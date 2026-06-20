import { useState, useCallback } from 'react';

const HL_GOLD = '#f5a623';

const ROOT_NOTES = { C:60, D:62, 'Eb':63, F:65, G:67, 'Ab':68, 'Bb':70 };
const ROOT_KEYS  = Object.keys(ROOT_NOTES);

// Include the major 6th — the defining interval of Highlife harmony
const CHORD_SHAPES = {
  I:    [0, 4, 7, 9],
  ii:   [2, 5, 9, 11],
  IV:   [5, 9, 12, 14],
  V:    [7, 11, 14, 16],
  vi:   [9, 12, 16, 17],
  bVII: [10, 14, 17, 19],
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

// Agogo bell clave (the soul of Highlife): steps 0,3,5,8,11,13
const AGOGO = [1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0].map(Boolean);

const DRUM_VARIANTS = {
  // E.T. Mensah / Dr. K. Gyasi — classic guitar-band Highlife
  'Guitar Band': {
    bpm: 122,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
      CLAP:     AGOGO,
    },
  },
  // Koo Nimo / Onyina — acoustic palm wine guitar feel
  'Palm Wine': {
    bpm: 104,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1].map(Boolean),
      CLAP:     [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0].map(Boolean),
    },
  },
  // Ebo Taylor / Gyedu-Blay Ambolley — afro-funk Highlife
  'Afro-Highlife': {
    bpm: 114,
    steps: {
      KICK:     [1,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,1,0].map(Boolean),
      SNARE:    [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0].map(Boolean),
      'HI-HAT': [1,0,1,0, 0,1,1,0, 1,0,1,0, 0,1,1,0].map(Boolean),
      CLAP:     AGOGO,
    },
  },
  // Daddy Lumba / Ofori Amponsah — contemporary burger highlife
  'Contemporary': {
    bpm: 110,
    steps: {
      KICK:     [1,0,0,0, 1,0,0,1, 0,0,1,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean),
      'HI-HAT': [1,1,0,1, 0,1,0,1, 1,1,0,1, 0,1,0,1].map(Boolean),
      CLAP:     [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
    },
  },
  // Ramblers / Stargazers — big band dance hall Highlife
  'Dance Band': {
    bpm: 120,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0].map(Boolean),
      SNARE:    [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
      'HI-HAT': [1,0,1,1, 0,1,1,0, 1,0,1,1, 0,1,1,0].map(Boolean),
      CLAP:     AGOGO,
    },
  },
  // Traditional Akan percussion influence
  'Festival': {
    bpm: 108,
    steps: {
      KICK:     [1,0,1,0, 0,0,1,0, 1,0,0,0, 1,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,1,0,0, 0,0,1,0].map(Boolean),
      'HI-HAT': [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1].map(Boolean),
      CLAP:     [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0].map(Boolean),
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

// Authentic Highlife "tickle" — uses the major 6th (chord[3]) prominently.
// Pattern per bar: 3rd → 5th → 6th → 5th | 3rd → oct-root → 5th → 6th
// Velocity alternation gives the rolling, strummed feel.
function buildGuitar(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];

  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    const third   = chord[1];
    const fifth   = chord[2];
    const sixth   = chord[3] ?? chord[2] + 2; // major 6th or fallback
    const octRoot = chord[0] + 12;

    const pattern = [
      { pitch: third,   vel: 82 },
      { pitch: fifth,   vel: 65 },
      { pitch: sixth,   vel: 88 },  // 6th is the accent
      { pitch: fifth,   vel: 60 },
      { pitch: third,   vel: 78 },
      { pitch: octRoot, vel: 70 },
      { pitch: fifth,   vel: 63 },
      { pitch: sixth,   vel: 75 },
    ];

    pattern.forEach(({ pitch, vel }, ei) => {
      notes.push({
        id: `hl_g_${ci}_${ei}`,
        pitch,
        startBeat: barStart + ei * 0.5,
        durationBeats: 0.42,
        velocity: vel,
      });
    });
  });

  return notes;
}

// Syncopated walking bass — root on 1, syncopated 8th on the "and", walk up to 5th,
// 4th as passing tone, 3rd on beat 3, resolve back to root on 4 with a leading 2nd.
function buildBass(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];

  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    const r = chord[0] - 12; // bass octave

    const pattern = [
      { interval: 0,  beat: 0,   dur: 0.38, vel: 100 },
      { interval: 0,  beat: 0.5, dur: 0.28, vel: 68  },  // syncopated ghost
      { interval: 7,  beat: 1,   dur: 0.38, vel: 85  },  // 5th
      { interval: 5,  beat: 1.5, dur: 0.25, vel: 65  },  // 4th (passing)
      { interval: 4,  beat: 2,   dur: 0.38, vel: 80  },  // 3rd
      { interval: 7,  beat: 2.5, dur: 0.25, vel: 62  },  // 5th
      { interval: 0,  beat: 3,   dur: 0.38, vel: 88  },  // root
      { interval: 2,  beat: 3.5, dur: 0.25, vel: 60  },  // 2nd → leads to next root
    ];

    pattern.forEach(({ interval, beat, dur, vel }) => {
      notes.push({
        id: `hl_b_${ci}_${beat}`,
        pitch: r + interval,
        startBeat: barStart + beat,
        durationBeats: dur,
        velocity: vel,
      });
    });
  });

  return notes;
}

