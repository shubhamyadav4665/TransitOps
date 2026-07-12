const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/expenses
router.get('/', async (req, res, next) => {
  try {
    const { vehicle_id, trip_id, category } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (vehicle_id) { conditions.push(`e.vehicle_id = $${idx++}`); params.push(vehicle_id); }
    if (trip_id)    { conditions.push(`e.trip_id = $${idx++}`);    params.push(trip_id); }
    if (category)   { conditions.push(`e.category = $${idx++}`);   params.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT e.*, v.name AS vehicle_name, v.registration_number,
              t.trip_number, u.name AS created_by_name
       FROM expenses e
       LEFT JOIN vehicles v ON e.vehicle_id = v.id
       LEFT JOIN trips t ON e.trip_id = t.id
       LEFT JOIN users u ON e.created_by = u.id
       ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      params
    );

    res.json({ success: true, expenses: result.rows, total: result.rows.length });
  } catch (err) { next(err); }
});

// POST /api/expenses
router.post(
  '/',
  [
    body('category').isIn(['Toll', 'Maintenance', 'Fuel', 'Insurance', 'Registration', 'Other'])
      .withMessage('Invalid category'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be >= 0'),
    body('expense_date').optional().isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { vehicle_id, trip_id, category, description, amount, expense_date } = req.body;

      const result = await pool.query(
        `INSERT INTO expenses (vehicle_id, trip_id, category, description, amount, expense_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [vehicle_id || null, trip_id || null, category, description, amount,
         expense_date || new Date().toISOString().split('T')[0], req.user.id]
      );

      res.status(201).json({ success: true, expense: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// PUT /api/expenses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    const e = existing.rows[0];
    const {
      category = e.category, description = e.description,
      amount = e.amount, expense_date = e.expense_date
    } = req.body;

    const result = await pool.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, expense_date=$4
       WHERE id=$5 RETURNING *`,
      [category, description, amount, expense_date, id]
    );

    res.json({ success: true, expense: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/expenses/:id
router.delete('/:id', authorize('Fleet Manager', 'Financial Analyst'), async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
