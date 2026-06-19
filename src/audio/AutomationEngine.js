// Manages automation lane data and applies interpolated values to track buses.

let _ptId = 1;
export const mkPtId = () => `pt${_ptId++}`;

export const AUTO_PARAMS = {
  volume:        { label: 'VOLUME',       min: 0,   max: 100, color: 'var(--accent-cyan)'    },
  pan:           { label: 'PAN',          min: -50, max: 50,  color: 'var(--accent-purple)'  },
  eqLow:         { label: 'EQ LOW',       min: -18, max: 18,  color: 'var(--accent-orange)'  },
  eqMid:         { label: 'EQ MID',       min: -18, max: 18,  color: 'var(--accent-yellow)'  },
  eqHigh:        { label: 'EQ HIGH',      min: -18, max: 18,  color: 'var(--accent-blue)'    },
  // ── Insert FX params (slot:key, values 0–100 scaled internally) ──
  'fx:0:mix':    { label: 'REVERB MIX',   min: 0,   max: 100, color: '#4a9eff', group: 'FX'  },
  'fx:0:size':   { label: 'REVERB SIZE',  min: 0,   max: 100, color: '#4a9eff', group: 'FX'  },
  'fx:1:mix':    { label: 'DELAY MIX',    min: 0,   max: 100, color: '#00d4b4', group: 'FX'  },
  'fx:1:time':   { label: 'DELAY TIME',   min: 0,   max: 100, color: '#00d4b4', group: 'FX'  },
  'fx:1:feedback':{ label: 'DELAY FB',    min: 0,   max: 95,  color: '#00d4b4', group: 'FX'  },
  'fx:2:drive':  { label: 'DIST DRIVE',   min: 0,   max: 100, color: '#ff6b35', group: 'FX'  },
  'fx:2:mix':    { label: 'DIST MIX',     min: 0,   max: 100, color: '#ff6b35', group: 'FX'  },
  'fx:3:mix':    { label: 'CHORUS MIX',   min: 0,   max: 100, color: '#c47fff', group: 'FX'  },
  'fx:3:rate':   { label: 'CHORUS RATE',  min: 0,   max: 100, color: '#c47fff', group: 'FX'  },
};

// Linear interpolation between sorted breakpoints
export function interpolate(points, beat) {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.beat - b.beat);
  if (beat <= sorted[0].beat)                       return sorted[0].value;
  if (beat >= sorted[sorted.length - 1].beat)       return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (beat >= a.beat && beat <= b.beat) {
      const t = (beat - a.beat) / (b.beat - a.beat);
      return a.value + t * (b.value - a.value);
    }
  }
  return null;
}

// Call from scheduler on every tick to push automation to bus parameters
export function applyAutomation(lanes, beat, engine) {
  const byTrack = {};
  for (const lane of lanes) {
    if (!byTrack[lane.trackId]) byTrack[lane.trackId] = [];
    byTrack[lane.trackId].push(lane);
  }
  for (const [trackId, trackLanes] of Object.entries(byTrack)) {
    const bus = engine.getBus(Number(trackId));
    if (!bus) continue;
    for (const lane of trackLanes) {
      const val = interpolate(lane.points, beat);
      if (val === null) continue;
      if (lane.param.startsWith('fx:')) {
        const parts  = lane.param.split(':');
        const slot   = parseInt(parts[1], 10);
        const key    = parts[2];
        const effect = bus.getInsert(slot);
        if (effect) {
          // Scale 0–100 range to each parameter's native range
          let scaled = val / 100;
          if (key === 'time')     scaled = val / 100 * 2;       // 0–2 s
          if (key === 'feedback') scaled = val / 100 * 0.95;    // 0–0.95
          if (key === 'rate')     scaled = val / 100 * 10;      // 0–10 Hz
          effect.update(key, scaled);
        }
        continue;
      }
      switch (lane.param) {
        case 'volume':  bus.setVolume(val); break;
        case 'pan':     bus.setPan(val);    break;
        case 'eqLow':   bus.setEQ('low',  val); break;
        case 'eqMid':   bus.setEQ('mid',  val); break;
        case 'eqHigh':  bus.setEQ('high', val); break;
      }
    }
  }
}
