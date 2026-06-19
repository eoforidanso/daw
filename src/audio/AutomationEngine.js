// Manages automation lane data and applies interpolated values to track buses.

let _ptId = 1;
export const mkPtId = () => `pt${_ptId++}`;

export const AUTO_PARAMS = {
  volume:  { label: 'VOLUME',  min: 0,   max: 100, color: 'var(--accent-cyan)'    },
  pan:     { label: 'PAN',     min: -50, max: 50,  color: 'var(--accent-purple)'  },
  eqLow:   { label: 'EQ LOW',  min: -18, max: 18,  color: 'var(--accent-orange)'  },
  eqMid:   { label: 'EQ MID',  min: -18, max: 18,  color: 'var(--accent-yellow)'  },
  eqHigh:  { label: 'EQ HIGH', min: -18, max: 18,  color: 'var(--accent-blue)'    },
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
