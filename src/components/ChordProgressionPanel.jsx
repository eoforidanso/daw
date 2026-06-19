import { useState, useEffect, useRef, useCallback } from 'react';

// ── Music theory ──────────────────────────────────────────────────────────────

const ROOT_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALE_INTERVALS = {
  major:      [0,2,4,5,7,9,11],
  minor:      [0,2,3,5,7,8,10],
  dorian:     [0,2,3,5,7,9,10],
  mixolydian: [0,2,4,5,7,9,10],
  phrygian:   [0,1,3,5,7,8,10],
  lydian:     [0,2,4,6,7,9,11],
};

// Chord progressions as scale degree indices (0-based)
const PROGRESSIONS = {
  happy:       { degrees: [0,4,5,3], name: 'I – V – vi – IV',  desc: 'Uplifting pop' },
  sad:         { degrees: [5,3,0,4], name: 'vi – IV – I – V',  desc: 'Emotional ballad' },
  tense:       { degrees: [0,6,3,4], name: 'i – VII – iv – V', desc: 'Dark & driving' },
  euphoric:    { degrees: [0,3,4,0], name: 'I – IV – V – I',   desc: 'Gospel / blues' },
  melancholic: { degrees: [5,1,3,0], name: 'vi – ii – IV – I', desc: 'Wistful & slow' },
  mysterious:  { degrees: [0,6,5,4], name: 'i – VII – VI – V', desc: 'Andalusian descent' },
};

function scaleDegreeToMidi(deg, intervals, rootSemi, octave) {
  const octShift = Math.floor(deg / 7);
  const d = deg % 7;
  return 12 * (octave + octShift + 1) + rootSemi + intervals[d];
}

function buildTriad(rootDeg, intervals, rootSemi, octave = 3) {
  return [0, 2, 4].map(off => scaleDegreeToMidi(rootDeg + off, intervals, rootSemi, octave));
}

function chordQuality(triadNotes) {
  const interval = triadNotes[1] - triadNotes[0];
  if (interval === 3) return 'm';
  if (interval === 2) return 'dim';
  return '';
}

function generateProgression(root, scale, mood, n = 4) {
  const rootSemi   = ROOT_NAMES.indexOf(root);
  const intervals  = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.major;
  const { degrees } = PROGRESSIONS[mood] ?? PROGRESSIONS.happy;
  return degrees.slice(0, n).map(deg => {
    const notes   = buildTriad(deg, intervals, rootSemi);
    const quality = chordQuality(notes);
    const name    = ROOT_NAMES[notes[0] % 12] + quality;
    return { notes, name, degree: deg };
  });
}

// ── Mini piano keyboard ───────────────────────────────────────────────────────

const WHITE_SEMIS  = [0,2,4,5,7,9,11];
const BLACK_LAYOUT = [1,3,null,6,8,10]; // null = no black key after E/B

function MiniPiano({ highlightNotes, baseOctave = 3, numOctaves = 2 }) {
  const W = 196, H = 52;
  const wkCount = numOctaves * 7;
  const wkW = W / wkCount;
  const bkW = wkW * 0.6;
  const bkH = H * 0.60;

  const whites = [], blacks = [];
  for (let oct = 0; oct < numOctaves; oct++) {
    WHITE_SEMIS.forEach((semi, ki) => {
      const midi = 12 * (baseOctave + oct + 1) + semi;
      whites.push({ x: (oct * 7 + ki) * wkW, midi, lit: highlightNotes.includes(midi) });
    });
    BLACK_LAYOUT.forEach((semi, ki) => {
      if (semi === null) return;
      const midi = 12 * (baseOctave + oct + 1) + semi;
      const offsets = [0.65, 1.65, null, 3.65, 4.65, 5.65];
      const xOff = offsets[ki];
      if (xOff === null) return;
      blacks.push({ x: (oct * 7 + xOff) * wkW, midi, lit: highlightNotes.includes(midi) });
    });
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', borderRadius: 3, overflow: 'hidden' }}>
      {whites.map(({ x, midi, lit }) => (
        <rect key={midi} x={x + 0.5} y={0} width={wkW - 1} height={H}
          fill={lit ? 'var(--accent-cyan)' : '#e8e8e8'} stroke="#666" strokeWidth={0.5} rx={1} />
      ))}
      {blacks.map(({ x, midi, lit }) => (
        <rect key={midi} x={x} y={0} width={bkW} height={bkH}
          fill={lit ? 'var(--accent-purple)' : '#1c1c1c'} rx={1} />
      ))}
      {/* Note labels for highlighted */}
      {whites.filter(w => w.lit).map(({ x, midi }) => (
        <text key={`lbl${midi}`} x={x + wkW / 2} y={H - 5}
          textAnchor="middle" fill="#000" fontSize={6} fontFamily="monospace" fontWeight="bold">
          {ROOT_NAMES[midi % 12]}
        </text>
      ))}
    </svg>
  );
}

