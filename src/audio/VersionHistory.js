const KEY = 'void_versions';
const MAX = 20;

function stripAudio(clips) {
  return (clips ?? [])
    .filter(c => c.type === 'midi')
    .map(({ audioBuffer, waveformData, ...c }) => c);
}

export const VersionHistory = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  },

  snapshot(state, label) {
    const now = Date.now();
    const clips = stripAudio(state.clips);
    const entry = {
      id: `v_${now}`,
      label: label ?? `Snapshot ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      projectName: state.name ?? 'Untitled',
      bpm: state.bpm ?? 128,
      tracks: state.tracks ?? [],
      clips,
      autoLanes: state.autoLanes ?? [],
      steps: state.steps ?? {},
      warpMarkers: state.warpMarkers ?? {},
      savedAt: now,
      trackCount: (state.tracks ?? []).length,
      clipCount: clips.length,
    };
    const list = [entry, ...this.getAll()].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
    return entry;
  },

  get(id) {
    return this.getAll().find(v => v.id === id) ?? null;
  },

  remove(id) {
    localStorage.setItem(KEY, JSON.stringify(this.getAll().filter(v => v.id !== id)));
  },

  rename(id, label) {
    if (!label?.trim()) return;
    localStorage.setItem(KEY, JSON.stringify(
      this.getAll().map(v => v.id === id ? { ...v, label: label.trim() } : v)
    ));
  },

  clear() { localStorage.removeItem(KEY); },

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
