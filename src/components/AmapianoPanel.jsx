import { useState, useCallback } from 'react';

const AMA_TEAL = '#00c9a7';

const ROOT_NOTES = { 'Ab':68, 'A':69, 'Bb':70, 'B':71, 'C':60, 'D':62, 'Eb':63, 'F':65, 'G':67 };
const ROOT_KEYS  = Object.keys(ROOT_NOTES);

// Amapiano harmony — minor with 7ths and 9ths (jazzy, soulful)
const CHORD_SHAPES = {
  'Im7':    [0, 3, 7, 10],
  'IIm7':   [2, 5, 9, 12],
  'IVm7':   [5, 8, 12, 15],
  'V7':     [7, 11, 14, 17],
  'bVImaj7':[8, 12, 15, 19],
  'bVII7':  [10, 14, 17, 21],
};

const PROGRESSIONS = {
  'Classic Ama':   ['Im7','bVImaj7','IVm7','V7'],
  'Pata Pata':     ['Im7','IIm7','bVImaj7','V7'],
  'Deep House':    ['Im7','bVII7','bVImaj7','IVm7'],
  'Gospel Ama':    ['Im7','IVm7','Im7','V7'],
  'Jazz Ama':      ['IIm7','V7','Im7','bVImaj7'],
  'Log Drum Vibe': ['Im7','bVImaj7','Im7','bVII7'],
};
const PROG_KEYS = Object.keys(PROGRESSIONS);

const ROW_COLORS = { KICK:'#ff6b35', SNARE:'#4a9eff', 'HI-HAT':'#00d4b4', CLAP:'#ff4466' };
const ROW_ORDER  = ['KICK','SNARE','HI-HAT','CLAP'];
const PITCH_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function pitchName(midi) { return PITCH_NAMES[midi % 12] + Math.floor(midi / 12 - 1); }

// Sgubhu: the signature Amapiano kick — heavy, syncopated, sub-heavy
const SGUBHU = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0].map(Boolean);

const DRUM_VARIANTS = {
  // Kabza De Small / DJ Maphorisa — the quintessential modern Amapiano
  'Sgubhu': {
    bpm: 114,
    steps: {
      KICK:     SGUBHU,
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean),
      CLAP:     [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0].map(Boolean),
    },
  },
  // Piano-driven, lighter kick, more chord stabs
  'Piano-Piano': {
    bpm: 112,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
      CLAP:     [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0].map(Boolean),
    },
  },
  // Slower, deeper, more atmospheric
  'Deep Ama': {
    bpm: 108,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
      'HI-HAT': [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1].map(Boolean),
      CLAP:     [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
    },
  },
  // Dance floor energy — faster, more active
  'Dance Floor': {
    bpm: 116,
    steps: {
      KICK:     [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [1,1,0,1, 0,1,1,0, 1,1,0,1, 0,1,1,0].map(Boolean),
      CLAP:     [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0].map(Boolean),
    },
  },
  // Sunset / soulful — relaxed, jazzy
  'Sunset Ama': {
    bpm: 106,
    steps: {
      KICK:     [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0].map(Boolean),
      SNARE:    [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0].map(Boolean),
      'HI-HAT': [1,0,1,1, 0,1,0,0, 1,0,1,1, 0,1,0,0].map(Boolean),
      CLAP:     [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,1,0,0].map(Boolean),
    },
  },
};

const VARIANT_KEYS = Object.keys(DRUM_VARIANTS);

function buildVoicings(root, progDegrees) {
  return progDegrees.map(deg => {
    const ivs = CHORD_SHAPES[deg] ?? CHORD_SHAPES['Im7'];
    return ivs.map(i => root + i);
  });
}

