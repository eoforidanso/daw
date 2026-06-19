// Mock collaboration — sessions stored in localStorage.
// To connect a real backend, replace each method body with WebSocket / Supabase Realtime / Liveblocks calls.
// The interface stays the same; no other file changes needed.

const PREFIX = 'void_collab_';
const COLORS = ['#00d4b4','#4a9eff','#9b72ff','#ff6b35','#ffbe45','#ff4466'];

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getSession(code) {
  try { return JSON.parse(localStorage.getItem(`${PREFIX}${code}`) ?? 'null'); } catch { return null; }
}

function setSession(code, session) {
  localStorage.setItem(`${PREFIX}${code}`, JSON.stringify(session));
}

// Simulated remote users that "join" after delays
const MOCK_USERS = [
  { name: 'Nova',    avatar: 'NV' },
  { name: 'Kai',     avatar: 'KA' },
  { name: 'Reeve',   avatar: 'RE' },
  { name: 'Sable',   avatar: 'SB' },
];

const MOCK_EVENTS = [
  state => `${state.name}'s bass track is sounding great — maybe try sidechaining to the kick`,
  state => `BPM is ${state.bpm}, this vibe works for this tempo`,
  state => `Just opened the project — ${state.trackCount} tracks loaded`,
  state => `Added some automation on the reverb send`,
  state => `Quantized the hi-hat pattern`,
  state => `Tweaked the filter cutoff on the synth`,
];

export const CollabSync = {
  createSession(state, userName) {
    const code = genCode();
    const hostUser = {
      id: `u_${Date.now()}`,
      name: userName || 'Host',
      avatar: (userName || 'H').slice(0, 2).toUpperCase(),
      color: COLORS[0],
      isHost: true,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };
    const session = {
      code,
      hostId: hostUser.id,
      projectName: state.name ?? 'Untitled',
      bpm: state.bpm ?? 128,
      trackCount: (state.tracks ?? []).length,
      users: [hostUser],
      events: [],
      createdAt: Date.now(),
      snapshot: {
        tracks: state.tracks ?? [],
        clips: (state.clips ?? []).filter(c => c.type === 'midi').map(({ audioBuffer, ...c }) => c),
        steps: state.steps ?? {},
        bpm: state.bpm ?? 128,
        name: state.name ?? 'Untitled',
      },
    };
    setSession(code, session);
    return { code, user: hostUser };
  },

  joinSession(code, userName) {
    const session = getSession(code);
    if (!session) return null;

    const existing = session.users.find(u => u.name.toLowerCase() === (userName || '').toLowerCase());
    if (existing) return { session, user: existing };

    const color = COLORS[session.users.length % COLORS.length];
    const user = {
      id: `u_${Date.now()}`,
      name: userName || 'Guest',
      avatar: (userName || 'G').slice(0, 2).toUpperCase(),
      color,
      isHost: false,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };
    session.users.push(user);
    session.events.push({ userId: user.id, userName: user.name, color, text: 'joined the session', ts: Date.now() });
    setSession(code, session);
    return { session, user };
  },

  getSession,

  heartbeat(code, userId) {
    const session = getSession(code);
    if (!session) return null;
    session.users = session.users.map(u => u.id === userId ? { ...u, lastSeen: Date.now() } : u);
    setSession(code, session);
    return session;
  },

  pushEvent(code, userId, text) {
    const session = getSession(code);
    if (!session) return;
    const user = session.users.find(u => u.id === userId);
    if (!user) return;
    session.events = [...(session.events ?? []).slice(-49), { userId, userName: user.name, color: user.color, text, ts: Date.now() }];
    setSession(code, session);
  },

  leaveSession(code, userId) {
    const session = getSession(code);
    if (!session) return;
    const user = session.users.find(u => u.id === userId);
    session.users = session.users.filter(u => u.id !== userId);
    if (user) session.events.push({ userId, userName: user.name, color: user.color, text: 'left the session', ts: Date.now() });
    setSession(code, session);
  },

  endSession(code) {
    localStorage.removeItem(`${PREFIX}${code}`);
  },

  // Simulate a remote user joining and sending messages (dev/demo only)
  simulateActivity(code, hostState) {
    const mock = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
    const color = COLORS[1 + Math.floor(Math.random() * (COLORS.length - 1))];
    setTimeout(() => {
      const session = getSession(code);
      if (!session) return;
      const user = { id: `sim_${Date.now()}`, name: mock.name, avatar: mock.avatar, color, isHost: false, joinedAt: Date.now(), lastSeen: Date.now() };
      session.users.push(user);
      session.events.push({ userId: user.id, userName: user.name, color, text: 'joined the session', ts: Date.now() });
      setSession(code, session);

      const ctx = { name: session.projectName, bpm: session.bpm, trackCount: session.trackCount };
      const msgFn = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
      setTimeout(() => {
        const s = getSession(code);
        if (!s) return;
        s.events.push({ userId: user.id, userName: user.name, color, text: msgFn(ctx), ts: Date.now() });
        setSession(code, s);
      }, 4000 + Math.random() * 4000);
    }, 2500 + Math.random() * 2000);
  },

  COLORS,

  relativeTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  },
};
