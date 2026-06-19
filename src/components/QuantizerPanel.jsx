import { useState, useCallback } from 'react';
import { Quantizer, GRIDS } from '../audio/Quantizer.js';

function Slider({ label, min, max, value, step = 1, onChange, color = 'var(--accent-cyan)', unit = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          WebkitAppearance: 'none', height: 3, outline: 'none', borderRadius: 2, cursor: 'pointer',
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, var(--bg-section) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

export default function QuantizerPanel({ clips, onQuantize, onHumanize }) {
  const [gridId, setGridId]           = useState('1/16');
  const [strength, setStrength]       = useState(100);
  const [swing, setSwing]             = useState(0);
  const [quantizeEnd, setQuantEnd]    = useState(false);
  const [humanTiming, setHumanTiming] = useState(2);
  const [humanVel, setHumanVel]       = useState(10);
  const [humanStretch, setHumanStr]   = useState(0);
  const [activeTab, setActiveTab]     = useState('quantize');
  const [flash, setFlash]             = useState('');

  // Select target clip — only MIDI clips
  const midiClips = (clips ?? []).filter(c => c.type === 'midi' && c.notes?.length > 0);
  const [targetClipId, setTarget] = useState(midiClips[0]?.id ?? null);
  const targetClip = midiClips.find(c => c.id === targetClipId);

  const doQuantize = useCallback(() => {
    if (!targetClip) return;
    const newNotes = Quantizer.quantize(targetClip.notes, {
      gridId, strength: strength / 100, swing: swing / 100, quantizeEnd,
    });
    onQuantize(targetClip.id, newNotes);
    setFlash(`✓ Quantized ${newNotes.length} notes (${gridId}, ${strength}%)`);
    setTimeout(() => setFlash(''), 2500);
  }, [targetClip, gridId, strength, swing, quantizeEnd, onQuantize]);

  const doHumanize = useCallback(() => {
    if (!targetClip) return;
    const newNotes = Quantizer.humanize(targetClip.notes, {
      timing:   humanTiming  / 100,
      velocity: humanVel     / 100,
      stretch:  humanStretch / 100,
    });
    onHumanize(targetClip.id, newNotes);
    setFlash(`✓ Humanized ${newNotes.length} notes`);
    setTimeout(() => setFlash(''), 2500);
  }, [targetClip, humanTiming, humanVel, humanStretch, onHumanize]);

  const doLegato = useCallback(() => {
    if (!targetClip) return;
    onQuantize(targetClip.id, Quantizer.legato(targetClip.notes));
    setFlash('✓ Applied legato');
    setTimeout(() => setFlash(''), 2000);
  }, [targetClip, onQuantize]);

  const doStaccato = useCallback(() => {
    if (!targetClip) return;
    onQuantize(targetClip.id, Quantizer.staccato(targetClip.notes));
    setFlash('✓ Applied staccato');
    setTimeout(() => setFlash(''), 2000);
  }, [targetClip, onQuantize]);

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Left sidebar: clip picker */}
      <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--border-faint)', overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', padding: '0 10px 8px' }}>MIDI CLIPS</div>
        {midiClips.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', padding: '8px 10px' }}>No MIDI clips with notes.</div>
        ) : midiClips.map(clip => (
          <div key={clip.id} onClick={() => setTarget(clip.id)} style={{
            padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            borderLeft: `2px solid ${clip.id === targetClipId ? clip.color : 'transparent'}`,
            background: clip.id === targetClipId ? 'var(--bg-element)' : 'transparent',
            transition: 'all 0.1s',
          }}
            onMouseEnter={e => { if (clip.id !== targetClipId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (clip.id !== targetClipId) e.currentTarget.style.background = ''; }}
          >
            <div style={{ width: 6, height: 6, borderRadius: 1, background: clip.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-primary)', letterSpacing: '0.08em' }}>{clip.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>{clip.notes?.length ?? 0} notes</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
          {[['quantize', 'QUANTIZE'], ['humanize', 'HUMANIZE'], ['articulate', 'ARTICULATE']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: '7px 16px', background: 'none', border: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', cursor: 'pointer',
              color: activeTab === id ? 'var(--accent-cyan)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === id ? 'var(--accent-cyan)' : 'transparent'}`,
            }}>{label}</button>
          ))}
          {flash && (
            <div style={{ marginLeft: 'auto', padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-cyan)', letterSpacing: '0.1em', alignSelf: 'center' }}>
              {flash}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '14px 18px', overflowY: 'auto' }}>
          {activeTab === 'quantize' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Grid */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 8 }}>GRID</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {GRIDS.map(g => (
                    <button key={g.id} onClick={() => setGridId(g.id)} style={{
                      padding: '5px 12px', borderRadius: 3,
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', cursor: 'pointer',
                      border: `1px solid ${gridId === g.id ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
                      background: gridId === g.id ? 'rgba(0,212,180,0.15)' : 'var(--bg-element)',
                      color: gridId === g.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    }}>{g.label}</button>
                  ))}
                </div>
              </div>

              {/* Strength + Swing */}
              <div style={{ display: 'flex', gap: 24, maxWidth: 400 }}>
                <div style={{ flex: 1 }}>
                  <Slider label="STRENGTH" min={0} max={100} value={strength} onChange={setStrength} color="var(--accent-cyan)" unit="%" />
                </div>
                <div style={{ flex: 1 }}>
                  <Slider label="SWING" min={0} max={100} value={swing} onChange={setSwing} color="var(--accent-orange)" unit="%" />
                </div>
              </div>

              {/* Options */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setQuantEnd(v => !v)} style={{
                  padding: '4px 10px', borderRadius: 2,
                  fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em', cursor: 'pointer',
                  border: `1px solid ${quantizeEnd ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                  background: quantizeEnd ? 'rgba(155,114,255,0.15)' : 'var(--bg-element)',
                  color: quantizeEnd ? 'var(--accent-purple)' : 'var(--text-muted)',
                }}>QUANTIZE ENDS</button>
              </div>

              {/* Action */}
              <button onClick={doQuantize} disabled={!targetClip} style={{
                alignSelf: 'flex-start', padding: '8px 24px', borderRadius: 4,
                border: '1px solid var(--accent-cyan)', background: 'rgba(0,212,180,0.12)',
                color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.2em', cursor: targetClip ? 'pointer' : 'not-allowed',
                opacity: targetClip ? 1 : 0.4,
              }}>
                QUANTIZE
              </button>
            </div>
          )}

          {activeTab === 'humanize' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 320 }}>
              <Slider label="TIMING SCATTER" min={0} max={25} step={0.5} value={humanTiming} onChange={setHumanTiming} color="var(--accent-orange)" unit=" ms" />
              <Slider label="VELOCITY SCATTER" min={0} max={40} value={humanVel} onChange={setHumanVel} color="var(--accent-purple)" unit="" />
              <Slider label="LENGTH VARIANCE" min={0} max={50} value={humanStretch} onChange={setHumanStr} color="var(--accent-blue)" unit="%" />
              <button onClick={doHumanize} disabled={!targetClip} style={{
                alignSelf: 'flex-start', padding: '8px 24px', borderRadius: 4,
                border: '1px solid var(--accent-orange)', background: 'rgba(255,107,53,0.12)',
                color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.2em', cursor: targetClip ? 'pointer' : 'not-allowed',
                opacity: targetClip ? 1 : 0.4,
              }}>HUMANIZE</button>
            </div>
          )}

          {activeTab === 'articulate' && (
            <div style={{ display: 'flex', flex: 1, gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'LEGATO', desc: 'Stretch each note to the next', fn: doLegato, color: 'var(--accent-cyan)' },
                { label: 'STACCATO', desc: 'Shorten all notes to 50%', fn: doStaccato, color: 'var(--accent-orange)' },
              ].map(a => (
                <div key={a.label} onClick={targetClip ? a.fn : undefined} style={{
                  padding: '14px 20px', borderRadius: 4, cursor: targetClip ? 'pointer' : 'not-allowed',
                  border: `1px solid ${a.color}33`, background: `${a.color}0a`,
                  opacity: targetClip ? 1 : 0.4, transition: 'all 0.1s',
                  maxWidth: 160,
                }}
                  onMouseEnter={e => { if (targetClip) e.currentTarget.style.background = `${a.color}18`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${a.color}0a`; }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: a.color, marginBottom: 6 }}>{a.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{a.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
