const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/fuel - list fuel logs
router.get('/', async (req, res, next) => {
  try {
    const { vehicle_id, trip_id } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (vehicle_id) { conditions.push(`fl.vehicle_id = $${idx++}`); params.push(vehicle_id); }
    if (trip_id)    { conditions.push(`fl.trip_id = $${idx++}`);    params.push(trip_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT fl.*, v.name AS vehicle_name, v.registration_number,
              t.trip_number, u.name AS created_by_name
       FROM fuel_logs fl
       JOIN vehicles v ON fl.vehicle_id = v.id
       LEFT JOIN trips t ON fl.trip_id = t.id
       LEFT JOIN users u ON fl.created_by = u.id
       ${where}
       ORDER BY fl.fuel_date DESC, fl.created_at DESC`,
      params
    );

    res.json({ success: true, fuelLogs: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
});

// POST /api/fuel - create fuel log
router.post(
  '/',
  [
    body('vehicle_id').isInt({ min: 1 }).withMessage('Valid vehicle_id required'),
    body('liters').isFloat({ min: 0.01 }).withMessage('Liters must be > 0'),
    body('total_cost').isFloat({ min: 0 }).withMessage('Total cost must be >= 0'),
    body('fuel_date').optional().isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { vehicle_id, trip_id, liters, cost_per_liter, total_cost,
              odometer_reading, fuel_date, station_name, notes } = req.body;

      // Validate vehicle exists
      const vRes = await pool.query('SELECT id FROM vehicles WHERE id = $1', [vehicle_id]);
      if (!vRes.rows.length) {
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }

      const result = await pool.query(
        `INSERT INTO fuel_logs (vehicle_id, trip_id, liters, cost_per_liter, total_cost,
           odometer_reading, fuel_date, station_name, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [vehicle_id, trip_id || null, liters, cost_per_liter, total_cost,
         odometer_reading, fuel_date || new Date().toISOString().split('T')[0],
         station_name, notes, req.user.id]
      );

      res.status(201).json({ success: true, fuelLog: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// PUT /api/fuel/:id - update fuel log
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM fuel_logs WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Fuel log not found' });
    }
    const fl = existing.rows[0];
    const {
      liters = fl.liters, cost_per_liter = fl.cost_per_liter,
      total_cost = fl.total_cost, odometer_reading = fl.odometer_reading,
      fuel_date = fl.fuel_date, station_name = fl.station_name, notes = fl.notes
    } = req.body;

    const result = await pool.query(
      `UPDATE fuel_logs SET liters=$1, cost_per_liter=$2, total_cost=$3,
         odometer_reading=$4, fuel_date=$5, station_name=$6, notes=$7
       WHERE id=$8 RETURNING *`,
      [liters, cost_per_liter, total_cost, odometer_reading, fuel_date, station_name, notes, id]
    );

    res.json({ success: true, fuelLog: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/fuel/:id
router.delete('/:id', authorize('Fleet Manager', 'Financial Analyst'), async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM fuel_logs WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Fuel log not found' });
    }
    res.json({ success: true, message: 'Fuel log deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
