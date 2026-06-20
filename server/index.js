require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, credentials: true },
});

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/projects', require('./src/routes/projects'));
app.use('/api/audio', require('./src/routes/audio'));

// health
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// socket collab
require('./src/socket/collab')(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`VOID Station server running on http://localhost:${PORT}`);
});
