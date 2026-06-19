import { useState, useCallback } from 'react';
import { DRUM_PATTERNS } from '../audio/DrumPatterns.js';

const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

const GENRE_MAP = {
  'Boom Bap':   { scale: 'minor',      bassRhythm: [0,4,8,12],           chordRhythm: [0,8],       leadDensity: 0.28 },
  'Trap':       { scale: 'minor',      bassRhythm: [0,3,8,11],           chordRhythm: [0],         leadDensity: 0.20 },
  'House':      { scale: 'major',      bassRhythm: [0,2,4,6,8,10,12,14], chordRhythm: [0,4,8,12],  leadDensity: 0.38 },
  'Techno':     { scale: 'minor',      bassRhythm: [0,2,8,10],           chordRhythm: [],          leadDensity: 0.15 },
  'Afrobeats':  { scale: 'major',      bassRhythm: [0,3,6,9,12],         chordRhythm: [0,6,12],    leadDensity: 0.35 },
  'Jungle':     { scale: 'minor',      bassRhythm: [0,4,7,12],           chordRhythm: [0,8],       leadDensity: 0.22 },
  'Reggaeton':  { scale: 'minor',      bassRhythm: [0,2,4,8,10,12],      chordRhythm: [0,8],       leadDensity: 0.28 },
  'UK Garage':  { scale: 'major',      bassRhythm: [0,3,8,11,14],        chordRhythm: [2,6,10,14], leadDensity: 0.35 },
  'Funk':       { scale: 'dorian',     bassRhythm: [0,2,3,5,8,10,11,13], chordRhythm: [0,5,8,13],  leadDensity: 0.40 },
  'Neo-Soul':   { scale: 'dorian',     bassRhythm: [0,4,7,12],           chordRhythm: [0,6,12],    leadDensity: 0.35 },
  'Dancehall':  { scale: 'minor',      bassRhythm: [0,4,8,10,12],        chordRhythm: [2,10],      leadDensity: 0.25 },
  'Gospel':     { scale: 'major',      bassRhythm: [0,4,8,12],           chordRhythm: [0,4,8,12],  leadDensity: 0.45 },
  'Bossa Nova': { scale: 'major',      bassRhythm: [0,3,8,11,14],        chordRhythm: [0,3,8,11],  leadDensity: 0.32 },
  'Disco':      { scale: 'major',      bassRhythm: [0,2,4,6,8,10,12,14], chordRhythm: [0,4,8,12],  leadDensity: 0.30 },
  'Footwork':   { scale: 'pentatonic', bassRhythm: [0,1,2,4,6,8,10,12],  chordRhythm: [],          leadDensity: 0.18 },
};

const GENRES = Object.keys(GENRE_MAP);
const ROW_ORDER  = ['KICK','SNARE','HI-HAT','CLAP'];
const ROW_COLORS = { KICK:'#ff6b35', SNARE:'#4a9eff', 'HI-HAT':'#00d4b4', CLAP:'#ff4466' };
const PITCH_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function pitchName(midi) { return PITCH_NAMES[midi % 12] + Math.floor(midi / 12 - 1); }
function getRoot(chord)  { return chord?.length ? Math.min(...chord) : 60; }

function buildBass(chord, rhythm, scale) {
  const root  = getRoot(chord);
  const low   = root - 12;
  const ints  = SCALES[scale] ?? SCALES.minor;
  return rhythm.map((step, i) => {
    let pitch = low;
    if (i % 4 === 1) pitch = low + 5;
    if (i % 4 === 2) pitch = low + 7;
    if (i === rhythm.length - 1) pitch = low + ints[1];
    return { id: `bs_${i}`, pitch, startBeat: step / 4, durationBeats: 0.22, velocity: i === 0 ? 100 : 78 };
  });
}

function buildChords(chord, rhythm) {
  if (!chord?.length) return [];
  const notes = [];
  rhythm.forEach((step, i) => {
    chord.forEach((pitch, j) => {
      notes.push({ id: `ch_${i}_${j}`, pitch, startBeat: step / 4, durationBeats: 0.5, velocity: 68 });
    });
  });
  return notes;
}