// Log drum bass — the signature Amapiano melodic bass element.
// Short tonal bass hits: root on 1, 5th on "and of 2", minor 3rd on 3, syncopated hit on "and of 4"
function buildLogDrum(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];
  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    const r = chord[0] - 12; // bass octave
    // Log drum pattern: root, 5th, min3rd, syncopated
    const pattern = [
      { interval: 0,  beat: 0,    dur: 0.35, vel: 105 },
      { interval: 0,  beat: 0.75, dur: 0.22, vel: 72  },  // off-beat ghost
      { interval: 7,  beat: 1.5,  dur: 0.35, vel: 88  },  // 5th on "and of 2"
      { interval: 3,  beat: 2,    dur: 0.35, vel: 82  },  // minor 3rd
      { interval: 7,  beat: 2.5,  dur: 0.22, vel: 65  },  // 5th ghost
      { interval: 0,  beat: 3,    dur: 0.35, vel: 92  },  // root on 4
      { interval: 10, beat: 3.5,  dur: 0.25, vel: 68  },  // min 7th leading
    ];
    pattern.forEach(({ interval, beat, dur, vel }) => {
      notes.push({
        id: `ama_b_${ci}_${beat}`,
        pitch: r + interval,
        startBeat: barStart + beat,
        durationBeats: dur,
        velocity: vel,
      });
    });
  });
  return notes;
}

// Piano stabs — characteristic Amapiano piano: offbeat stabs on "and of 1" and "and of 3"
// Also includes a roll on beat 4 into the next bar
function buildPiano(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];
  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    // Amapiano piano stab positions: 0.5, 2.5 (off-beats) + a chord hit on beat 1
    const stabs = [
      { beat: 0,   vel: 72, dur: 0.4 },   // downbeat (softer)
      { beat: 0.5, vel: 82, dur: 0.35 },  // "and of 1" — the main stab
      { beat: 2.5, vel: 85, dur: 0.35 },  // "and of 3" — second main stab
      { beat: 3.75,vel: 65, dur: 0.2  },  // pick-up into next bar
    ];
    stabs.forEach(({ beat, vel, dur }) => {
      chord.forEach((pitch, pi) => {
        notes.push({
          id: `ama_p_${ci}_${beat}_${pi}`,
          pitch,
          startBeat: barStart + beat,
          durationBeats: dur,
          velocity: vel - pi * 5, // top notes slightly softer
        });
      });
    });
  });
  return notes;
}

// Flute / lead — soulful melodic line, one note at a time
// Uses root, 2nd, min3rd, 5th, min7th of the chord
function buildFlute(root, progDegrees) {
  const voicings = buildVoicings(root, progDegrees);
  const notes = [];
  voicings.forEach((chord, ci) => {
    const barStart = ci * 4;
    const r = chord[0]; // root in mid octave
    // Simple soulful melody: 5th → min7 → root+oct → 5th → min3 → 5th → root | ...
    const melody = [
      { interval: 7,  beat: 0,    vel: 80 },
      { interval: 10, beat: 0.5,  vel: 72 },
      { interval: 12, beat: 1,    vel: 85 },
      { interval: 7,  beat: 1.5,  vel: 68 },
      { interval: 3,  beat: 2,    vel: 78 },
      { interval: 5,  beat: 2.5,  vel: 70 },
      { interval: 7,  beat: 3,    vel: 82 },
      { interval: 10, beat: 3.5,  vel: 65 },
    ];
    melody.forEach(({ interval, beat, vel }) => {
      notes.push({
        id: `ama_f_${ci}_${beat}`,
        pitch: r + interval,
        startBeat: barStart + beat,
        durationBeats: 0.4,
        velocity: vel,
      });
    });
  });
  return notes;
}

function Pill({ active, color = AMA_TEAL, onClick, children }) {
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

function SLabel({ children }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 5 }}>
      {children}
    </div>
  );
}

