// Per-scene parameter automation — stored in localStorage.
// Each scene has an array of { id, target, param, value, label } actions
// that fire when the scene is launched in Performance Mode.

const KEY = 'void_scene_auto';

export const AUTOMATABLE_PARAMS = [
  { param: 'volume',  label: 'Volume',      unit: '',   min: 0,   max: 100, step: 1  },
  { param: 'pan',     label: 'Pan',         unit: '',   min: -1,  max: 1,   step: 0.01 },
  { param: 'bpm',     label: 'BPM',         unit: 'BPM',min: 40,  max: 240, step: 1  },
  { param: 'reverbMix', label: 'Reverb',    unit: '%',  min: 0,   max: 100, step: 1  },
  { param: 'filterCutoff', label: 'Filter', unit: 'Hz', min: 80,  max: 18000,step: 10},
  { param: 'delayMix', label: 'Delay',      unit: '%',  min: 0,   max: 100, step: 1  },
];

export const SceneAutomation = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
  },

  getScene(si) {
    return this.getAll()[si] ?? [];
  },

  setScene(si, actions) {
    const all = this.getAll();
    if (!actions.length) { delete all[si]; }
    else { all[si] = actions; }
    localStorage.setItem(KEY, JSON.stringify(all));
  },

  addAction(si, action) {
    const id  = `a_${Date.now()}`;
    const actions = [...this.getScene(si), { id, ...action }];
    this.setScene(si, actions);
    return id;
  },

  removeAction(si, id) {
    this.setScene(si, this.getScene(si).filter(a => a.id !== id));
  },

  updateAction(si, id, updates) {
    this.setScene(si, this.getScene(si).map(a => a.id === id ? { ...a, ...updates } : a));
  },

  hasActions(si) {
    return (this.getScene(si)).length > 0;
  },

  clear() { localStorage.removeItem(KEY); },
};
