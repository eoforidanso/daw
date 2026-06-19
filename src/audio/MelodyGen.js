// Algorithmic melody generation using scale-aware Markov chains + motif development.

export const SCALES = {
  major:         { intervals: [0,2,4,5,7,9,11],    label: 'MAJOR'        },
  minor:         { intervals: [0,2,3,5,7,8,10],    label: 'MINOR'        },
  pentatonic:    { intervals: [0,2,4,7,9],          label: 'PENTATONIC'   },
  minor_pent:    { intervals: [0,3,5,7,10],         label: 'MIN PENT'     },
  blues:         { intervals: [0,3,5,6,7,10],       label: 'BLUES'        },
  dorian:        { intervals: [0,2,3,5,7,9,10],     label: 'DORIAN'       },
  lydian:        { intervals: [0,2,4,6,7,9,11],     label: 'LYDIAN'       },
  mixolydian:    { intervals: [0,2,4,5,7,9,10],     label: 'MIXOLYDIAN'   },
  phrygian:      { intervals: [0,1,3,5,7,8,10],     label: 'PHRYGIAN'     },
  harmonic_min:  { intervals: [0,2,3,5,7,8,11],     label: 'HARM MIN'     },
  whole_tone:    { intervals: [0,2,4,6,8,10],       label: 'WHOLE TONE'   },
  chromatic:     { intervals: [0,1,2,3,4,5,6,7,8,9,10,11], label: 'CHROMATIC' },
};

export const STYLES = {
  edm:       { label: 'EDM',       rhythmBias: 'eighth',  restProb: 0.08, repetition: 0.75, octaveRange: [4,6], leapBias: 0.2,  velRange: [90,127] },
  hiphop:    { label: 'HIP-HOP',  rhythmBias: 'syncopate',restProb: 0.35, repetition: 0.6,  octaveRange: [4,5], leapBias: 0.1,  velRange: [70,110] },
  jazz:      { label: 'JAZZ',      rhythmBias: 'swing',   restProb: 0.25, repetition: 0.25, octaveRange: [4,5], leapBias: 0.35, velRange: [55,105], chromatic: 0.25 },
  classical: { label: 'CLASSICAL', rhythmBias: 'varied',  restProb: 0.12, repetition: 0.4,  octaveRange: [3,6], leapBias: 0.25, velRange: [45,105] },
  ambient:   { label: 'AMBIENT',   rhythmBias: 'long',    restProb: 0.45, repetition: 0.55, octaveRange: [4,5], leapBias: 0.05, velRange: [35,75]  },
  techno:    { label: 'TECHNO',    rhythmBias: 'sixteenth',restProb: 0.05, repetition: 0.8,  octaveRange: [4,5], leapBias: 0.1,  velRange: [95,127] },
  lofi:      { label: 'LO-FI',     rhythmBias: 'varied',  restProb: 0.3,  repetition: 0.5,  octaveRange: [4,5], leapBias: 0.15, velRange: [50,90]  },
};

// Build MIDI pitch pool for a scale across multiple octaves
function buildPitchPool(rootMidi, scaleDef, octaveRange) {
  const pool = [];
  for (let oct = octaveRange[0]; oct <= octaveRange[1]; oct++) {
    for (const interval of scaleDef.intervals) {
      const pitch = oct * 12 + (rootMidi % 12) + interval;
      if (pitch >= 21 && pitch <= 108) pool.push(pitch);
    }
  }
  return [...new Set(pool)].sort((a, b) => a - b);
}

// Transition probability: favors steps, allows leaps, pulls toward root/fifth
function weightedNext(pool, currentIdx, styleDef, rootPitch) {
  const weights = pool.map((pitch, i) => {
    const dist   = Math.abs(i - currentIdx);
    let   w      = Math.max(0.05, 1 / (dist + 0.5));
    if (dist === 1) w *= 3.5;           // strong preference for steps
    if (dist === 0) w *= 0.4;           // mild penalty for immediate repeat
    if (pitch % 12 === rootPitch % 12)  w *= 1.6;  // root attraction
    if ((pitch - rootPitch) % 12 === 7) w *= 1.3;  // fifth attraction
    if (dist > 4 && Math.random() > styleDef.leapBias) w *= 0.1; // suppress big leaps
    return w;
  });
  const sum  = weights.reduce((a, b) => a + b, 0);
  let   rand = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]; if (rand <= 0) return i;
  }
  return pool.length - 1;
}

