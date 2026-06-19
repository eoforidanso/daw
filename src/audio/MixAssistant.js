// AI mixing assistant: analyzes track frequency content + levels,
// generates actionable EQ/dynamics suggestions per track.

// Known spectral profiles for track types
const TRACK_PROFILES = {
  drum: {
    KICK:    { targetLow: [50, 90], targetMid: [250, 450], cutMud: [250, 450], boostPunch: [70, 100], highCut: 10000 },
    SNARE:   { hpf: 80, targetBody: [200, 300], targetCrack: [5000, 8000], boostPresence: 3000 },
    'HI-HAT':{ hpf: 600, airBoost: 12000, notchMid: [1200, 2000] },
    CLAP:    { hpf: 120, snapBoost: [4000, 6000], body: 800 },
  },
  synth: {
    BASS:    { boostSub: [40, 80], harmonic: [100, 200], cutMud: [280, 380] },
    LEAD:    { boostPresence: [2000, 4000], airBoost: 10000, hpf: 200 },
    PAD:     { hpf: 120, cutLow: 250, boostMid: [800, 2000], lpf: 12000 },
    DEFAULT: { hpf: 100, mid: 1000 },
  },
};

// Get FFT magnitude data from an analyser node
function getFFTData(bus) {
  try {
    const analyser = bus._analyser;
    if (!analyser) return null;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    return buf;
  } catch { return null; }
}

// Get RMS energy in a frequency band from FFT data
function bandEnergy(fftData, sr, loHz, hiHz) {
  if (!fftData) return 0;
  const binSize = (sr / 2) / fftData.length;
  const lo      = Math.floor(loHz / binSize);
  const hi      = Math.min(fftData.length - 1, Math.ceil(hiHz / binSize));
  let   sum     = 0;
  for (let i = lo; i <= hi; i++) sum += fftData[i] ** 2;
  return Math.sqrt(sum / Math.max(1, hi - lo + 1)) / 255;
}

function rnd1(v) { return Math.round(v * 10) / 10; }

// Generate suggestions for a single track
function analyzeSingleTrack(track, bus, allBuses) {
  const suggestions = [];
  const level = bus?.getLevel() ?? 0;
  const type  = track.type;
  const name  = track.name.toUpperCase();

  // Level warnings
  if (level > 0.92) suggestions.push({ type: 'level', severity: 'warn', text: `Clipping risk — pull fader down 3–6 dB`, action: { kind: 'volume', value: Math.max(0, track.volume - 12) } });
  if (level < 0.02 && !track.mute) suggestions.push({ type: 'level', severity: 'info', text: `Very low level — check if this is intentional`, action: null });

  // Type-specific EQ suggestions (using known best practices, not live FFT)
  if (type === 'drum') {
    if (name.includes('KICK')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `Boost 70–90 Hz for sub punch`, action: { kind: 'eq', band: 'low', value: 4 } });
      suggestions.push({ type: 'eq', severity: 'tip', text: `Cut 200–350 Hz to clean up mud`, action: { kind: 'eq', band: 'mid', value: -4 } });
    } else if (name.includes('SNARE')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `Boost 200–250 Hz for body`, action: { kind: 'eq', band: 'low', value: 3 } });
      suggestions.push({ type: 'eq', severity: 'tip', text: `Boost 5–8 kHz for crack and snap`, action: { kind: 'eq', band: 'high', value: 5 } });
    } else if (name.includes('HI') || name.includes('HAT')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `HPF at 600 Hz — no bass content needed`, action: { kind: 'eq', band: 'low', value: -12 } });
      suggestions.push({ type: 'eq', severity: 'tip', text: `Air boost at 12 kHz for shimmer`, action: { kind: 'eq', band: 'high', value: 4 } });
    } else if (name.includes('CLAP')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `Boost 4–6 kHz for snap transient`, action: { kind: 'eq', band: 'high', value: 4 } });
    }
  } else if (type === 'synth') {
    if (name.includes('BASS') || name.includes('BAS')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `Keep 40–80 Hz sub, cut 250–380 Hz mud`, action: { kind: 'eq', band: 'mid', value: -5 } });
      suggestions.push({ type: 'eq', severity: 'tip', text: `Add harmonics at 120–200 Hz for bass mono presence`, action: { kind: 'eq', band: 'low', value: 3 } });
    } else if (name.includes('LEAD')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `HPF at 200 Hz — leads don't need low end`, action: { kind: 'eq', band: 'low', value: -8 } });
      suggestions.push({ type: 'eq', severity: 'tip', text: `Presence boost at 3–4 kHz for cut-through`, action: { kind: 'eq', band: 'high', value: 4 } });
    } else if (name.includes('PAD')) {
      suggestions.push({ type: 'eq', severity: 'tip', text: `HPF at 120 Hz and LPF at 12 kHz for width`, action: { kind: 'eq', band: 'low', value: -6 } });
      suggestions.push({ type: 'eq', severity: 'tip', text: `Cut 200–400 Hz to avoid muddiness with pads`, action: { kind: 'eq', band: 'mid', value: -3 } });
    }
  } else if (type === 'fx') {
    suggestions.push({ type: 'eq', severity: 'tip', text: `HPF + LPF bandpass for focused FX sound`, action: { kind: 'eq', band: 'low', value: -6 } });
    suggestions.push({ type: 'level', severity: 'tip', text: `Keep FX low in mix (–6 to –12 dB vs main elements)`, action: null });
  }

  // Muting check
  if (track.mute) {
    suggestions.push({ type: 'info', severity: 'info', text: `Track is muted`, action: null });
  }

  return suggestions;
}

