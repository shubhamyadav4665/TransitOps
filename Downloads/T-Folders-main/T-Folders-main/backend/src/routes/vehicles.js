const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/vehicles - list all vehicles with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { status, type, region, search } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`v.status = $${idx++}`); params.push(status); }
    if (type)   { conditions.push(`v.type = $${idx++}`);   params.push(type); }
    if (region) { conditions.push(`v.region ILIKE $${idx++}`); params.push(`%${region}%`); }
    if (search) {
      conditions.push(`(v.registration_number ILIKE $${idx} OR v.name ILIKE $${idx} OR v.model ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT v.*,
        COALESCE(SUM(fl.total_cost), 0) AS total_fuel_cost,
        COALESCE(SUM(ml.cost), 0) AS total_maintenance_cost
       FROM vehicles v
       LEFT JOIN fuel_logs fl ON fl.vehicle_id = v.id
       LEFT JOIN maintenance_logs ml ON ml.vehicle_id = v.id
       ${where}
       GROUP BY v.id
       ORDER BY v.created_at DESC`,
      params
    );

    res.json({ success: true, vehicles: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
});

// GET /api/vehicles/available - only available vehicles for dispatch
router.get('/available', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, registration_number, name, model, type, max_load_capacity, odometer, region
       FROM vehicles WHERE status = 'Available' ORDER BY name`
    );
    res.json({ success: true, vehicles: result.rows });
  } catch (err) { next(err); }
});

// GET /api/vehicles/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT v.*,
        COALESCE(SUM(fl.total_cost), 0) AS total_fuel_cost,
        COALESCE(SUM(ml.cost), 0) AS total_maintenance_cost,
        COALESCE(SUM(fl.liters), 0) AS total_fuel_liters
       FROM vehicles v
       LEFT JOIN fuel_logs fl ON fl.vehicle_id = v.id
       LEFT JOIN maintenance_logs ml ON ml.vehicle_id = v.id
       WHERE v.id = $1
       GROUP BY v.id`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // Recent trips
    const trips = await pool.query(
      `SELECT t.id, t.trip_number, t.source, t.destination, t.status,
              t.actual_distance, t.fuel_consumed, t.revenue, t.completed_at
       FROM trips t WHERE t.vehicle_id = $1 ORDER BY t.created_at DESC LIMIT 5`,
      [id]
    );

    // Recent maintenance
    const maintenance = await pool.query(
      `SELECT id, maintenance_type, description, cost, status, scheduled_date, completed_date
       FROM maintenance_logs WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [id]
    );

    res.json({
      success: true,
      vehicle: result.rows[0],
      recentTrips: trips.rows,
      recentMaintenance: maintenance.rows
    });
  } catch (err) { next(err); }
});

// POST /api/vehicles - create vehicle (Fleet Manager only)
router.post(
  '/',
  authorize('Fleet Manager'),
  [
    body('registration_number').notEmpty().withMessage('Registration number is required'),
    body('name').notEmpty().withMessage('Vehicle name is required'),
    body('type').isIn(['Truck', 'Van', 'Bus', 'Pickup', 'Tanker', 'Trailer', 'Other']).withMessage('Invalid vehicle type'),
    body('max_load_capacity').isFloat({ min: 1 }).withMessage('Max load capacity must be > 0'),
    body('acquisition_cost').optional().isFloat({ min: 0 }),
    body('odometer').optional().isFloat({ min: 0 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { registration_number, name, model, type, max_load_capacity,
              odometer = 0, acquisition_cost = 0, region, year, fuel_type } = req.body;

      // Check unique registration
      const existing = await pool.query(
        'SELECT id FROM vehicles WHERE registration_number = $1', [registration_number]
      );
      if (existing.rows.length) {
        return res.status(409).json({ success: false, message: 'Registration number already exists' });
      }

      const result = await pool.query(
        `INSERT INTO vehicles (registration_number, name, model, type, max_load_capacity,
           odometer, acquisition_cost, status, region, year, fuel_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Available',$8,$9,$10)
         RETURNING *`,
        [registration_number, name, model, type, max_load_capacity,
         odometer, acquisition_cost, region, year, fuel_type || 'Diesel']
      );

      res.status(201).json({ success: true, vehicle: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// PUT /api/vehicles/:id - update vehicle
router.put(
  '/:id',
  authorize('Fleet Manager'),
  [
    body('type').optional().isIn(['Truck', 'Van', 'Bus', 'Pickup', 'Tanker', 'Trailer', 'Other']),
    body('status').optional().isIn(['Available', 'On Trip', 'In Shop', 'Retired']),
    body('max_load_capacity').optional().isFloat({ min: 1 }),
    body('acquisition_cost').optional().isFloat({ min: 0 }),
    body('odometer').optional().isFloat({ min: 0 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const existing = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
      if (!existing.rows.length) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      const v = existing.rows[0];
      const {
        name = v.name, model = v.model, type = v.type,
        max_load_capacity = v.max_load_capacity, odometer = v.odometer,
        acquisition_cost = v.acquisition_cost, status = v.status,
        region = v.region, year = v.year, fuel_type = v.fuel_type
      } = req.body;

      const result = await pool.query(
        `UPDATE vehicles SET name=$1, model=$2, type=$3, max_load_capacity=$4,
           odometer=$5, acquisition_cost=$6, status=$7, region=$8, year=$9,
           fuel_type=$10, updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [name, model, type, max_load_capacity, odometer, acquisition_cost,
         status, region, year, fuel_type, id]
      );

      res.json({ success: true, vehicle: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// DELETE /api/vehicles/:id - retire (soft) vehicle
router.delete('/:id', authorize('Fleet Manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT status FROM vehicles WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    if (existing.rows[0].status === 'On Trip') {
      return res.status(400).json({ success: false, message: 'Cannot retire a vehicle that is On Trip' });
    }

    await pool.query(
      `UPDATE vehicles SET status = 'Retired', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Vehicle retired successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
