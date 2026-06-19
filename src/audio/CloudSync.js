// Mock cloud provider — all data stored in localStorage.
// To connect a real backend, replace each method body:
//   signIn   → POST /auth/login
//   push     → PUT  /projects/:name
//   listProjects → GET /projects
//   pull     → GET  /projects/:id
// The interface stays the same; no other file changes.

const USER_KEY     = 'void_cloud_user';
const PROJECTS_KEY = 'void_cloud_projects';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function stripAudio(clips) {
  return (clips ?? [])
    .filter(c => c.type === 'midi')
    .map(({ audioBuffer, waveformData, ...c }) => c);
}

export const CloudSync = {
  // ── Auth ─────────────────────────────────────────────────────────
  getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
  },

  async signIn(email) {
    await delay(900);
    const user = {
      email,
      displayName: email.split('@')[0],
      uid: `u_${Date.now()}`,
      signedInAt: Date.now(),
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  async signOut() {
    await delay(200);
    localStorage.removeItem(USER_KEY);
  },

  // ── Projects ─────────────────────────────────────────────────────
  async listProjects() {
    await delay(600);
    try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '[]'); } catch { return []; }
  },

  async push(state) {
    await delay(1100);
    const entry = {
      id:          `p_${Date.now()}`,
      projectName: state.name ?? 'Untitled',
      bpm:         state.bpm ?? 128,
      tracks:      state.tracks ?? [],
      clips:       stripAudio(state.clips),
      autoLanes:   state.autoLanes ?? [],
      steps:       state.steps ?? {},
      warpMarkers: state.warpMarkers ?? {},
      pushedAt:    Date.now(),
    };
    const existing = await this.listProjects();
    const updated  = [entry, ...existing.filter(p => p.projectName !== entry.projectName)];
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
    return entry;
  },

  async pull(projectId) {
    await delay(750);
    const list = await this.listProjects();
    return list.find(p => p.id === projectId) ?? null;
  },

  async deleteProject(projectId) {
    await delay(400);
    const list = await this.listProjects();
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list.filter(p => p.id !== projectId)));
  },

  // ── Helpers ───────────────────────────────────────────────────────
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