// Check for potential masking between tracks (simplified frequency band check)
function analyzeInteractions(tracks) {
  const suggestions = [];
  const hasBass  = tracks.some(t => t.name.toUpperCase().includes('BASS'));
  const hasKick  = tracks.some(t => t.name.toUpperCase().includes('KICK'));
  if (hasBass && hasKick) {
    suggestions.push({
      trackId: null,
      type: 'masking', severity: 'warn',
      text: `KICK & BASS compete in 50–120 Hz. Sidechain BASS to KICK or use dynamic EQ to carve space.`,
      action: null,
    });
  }
  const hasPad  = tracks.some(t => t.name.toUpperCase().includes('PAD'));
  const hasLead = tracks.some(t => t.name.toUpperCase().includes('LEAD'));
  if (hasPad && hasLead) {
    suggestions.push({
      trackId: null,
      type: 'masking', severity: 'info',
      text: `PAD & LEAD may compete at 800–2000 Hz. Automate or EQ to separate their presence.`,
      action: null,
    });
  }
  return suggestions;
}

// Overall mix balance
function analyzeMasterBalance(tracks) {
  const suggestions = [];
  const loudTracks = tracks.filter(t => t.volume > 88 && !t.mute);
  if (loudTracks.length > 3) {
    suggestions.push({
      trackId: null,
      type: 'balance', severity: 'warn',
      text: `${loudTracks.length} tracks above 88% — mix may lack headroom. Try the gain staging rule: kick at unity, everything else relative.`,
      action: null,
    });
  }
  const panTracks = tracks.filter(t => Math.abs(t.pan) < 5 && !t.mute && t.type !== 'drum');
  if (panTracks.length > 4) {
    suggestions.push({
      trackId: null,
      type: 'stereo', severity: 'info',
      text: `Most tracks are center-panned. Try spreading synths/FX ±15–40 for width.`,
      action: null,
    });
  }
  return suggestions;
}

export const MixAssistant = {
  analyze(tracks, engine) {
    const perTrack = tracks.map(track => {
      const bus = engine.getBus(track.id);
      return {
        trackId: track.id,
        trackName: track.name,
        suggestions: analyzeSingleTrack(track, bus, null),
      };
    });

    const global = [
      ...analyzeInteractions(tracks),
      ...analyzeMasterBalance(tracks),
    ];

    return { perTrack, global };
  },

  // Build a flat list of all suggestions with metadata
  flatSuggestions(analysis) {
    const list = [];
    for (const t of analysis.perTrack) {
      for (const s of t.suggestions) {
        list.push({ ...s, trackId: t.trackId, trackName: t.trackName });
      }
    }
    for (const s of analysis.global) {
      list.push({ ...s, trackName: 'MIX' });
    }
    return list;
  },
};