export default function AmapianoPanel({ tracks, arpChord, onStepsChange, onBpmChange, dispatchClips }) {
  const [key,        setKey]        = useState('Ab');
  const [prog,       setProg]       = useState('Classic Ama');
  const [variant,    setVariant]    = useState('Sgubhu');
  const [complexity, setComplexity] = useState('full');
  const [seed,       setSeed]       = useState(null);
  const [inserted,   setInserted]   = useState(false);

  const generate = useCallback(() => {
    const root        = ROOT_NOTES[key] ?? 68;
    const progDegrees = PROGRESSIONS[prog];
    setSeed({
      variant:    DRUM_VARIANTS[variant],
      logDrum:    buildLogDrum(root, progDegrees),
      piano:      buildPiano(root, progDegrees),
      flute:      buildFlute(root, progDegrees),
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
    const pianoTrack = tracks.find(t => /pad|chord|synth/i.test(t.name));
    const leadTrack  = tracks.find(t => /lead|melody|guitar/i.test(t.name));

    const incBass  = complexity !== 'drums';
    const incPiano = complexity === '+piano' || complexity === 'full';
    const incFlute = complexity === 'full';

    if (incBass && bassTrack && seed.logDrum.length) {
      dispatchClips?.({ type: 'ADD', clip: { id: `ama_b_${now}`, trackId: bassTrack.id, type: 'midi', startBeat: 0, durationBeats: 16, notes: seed.logDrum, label: `${variant} Log Drum`, color: bassTrack.color } });
    }
    if (incPiano && pianoTrack && seed.piano.length) {
      dispatchClips?.({ type: 'ADD', clip: { id: `ama_p_${now}`, trackId: pianoTrack.id, type: 'midi', startBeat: 0, durationBeats: 16, notes: seed.piano, label: `${variant} Piano`, color: pianoTrack.color } });
    }
    if (incFlute && leadTrack && seed.flute.length) {
      dispatchClips?.({ type: 'ADD', clip: { id: `ama_f_${now}`, trackId: leadTrack.id, type: 'midi', startBeat: 0, durationBeats: 16, notes: seed.flute, label: `${variant} Flute`, color: leadTrack.color } });
    }
    setInserted(true);
  }, [seed, variant, complexity, tracks, onStepsChange, onBpmChange, dispatchClips]);

  return (
    <div style={{ padding: '10px 14px', height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: AMA_TEAL }}>AMAPIANO</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', background: 'var(--bg-element)', padding: '1px 8px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
          South African — sgubhu kick · log drum bass · piano stabs · flute
        </span>
        {seed && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: AMA_TEAL, background: `${AMA_TEAL}18`, padding: '1px 7px', borderRadius: 3, border: `1px solid ${AMA_TEAL}44` }}>
            {key}m · {prog} · {seed.variant.bpm} BPM
          </span>
        )}
        {inserted && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>✓ INSERTED</span>}
      </div>

      {/* Key */}
      <div>
        <SLabel>KEY (minor)</SLabel>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ROOT_KEYS.map(k => <Pill key={k} active={key === k} onClick={() => setKey(k)}>{k}m</Pill>)}
        </div>
      </div>

      {/* Progression */}
      <div>
        <SLabel>PROGRESSION</SLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PROG_KEYS.map(p => <Pill key={p} active={prog === p} color="var(--accent-purple)" onClick={() => setProg(p)}>{p}</Pill>)}
        </div>
      </div>

      {/* Drum variant */}
      <div>
        <SLabel>DRUM VARIANT</SLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {VARIANT_KEYS.map(v => (
            <Pill key={v} active={variant === v} color="var(--accent-cyan)" onClick={() => setVariant(v)}>
              {v} <span style={{ opacity: 0.55 }}>~{DRUM_VARIANTS[v].bpm}</span>
            </Pill>
          ))}
        </div>
      </div>

      {/* Layers + Generate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LAYERS</span>
        {[['drums','DRUMS'],['bass','+LOG DRUM'],['+piano','+PIANO'],['full','FULL']].map(([v, l]) => (
          <Pill key={v} active={complexity === v} color={AMA_TEAL} onClick={() => setComplexity(v)}>{l}</Pill>
        ))}
        <button
          onClick={generate}
          style={{
            marginLeft: 'auto', height: 28, padding: '0 20px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${AMA_TEAL}`, background: `${AMA_TEAL}22`,
            color: AMA_TEAL, fontFamily: 'var(--font-mono)', fontSize: 10,
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
              <SLabel>DRUMS — <span style={{ color: AMA_TEAL }}>{variant} ~{seed.variant.bpm} BPM</span>{variant === 'Sgubhu' && <span style={{ color: '#ff6b35', marginLeft: 8 }}>SGUBHU KICK</span>}</SLabel>
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

            {/* Chord voicings */}
            <div>
              <SLabel>{prog} <span style={{ color: AMA_TEAL }}>· min7 / maj7 voicings</span></SLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                {seed.voicings.map((chord, ci) => (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: AMA_TEAL, marginBottom: 2 }}>
                      {seed.progDegrees[ci]}
                    </span>
                    {chord.map((pitch, pi) => (
                      <div key={pi} style={{
                        padding: '1px 5px', borderRadius: 2,
                        background: pi === 3 ? `${AMA_TEAL}44` : `${AMA_TEAL}18`,
                        border: `1px solid ${pi === 3 ? AMA_TEAL : AMA_TEAL + '55'}`,
                        fontFamily: 'var(--font-mono)', fontSize: 7,
                        color: pi === 3 ? AMA_TEAL : AMA_TEAL + 'cc',
                      }}>
                        {pitchName(pitch)}{pi === 3 ? ' 7' : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Log drum bass notes */}
            {seed.logDrum.length > 0 && (
              <div>
                <SLabel>LOG DRUM BASS — {seed.logDrum.length} NOTES</SLabel>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', maxWidth: 200 }}>
                  {seed.logDrum.slice(0, 14).map((n, i) => (
                    <div key={i} style={{
                      padding: '2px 4px', borderRadius: 2,
                      background: 'rgba(255,107,53,0.18)', border: '1px solid #ff6b35',
                      fontFamily: 'var(--font-mono)', fontSize: 7, color: '#ff6b35',
                    }}>{pitchName(n.pitch)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Piano stab mini-roll */}
            {seed.piano.length > 0 && (
              <div>
                <SLabel>PIANO STABS — offbeat chords</SLabel>
                <div style={{ position: 'relative', width: 240, height: 52, background: 'var(--bg-element)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  {[0,1,2,3].map(b => (
                    <div key={b} style={{ position: 'absolute', left: `${b * 25}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--border-faint)' }} />
                  ))}
                  {/* "and" markers at 12.5% and 62.5% (beats 0.5 and 2.5) */}
                  {[0.5, 2.5].map(b => (
                    <div key={b} style={{ position: 'absolute', left: `${(b / 4) * 100}%`, top: 0, bottom: 0, borderLeft: `1px dashed ${AMA_TEAL}44` }} />
                  ))}
                  {(() => {
                    const unique = [...new Set(seed.piano.map(n => n.pitch))].sort();
                    const minP = unique[0];
                    const range = Math.max(unique[unique.length - 1] - minP, 1);
                    return seed.piano.map((n, i) => {
                      const pct = (n.pitch - minP) / range;
                      const isOffbeat = Math.abs((n.startBeat % 4) - 0.5) < 0.1 || Math.abs((n.startBeat % 4) - 2.5) < 0.1;
                      return (
                        <div key={i} style={{
                          position: 'absolute',
                          left: `${(n.startBeat / 16) * 100}%`,
                          bottom: `${pct * 82}%`,
                          width: 4, height: 4,
                          background: isOffbeat ? AMA_TEAL : `${AMA_TEAL}66`,
                          borderRadius: 1,
                          boxShadow: isOffbeat ? `0 0 3px ${AMA_TEAL}` : 'none',
                        }} />
                      );
                    });
                  })()}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginTop: 3 }}>
                  <span style={{ color: AMA_TEAL }}>■</span> = offbeat stab  <span style={{ color: 'var(--border-subtle)', marginLeft: 6 }}>|</span> dashed = "and" positions
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
