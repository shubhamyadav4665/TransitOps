const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/maintenance
router.get('/', async (req, res, next) => {
  try {
    const { status, vehicle_id, search } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`ml.status = $${idx++}`); params.push(status); }
    if (vehicle_id) { conditions.push(`ml.vehicle_id = $${idx++}`); params.push(vehicle_id); }
    if (search) {
      conditions.push(`(ml.maintenance_type ILIKE $${idx} OR ml.description ILIKE $${idx} OR v.name ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ml.*, v.name AS vehicle_name, v.registration_number, v.type AS vehicle_type,
              u.name AS created_by_name
       FROM maintenance_logs ml
       JOIN vehicles v ON ml.vehicle_id = v.id
       LEFT JOIN users u ON ml.created_by = u.id
       ${where}
       ORDER BY ml.created_at DESC`,
      params
    );

    res.json({ success: true, maintenance: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
});

// GET /api/maintenance/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ml.*, v.name AS vehicle_name, v.registration_number, v.status AS vehicle_status,
              u.name AS created_by_name
       FROM maintenance_logs ml
       JOIN vehicles v ON ml.vehicle_id = v.id
       LEFT JOIN users u ON ml.created_by = u.id
       WHERE ml.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }
    res.json({ success: true, maintenance: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/maintenance - create maintenance record → vehicle becomes In Shop
router.post(
  '/',
  authorize('Fleet Manager'),
  [
    body('vehicle_id').isInt({ min: 1 }).withMessage('Valid vehicle_id required'),
    body('maintenance_type').notEmpty().withMessage('Maintenance type is required'),
    body('cost').optional().isFloat({ min: 0 }),
    body('scheduled_date').optional().isISO8601()
  ],
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { vehicle_id, maintenance_type, description, cost = 0,
              scheduled_date, technician, service_center } = req.body;

      await client.query('BEGIN');

      // Validate vehicle
      const vRes = await client.query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
      if (!vRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Vehicle not found' });
      }
      if (vRes.rows[0].status === 'On Trip') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Cannot add maintenance to a vehicle that is On Trip' });
      }
      if (vRes.rows[0].status === 'Retired') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Cannot add maintenance to a Retired vehicle' });
      }

      // Create maintenance record (status = Active)
      const result = await client.query(
        `INSERT INTO maintenance_logs (vehicle_id, maintenance_type, description, cost,
           status, scheduled_date, technician, service_center, created_by)
         VALUES ($1,$2,$3,$4,'Active',$5,$6,$7,$8)
         RETURNING *`,
        [vehicle_id, maintenance_type, description, cost,
         scheduled_date || null, technician, service_center, req.user.id]
      );

      // Automatically set vehicle status to In Shop
      await client.query(
        `UPDATE vehicles SET status = 'In Shop', updated_at = NOW() WHERE id = $1`,
        [vehicle_id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        maintenance: result.rows[0],
        message: `Vehicle status updated to 'In Shop'`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PATCH /api/maintenance/:id/close - Complete maintenance → vehicle back to Available
router.patch(
  '/:id/close',
  authorize('Fleet Manager'),
  [
    body('completed_date').optional().isISO8601(),
    body('cost').optional().isFloat({ min: 0 })
  ],
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { completed_date, cost, technician, service_center } = req.body;

      await client.query('BEGIN');

      const mlRes = await client.query('SELECT * FROM maintenance_logs WHERE id = $1', [id]);
      if (!mlRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Maintenance record not found' });
      }

      const ml = mlRes.rows[0];
      if (ml.status === 'Completed') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Maintenance record is already completed' });
      }

      // Update maintenance record
      await client.query(
        `UPDATE maintenance_logs SET status = 'Completed',
           completed_date = $1, cost = COALESCE($2, cost),
           technician = COALESCE($3, technician),
           service_center = COALESCE($4, service_center),
           updated_at = NOW()
         WHERE id = $5`,
        [completed_date || new Date().toISOString().split('T')[0], cost, technician, service_center, id]
      );

      // Check if there are other active maintenance records for the same vehicle
      const otherActive = await client.query(
        `SELECT COUNT(*) FROM maintenance_logs
         WHERE vehicle_id = $1 AND status = 'Active' AND id != $2`,
        [ml.vehicle_id, id]
      );

      // Only restore to Available if no other active maintenance AND vehicle not retired
      if (parseInt(otherActive.rows[0].count) === 0) {
        const vRes = await client.query('SELECT status FROM vehicles WHERE id = $1', [ml.vehicle_id]);
        if (vRes.rows[0].status !== 'Retired') {
          await client.query(
            `UPDATE vehicles SET status = 'Available', updated_at = NOW() WHERE id = $1`,
            [ml.vehicle_id]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Maintenance completed. Vehicle restored to Available.' });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// PUT /api/maintenance/:id - update maintenance record
router.put('/:id', authorize('Fleet Manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const mlRes = await pool.query('SELECT * FROM maintenance_logs WHERE id = $1', [id]);
    if (!mlRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }
    const ml = mlRes.rows[0];

    const {
      maintenance_type = ml.maintenance_type,
      description = ml.description,
      cost = ml.cost,
      scheduled_date = ml.scheduled_date,
      technician = ml.technician,
      service_center = ml.service_center
    } = req.body;

    const result = await pool.query(
      `UPDATE maintenance_logs SET maintenance_type=$1, description=$2, cost=$3,
         scheduled_date=$4, technician=$5, service_center=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [maintenance_type, description, cost, scheduled_date, technician, service_center, id]
    );

    res.json({ success: true, maintenance: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
