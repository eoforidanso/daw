import { useState, useCallback } from 'react';

const HL_GOLD = '#f5a623';

const ROOT_NOTES = { C:60, D:62, 'Eb':63, F:65, G:67, 'Ab':68, 'Bb':70 };
const ROOT_KEYS  = Object.keys(ROOT_NOTES);

// Semitone intervals from tonic for common highlife chord degrees
const CHORD_SHAPES = {
  I:    [0, 4, 7],
  ii:   [2, 5, 9],
  IV:   [5, 9, 12],
  V:    [7, 11, 14],
  vi:   [9, 12, 16],
  bVII: [10, 14, 17],
};

const PROGRESSIONS = {
  'Classic Highlife': ['I','IV','V','I'],
  'Palmwine Cycle':   ['I','V','vi','IV'],
  'Gospel Highlife':  ['IV','V','I','vi'],
  'Modern Highlife':  ['ii','V','I','V'],
  'Funky Highlife':   ['I','bVII','IV','I'],
  'Jazz Highlife':    ['I','ii','V','I'],
};
const PROG_KEYS = Object.keys(PROGRESSIONS);

const DRUM_VARIANTS = {
  'Guitar Band': {
    bpm: 122,
    steps: {
      KICK:     [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0].map(Boolean),
      SNARE:    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean),
      'HI-HAT': [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
      CLAP:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    },
  },
  'Palm Wine': {
    bpm: 104,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
      'HI-HAT': [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1].map(Boolean),
      CLAP:     [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
    },
  },
  'Afro-Highlife': {
    bpm: 114,
    steps: {
      KICK:     [1,0,0,1, 0,0,1,0, 1,0,0,0, 1,0,0,0].map(Boolean),
      SNARE:    [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
      'HI-HAT': [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0].map(Boolean),
      CLAP:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0].map(Boolean),
    },
  },
  'Contemporary': {
    bpm: 110,
    steps: {
      KICK:     [1,0,0,0, 1,0,0,0, 0,0,1,0, 1,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1].map(Boolean),
      CLAP:     [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
    },
  },
  'Dance Band': {
    bpm: 120,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean),
      'HI-HAT': [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1].map(Boolean),
      CLAP:     [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0].map(Boolean),
    },
  },
  'Festival': {
    bpm: 108,
    steps: {
      KICK:     [1,0,1,0, 0,0,1,0, 1,0,0,0, 1,0,0,1].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1].map(Boolean),
      CLAP:     [0,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    },
  },
};

const VARIANT_KEYS = Object.keys(DRUM_VARIANTS);
const ROW_ORDER    = ['KICK','SNARE','HI-HAT','CLAP'];
const ROW_COLORS   = { KICK:'#ff6b35', SNARE:'#4a9eff', 'HI-HAT':'#00d4b4', CLAP:'#ff4466' };
const PITCH_NAMES  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function pitchName(midi) { return PITCH_NAMES[midi % 12] + Math.floor(midi / 12 - 1); }

function buildVoicings(root, progDegrees) {
  return progDegrees.map(deg => {
    const ivs = CHORD_SHAPES[deg] ?? CHORD_SHAPES.I;
    return ivs.map(i => root + i);
  });
}

// Classic highlife "tickle" arpeggio: 3rd→5th→oct-root→5th per 2 beats, 8 notes per bar
function buildGuitar(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];
  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    // ei 0=3rd, 1=5th, 2=high-root, 3=5th | 4=3rd, 5=5th, 6=high-root, 7=3rd
    [1, 2, null, 2, 1, 2, null, 1].forEach((idx, ei) => {
      const pitch = idx === null ? chord[0] + 12 : chord[Math.min(idx, chord.length - 1)];
      notes.push({
        id: `hl_g_${ci}_${ei}`,
        pitch,
        startBeat: barStart + ei * 0.5,
        durationBeats: 0.4,
        velocity: 68 + Math.floor(Math.random() * 18),
      });
    });
  });
  return notes;
}

// Walking bass: root→5th→root→3rd per bar
function buildBass(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];
  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    const bassRoot = chord[0] - 12;
    [0, 7, 0, 4].forEach((interval, bi) => {
      notes.push({
        id: `hl_b_${ci}_${bi}`,
        pitch: bassRoot + interval,
        startBeat: barStart + bi,
        durationBeats: 0.22,
        velocity: bi === 0 ? 100 : 78,
      });
    });
  });
  return notes;
}