// ── Chord card ────────────────────────────────────────────────────────────────

function ChordCard({ chord, barLabel, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 5, cursor: 'pointer', userSelect: 'none',
        border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-faint)'}`,
        background: isActive ? 'rgba(0,212,180,0.10)' : 'var(--bg-element)',
        padding: '10px 12px', transition: 'all 0.15s', minWidth: 150,
        boxShadow: isActive ? '0 0 0 1px var(--accent-cyan)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
          color: isActive ? 'var(--accent-cyan)' : 'var(--text-bright)', letterSpacing: '0.04em',
        }}>
          {chord.name}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          {barLabel}
        </span>
      </div>
      <MiniPiano highlightNotes={chord.notes} />
      <div style={{ marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        {chord.notes.map(n => ROOT_NAMES[n % 12]).join(' · ')}
        {isActive && <span style={{ color: 'var(--accent-cyan)', marginLeft: 6 }}>▶</span>}
      </div>
    </div>
  );
}

// ── Progression display ───────────────────────────────────────────────────────

function RomanLabel({ degree, scale }) {
  const ROMAN = ['I','II','III','IV','V','VI','VII'];
  const MINOR_SCALES = ['minor','phrygian','dorian'];
  const isMinorKey = MINOR_SCALES.includes(scale);
  const r = ROMAN[degree % 7];
  return isMinorKey ? r.toLowerCase() : r;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChordProgressionPanel({ tracks, onInsert, playNote, onChordSelect }) {
  const [root,       setRoot]       = useState('C');
  const [scale,      setScale]      = useState('major');
  const [mood,       setMood]       = useState('happy');
  const [numChords,  setNumChords]  = useState(4);
  const [bars,       setBars]       = useState(4);
  const [chords,     setChords]     = useState([]);
  const [activeIdx,  setActiveIdx]  = useState(null);
  const [targetId,   setTargetId]   = useState(null);
  const timersRef = useRef([]);

  const ACCENT = 'var(--accent-cyan)';

  useEffect(() => {
    if (tracks.length > 0 && targetId === null) setTargetId(tracks[0].id);
  }, [tracks]);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  useEffect(() => () => clearTimers(), []);

  const generate = () => {
    setChords(generateProgression(root, scale, mood, numChords));
    setActiveIdx(null);
  };

  const playChord = useCallback((chord, idx) => {
    clearTimers();
    setActiveIdx(idx);
    onChordSelect?.(chord.notes);
    chord.notes.forEach((midi, i) => {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      timersRef.current.push(setTimeout(() => playNote?.(freq, 0.9), i * 90));
    });
    timersRef.current.push(setTimeout(() => setActiveIdx(null), chord.notes.length * 90 + 850));
  }, [playNote]);

  const playAll = useCallback(() => {
    clearTimers();
    chords.forEach((chord, ci) => {
      const delay = ci * 1000;
      timersRef.current.push(setTimeout(() => {
        setActiveIdx(ci);
        chord.notes.forEach((midi, ni) => {
          const freq = 440 * Math.pow(2, (midi - 69) / 12);
          timersRef.current.push(setTimeout(() => playNote?.(freq, 0.9), ni * 90));
        });
      }, delay));
    });
    timersRef.current.push(setTimeout(() => setActiveIdx(null), chords.length * 1000 + 200));
  }, [chords, playNote]);

  const handleInsert = () => {
    if (!chords.length || targetId === null) return;
    const beatsPerChord = (bars / numChords) * 4;
    const notes = chords.flatMap((chord, ci) =>
      chord.notes.map((pitch, ni) => ({
        pitch,
        startBeat: ci * beatsPerChord + ni * 0.04,
        durationBeats: beatsPerChord - 0.08,
        velocity: 90 - ni * 8,
      }))
    );
    onInsert?.({ notes, trackId: targetId, bars });
  };

  const sel  = { fontFamily: 'var(--font-mono)', fontSize: 8, background: 'var(--bg-element)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 3, padding: '4px 8px', outline: 'none', cursor: 'pointer' };
  const lbl  = { fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.18em', color: 'var(--text-muted)', display: 'block', marginBottom: 4 };
  const pill = (on) => ({ padding: '4px 10px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${on ? ACCENT : 'var(--border-default)'}`, background: on ? 'rgba(0,212,180,0.12)' : 'none', color: on ? ACCENT : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 8 });

  const prog = PROGRESSIONS[mood];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-void)' }}>
      {/* Controls */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-faint)', display: 'flex', gap: 14, alignItems: 'flex-end', flexShrink: 0, flexWrap: 'wrap' }}>
        <div><span style={lbl}>KEY</span>
          <select value={root} onChange={e => setRoot(e.target.value)} style={sel}>
            {ROOT_NAMES.map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div><span style={lbl}>SCALE</span>
          <select value={scale} onChange={e => setScale(e.target.value)} style={sel}>
            {Object.keys(SCALE_INTERVALS).map(s => <option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}
          </select>
        </div>
        <div><span style={lbl}>MOOD</span>
          <select value={mood} onChange={e => setMood(e.target.value)} style={sel}>
            {Object.entries(PROGRESSIONS).map(([k,v]) => <option key={k} value={k}>{k[0].toUpperCase()+k.slice(1)} — {v.desc}</option>)}
          </select>
        </div>
        <div><span style={lbl}>CHORDS</span>
          <div style={{ display: 'flex', gap: 4 }}>{[4,8].map(n => <button key={n} onClick={() => setNumChords(n)} style={pill(numChords===n)}>{n}</button>)}</div>
        </div>
        <div><span style={lbl}>BARS</span>
          <div style={{ display: 'flex', gap: 4 }}>{[4,8,16].map(b => <button key={b} onClick={() => setBars(b)} style={pill(bars===b)}>{b}</button>)}</div>
        </div>
        <button onClick={generate} style={{ padding: '6px 20px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${ACCENT}`, background: 'rgba(0,212,180,0.12)', color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', fontWeight: 700 }}>
          ◈ GENERATE
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {chords.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: 12 }}>
            <div style={{ fontSize: 32, color: 'var(--border-strong)' }}>♩♩♩♩</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.14em' }}>SELECT KEY · SCALE · MOOD THEN GENERATE</div>
          </div>
        ) : (
          <>
            {/* Progression name badge */}
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--accent-purple)' }}>
                {prog?.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>
                in {root} {scale[0].toUpperCase()+scale.slice(1)} · {bars} bars
              </span>
            </div>

            {/* Chord cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {chords.map((chord, i) => (
                <ChordCard
                  key={i} chord={chord}
                  barLabel={`BAR ${Math.round((i / chords.length) * bars) + 1}`}
                  isActive={activeIdx === i}
                  onClick={() => playChord(chord, i)}
                />
              ))}
            </div>

            {/* Roman numeral progression */}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.14em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              {chords.map((chord, i) => (
                <span key={i} style={{ color: activeIdx === i ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                  {chord.name}{i < chords.length - 1 && <span style={{ color: 'var(--border-strong)', margin: '0 6px' }}>→</span>}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border-faint)' }}>
              <button onClick={playAll} style={{ padding: '6px 14px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em' }}>
                ▶ PLAY ALL
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>INSERT TO</span>
                <select value={targetId ?? ''} onChange={e => setTargetId(e.target.value)} style={{ ...sel, minWidth: 110 }}>
                  {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button
                  onClick={handleInsert}
                  disabled={!targetId || !chords.length}
                  style={{
                    padding: '6px 16px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid var(--accent-purple)', background: 'rgba(155,114,255,0.12)', color: 'var(--accent-purple)',
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', fontWeight: 700,
                    opacity: targetId && chords.length ? 1 : 0.5,
                  }}
                >
                  ↓ INSERT {bars}B CLIP
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