function buildLead(chord, density, scale) {
  const root = getRoot(chord);
  const ints = SCALES[scale] ?? SCALES.minor;
  const scale8 = [...ints, ...ints.map(i => i + 12)];
  const notes = [];
  for (let step = 0; step < 16; step++) {
    if (Math.random() < density) {
      let pitch;
      if (chord?.length && Math.random() < 0.6) {
        pitch = chord[Math.floor(Math.random() * chord.length)];
        if (Math.random() < 0.3) pitch += 12;
      } else {
        pitch = root + scale8[Math.floor(Math.random() * scale8.length)];
      }
      notes.push({ id: `ld_${step}`, pitch, startBeat: step / 4, durationBeats: 0.22, velocity: Math.floor(Math.random() * 20 + 68) });
    }
  }
  return notes;
}

function generateSeed(chord, genreName, complexity) {
  const cfg = GENRE_MAP[genreName] ?? GENRE_MAP['Boom Bap'];
  const dp  = DRUM_PATTERNS.find(p => p.genre === genreName || p.name === genreName) ?? DRUM_PATTERNS[0];
  return {
    drumPattern: dp,
    bass:   complexity !== 'drums' ? buildBass(chord, cfg.bassRhythm, cfg.scale) : [],
    chords: complexity === 'full'  ? buildChords(chord, cfg.chordRhythm)          : [],
    lead:   complexity === 'full'  ? buildLead(chord, cfg.leadDensity, cfg.scale) : [],
  };
}

// ── tiny pill button helper ───────────────────────────────────────
function Pill({ active, color = 'var(--accent-cyan)', onClick, children }) {
  return (
    <button onClick={onClick} style={{
      height: 20, padding: '0 9px', borderRadius: 3, cursor: 'pointer',
      border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
      background: active ? `${color}22` : 'var(--bg-element)',
      color: active ? color : 'var(--text-muted)',
      fontFamily: 'var(--font-mono)', fontSize: 8,
    }}>{children}</button>
  );
}

