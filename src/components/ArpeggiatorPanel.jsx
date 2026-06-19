const ROOT_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function MiniPianoARP({ chord }) {
  const WHITE_SEMIS = [0,2,4,5,7,9,11];
  const BLACK_XS    = [0.65, 1.65, null, 3.65, 4.65, 5.65];
  const NUM_OCTS    = 3, BASE_OCT = 3;
  const W = 240, H = 44;
  const wkCount = NUM_OCTS * 7;
  const wkW = W / wkCount;
  const bkW = wkW * 0.6;
  const bkH = H * 0.6;

  const whites = [], blacks = [];
  for (let oct = 0; oct < NUM_OCTS; oct++) {
    WHITE_SEMIS.forEach((semi, ki) => {
      const midi = 12 * (BASE_OCT + oct + 1) + semi;
      whites.push({ x: (oct * 7 + ki) * wkW, midi, lit: chord.includes(midi) });
    });
    [1,3,null,6,8,10].forEach((semi, ki) => {
      if (semi === null || BLACK_XS[ki] === null) return;
      const midi = 12 * (BASE_OCT + oct + 1) + semi;
      blacks.push({ x: (oct * 7 + BLACK_XS[ki]) * wkW, midi, lit: chord.includes(midi) });
    });
  }

  return (
    <svg width={W} height={H} style={{ display: 'block', borderRadius: 2, overflow: 'hidden' }}>
      {whites.map(({ x, midi, lit }) => (
        <rect key={midi} x={x + 0.5} y={0} width={wkW - 1} height={H}
          fill={lit ? 'var(--accent-cyan)' : '#e8e8e8'} stroke="#444" strokeWidth={0.5} rx={1} />
      ))}
      {blacks.map(({ x, midi, lit }) => (
        <rect key={midi} x={x} y={0} width={bkW} height={bkH}
          fill={lit ? 'var(--accent-purple)' : '#1a1a1a'} rx={1} />
      ))}
    </svg>
  );
}

export default function ArpeggiatorPanel({
  tracks, isPlaying,
  arpEnabled, setArpEnabled,
  arpChord,   setArpChord,
  arpRate,    setArpRate,
  arpPattern, setArpPattern,
  arpOctaves, setArpOctaves,
  arpGate,    setArpGate,
  arpTrackId, setArpTrackId,
}) {
  const ACCENT = 'var(--accent-cyan)';
  const PURPLE = 'var(--accent-purple)';
  const ORANGE = 'var(--accent-orange)';
  const mono = { fontFamily: 'var(--font-mono)' };
  const lbl  = { ...mono, fontSize: 6, letterSpacing: '0.18em', color: 'var(--text-muted)', display: 'block', marginBottom: 5 };

  const pill = (on, color = ACCENT) => ({
    padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
    border: `1px solid ${on ? color : 'var(--border-default)'}`,
    background: on ? color + '22' : 'var(--bg-element)',
    color: on ? color : 'var(--text-muted)',
    ...mono, fontSize: 8, letterSpacing: '0.1em',
  });

  // Build preview sequence for display
  const previewSeq = (() => {
    if (!arpChord.length) return [];
    const sorted = [...arpChord].sort((a, b) => a - b);
    let notes = [];
    for (let o = 0; o < arpOctaves; o++) notes = [...notes, ...sorted.map(p => p + o * 12)];
    switch (arpPattern) {
      case 'down':   return [...notes].reverse();
      case 'bounce': return notes.length < 2 ? notes : [...notes, ...[...notes].reverse().slice(1, -1)];
      default: return notes;
    }
  })();

  const chordLabel = arpChord.length
    ? arpChord.sort((a, b) => a - b).map(p => ROOT_NAMES[p % 12]).join(' · ')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-void)', padding: 16, gap: 16, overflowY: 'auto' }}>

      {/* Enable row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => setArpEnabled(v => !v)}
          style={{
            padding: '8px 22px', borderRadius: 4, cursor: 'pointer',
            border: `2px solid ${arpEnabled ? ACCENT : 'var(--border-subtle)'}`,
            background: arpEnabled ? ACCENT + '22' : 'var(--bg-element)',
            color: arpEnabled ? ACCENT : 'var(--text-muted)',
            ...mono, fontSize: 10, letterSpacing: '0.22em', fontWeight: 700,
          }}
        >
          {arpEnabled ? '◈ ARP ON' : '◇ ARP OFF'}
        </button>
        {arpEnabled && isPlaying && (
          <span style={{ ...mono, fontSize: 8, color: ACCENT, letterSpacing: '0.15em' }}>
            ▶ PLAYING
          </span>
        )}
        {arpEnabled && !isPlaying && (
          <span style={{ ...mono, fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            Press play to hear
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Chord display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
          <div>
            <span style={lbl}>ACTIVE CHORD</span>
            <div style={{ padding: '10px 12px', borderRadius: 4, background: 'var(--bg-element)', border: `1px solid ${arpChord.length ? 'var(--accent-cyan)' : 'var(--border-faint)'}` }}>
              {arpChord.length ? (
                <>
                  <div style={{ ...mono, fontSize: 11, color: ACCENT, letterSpacing: '0.12em', marginBottom: 8, fontWeight: 700 }}>
                    {chordLabel}
                  </div>
                  <MiniPianoARP chord={arpChord} />
                </>
              ) : (
                <div style={{ ...mono, fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em', lineHeight: 1.6 }}>
                  Go to CHORDS tab → click a chord card<br />to load it here, then enable ARP.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 200 }}>
          <div>
            <span style={lbl}>RATE</span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['1/32','1/16','1/8','1/4'].map(r => (
                <button key={r} onClick={() => setArpRate(r)} style={pill(arpRate === r)}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <span style={lbl}>PATTERN</span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['up','down','bounce','random'].map(p => (
                <button key={p} onClick={() => setArpPattern(p)} style={pill(arpPattern === p, PURPLE)}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={lbl}>OCTAVES</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[1, 2, 3].map(o => (
                <button key={o} onClick={() => setArpOctaves(o)} style={pill(arpOctaves === o, ORANGE)}>
                  {o} OCT
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={lbl}>GATE</span>
              <span style={{ ...mono, fontSize: 7, color: ACCENT }}>{Math.round(arpGate * 100)}%</span>
            </div>
            <input
              type="range" min="0.05" max="1" step="0.05" value={arpGate}
              onChange={e => setArpGate(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)', height: 3 }}
            />
          </div>

          <div>
            <span style={lbl}>OUTPUT TRACK</span>
            <select
              value={arpTrackId ?? ''}
              onChange={e => setArpTrackId(+e.target.value || e.target.value)}
              style={{
                ...mono, fontSize: 8, background: 'var(--bg-element)',
                border: '1px solid var(--border-default)', color: 'var(--text-primary)',
                borderRadius: 3, padding: '4px 8px', outline: 'none', cursor: 'pointer',
              }}
            >
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Sequence preview */}
      {previewSeq.length > 0 && (
        <div>
          <span style={lbl}>SEQUENCE PREVIEW — {previewSeq.length} STEPS</span>
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px', background: 'var(--bg-element)', borderRadius: 3, border: '1px solid var(--border-faint)', overflowX: 'auto' }}>
            {previewSeq.map((pitch, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 3,
                  background: ACCENT + '18', border: `1px solid ${ACCENT}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ ...mono, fontSize: 7, color: ACCENT }}>
                    {ROOT_NAMES[pitch % 12]}{Math.floor(pitch / 12) - 1}
                  </span>
                </div>
                <span style={{ ...mono, fontSize: 6, color: 'var(--text-muted)' }}>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
