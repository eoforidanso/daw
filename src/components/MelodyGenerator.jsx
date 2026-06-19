import { useState, useCallback } from 'react';
import { MelodyGen, SCALES, STYLES } from '../audio/MelodyGen.js';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ROOT_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ midi: 60 + i, label: NOTE_NAMES[i] }));

function KnobSlider({ label, min, max, value, step = 1, onChange, color = 'var(--accent-cyan)', unit = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          WebkitAppearance: 'none', height: 3, outline: 'none',
          borderRadius: 2, cursor: 'pointer',
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, var(--bg-section) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

// Visual note preview — mini piano roll-style
function NotePreview({ notes, bars }) {
  if (!notes.length) return (
    <div style={{ flex: 1, background: 'var(--bg-void)', border: '1px solid var(--border-faint)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>NO PREVIEW</span>
    </div>
  );

  const maxBeat = bars * 4;
  const pitches = notes.map(n => n.pitch);
  const lo = Math.min(...pitches) - 1;
  const hi = Math.max(...pitches) + 1;
  const pitchRange = Math.max(hi - lo, 4);
  const W = 380, H = 64;

  return (
    <svg width={W} height={H} style={{ background: 'var(--bg-void)', border: '1px solid var(--border-faint)', borderRadius: 3, display: 'block' }}>
      {/* Beat lines */}
      {Array.from({ length: bars * 4 + 1 }, (_, i) => (
        <line key={i} x1={(i / (bars * 4)) * W} y1={0} x2={(i / (bars * 4)) * W} y2={H}
          stroke={i % 4 === 0 ? 'var(--border-subtle)' : 'var(--border-faint)'} strokeWidth={1} />
      ))}
      {/* Notes */}
      {notes.map(n => {
        const x = (n.startBeat / maxBeat) * W;
        const w = Math.max(3, (n.durationBeats / maxBeat) * W - 1);
        const y = H - ((n.pitch - lo) / pitchRange) * H;
        const h = Math.max(3, H / pitchRange - 1);
        const alpha = Math.round((n.velocity / 127) * 55 + 45).toString(16);
        return (
          <rect key={n.id} x={x} y={Math.max(0, y - h)} width={w} height={h}
            rx={1} fill={`var(--accent-cyan)${alpha}`}
            stroke="var(--accent-cyan)" strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
}

export default function MelodyGenerator({ onInsert, tracks }) {
  const [rootMidi, setRootMidi]   = useState(60);
  const [scaleId, setScaleId]     = useState('minor');
  const [styleId, setStyleId]     = useState('edm');
  const [bars, setBars]           = useState(4);
  const [density, setDensity]     = useState(65);
  const [targetTrack, setTarget]  = useState(6);
  const [preview, setPreview]     = useState([]);
  const [generating, setGenning]  = useState(false);
  const [insertMsg, setInsertMsg] = useState('');

  const generate = useCallback(() => {
    setGenning(true);
    // Small timeout so the UI updates before heavy computation
    setTimeout(() => {
      const notes = MelodyGen.generate({
        rootMidi, scaleId, styleId, bars, density: density / 100,
      });
      setPreview(notes);
      setGenning(false);
    }, 30);
  }, [rootMidi, scaleId, styleId, bars, density]);

  const handleInsert = () => {
    if (!preview.length) { generate(); return; }
    onInsert({ notes: preview, trackId: targetTrack, bars });
    setInsertMsg(`✓ Inserted ${preview.length} notes into ${tracks.find(t => t.id === targetTrack)?.name ?? 'track'}`);
    setTimeout(() => setInsertMsg(''), 2500);
  };

  const regenerate = () => { setPreview([]); generate(); };

  const scaleList = MelodyGen.scales;
  const styleList = MelodyGen.styles;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--bg-void)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--accent-cyan)' }}>AI MELODY</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', color: 'var(--text-muted)', marginTop: 2 }}>MARKOV CHAIN + MOTIF DEVELOPMENT</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={regenerate} disabled={generating} style={{
            padding: '6px 14px', borderRadius: 3, border: '1px solid var(--border-strong)',
            background: 'var(--bg-element)', color: generating ? 'var(--text-muted)' : 'var(--text-primary)',
            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', cursor: generating ? 'not-allowed' : 'pointer',
          }}>
            {generating ? 'GENERATING…' : '⟳ GENERATE'}
          </button>
          <button onClick={handleInsert} style={{
            padding: '6px 16px', borderRadius: 3,
            border: '1px solid var(--accent-cyan)', background: 'rgba(0,212,180,0.1)',
            color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 8,
            letterSpacing: '0.18em', cursor: 'pointer',
          }}>
            INSERT
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border-faint)' }}>

        {/* Root + Scale */}
        <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-faint)', minWidth: 200, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 8 }}>SCALE</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.1em' }}>ROOT</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, maxWidth: 100 }}>
                {ROOT_OPTIONS.map(r => (
                  <button key={r.midi} onClick={() => setRootMidi(r.midi)} style={{
                    width: 28, height: 22, borderRadius: 2, fontSize: 7,
                    fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.05em',
                    border: `1px solid ${rootMidi === r.midi ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                    background: rootMidi === r.midi ? 'var(--accent-cyan)' : 'var(--bg-element)',
                    color: rootMidi === r.midi ? '#000' : 'var(--text-secondary)',
                  }}>{r.label}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.1em' }}>MODE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 120, overflowY: 'auto' }}>
                {scaleList.map(s => (
                  <button key={s.id} onClick={() => setScaleId(s.id)} style={{
                    padding: '3px 8px', borderRadius: 2, textAlign: 'left',
                    fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.08em', cursor: 'pointer',
                    border: `1px solid ${scaleId === s.id ? 'var(--accent-purple)' : 'var(--border-faint)'}`,
                    background: scaleId === s.id ? 'rgba(155,114,255,0.18)' : 'var(--bg-element)',
                    color: scaleId === s.id ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Style */}
        <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-faint)', minWidth: 160, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 8 }}>STYLE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {styleList.map(s => (
              <button key={s.id} onClick={() => setStyleId(s.id)} style={{
                padding: '5px 10px', borderRadius: 2, textAlign: 'left',
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', cursor: 'pointer',
                border: `1px solid ${styleId === s.id ? 'var(--accent-orange)' : 'var(--border-faint)'}`,
                background: styleId === s.id ? 'rgba(255,107,53,0.15)' : 'var(--bg-element)',
                color: styleId === s.id ? 'var(--accent-orange)' : 'var(--text-secondary)',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div style={{ padding: '10px 14px', borderRight: '1px solid var(--border-faint)', minWidth: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>PARAMETERS</div>
          <KnobSlider label="BARS" min={1} max={16} value={bars} onChange={setBars} color="var(--accent-blue)" />
          <KnobSlider label="DENSITY" min={10} max={100} value={density} onChange={setDensity} color="var(--accent-cyan)" unit="%" />
        </div>

        {/* Target + Insert */}
        <div style={{ padding: '10px 14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>TARGET TRACK</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {tracks.filter(t => t.type === 'synth' || t.type === 'fx').map(t => (
              <button key={t.id} onClick={() => setTarget(t.id)} style={{
                padding: '4px 10px', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em', cursor: 'pointer',
                border: `1px solid ${targetTrack === t.id ? t.color : 'var(--border-faint)'}`,
                background: targetTrack === t.id ? t.color + '20' : 'var(--bg-element)',
                color: targetTrack === t.id ? t.color : 'var(--text-secondary)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: t.color, flexShrink: 0 }} />
                {t.name}
              </button>
            ))}
          </div>
          {insertMsg && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-cyan)', letterSpacing: '0.08em', marginTop: 4 }}>
              {insertMsg}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
            PREVIEW {preview.length > 0 ? `— ${preview.length} NOTES` : '— CLICK GENERATE'}
          </span>
          {preview.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {bars} BARS · {MelodyGen.scales.find(s => s.id === scaleId)?.label} · {NOTE_NAMES[rootMidi % 12]}
            </span>
          )}
        </div>
        <NotePreview notes={preview} bars={bars} />
      </div>
    </div>
  );
}
