const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password } = req.body;

      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.password_hash, u.is_active, r.id AS role_id, r.name AS role
         FROM users u JOIN roles r ON u.role_id = r.id
         WHERE u.email = $1`,
        [email]
      );

      if (!result.rows.length) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ success: false, message: 'Account is inactive' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/register (admin only – Fleet Manager creates users)
router.post(
  '/register',
  authenticate,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role_id').isInt({ min: 1 }).withMessage('Valid role_id is required')
  ],
  async (req, res, next) => {
    try {
      if (req.user.role !== 'Fleet Manager') {
        return res.status(403).json({ success: false, message: 'Only Fleet Managers can create users' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, email, password, role_id } = req.body;

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role_id, is_active, created_at`,
        [name, email, password_hash, role_id]
      );

      res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/roles
router.get('/roles', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM roles ORDER BY id');
    res.json({ success: true, roles: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
