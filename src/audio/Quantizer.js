// MIDI quantization: snap note start times to a rhythmic grid with adjustable strength and swing.

export const GRIDS = [
  { id: '1/4',  beats: 1,      label: '1/4'  },
  { id: '1/8',  beats: 0.5,    label: '1/8'  },
  { id: '1/8T', beats: 1/3,    label: '1/8T' },  // triplet
  { id: '1/16', beats: 0.25,   label: '1/16' },
  { id: '1/16T',beats: 1/6,    label: '1/16T'},
  { id: '1/32', beats: 0.125,  label: '1/32' },
  { id: '1/64', beats: 0.0625, label: '1/64' },
];

// Nearest grid point for a given beat value
function nearestGrid(beat, gridBeats) {
  return Math.round(beat / gridBeats) * gridBeats;
}

// Snap note ends to grid as well
function nearestDur(startBeat, endBeat, gridBeats) {
  const endGrid = nearestGrid(endBeat, gridBeats);
  return Math.max(gridBeats, endGrid - startBeat);
}

export const Quantizer = {
  // Quantize note start times
  // strength: 0 = no quantization, 1 = full snap
  // swing: 0 = straight, 1 = full swing (50% shifts off-beats by 1/3 of a grid unit forward)
  quantize(notes, { gridId = '1/16', strength = 1, swing = 0, quantizeEnd = false }) {
    const grid     = GRIDS.find(g => g.id === gridId) ?? GRIDS[3];
    const g        = grid.beats;
    const swingAmt = swing * g * 0.33;

    return notes.map(note => {
      const snapped = nearestGrid(note.startBeat, g);
      const newStart = note.startBeat + (snapped - note.startBeat) * strength;

      // Apply swing to off-beat positions
      const isOffBeat = (Math.round(newStart / g) % 2) === 1;
      const swingShift = isOffBeat ? swingAmt : 0;

      const quantStart = newStart + swingShift;

      let quantDur = note.durationBeats;
      if (quantizeEnd) {
        quantDur = nearestDur(quantStart, quantStart + note.durationBeats, g);
      }

      return {
        ...note,
        startBeat:     Math.max(0, quantStart),
        durationBeats: Math.max(g * 0.5, quantDur),
      };
    });
  },

  // Humanize: add controlled randomness to perfectly quantized notes
  humanize(notes, { timing = 0.02, velocity = 15, stretch = 0 }) {
    return notes.map(note => ({
      ...note,
      startBeat:     Math.max(0, note.startBeat + (Math.random() - 0.5) * timing * 2),
      durationBeats: Math.max(0.0625, note.durationBeats * (1 + (Math.random() - 0.5) * stretch)),
      velocity:      Math.max(1, Math.min(127, note.velocity + Math.round((Math.random() - 0.5) * velocity * 2))),
    }));
  },

  // Legato: stretch each note to reach the next note start
  legato(notes) {
    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
    return sorted.map((note, i) => {
      const next    = sorted[i + 1];
      const newDur  = next ? next.startBeat - note.startBeat - 0.0625 : note.durationBeats;
      return { ...note, durationBeats: Math.max(0.0625, newDur) };
    });
  },

  // Staccato: shorten all notes to a fraction of their duration
  staccato(notes, factor = 0.5) {
    return notes.map(note => ({
      ...note,
      durationBeats: Math.max(0.0625, note.durationBeats * factor),
    }));
  },
};
