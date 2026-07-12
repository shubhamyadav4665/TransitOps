const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/trips
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (search) {
      conditions.push(`(t.trip_number ILIKE $${idx} OR t.source ILIKE $${idx} OR t.destination ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT t.*,
              v.registration_number, v.name AS vehicle_name, v.type AS vehicle_type,
              d.name AS driver_name, d.license_number,
              u.name AS created_by_name
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       LEFT JOIN users u ON t.created_by = u.id
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );

    res.json({ success: true, trips: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
});

// GET /api/trips/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT t.*,
              v.registration_number, v.name AS vehicle_name, v.type AS vehicle_type, v.max_load_capacity,
              d.name AS driver_name, d.license_number, d.contact_number AS driver_contact,
              u.name AS created_by_name
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       JOIN drivers d ON t.driver_id = d.id
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Fuel logs for this trip
    const fuelLogs = await pool.query(
      'SELECT * FROM fuel_logs WHERE trip_id = $1 ORDER BY fuel_date',
      [id]
    );

    // Expenses for this trip
    const expenses = await pool.query(
      'SELECT * FROM expenses WHERE trip_id = $1 ORDER BY expense_date',
      [id]
    );

    res.json({
      success: true,
      trip: result.rows[0],
      fuelLogs: fuelLogs.rows,
      expenses: expenses.rows
    });
  } catch (err) { next(err); }
});

// POST /api/trips - create trip (Draft)
router.post(
  '/',
  authorize('Fleet Manager', 'Dispatcher'),
  [
    body('source').notEmpty().withMessage('Source is required'),
    body('destination').notEmpty().withMessage('Destination is required'),
    body('vehicle_id').isInt({ min: 1 }).withMessage('Valid vehicle_id required'),
    body('driver_id').isInt({ min: 1 }).withMessage('Valid driver_id required'),
    body('cargo_weight').isFloat({ min: 0 }).withMessage('Cargo weight must be >= 0'),
    body('planned_distance').optional().isFloat({ min: 0 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { source, destination, vehicle_id, driver_id, cargo_weight,
              planned_distance, revenue = 0, notes } = req.body;

      // --- Business Rule Validations ---

      // 1. Validate vehicle
      const vehicleRes = await pool.query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
      if (!vehicleRes.rows.length) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      const vehicle = vehicleRes.rows[0];

      if (vehicle.status === 'Retired' || vehicle.status === 'In Shop') {
        return res.status(400).json({
          success: false,
          message: `Vehicle is '${vehicle.status}' and cannot be dispatched`
        });
      }
      if (vehicle.status === 'On Trip') {
        return res.status(400).json({
          success: false,
          message: 'Vehicle is already On Trip and cannot be assigned to another trip'
        });
      }

      // 2. Validate cargo weight
      if (parseFloat(cargo_weight) > parseFloat(vehicle.max_load_capacity)) {
        return res.status(400).json({
          success: false,
          message: `Cargo weight (${cargo_weight} kg) exceeds vehicle max load capacity (${vehicle.max_load_capacity} kg)`
        });
      }

      // 3. Validate driver
      const driverRes = await pool.query('SELECT * FROM drivers WHERE id = $1', [driver_id]);
      if (!driverRes.rows.length) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }
      const driver = driverRes.rows[0];

      if (driver.status === 'Suspended') {
        return res.status(400).json({ success: false, message: 'Suspended drivers cannot be assigned to trips' });
      }
      if (driver.status === 'On Trip') {
        return res.status(400).json({ success: false, message: 'Driver is already On Trip' });
      }
      if (new Date(driver.license_expiry_date) < new Date()) {
        return res.status(400).json({
          success: false,
          message: `Driver license expired on ${driver.license_expiry_date}`
        });
      }

      // Generate trip number
      const countRes = await pool.query('SELECT COUNT(*) FROM trips');
      const tripNumber = `TRIP-${String(parseInt(countRes.rows[0].count) + 1).padStart(4, '0')}`;

      const result = await pool.query(
        `INSERT INTO trips (trip_number, source, destination, vehicle_id, driver_id,
           cargo_weight, planned_distance, revenue, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Draft',$10)
         RETURNING *`,
        [tripNumber, source, destination, vehicle_id, driver_id,
         cargo_weight, planned_distance, revenue, notes, req.user.id]
      );

      res.status(201).json({ success: true, trip: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// PATCH /api/trips/:id/dispatch - Draft → Dispatched
router.patch('/:id/dispatch', authorize('Fleet Manager', 'Dispatcher'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1', [id]);
    if (!tripRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    const trip = tripRes.rows[0];
    if (trip.status !== 'Draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Trip is '${trip.status}', only Draft trips can be dispatched` });
    }

    // Re-validate vehicle & driver status at dispatch time
    const vRes = await client.query('SELECT status, max_load_capacity FROM vehicles WHERE id = $1', [trip.vehicle_id]);
    const dRes = await client.query('SELECT status, license_expiry_date FROM drivers WHERE id = $1', [trip.driver_id]);

    if (vRes.rows[0].status !== 'Available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Vehicle is no longer available (status: ${vRes.rows[0].status})` });
    }
    if (dRes.rows[0].status !== 'Available') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Driver is no longer available (status: ${dRes.rows[0].status})` });
    }
    if (new Date(dRes.rows[0].license_expiry_date) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Driver license has expired' });
    }

    // Get vehicle odometer for start_odometer
    const vDetailRes = await client.query('SELECT odometer FROM vehicles WHERE id = $1', [trip.vehicle_id]);

    // Update trip status
    await client.query(
      `UPDATE trips SET status = 'Dispatched', dispatched_at = NOW(),
         start_odometer = $1, updated_at = NOW()
       WHERE id = $2`,
      [vDetailRes.rows[0].odometer, id]
    );

    // Update vehicle and driver status to On Trip
    await client.query(
      `UPDATE vehicles SET status = 'On Trip', updated_at = NOW() WHERE id = $1`,
      [trip.vehicle_id]
    );
    await client.query(
      `UPDATE drivers SET status = 'On Trip', updated_at = NOW() WHERE id = $1`,
      [trip.driver_id]
    );

    await client.query('COMMIT');

    const updatedTrip = await pool.query(
      `SELECT t.*, v.registration_number, v.name AS vehicle_name, d.name AS driver_name
       FROM trips t JOIN vehicles v ON t.vehicle_id=v.id JOIN drivers d ON t.driver_id=d.id
       WHERE t.id=$1`, [id]
    );

    res.json({ success: true, trip: updatedTrip.rows[0], message: 'Trip dispatched successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/trips/:id/complete - Dispatched → Completed
router.patch(
  '/:id/complete',
  authorize('Fleet Manager', 'Dispatcher'),
  [
    body('end_odometer').isFloat({ min: 0 }).withMessage('End odometer is required'),
    body('fuel_consumed').optional().isFloat({ min: 0 })
  ],
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const { end_odometer, fuel_consumed, revenue } = req.body;

      await client.query('BEGIN');

      const tripRes = await client.query('SELECT * FROM trips WHERE id = $1', [id]);
      if (!tripRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Trip not found' });
      }

      const trip = tripRes.rows[0];
      if (trip.status !== 'Dispatched') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Trip is '${trip.status}', only Dispatched trips can be completed` });
      }

      if (parseFloat(end_odometer) < parseFloat(trip.start_odometer)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'End odometer cannot be less than start odometer' });
      }

      const actualDistance = parseFloat(end_odometer) - parseFloat(trip.start_odometer);

      // Update trip
      await client.query(
        `UPDATE trips SET status = 'Completed', end_odometer = $1, actual_distance = $2,
           fuel_consumed = $3, revenue = COALESCE($4, revenue), completed_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [end_odometer, actualDistance, fuel_consumed, revenue, id]
      );

      // Update vehicle odometer and status
      await client.query(
        `UPDATE vehicles SET status = 'Available', odometer = $1, updated_at = NOW() WHERE id = $2`,
        [end_odometer, trip.vehicle_id]
      );

      // Update driver status
      await client.query(
        `UPDATE drivers SET status = 'Available', updated_at = NOW() WHERE id = $1`,
        [trip.driver_id]
      );

      // Auto-create fuel log if fuel_consumed provided
      if (fuel_consumed && parseFloat(fuel_consumed) > 0) {
        await client.query(
          `INSERT INTO fuel_logs (vehicle_id, trip_id, liters, total_cost, odometer_reading, fuel_date, created_by)
           VALUES ($1, $2, $3, 0, $4, CURRENT_DATE, $5)`,
          [trip.vehicle_id, id, fuel_consumed, end_odometer, req.user.id]
        );
      }

      await client.query('COMMIT');

      const updatedTrip = await pool.query(
        `SELECT t.*, v.registration_number, v.name AS vehicle_name, d.name AS driver_name
         FROM trips t JOIN vehicles v ON t.vehicle_id=v.id JOIN drivers d ON t.driver_id=d.id
         WHERE t.id=$1`, [id]
      );

      res.json({ success: true, trip: updatedTrip.rows[0], message: 'Trip completed successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PATCH /api/trips/:id/cancel - Cancel a Draft or Dispatched trip
router.patch('/:id/cancel', authorize('Fleet Manager', 'Dispatcher'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1', [id]);
    if (!tripRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    const trip = tripRes.rows[0];
    if (trip.status === 'Completed' || trip.status === 'Cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Trip is already '${trip.status}'` });
    }

    await client.query(
      `UPDATE trips SET status = 'Cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Restore vehicle and driver to Available if trip was dispatched
    if (trip.status === 'Dispatched') {
      await client.query(
        `UPDATE vehicles SET status = 'Available', updated_at = NOW() WHERE id = $1`,
        [trip.vehicle_id]
      );
      await client.query(
        `UPDATE drivers SET status = 'Available', updated_at = NOW() WHERE id = $1`,
        [trip.driver_id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Trip cancelled successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/trips/:id - update trip details (Draft only)
router.put('/:id', authorize('Fleet Manager', 'Dispatcher'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tripRes = await pool.query('SELECT * FROM trips WHERE id = $1', [id]);
    if (!tripRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }
    if (tripRes.rows[0].status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Only Draft trips can be edited' });
    }

    const t = tripRes.rows[0];
    const { source = t.source, destination = t.destination, cargo_weight = t.cargo_weight,
            planned_distance = t.planned_distance, revenue = t.revenue, notes = t.notes } = req.body;

    const result = await pool.query(
      `UPDATE trips SET source=$1, destination=$2, cargo_weight=$3,
         planned_distance=$4, revenue=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [source, destination, cargo_weight, planned_distance, revenue, notes, id]
    );

    res.json({ success: true, trip: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