// Generate a rhythm grid for one bar (4 beats) for the given style
function genRhythm(beats, styleBias, restProb) {
  const grid = [];
  let   pos  = 0;
  while (pos < beats) {
    const isRest = Math.random() < restProb;
    let   dur;
    switch (styleBias) {
      case 'sixteenth': dur = 0.25; break;
      case 'eighth':    dur = [0.25, 0.5][Math.floor(Math.random() * 2)]; break;
      case 'syncopate': dur = [0.25, 0.375, 0.5][Math.floor(Math.random() * 3)]; break;
      case 'swing':     dur = Math.random() < 0.5 ? 1/3 : 2/3; break;
      case 'long':      dur = [0.5, 1, 1.5][Math.floor(Math.random() * 3)]; break;
      default:          dur = [0.25, 0.5, 0.75, 1][Math.floor(Math.random() * 4)];
    }
    dur = Math.min(dur, beats - pos);
    if (dur < 0.125) { pos = beats; break; }
    grid.push({ startBeat: pos, dur, isRest });
    pos += dur;
  }
  return grid;
}

// Apply motif development transformations
function developMotif(motif, transformation, pool) {
  switch (transformation) {
    case 'repeat':     return motif.map(n => ({ ...n }));
    case 'sequence_up': return motif.map(n => ({
      ...n,
      pitchIdx: Math.min(pool.length - 1, n.pitchIdx + 2),
    }));
    case 'sequence_down': return motif.map(n => ({
      ...n,
      pitchIdx: Math.max(0, n.pitchIdx - 2),
    }));
    case 'invert': {
      const center = Math.round((motif[0].pitchIdx + motif[motif.length - 1].pitchIdx) / 2);
      return motif.map(n => ({ ...n, pitchIdx: Math.max(0, Math.min(pool.length - 1, 2 * center - n.pitchIdx)) }));
    }
    case 'retrograde': return [...motif].reverse().map((n, i) => ({
      ...n, startBeat: motif[i]?.startBeat ?? n.startBeat, dur: motif[i]?.dur ?? n.dur,
    }));
    case 'variation': return motif.map(n => ({
      ...n, pitchIdx: Math.max(0, Math.min(pool.length - 1, n.pitchIdx + (Math.random() < 0.5 ? 1 : -1))),
    }));
    case 'augment': return motif.map(n => ({ ...n, dur: n.dur * 2 }));
    default: return motif.map(n => ({ ...n }));
  }
}

function jitterVelocity(base, velRange) {
  const [lo, hi] = velRange;
  return Math.max(lo, Math.min(hi, base + Math.round((Math.random() - 0.5) * 20)));
}

let _nid = 100;
const nid = () => `gn${_nid++}`;

export const MelodyGen = {
  scales: Object.entries(SCALES).map(([id, def]) => ({ id, label: def.label })),
  styles: Object.entries(STYLES).map(([id, def]) => ({ id, label: def.label })),

  generate({ rootMidi = 60, scaleId = 'minor', styleId = 'edm', bars = 4, density = 0.65 }) {
    const scaleDef = SCALES[scaleId] ?? SCALES.minor;
    const styleDef = STYLES[styleId] ?? STYLES.edm;
    const pool     = buildPitchPool(rootMidi, scaleDef, styleDef.octaveRange);

    if (!pool.length) return [];

    // ── Build seed motif from bar 0 ──────────────────────────────
    const motifRhythm = genRhythm(4, styleDef.rhythmBias, styleDef.restProb * (1 - density));
    let   curIdx      = Math.floor(pool.length / 2); // start near center
    const seedMotif   = motifRhythm.map(r => {
      if (r.isRest) return { ...r, pitchIdx: null };
      curIdx = weightedNext(pool, curIdx, styleDef, rootMidi);
      return { ...r, pitchIdx: curIdx };
    });

    // ── Develop motif across bars ────────────────────────────────
    const devOptions = ['repeat', 'sequence_up', 'sequence_down', 'variation', 'invert'];
    const allNotes   = [];

    for (let bar = 0; bar < bars; bar++) {
      let barMotif;
      if (bar === 0) {
        barMotif = seedMotif;
      } else if (Math.random() < styleDef.repetition) {
        const dev  = devOptions[Math.floor(Math.random() * devOptions.length)];
        barMotif   = developMotif(seedMotif, dev, pool);
      } else {
        const newRhythm = genRhythm(4, styleDef.rhythmBias, styleDef.restProb * (1 - density));
        barMotif = newRhythm.map(r => {
          if (r.isRest) return { ...r, pitchIdx: null };
          curIdx = weightedNext(pool, curIdx, styleDef, rootMidi);
          return { ...r, pitchIdx: curIdx };
        });
      }

      for (const event of barMotif) {
        if (event.pitchIdx === null || event.pitchIdx === undefined) continue;
        const pitch    = pool[Math.max(0, Math.min(pool.length - 1, event.pitchIdx))];
        const velocity = jitterVelocity(Math.round((styleDef.velRange[0] + styleDef.velRange[1]) / 2), styleDef.velRange);
        allNotes.push({
          id:            nid(),
          pitch,
          startBeat:     bar * 4 + event.startBeat,
          durationBeats: Math.max(0.125, event.dur - 0.0625),
          velocity,
        });
      }
    }

    return allNotes;
  },
};
