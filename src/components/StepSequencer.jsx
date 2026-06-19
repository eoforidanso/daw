import { useState, useEffect } from 'react';
import { DRUM_PATTERNS } from '../audio/DrumPatterns.js';

// ── Pattern library tile ──────────────────────────────────────────
const ROW_ORDER  = ['KICK', 'SNARE', 'HI-HAT', 'CLAP'];
const ROW_COLORS = { KICK: '#ff6b35', SNARE: '#4a9eff', 'HI-HAT': '#00d4b4', CLAP: '#ff4466' };

function PatternTile({ pattern, onLoad }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onLoad}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer', padding: '6px 8px', borderRadius: 4,
        border: `1px solid ${hover ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
        background: hover ? 'var(--bg-element)' : 'var(--bg-section)',
        transition: 'all 0.1s', minWidth: 140, flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-primary)' }}>{pattern.name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-cyan)', background: 'var(--accent-cyan-glow)', padding: '0 3px', borderRadius: 2 }}>{pattern.genre}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ROW_ORDER.map(row => (
          <div key={row} style={{ display: 'flex' }}>
            {(pattern.steps[row] ?? Array(16).fill(false)).map((on, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: on ? ROW_COLORS[row] : 'var(--bg-void)', opacity: on ? 1 : 0.2, flexShrink: 0, marginLeft: i % 4 === 0 && i > 0 ? 3 : 1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Draggable bar (shared by prob and velocity rows) ─────────────
function DragBar({ value, max = 100, color, accentLow, onChange, label }) {
  const handleMouseDown = (e) => {
    e.stopPropagation();
    const startY = e.clientY, startVal = value;
    const onMove = (ev) => {
      const delta = -(ev.clientY - startY);
      onChange(Math.max(0, Math.min(max, Math.round(startVal + delta * (max / 60)))));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const pct  = (value / max) * 100;
  const fill = accentLow && value < max * 0.4 ? '#7b7bff'
             : accentLow && value > max * 0.85 ? '#ffcc00'
             : color;
  return (
    <div
      title={`${label}: ${value}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onChange(max)}
      style={{ flex: 1, height: 18, display: 'flex', alignItems: 'flex-end', background: 'var(--bg-void)', borderRadius: 1, cursor: 'ns-resize', overflow: 'hidden' }}
    >
      <div style={{ width: '100%', height: `${pct}%`, background: fill, borderRadius: '1px 1px 0 0', transition: 'height 0.04s' }} />
    </div>
  );
}