// Block chord stabs on beats 1 and 3 of each bar
function buildChords(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];
  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    [0, 2].forEach((beatOff, si) => {
      chord.forEach((pitch, pi) => {
        notes.push({
          id: `hl_c_${ci}_${si}_${pi}`,
          pitch,
          startBeat: barStart + beatOff,
          durationBeats: 0.75,
          velocity: 68,
        });
      });
    });
  });
  return notes;
}

function Pill({ active, color = HL_GOLD, onClick, children }) {
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

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 5 }}>
      {children}
    </div>
  );
}

export default function HighlifePanel({ tracks, arpChord, onStepsChange, dispatchClips }) {
  const [key,        setKey]        = useState('G');
  const [prog,       setProg]       = useState('Classic Highlife');
  const [variant,    setVariant]    = useState('Guitar Band');
  const [complexity, setComplexity] = useState('full');
  const [seed,       setSeed]       = useState(null);
  const [inserted,   setInserted]   = useState(false);

  const generate = useCallback(() => {
    const root        = ROOT_NOTES[key] ?? 67;
    const progDegrees = PROGRESSIONS[prog];
    setSeed({
      variant:    DRUM_VARIANTS[variant],
      guitar:     buildGuitar(root, progDegrees),
      bass:       buildBass(root, progDegrees),
      chords:     buildChords(root, progDegrees),
      voicings:   buildVoicings(root, progDegrees),
      progDegrees,
      root,
    });
    setInserted(false);
  }, [key, prog, variant]);

  const insert = useCallback(() => {
    if (!seed) return;
    onStepsChange?.(seed.variant.steps);

    const now        = Date.now();
    const bassTrack  = tracks.find(t => /bass/i.test(t.name));
    const gtrTrack   = tracks.find(t => /guitar|lead|melody/i.test(t.name));
    const chordTrack = tracks.find(t => /pad|chord|synth/i.test(t.name));

    const incBass   = complexity !== 'drums';
    const incGuitar = complexity === '+guitar' || complexity === 'full';
    const incChords = complexity === 'full';

    if (incBass && bassTrack && seed.bass.length) {
      dispatchClips?.({ type: 'ADD', clip: { id: `hl_b_${now}`, trackId: bassTrack.id, type: 'midi', startBeat: 0, durationBeats: 16, notes: seed.bass, label: `${variant} Bass`, color: bassTrack.color } });
    }
    if (incGuitar && gtrTrack && seed.guitar.length) {
      dispatchClips?.({ type: 'ADD', clip: { id: `hl_g_${now}`, trackId: gtrTrack.id, type: 'midi', startBeat: 0, durationBeats: 16, notes: seed.guitar, label: `${variant} Guitar`, color: gtrTrack.color } });
    }
    if (incChords && chordTrack && seed.chords.length) {
      dispatchClips?.({ type: 'ADD', clip: { id: `hl_c_${now}`, trackId: chordTrack.id, type: 'midi', startBeat: 0, durationBeats: 16, notes: seed.chords, label: `${variant} Chords`, color: chordTrack.color } });
    }
    setInserted(true);
  }, [seed, variant, complexity, tracks, onStepsChange, dispatchClips]);

  return (
    <div style={{ padding: '10px 14px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: HL_GOLD }}>HIGHLIFE</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', background: 'var(--bg-element)', padding: '1px 8px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
          Classic Ghanaian patterns — guitars · drums · bass · chords
        </span>
        {seed && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: HL_GOLD, background: `${HL_GOLD}18`, padding: '1px 7px', borderRadius: 3, border: `1px solid ${HL_GOLD}44` }}>
            {key} · {prog} · {seed.variant.bpm} BPM
          </span>
        )}
        {inserted && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>✓ INSERTED</span>}
      </div>

      {/* Key selector */}
      <div>
        <SectionLabel>KEY</SectionLabel>
        <div style={{ display: 'flex', gap: 4 }}>
          {ROOT_KEYS.map(k => <Pill key={k} active={key === k} onClick={() => setKey(k)}>{k}</Pill>)}
        </div>
      </div>

      {/* Chord progression */}
      <div>
        <SectionLabel>CHORD PROGRESSION</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PROG_KEYS.map(p => <Pill key={p} active={prog === p} color="var(--accent-purple)" onClick={() => setProg(p)}>{p}</Pill>)}
        </div>
      </div>

      {/* Drum variant */}
      <div>
        <SectionLabel>DRUM PATTERN</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {VARIANT_KEYS.map(v => (
            <Pill key={v} active={variant === v} color="var(--accent-cyan)" onClick={() => setVariant(v)}>
              {v} <span style={{ opacity: 0.6 }}>~{DRUM_VARIANTS[v].bpm}</span>
            </Pill>
          ))}
        </div>
      </div>

      {/* Complexity + Generate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LAYERS</span>
        {[['drums','DRUMS'],['bass','+BASS'],['+guitar','+GUITAR'],['full','FULL']].map(([v, l]) => (
          <Pill key={v} active={complexity === v} color={HL_GOLD} onClick={() => setComplexity(v)}>{l}</Pill>
        ))}
        <button
          onClick={generate}
          style={{
            marginLeft: 'auto', height: 28, padding: '0 20px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${HL_GOLD}`, background: `${HL_GOLD}22`,
            color: HL_GOLD, fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.08em', fontWeight: 600,
          }}
        >
          ⚡ GENERATE
        </button>
      </div>

      {/* Preview */}
      {seed && (
        <>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Drum grid */}
            <div>
              <SectionLabel>DRUMS — <span style={{ color: HL_GOLD }}>{variant} ~{seed.variant.bpm} BPM</span></SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {ROW_ORDER.map(row => (
                  <div key={row} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: ROW_COLORS[row], width: 42, flexShrink: 0 }}>{row}</span>
                    {(seed.variant.steps[row] ?? Array(16).fill(false)).map((on, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                        background: on ? ROW_COLORS[row] : 'var(--bg-element)',
                        border: `1px solid ${on ? ROW_COLORS[row] : 'var(--border-subtle)'}`,
                        marginLeft: i % 4 === 0 && i > 0 ? 4 : 0,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Progression chord voicings */}
            <div>
              <SectionLabel>CHORDS — {prog}</SectionLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                {seed.voicings.map((chord, ci) => (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: HL_GOLD, marginBottom: 2 }}>
                      {seed.progDegrees[ci]}
                    </span>
                    {chord.map((pitch, pi) => (
                      <div key={pi} style={{
                        padding: '1px 5px', borderRadius: 2,
                        background: `${HL_GOLD}22`, border: `1px solid ${HL_GOLD}66`,
                        fontFamily: 'var(--font-mono)', fontSize: 7, color: HL_GOLD,
                      }}>{pitchName(pitch)}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Bass notes */}
            {seed.bass.length > 0 && (
              <div>
                <SectionLabel>BASS — {seed.bass.length} NOTES</SectionLabel>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 200 }}>
                  {seed.bass.slice(0, 16).map((n, i) => (
                    <div key={i} style={{
                      padding: '2px 5px', borderRadius: 3,
                      background: 'rgba(255,107,53,0.18)', border: '1px solid #ff6b35',
                      fontFamily: 'var(--font-mono)', fontSize: 7, color: '#ff6b35',
                    }}>{pitchName(n.pitch)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Guitar arpeggio mini-roll */}
            {seed.guitar.length > 0 && (
              <div>
                <SectionLabel>GUITAR TICKLE — {seed.guitar.length} NOTES (4 BARS)</SectionLabel>
                <div style={{ position: 'relative', width: 220, height: 48, background: 'var(--bg-element)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {[0,1,2,3].map(b => (
                    <div key={b} style={{ position: 'absolute', left: `${b * 25}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--border-faint)' }} />
                  ))}
                  {seed.guitar.map((n, i) => {
                    const minPitch = Math.min(...seed.guitar.map(x => x.pitch));
                    const maxPitch = Math.max(...seed.guitar.map(x => x.pitch));
                    const range = Math.max(maxPitch - minPitch, 1);
                    const pct = (n.pitch - minPitch) / range;
                    const totalBeats = 16;
                    return (
                      <div key={i} style={{
                        position: 'absolute',
                        left: `${(n.startBeat / totalBeats) * 100}%`,
                        bottom: `${pct * 82}%`,
                        width: 5, height: 4,
                        background: HL_GOLD,
                        borderRadius: 1, opacity: 0.85,
                      }} />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Insert button */}
          <button
            onClick={insert}
            style={{
              alignSelf: 'flex-start', height: 26, padding: '0 18px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${inserted ? '#00ff88' : 'var(--accent-purple)'}`,
              background: inserted ? 'rgba(0,255,136,0.12)' : 'rgba(138,43,226,0.15)',
              color: inserted ? '#00ff88' : 'var(--accent-purple)',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 600,
            }}
          >
            {inserted ? '✓ INSERTED' : '▶ INSERT INTO TRACKS'}
          </button>
        </>
      )}
    </div>
  );
}