// Highlife chord stabs: beat 1 and the "and of 3" (2.5) — the classic offbeat accent.
function buildChords(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];

  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    [{ beat: 0, vel: 78 }, { beat: 2.5, vel: 65 }].forEach(({ beat, vel }) => {
      chord.forEach((pitch, pi) => {
        notes.push({
          id: `hl_c_${ci}_${beat}_${pi}`,
          pitch,
          startBeat: barStart + beat,
          durationBeats: 0.5,
          velocity: vel,
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
      fontFamily: 'var(--font-mono)', fontSize: 8, flexShrink: 0,
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

export default function HighlifePanel({ tracks, arpChord, onStepsChange, onBpmChange, dispatchClips }) {
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
    onBpmChange?.(seed.variant.bpm);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: HL_GOLD }}>HIGHLIFE</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', background: 'var(--bg-element)', padding: '1px 8px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
          Ghanaian Highlife — guitar tickle · agogo bell · walking bass · 6th chords
        </span>
        {seed && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: HL_GOLD, background: `${HL_GOLD}18`, padding: '1px 7px', borderRadius: 3, border: `1px solid ${HL_GOLD}44` }}>
            {key} · {prog} · {seed.variant.bpm} BPM
          </span>
        )}
        {inserted && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>✓ INSERTED</span>}
      </div>

      {/* Key */}
      <div>
        <SectionLabel>KEY</SectionLabel>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ROOT_KEYS.map(k => <Pill key={k} active={key === k} onClick={() => setKey(k)}>{k}</Pill>)}
        </div>
      </div>

      {/* Progression */}
      <div>
        <SectionLabel>PROGRESSION</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PROG_KEYS.map(p => <Pill key={p} active={prog === p} color="var(--accent-purple)" onClick={() => setProg(p)}>{p}</Pill>)}
        </div>
      </div>

      {/* Drum variant */}
      <div>
        <SectionLabel>DRUM VARIANT</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {VARIANT_KEYS.map(v => (
            <Pill key={v} active={variant === v} color="var(--accent-cyan)" onClick={() => setVariant(v)}>
              {v} <span style={{ opacity: 0.55 }}>~{DRUM_VARIANTS[v].bpm}</span>
            </Pill>
          ))}
        </div>
      </div>

      {/* Complexity + Generate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
              <SectionLabel>
                DRUMS — <span style={{ color: HL_GOLD }}>{variant} ~{seed.variant.bpm} BPM</span>
                <span style={{ color: 'var(--accent-cyan)', marginLeft: 8 }}>CLAP = AGOGO BELL</span>
              </SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {ROW_ORDER.map(row => (
                  <div key={row} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: ROW_COLORS[row], width: 46, flexShrink: 0 }}>{row}</span>
                    {(seed.variant.steps[row] ?? Array(16).fill(false)).map((on, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                        background: on ? ROW_COLORS[row] : 'var(--bg-element)',
                        border: `1px solid ${on ? ROW_COLORS[row] : 'var(--border-subtle)'}`,
                        marginLeft: i % 4 === 0 && i > 0 ? 4 : 0,
                        boxShadow: on ? `0 0 4px ${ROW_COLORS[row]}66` : 'none',
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Chord voicings — show the 6th */}
            <div>
              <SectionLabel>{prog} <span style={{ color: HL_GOLD }}>· major 6th chords</span></SectionLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                {seed.voicings.map((chord, ci) => (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: HL_GOLD, marginBottom: 2 }}>
                      {seed.progDegrees[ci]}
                    </span>
                    {chord.map((pitch, pi) => (
                      <div key={pi} style={{
                        padding: '1px 5px', borderRadius: 2,
                        background: pi === 3 ? `${HL_GOLD}44` : `${HL_GOLD}18`,
                        border: `1px solid ${pi === 3 ? HL_GOLD : HL_GOLD + '55'}`,
                        fontFamily: 'var(--font-mono)', fontSize: 7,
                        color: pi === 3 ? HL_GOLD : HL_GOLD + 'cc',
                      }}>
                        {pitchName(pitch)}{pi === 3 ? ' 6' : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Bass */}
            {seed.bass.length > 0 && (
              <div>
                <SectionLabel>WALKING BASS — {seed.bass.length} NOTES</SectionLabel>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 200 }}>
                  {seed.bass.slice(0, 16).map((n, i) => (
                    <div key={i} style={{
                      padding: '2px 4px', borderRadius: 2,
                      background: 'rgba(255,107,53,0.18)', border: '1px solid #ff6b35',
                      fontFamily: 'var(--font-mono)', fontSize: 7, color: '#ff6b35',
                    }}>{pitchName(n.pitch)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Guitar tickle mini-roll */}
            {seed.guitar.length > 0 && (
              <div>
                <SectionLabel>GUITAR TICKLE — 6th accent highlighted</SectionLabel>
                <div style={{ position: 'relative', width: 240, height: 52, background: 'var(--bg-element)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {[0,1,2,3].map(b => (
                    <div key={b} style={{ position: 'absolute', left: `${b * 25}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--border-faint)' }} />
                  ))}
                  {(() => {
                    const minP = Math.min(...seed.guitar.map(x => x.pitch));
                    const maxP = Math.max(...seed.guitar.map(x => x.pitch));
                    const range = Math.max(maxP - minP, 1);
                    return seed.guitar.map((n, i) => {
                      const pct = (n.pitch - minP) / range;
                      const is6th = n.velocity >= 85; // 6th has the highest velocity
                      return (
                        <div key={i} style={{
                          position: 'absolute',
                          left: `${(n.startBeat / 16) * 100}%`,
                          bottom: `${pct * 84}%`,
                          width: is6th ? 7 : 5,
                          height: is6th ? 5 : 4,
                          background: is6th ? HL_GOLD : `${HL_GOLD}88`,
                          borderRadius: 1,
                          boxShadow: is6th ? `0 0 3px ${HL_GOLD}` : 'none',
                        }} />
                      );
                    });
                  })()}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginTop: 3 }}>
                  <span style={{ color: HL_GOLD }}>■</span> = 6th note accent
                </div>
              </div>
            )}
          </div>

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
