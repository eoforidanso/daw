const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.use(requireAuth);

// GET /api/audio — list user's files
router.get('/', (req, res) => {
  const { project_id } = req.query;
  const query = project_id
    ? 'SELECT id, filename, original_name, size, project_id, created_at FROM audio_files WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC'
    : 'SELECT id, filename, original_name, size, project_id, created_at FROM audio_files WHERE owner_id = ? ORDER BY created_at DESC';
  const args = project_id ? [req.user.id, project_id] : [req.user.id];
  res.json({ files: db.prepare(query).all(...args) });
});

// POST /api/audio — upload a file
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid audio file uploaded' });

  const id = uuid();
  const { project_id } = req.body;
  db.prepare(
    'INSERT INTO audio_files (id, owner_id, project_id, filename, original_name, size) VALUES (?,?,?,?,?,?)'
  ).run(id, req.user.id, project_id || null, req.file.filename, req.file.originalname, req.file.size);

  res.status(201).json({
    file: {
      id,
      filename: req.file.filename,
      original_name: req.file.originalname,
      size: req.file.size,
      url: `/api/audio/${id}/download`,
    },
  });
});

// GET /api/audio/:id/download
router.get('/:id/download', (req, res) => {
  const row = db.prepare('SELECT * FROM audio_files WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

  res.download(filePath, row.original_name);
});

// DELETE /api/audio/:id
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM audio_files WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, row.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM audio_files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
