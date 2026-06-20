const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, displayName = '' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hash = bcrypt.hashSync(password, 10);
  const id = uuid();
  db.prepare('INSERT INTO users (id, email, password, display_name) VALUES (?,?,?,?)').run(
    id, email.toLowerCase(), hash, displayName || email.split('@')[0]
  );

  const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(id);
  res.json({ token: signToken({ id: user.id, email: user.email }), user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  const { password: _p, ...safe } = user;
  res.json({ token: signToken({ id: user.id, email: user.email }), user: safe });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
