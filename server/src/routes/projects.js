const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/projects
router.get('/', (req, res) => {
  const projects = db.prepare(
    'SELECT id, name, bpm, updated_at, created_at FROM projects WHERE owner_id = ? ORDER BY updated_at DESC'
  ).all(req.user.id);
  res.json({ projects });
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name = 'Untitled', bpm = 120, state } = req.body;
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    'INSERT INTO projects (id, owner_id, name, bpm, updated_at, created_at) VALUES (?,?,?,?,?,?)'
  ).run(id, req.user.id, name, bpm, now, now);

  if (state) {
    db.prepare(
      'INSERT INTO project_versions (id, project_id, state_json, label, created_at) VALUES (?,?,?,?,?)'
    ).run(uuid(), id, JSON.stringify(state), 'initial', now);
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ project });
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const latest = db.prepare(
    'SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(req.params.id);

  res.json({ project, state: latest ? JSON.parse(latest.state_json) : null });
});

// PUT /api/projects/:id — save/push new version
router.put('/:id', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const { name, bpm, state, label = '' } = req.body;
  const now = Math.floor(Date.now() / 1000);

  const updates = [];
  const vals = [];
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (bpm !== undefined) { updates.push('bpm = ?'); vals.push(bpm); }
  updates.push('updated_at = ?'); vals.push(now);
  vals.push(req.params.id);

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

  if (state !== undefined) {
    db.prepare(
      'INSERT INTO project_versions (id, project_id, state_json, label, created_at) VALUES (?,?,?,?,?)'
    ).run(uuid(), req.params.id, JSON.stringify(state), label, now);

    // keep only 20 versions per project
    const old = db.prepare(
      'SELECT id FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 20'
    ).all(req.params.id);
    if (old.length) {
      const ids = old.map(r => r.id);
      db.prepare(`DELETE FROM project_versions WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
    }
  }

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project: updated });
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ? AND owner_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// GET /api/projects/:id/versions
router.get('/:id/versions', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const versions = db.prepare(
    'SELECT id, label, created_at FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.params.id);
  res.json({ versions });
});

// GET /api/projects/:id/versions/:vid
router.get('/:id/versions/:vid', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const version = db.prepare('SELECT * FROM project_versions WHERE id = ? AND project_id = ?').get(req.params.vid, req.params.id);
  if (!version) return res.status(404).json({ error: 'Version not found' });

  res.json({ version: { ...version, state: JSON.parse(version.state_json) } });
});

module.exports = router;
