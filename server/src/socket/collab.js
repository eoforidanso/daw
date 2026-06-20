const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

// in-memory room state (cleared on restart; persistent version would use Redis)
const rooms = new Map(); // code → { hostId, members: Map<socketId, {userId,displayName}>, project_id }

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

module.exports = function registerCollab(io) {
  // auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRow = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
    const displayName = userRow?.display_name || 'Unknown';

    // CREATE SESSION
    socket.on('collab:create', ({ project_id } = {}, ack) => {
      let code = generateCode();
      while (rooms.has(code)) code = generateCode();

      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 4; // 4 hours
      db.prepare(
        'INSERT INTO collab_sessions (code, project_id, host_id, expires_at) VALUES (?,?,?,?)'
      ).run(code, project_id || null, userId, expiresAt);

      rooms.set(code, {
        hostId: userId,
        project_id: project_id || null,
        members: new Map([[socket.id, { userId, displayName }]]),
      });

      socket.join(code);
      socket.currentRoom = code;
      ack?.({ ok: true, code });
    });

    // JOIN SESSION
    socket.on('collab:join', ({ code } = {}, ack) => {
      const room = rooms.get(code);
      if (!room) return ack?.({ ok: false, error: 'Session not found' });

      room.members.set(socket.id, { userId, displayName });
      socket.join(code);
      socket.currentRoom = code;

      const members = [...room.members.values()];
      socket.to(code).emit('collab:user_joined', { userId, displayName });
      ack?.({ ok: true, members, project_id: room.project_id });
    });

    // BROADCAST EVENT (patch, cursor, etc.)
    socket.on('collab:event', (event) => {
      const code = socket.currentRoom;
      if (!code) return;
      socket.to(code).emit('collab:event', { ...event, from: userId, fromName: displayName });
    });

    // CURSOR POSITION
    socket.on('collab:cursor', (pos) => {
      const code = socket.currentRoom;
      if (!code) return;
      socket.to(code).emit('collab:cursor', { pos, from: userId, fromName: displayName });
    });

    // LEAVE SESSION
    socket.on('collab:leave', () => leaveRoom(socket));
    socket.on('disconnect', () => leaveRoom(socket));

    function leaveRoom(s) {
      const code = s.currentRoom;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      room.members.delete(s.id);
      s.to(code).emit('collab:user_left', { userId, displayName });
      s.leave(code);
      s.currentRoom = null;
      if (room.members.size === 0) {
        rooms.delete(code);
        db.prepare('DELETE FROM collab_sessions WHERE code = ?').run(code);
      }
    }
  });
};