export default function SongSeedPanel({ tracks, arpChord, onStepsChange, dispatchClips }) {
  const [genre,      setGenre]      = useState('Boom Bap');
  const [complexity, setComplexity] = useState('full');
  const [seed,       setSeed]       = useState(null);
  const [inserted,   setInserted]   = useState(false);

  const chord = arpChord?.length ? arpChord : [60, 64, 67];

  const generate = useCallback(() => {
    setSeed(generateSeed(chord, genre, complexity));
    setInserted(false);
  }, [chord, genre, complexity]);

  const insert = useCallback(() => {
    if (!seed) return;
    onStepsChange?.(seed.drumPattern.steps);

    const bassTrack  = tracks.find(t => /bass/i.test(t.name));
    const chordTrack = tracks.find(t => /pad|chord|synth/i.test(t.name));
    const leadTrack  = tracks.find(t => /lead/i.test(t.name));
    const now = Date.now();

    if (bassTrack && seed.bass.length > 0) {
      dispatchClips?.({ type: 'ADD', clip: { id: `seed_b_${now}`, trackId: bassTrack.id, type: 'midi', startBeat: 0, durationBeats: 4, notes: seed.bass, label: `${genre} Bass`, color: bassTrack.color } });
    }
    if (chordTrack && seed.chords.length > 0) {
      dispatchClips?.({ type: 'ADD', clip: { id: `seed_c_${now}`, trackId: chordTrack.id, type: 'midi', startBeat: 0, durationBeats: 4, notes: seed.chords, label: `${genre} Chords`, color: chordTrack.color } });
    }
    if (leadTrack && seed.lead.length > 0) {
      dispatchClips?.({ type: 'ADD', clip: { id: `seed_l_${now}`, trackId: leadTrack.id, type: 'midi', startBeat: 0, durationBeats: 4, notes: seed.lead, label: `${genre} Lead`, color: leadTrack.color } });
    }
    setInserted(true);
  }, [seed, genre, tracks, onStepsChange, dispatchClips]);

  const root = getRoot(chord);

  return (
    <div style={{ padding: '10px 14px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent-cyan)' }}>SONG SEED</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', background: 'var(--bg-element)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
          CHORD: {chord.map(pitchName).join(' · ')}
        </span>
        {inserted && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>✓ INSERTED</span>}
      </div>

      {/* Genre grid */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 5 }}>GENRE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {GENRES.map(g => <Pill key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Pill>)}
        </div>
      </div>

      {/* Complexity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>COMPLEXITY</span>
        {[['drums','DRUMS ONLY'],['bass','+ BASS'],['full','FULL']].map(([v, l]) => (
          <Pill key={v} active={complexity === v} color="var(--accent-purple)" onClick={() => setComplexity(v)}>{l}</Pill>
        ))}
        <button onClick={generate} style={{ marginLeft: 'auto', height: 26, padding: '0 18px', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--accent-cyan)', background: 'var(--accent-cyan-glow)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 600 }}>
          ⚡ GENERATE
        </button>
      </div>

      {seed && (
        <>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Drum grid preview */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 5 }}>
                DRUMS — <span style={{ color: 'var(--accent-cyan)' }}>{seed.drumPattern.name}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {ROW_ORDER.map(row => (
                  <div key={row} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: ROW_COLORS[row], width: 42, flexShrink: 0 }}>{row}</span>
                    {(seed.drumPattern.steps[row] ?? Array(16).fill(false)).map((on, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: on ? ROW_COLORS[row] : 'var(--bg-element)', border: `1px solid ${on ? ROW_COLORS[row] : 'var(--border-subtle)'}`, marginLeft: i % 4 === 0 && i > 0 ? 4 : 0, flexShrink: 0 }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Bass notes */}
            {seed.bass.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 5 }}>BASS — {seed.bass.length} NOTES</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 180 }}>
                  {seed.bass.map((n, i) => (
                    <div key={i} style={{ padding: '2px 6px', borderRadius: 3, background: 'rgba(255,107,53,0.18)', border: '1px solid #ff6b35', fontFamily: 'var(--font-mono)', fontSize: 7, color: '#ff6b35' }}>{pitchName(n.pitch)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Chord voicing */}
            {seed.chords.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 5 }}>CHORDS — {Math.round(seed.chords.length / (chord.length || 1))} STABS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {chord.map((p, i) => (
                    <div key={i} style={{ padding: '2px 6px', borderRadius: 3, background: 'rgba(74,158,255,0.18)', border: '1px solid #4a9eff', fontFamily: 'var(--font-mono)', fontSize: 7, color: '#4a9eff', display: 'inline-flex', width: 'fit-content' }}>{pitchName(p)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Lead motif mini-roll */}
            {seed.lead.length > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 5 }}>LEAD — {seed.lead.length} NOTES</div>
                <div style={{ position: 'relative', width: 180, height: 44, background: 'var(--bg-element)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {/* Beat lines */}
                  {[0,1,2,3].map(b => (
                    <div key={b} style={{ position: 'absolute', left: `${b * 25}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--border-faint)' }} />
                  ))}
                  {seed.lead.map((n, i) => {
                    const pct = Math.max(0, Math.min(1, (n.pitch - root) / 24));
                    return (
                      <div key={i} style={{ position: 'absolute', left: `${(n.startBeat / 4) * 100}%`, bottom: `${pct * 88}%`, width: 8, height: 4, background: 'var(--accent-purple)', borderRadius: 1 }} />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button onClick={insert} style={{
            alignSelf: 'flex-start', height: 26, padding: '0 18px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${inserted ? '#00ff88' : 'var(--accent-purple)'}`,
            background: inserted ? 'rgba(0,255,136,0.12)' : 'rgba(138,43,226,0.15)',
            color: inserted ? '#00ff88' : 'var(--accent-purple)',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 600,
          }}>
            {inserted ? '✓ INSERTED' : '▶ INSERT INTO TRACKS'}
          </button>
        </>
      )}
    </div>
  );
}
