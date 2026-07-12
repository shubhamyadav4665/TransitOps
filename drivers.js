const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/drivers - list all drivers
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR license_number ILIKE $${idx} OR contact_number ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT *,
        CASE WHEN license_expiry_date < CURRENT_DATE THEN true ELSE false END AS license_expired,
        CASE WHEN license_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN true ELSE false END AS license_expiring_soon
       FROM drivers ${where}
       ORDER BY created_at DESC`,
      params
    );

    res.json({ success: true, drivers: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
});

// GET /api/drivers/available - available drivers for dispatch
router.get('/available', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, license_number, license_category, license_expiry_date, safety_score
       FROM drivers
       WHERE status = 'Available'
         AND license_expiry_date >= CURRENT_DATE
       ORDER BY name`
    );
    res.json({ success: true, drivers: result.rows });
  } catch (err) { next(err); }
});

// GET /api/drivers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT *,
        CASE WHEN license_expiry_date < CURRENT_DATE THEN true ELSE false END AS license_expired
       FROM drivers WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Trip history
    const trips = await pool.query(
      `SELECT t.id, t.trip_number, t.source, t.destination, t.status,
              t.actual_distance, t.completed_at, v.name AS vehicle_name
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.driver_id = $1
       ORDER BY t.created_at DESC LIMIT 10`,
      [id]
    );

    res.json({ success: true, driver: result.rows[0], tripHistory: trips.rows });
  } catch (err) { next(err); }
});

// POST /api/drivers - create driver
router.post(
  '/',
  authorize('Fleet Manager', 'Safety Officer'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('license_number').notEmpty().withMessage('License number is required'),
    body('license_category').notEmpty().withMessage('License category is required'),
    body('license_expiry_date').isISO8601().withMessage('Valid license expiry date required'),
    body('contact_number').optional().notEmpty(),
    body('safety_score').optional().isFloat({ min: 0, max: 100 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, license_number, license_category, license_expiry_date,
              contact_number, email, safety_score = 100, address } = req.body;

      const existing = await pool.query(
        'SELECT id FROM drivers WHERE license_number = $1', [license_number]
      );
      if (existing.rows.length) {
        return res.status(409).json({ success: false, message: 'License number already registered' });
      }

      const result = await pool.query(
        `INSERT INTO drivers (name, license_number, license_category, license_expiry_date,
           contact_number, email, safety_score, status, address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Available',$8)
         RETURNING *`,
        [name, license_number, license_category, license_expiry_date,
         contact_number, email, safety_score, address]
      );

      res.status(201).json({ success: true, driver: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// PUT /api/drivers/:id - update driver
router.put(
  '/:id',
  authorize('Fleet Manager', 'Safety Officer'),
  [
    body('status').optional().isIn(['Available', 'On Trip', 'Off Duty', 'Suspended']),
    body('safety_score').optional().isFloat({ min: 0, max: 100 }),
    body('license_expiry_date').optional().isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id } = req.params;
      const existing = await pool.query('SELECT * FROM drivers WHERE id = $1', [id]);
      if (!existing.rows.length) {
        return res.status(404).json({ success: false, message: 'Driver not found' });
      }

      const d = existing.rows[0];
      const {
        name = d.name, license_number = d.license_number,
        license_category = d.license_category,
        license_expiry_date = d.license_expiry_date,
        contact_number = d.contact_number, email = d.email,
        safety_score = d.safety_score, status = d.status,
        address = d.address
      } = req.body;

      const result = await pool.query(
        `UPDATE drivers SET name=$1, license_number=$2, license_category=$3,
           license_expiry_date=$4, contact_number=$5, email=$6, safety_score=$7,
           status=$8, address=$9, updated_at=NOW()
         WHERE id=$10 RETURNING *`,
        [name, license_number, license_category, license_expiry_date,
         contact_number, email, safety_score, status, address, id]
      );

      res.json({ success: true, driver: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// DELETE /api/drivers/:id - suspend driver
router.delete('/:id', authorize('Fleet Manager', 'Safety Officer'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT status FROM drivers WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    if (existing.rows[0].status === 'On Trip') {
      return res.status(400).json({ success: false, message: 'Cannot suspend a driver currently On Trip' });
    }

    await pool.query(
      `UPDATE drivers SET status = 'Suspended', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Driver suspended successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