// ── Row of 16 drag-bars aligned to step groups ───────────────────
function BarRow({ trackName, values, max, color, accentLow, label, onChange }) {
  return (
    <div style={{ display: 'flex', paddingLeft: 72, gap: 3, marginTop: 2, marginBottom: 1 }}>
      {[0, 4, 8, 12].map((groupStart, gi) => (
        <div key={gi} style={{ display: 'flex', gap: 3, flex: 1 }}>
          {Array.from({ length: 4 }, (_, j) => {
            const idx = groupStart + j;
            return (
              <DragBar
                key={idx}
                value={values[idx] ?? max}
                max={max}
                color={color}
                accentLow={accentLow}
                label={label}
                onChange={v => onChange(prev => {
                  const cur = [...(prev?.[trackName] ?? Array(16).fill(max))];
                  cur[idx] = v;
                  return { ...prev, [trackName]: cur };
                })}
              />
            );
          })}
          {gi < 3 && <div style={{ width: 4, flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  );
}

// ── Genre-weighted randomize config ──────────────────────────────
const RNG_CFG = {
  KICK:     { density: 0.28, bias: [0,4,8,12], boost: 2.0 },
  SNARE:    { density: 0.20, bias: [4,12],     boost: 2.8 },
  'HI-HAT': { density: 0.55, bias: [],         boost: 1.0 },
  CLAP:     { density: 0.15, bias: [],         boost: 1.0 },
};

export default function StepSequencer({
  tracks, steps, onStepsChange,
  stepProbs, onProbsChange,
  stepVels,  onVelsChange,
  swing, onSwingChange,
  onMorphChange,
  currentBeat, isPlaying,
}) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showProb,    setShowProb]    = useState(false);
  const [showVel,     setShowVel]     = useState(false);

  // ── Pattern A/B/C/D slots ─────────────────────────────────────
  const [activeSlot,     setActiveSlot]     = useState(0);
  const [patternSlots,   setPatternSlots]   = useState([null, null, null, null]);
  const [morphTargetSlot, setMorphTargetSlot] = useState(null); // null = off
  const [morphAmount,     setMorphAmount]     = useState(0);

  // Notify engine whenever morph parameters change
  useEffect(() => {
    if (morphTargetSlot === null) {
      onMorphChange?.({ amount: 0, targetSteps: null, targetVels: null });
      return;
    }
    const target = patternSlots[morphTargetSlot];
    onMorphChange?.({
      amount:       morphAmount,
      targetSteps:  target?.steps ?? null,
      targetVels:   target?.vels  ?? null,
    });
  }, [morphAmount, morphTargetSlot, patternSlots, onMorphChange]);

  const switchSlot = (newSlot) => {
    if (newSlot === activeSlot) return;
    const snapshot = { steps, probs: stepProbs ?? {}, vels: stepVels ?? {} };
    const updated  = patternSlots.map((s, i) => i === activeSlot ? snapshot : s);
    setPatternSlots(updated);
    setActiveSlot(newSlot);
    const target = updated[newSlot];
    if (target) {
      onStepsChange(target.steps);
      onProbsChange?.(target.probs);
      onVelsChange?.(target.vels);
    } else {
      const blank = Object.fromEntries(Object.keys(steps).map(k => [k, Array(16).fill(false)]));
      const full  = Object.fromEntries(Object.keys(steps).map(k => [k, Array(16).fill(100)]));
      onStepsChange(blank);
      onProbsChange?.(full);
      onVelsChange?.(full);
    }
  };

  const toggleStep = (trackName, idx) => {
    onStepsChange(prev => ({ ...prev, [trackName]: prev[trackName].map((v, i) => i === idx ? !v : v) }));
  };

  const loadPattern = (pattern) => {
    onStepsChange(pattern.steps);
    onProbsChange?.(prev => Object.fromEntries(Object.keys(prev ?? {}).map(k => [k, Array(16).fill(100)])));
    onVelsChange?.(prev  => Object.fromEntries(Object.keys(prev  ?? {}).map(k => [k, Array(16).fill(100)])));
  };

  const clearPattern = () => {
    onStepsChange(prev => Object.fromEntries(Object.keys(prev).map(k => [k, Array(16).fill(false)])));
  };

  const randomize = () => {
    const newSteps = {}, newProbs = {}, newVels = {};
    tracks.forEach(track => {
      const name = track.name.toUpperCase();
      const cfg  = RNG_CFG[name] ?? { density: 0.25, bias: [], boost: 1 };
      const s = Array(16).fill(false), p = Array(16).fill(100), v = Array(16).fill(100);
      for (let i = 0; i < 16; i++) {
        const chance = cfg.density * (cfg.bias.includes(i) ? cfg.boost : 1);
        s[i] = Math.random() < chance;
        p[i] = s[i] ? Math.floor(Math.random() * 40 + 60) : 100;
        v[i] = s[i] ? Math.floor(Math.random() * 40 + 60) : 100;
      }
      newSteps[track.name] = s; newProbs[track.name] = p; newVels[track.name] = v;
    });
    onStepsChange(newSteps);
    onProbsChange?.(newProbs);
    onVelsChange?.(newVels);
  };

  // Apply ghost preset: random ~35% of on-steps get low velocity + lower prob
  const applyGhost = () => {
    onVelsChange?.(prev => {
      const next = { ...prev };
      tracks.forEach(track => {
        const cur = [...(next[track.name] ?? Array(16).fill(100))];
        const trackSteps = steps[track.name] ?? [];
        trackSteps.forEach((on, i) => {
          if (on && Math.random() < 0.38) cur[i] = Math.floor(Math.random() * 20 + 18); // 18–38
        });
        next[track.name] = cur;
      });
      return next;
    });
    onProbsChange?.(prev => {
      const next = { ...prev };
      tracks.forEach(track => {
        const cur = [...(next[track.name] ?? Array(16).fill(100))];
        (steps[track.name] ?? []).forEach((on, i) => {
          if (on && (stepVels?.[track.name]?.[i] ?? 100) < 45) cur[i] = Math.floor(Math.random() * 20 + 65);
        });
        next[track.name] = cur;
      });
      return next;
    });
  };

  // Apply accent preset: every 4th on-step gets boosted velocity
  const applyAccent = () => {
    onVelsChange?.(prev => {
      const next = { ...prev };
      tracks.forEach(track => {
        const cur = [...(next[track.name] ?? Array(16).fill(100))];
        let hitCount = 0;
        (steps[track.name] ?? []).forEach((on, i) => {
          if (on) { if (hitCount % 4 === 0) cur[i] = 127; hitCount++; }
        });
        next[track.name] = cur;
      });
      return next;
    });
  };

  const beatLabels = ['1','+','2','+','3','+','4','+','1','+','2','+','3','+','4','+'];

  return (
    <div className="step-sequencer">
      <div className="seq-header">
        <span className="seq-title">BEAT GRID — 16 STEPS / BAR</span>
        <span className="seq-title">{isPlaying ? `▶ STEP ${(currentBeat + 1) || 1}` : '■ STOPPED'}</span>
      </div>

      <div style={{ display: 'flex', marginLeft: 72, gap: 3, marginBottom: 4 }}>
        {beatLabels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 7, color: i % 4 === 0 ? 'var(--text-secondary)' : 'var(--text-muted)', borderLeft: i % 4 === 0 ? '1px solid var(--border-subtle)' : 'none', paddingLeft: i % 4 === 0 ? 2 : 0 }}>{l}</div>
        ))}
      </div>

      {tracks.map(track => {
        const trackSteps = steps[track.name] || Array(16).fill(false);
        const trackProbs = stepProbs?.[track.name] ?? Array(16).fill(100);
        const trackVels  = stepVels?.[track.name]  ?? Array(16).fill(100);
        return (
          <div key={track.id}>
            <div className="step-seq-track">
              <div className="step-seq-track-info">
                <span className="step-seq-track-name" style={{ color: track.color }}>{track.name}</span>
                <input type="range" min="0" max="100" defaultValue={track.volume} className="step-seq-track-vol"
                  style={{ background: `linear-gradient(to right, ${track.color}88 ${track.volume}%, var(--bg-section) ${track.volume}%)` }}
                />
              </div>
              <div className="step-seq-steps">
                {[0,4,8,12].map((groupStart, gi) => (
                  <div key={gi} style={{ display: 'flex', gap: 3, flex: 1 }}>
                    {Array.from({ length: 4 }, (_, j) => {
                      const idx = groupStart + j;
                      const on  = trackSteps[idx];
                      const vel = trackVels[idx] ?? 100;
                      return (
                        <button
                          key={idx}
                          className={`step-btn ${on ? 'on' : ''} ${isPlaying && currentBeat === idx ? 'current' : ''}`}
                          style={{
                            '--step-color': track.color, flex: 1,
                            // Ghost notes (vel < 45) appear at reduced opacity; accents (vel > 110) glow brighter
                            opacity: on && showVel ? (vel < 45 ? 0.35 : vel > 110 ? 1 : 0.5 + vel / 200) : undefined,
                          }}
                          onClick={() => toggleStep(track.name, idx)}
                        />
                      );
                    })}
                    {gi < 3 && <div style={{ width: 4, flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>

            {showProb && (
              <BarRow
                trackName={track.name}
                values={trackProbs} max={100}
                color={track.color}
                label="Prob %"
                onChange={onProbsChange}
              />
            )}
            {showVel && (
              <BarRow
                trackName={track.name}
                values={trackVels} max={127}
                color={track.color}
                accentLow   // blue = ghost, yellow = accent
                label="Vel"
                onChange={onVelsChange}
              />
            )}
          </div>
        );
      })}

      {/* ── Bottom controls ── */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>PATTERN</span>
        {['A','B','C','D'].map((p, i) => (
          <button key={p} onClick={() => switchSlot(i)} style={{ width: 28, height: 20, borderRadius: 3, border: `1px solid ${i === activeSlot ? 'var(--accent-cyan)' : 'var(--border-default)'}`, background: i === activeSlot ? 'var(--accent-cyan-glow)' : 'var(--bg-element)', color: i === activeSlot ? 'var(--accent-cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer' }}>{p}</button>
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: swing > 0 ? 'var(--accent-orange)' : 'var(--text-muted)', marginLeft: 8 }}>SWING {swing > 0 ? `${swing}%` : ''}</span>
        <input type="range" min="0" max="100" value={swing ?? 0} onChange={e => onSwingChange?.(+e.target.value)} style={{ WebkitAppearance: 'none', width: 80, height: 3, background: 'var(--bg-section)', outline: 'none', borderRadius: 2, cursor: 'pointer' }} />

        {/* ── Pattern morph ── */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: morphTargetSlot !== null ? '#ff6bcc' : 'var(--text-muted)', marginLeft: 8 }}>MORPH</span>
        {['A','B','C','D'].map((p, i) => {
          if (i === activeSlot) return null;
          const isTarget = morphTargetSlot === i;
          return (
            <button key={p}
              onClick={() => { setMorphTargetSlot(isTarget ? null : i); if (isTarget) setMorphAmount(0); }}
              style={{ width: 22, height: 20, borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9,
                border:      `1px solid ${isTarget ? '#ff6bcc' : 'var(--border-subtle)'}`,
                background:  isTarget ? 'rgba(255,107,204,0.15)' : 'var(--bg-element)',
                color:       isTarget ? '#ff6bcc' : 'var(--text-muted)',
              }}>{p}</button>
          );
        })}
        {morphTargetSlot !== null && (
          <>
            <input type="range" min="0" max="100" value={morphAmount}
              onChange={e => setMorphAmount(+e.target.value)}
              style={{ WebkitAppearance: 'none', width: 70, height: 3, background: 'var(--bg-section)', outline: 'none', borderRadius: 2, cursor: 'pointer' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff6bcc', minWidth: 26 }}>{morphAmount}%</span>
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {showVel && (
            <>
              <button onClick={applyGhost} style={{ height: 20, padding: '0 7px', borderRadius: 3, border: '1px solid #7b7bff', background: 'rgba(123,123,255,0.12)', color: '#7b7bff', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>GHOST</button>
              <button onClick={applyAccent} style={{ height: 20, padding: '0 7px', borderRadius: 3, border: '1px solid #ffcc00', background: 'rgba(255,204,0,0.12)', color: '#ffcc00', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>ACCENT</button>
            </>
          )}
          <button onClick={randomize} style={{ height: 20, padding: '0 8px', borderRadius: 3, border: '1px solid var(--accent-purple)', background: 'var(--bg-element)', color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>RND</button>
          <button onClick={clearPattern} style={{ height: 20, padding: '0 8px', borderRadius: 3, border: '1px solid var(--border-subtle)', background: 'var(--bg-element)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>CLR</button>
          <button onClick={() => setShowProb(v => !v)} style={{ height: 20, padding: '0 8px', borderRadius: 3, border: `1px solid ${showProb ? 'var(--accent-orange)' : 'var(--border-subtle)'}`, background: showProb ? 'rgba(255,150,50,0.15)' : 'var(--bg-element)', color: showProb ? 'var(--accent-orange)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>PROB</button>
          <button onClick={() => setShowVel(v => !v)} style={{ height: 20, padding: '0 8px', borderRadius: 3, border: `1px solid ${showVel ? '#ffcc00' : 'var(--border-subtle)'}`, background: showVel ? 'rgba(255,204,0,0.12)' : 'var(--bg-element)', color: showVel ? '#ffcc00' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>VEL</button>
          <button onClick={() => setShowLibrary(v => !v)} style={{ height: 20, padding: '0 8px', borderRadius: 3, border: `1px solid ${showLibrary ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`, background: showLibrary ? 'var(--accent-cyan-glow)' : 'var(--bg-element)', color: showLibrary ? 'var(--accent-cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}>LIBRARY</button>
        </div>
      </div>

      {showLibrary && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 6 }}>PATTERN LIBRARY — CLICK TO LOAD</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
            {DRUM_PATTERNS.map((pattern, i) => (
              <PatternTile key={i} pattern={pattern} onLoad={() => loadPattern(pattern)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
