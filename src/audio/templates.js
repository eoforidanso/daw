const DEFAULT_SYNTH = {
  osc1Type: 'sawtooth', osc1Detune: 0,
  osc2Type: 'sine',     osc2Detune: 7,
  filterType: 'lowpass', filterCutoff: 2000, filterRes: 30,
  attack: 10, decay: 20, sustain: 70, release: 30,
  lfoRate: 50, lfoDepth: 30,
  reverbMix: 30, reverbSize: 70,
  delayTime: 25, delayFeedback: 40, delayMix: 20,
  distortion: 0, chorus: 20,
};

const b = (arr) => arr.map(Boolean);

export const TEMPLATES = {
  empty: {
    id: 'empty',
    name: 'Empty Project',
    description: 'Blank slate. Add your own tracks, instruments, and gear.',
    bpm: 120,
    accent: '#5a5a78',
    tracks: [],
    synthParams: DEFAULT_SYNTH,
    steps: {},
    clips: [],
  },

  edm: {
    id: 'edm',
    name: 'EDM',
    description: '4-on-the-floor kick, layered synths, sidechain-ready signal chain.',
    bpm: 128,
    accent: '#00d4b4',
    tracks: [
      { id: 1, name: 'KICK',     color: '#ff6b35', type: 'drum',  volume: 85, pan: 0,   mute: false, solo: false },
      { id: 2, name: 'SNARE',    color: '#4a9eff', type: 'drum',  volume: 70, pan: 0,   mute: false, solo: false },
      { id: 3, name: 'HI-HAT',   color: '#00d4b4', type: 'drum',  volume: 58, pan: 5,   mute: false, solo: false },
      { id: 4, name: 'CLAP',     color: '#ff4466', type: 'drum',  volume: 52, pan: -5,  mute: false, solo: false },
      { id: 5, name: 'BASS SYN', color: '#9b72ff', type: 'synth', volume: 80, pan: -8,  mute: false, solo: false },
      { id: 6, name: 'LEAD OSC', color: '#ffbe45', type: 'synth', volume: 65, pan: 14,  mute: false, solo: false },
      { id: 7, name: 'PAD ATMO', color: '#4a9eff', type: 'synth', volume: 45, pan: 0,   mute: false, solo: false },
      { id: 8, name: 'FX RISER', color: '#ff6b35', type: 'fx',    volume: 35, pan: 0,   mute: false, solo: false },
    ],
    synthParams: { ...DEFAULT_SYNTH, osc1Type: 'sawtooth', filterCutoff: 1800, reverbMix: 20 },
    steps: {
      KICK:     b([1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]),
      SNARE:    b([0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0]),
      'HI-HAT': b([1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]),
      CLAP:     b([0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1]),
    },
    clips: [],
  },

  afrobeats: {
    id: 'afrobeats',
    name: 'Afrobeats',
    description: 'Syncopated kick, clave-driven hi-hats, vibrant melody leads.',
    bpm: 107,
    accent: '#ffbe45',
    tracks: [
      { id: 1, name: 'KICK',     color: '#ff6b35', type: 'drum',  volume: 82, pan: 0,   mute: false, solo: false },
      { id: 2, name: 'SNARE',    color: '#4a9eff', type: 'drum',  volume: 68, pan: 0,   mute: false, solo: false },
      { id: 3, name: 'HI-HAT',   color: '#ffbe45', type: 'drum',  volume: 62, pan: 8,   mute: false, solo: false },
      { id: 4, name: 'CLAP',     color: '#ff4466', type: 'drum',  volume: 58, pan: -8,  mute: false, solo: false },
      { id: 5, name: 'BASS',     color: '#9b72ff', type: 'synth', volume: 78, pan: 0,   mute: false, solo: false },
      { id: 6, name: 'LEAD',     color: '#ffbe45', type: 'synth', volume: 72, pan: 12,  mute: false, solo: false },
      { id: 7, name: 'MELODY',   color: '#4a9eff', type: 'synth', volume: 62, pan: -12, mute: false, solo: false },
      { id: 8, name: 'SHAKER',   color: '#00d4b4', type: 'fx',    volume: 48, pan: 0,   mute: false, solo: false },
    ],
    synthParams: {
      ...DEFAULT_SYNTH,
      osc1Type: 'triangle', filterCutoff: 2400, filterRes: 20,
      reverbMix: 25, delayTime: 30, delayMix: 30,
    },
    steps: {
      KICK:     b([1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0]),
      SNARE:    b([0,0,0,0, 1,0,0,0, 0,0,0,1, 0,0,0,0]),
      'HI-HAT': b([1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]),
      CLAP:     b([0,0,1,0, 0,1,0,0, 1,0,0,0, 0,1,0,1]),
    },
    clips: [],
  },

  lofi: {
    id: 'lofi',
    name: 'Lo-Fi',
    description: 'Dusty drums, warm bass, jazzy chords — slow tempo chill vibes.',
    bpm: 78,
    accent: '#9b72ff',
    tracks: [
      { id: 1, name: 'KICK',    color: '#888899', type: 'drum',  volume: 68, pan: 0,   mute: false, solo: false },
      { id: 2, name: 'SNARE',   color: '#aaaacc', type: 'drum',  volume: 60, pan: 0,   mute: false, solo: false },
      { id: 3, name: 'HI-HAT',  color: '#00d4b4', type: 'drum',  volume: 45, pan: 0,   mute: false, solo: false },
      { id: 4, name: 'CLAP',    color: '#9b72ff', type: 'drum',  volume: 30, pan: 0,   mute: false, solo: false },
      { id: 5, name: 'BASS',    color: '#9b72ff', type: 'synth', volume: 72, pan: -5,  mute: false, solo: false },
      { id: 6, name: 'PIANO',   color: '#ffbe45', type: 'synth', volume: 65, pan: 10,  mute: false, solo: false },
      { id: 7, name: 'GUITAR',  color: '#4a9eff', type: 'synth', volume: 50, pan: -15, mute: false, solo: false },
      { id: 8, name: 'ATMOS',   color: '#00d4b4', type: 'fx',    volume: 38, pan: 0,   mute: false, solo: false },
    ],
    synthParams: {
      ...DEFAULT_SYNTH,
      osc1Type: 'triangle', filterCutoff: 1200, filterRes: 15,
      attack: 20, decay: 40, sustain: 60, release: 50,
      reverbMix: 40, reverbSize: 85, delayTime: 35, delayMix: 25,
    },
    steps: {
      KICK:     b([1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]),
      SNARE:    b([0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0]),
      'HI-HAT': b([1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]),
      CLAP:     b([0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]),
    },
    clips: [],
  },

  podcast: {
    id: 'podcast',
    name: 'Podcast',
    description: 'Dual vocal tracks, music bed, SFX layers — broadcast-ready layout.',
    bpm: 120,
    accent: '#4a9eff',
    tracks: [
      { id: 1, name: 'HOST MIC',  color: '#4a9eff', type: 'audio', volume: 85, pan: -8,  mute: false, solo: false },
      { id: 2, name: 'GUEST MIC', color: '#00d4b4', type: 'audio', volume: 82, pan: 8,   mute: false, solo: false },
      { id: 3, name: 'MUSIC BED', color: '#9b72ff', type: 'audio', volume: 30, pan: 0,   mute: false, solo: false },
      { id: 4, name: 'SFX',       color: '#ffbe45', type: 'audio', volume: 60, pan: 0,   mute: false, solo: false },
      { id: 5, name: 'INTRO',     color: '#ff6b35', type: 'audio', volume: 75, pan: 0,   mute: false, solo: false },
      { id: 6, name: 'OUTRO',     color: '#ff4466', type: 'audio', volume: 75, pan: 0,   mute: false, solo: false },
    ],
    synthParams: {
      ...DEFAULT_SYNTH,
      filterCutoff: 3500, filterRes: 10,
      reverbMix: 12, delayMix: 5,
    },
    steps: {},
    clips: [],
  },
};

export const TEMPLATE_ORDER = ['empty', 'edm', 'afrobeats', 'lofi', 'podcast'];
