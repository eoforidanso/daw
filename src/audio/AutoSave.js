const DRAFT_KEY   = 'void_draft';
const RECENTS_KEY = 'void_recents';
const MAX_RECENTS = 5;

function stripAudio(clips) {
  return (clips ?? [])
    .filter(c => c.type === 'midi')
    .map(({ audioBuffer, waveformData, ...c }) => c);
}

export const AutoSave = {
  serialize(state) {
    return {
      version:     1,
      projectName: state.name,
      bpm:         state.bpm,
      tracks:      state.tracks ?? [],
      clips:       stripAudio(state.clips),
      autoLanes:   state.autoLanes ?? [],
      steps:       state.steps ?? {},
      warpMarkers: state.warpMarkers ?? {},
      savedAt:     Date.now(),
    };
  },

  saveDraft(state) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(this.serialize(state)));
    } catch (e) {
      console.warn('AutoSave draft failed:', e.message);
    }
  },

  getDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  },

  addRecent(state) {
    try {
      const entry = { ...this.serialize(state), id: `r_${Date.now()}` };
      const list  = this.getRecents().filter(r => r.projectName !== state.name);
      localStorage.setItem(RECENTS_KEY, JSON.stringify([entry, ...list].slice(0, MAX_RECENTS)));
    } catch (e) {
      console.warn('AutoSave addRecent failed:', e.message);
    }
  },

  getRecents() {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  relativeTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60_000);
    if (m < 1)   return 'Just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  },
};
