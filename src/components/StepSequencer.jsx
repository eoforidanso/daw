import { useState } from 'react';
import { DRUM_PATTERNS } from '../audio/DrumPatterns.js';

// ── Mini pattern preview tile ─────────────────────────────────────
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
        cursor: 'pointer',
        padding: '6px 8px',
        borderRadius: 4,
        border: `1px solid ${hover ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
        background: hover ? 'var(--bg-element)' : 'var(--bg-section)',
        transition: 'all 0.1s',
        minWidth: 140,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
          {pattern.name}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 7,
          color: 'var(--accent-cyan)', letterSpacing: '0.1em',
          background: 'var(--accent-cyan-glow)', padding: '0 3px', borderRadius: 2,
        }}>
          {pattern.genre}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ROW_ORDER.map(row => (
          <div key={row} style={{ display: 'flex', gap: 0 }}>
            {(pattern.steps[row] ?? Array(16).fill(false)).map((on, i) => (
              <div
                key={i}
                style={{
                  width: 6, height: 6,
                  borderRadius: 1,
                  background: on ? ROW_COLORS[row] : 'var(--bg-void)',
                  opacity: on ? 1 : 0.2,
                  flexShrink: 0,
                  marginLeft: i % 4 === 0 && i > 0 ? 3 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StepSequencer({ tracks, steps, onStepsChange, currentBeat, isPlaying }) {
  const [showLibrary, setShowLibrary] = useState(false);

  const toggleStep = (trackName, idx) => {
    onStepsChange(prev => ({
      ...prev,
      [trackName]: prev[trackName].map((v, i) => i === idx ? !v : v),
    }));
  };

  const loadPattern = (pattern) => {
    onStepsChange(pattern.steps);
  };

  const clearPattern = () => {
    onStepsChange(prev => Object.fromEntries(
      Object.keys(prev).map(k => [k, Array(16).fill(false)])
    ));
  };

  const beatLabels = ['1', '+', '2', '+', '3', '+', '4', '+', '1', '+', '2', '+', '3', '+', '4', '+'];

  return (
    <div className="step-sequencer">
      <div className="seq-header">
        <span className="seq-title">BEAT GRID — 16 STEPS / BAR</span>
        <span className="seq-title">{isPlaying ? `▶ STEP ${(currentBeat + 1) || 1}` : '■ STOPPED'}</span>
      </div>

      <div style={{ display: 'flex', marginLeft: 72, gap: 3, marginBottom: 4 }}>
        {beatLabels.map((l, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 7,
            color: i % 4 === 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            borderLeft: i % 4 === 0 ? '1px solid var(--border-subtle)' : 'none',
            paddingLeft: i % 4 === 0 ? 2 : 0,
          }}>{l}</div>
        ))}
      </div>

      {tracks.map(track => {
        const trackSteps = steps[track.name] || Array(16).fill(false);
        return (
          <div key={track.id} className="step-seq-track">
            <div className="step-seq-track-info">
              <span className="step-seq-track-name" style={{ color: track.color }}>{track.name}</span>
              <input type="range" min="0" max="100" defaultValue={track.volume} className="step-seq-track-vol"
                style={{ background: `linear-gradient(to right, ${track.color}88 ${track.volume}%, var(--bg-section) ${track.volume}%)` }}
              />
            </div>
            <div className="step-seq-steps">
              {[0, 4, 8, 12].map((groupStart, gi) => (
                <div key={gi} style={{ display: 'flex', gap: 3, flex: 1 }}>
                  {Array.from({ length: 4 }, (_, j) => {
                    const idx = groupStart + j;
                    const on = trackSteps[idx];
                    const isCurrent = isPlaying && currentBeat === idx;
                    return (
                      <button
                        key={idx}
                        className={`step-btn ${on ? 'on' : ''} ${isCurrent ? 'current' : ''}`}
                        style={{ '--step-color': track.color, flex: 1 }}
                        onClick={() => toggleStep(track.name, idx)}
                      />
                    );
                  })}
                  {gi < 3 && <div style={{ width: 4, flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Bottom controls ── */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>PATTERN</span>
        {['A','B','C','D'].map(p => (
          <button key={p} style={{
            width: 28, height: 20, borderRadius: 3,
            border: `1px solid ${p === 'A' ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
            background: p === 'A' ? 'var(--accent-cyan-glow)' : 'var(--bg-element)',
            color: p === 'A' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
          }}>{p}</button>
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em', marginLeft: 8 }}>SWING</span>
        <input type="range" min="0" max="100" defaultValue={0} style={{
          WebkitAppearance: 'none', width: 80, height: 3,
          background: 'var(--bg-section)', outline: 'none', borderRadius: 2,
        }} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={clearPattern}
            style={{
              height: 20, padding: '0 8px', borderRadius: 3,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-element)', color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >CLR</button>
          <button
            onClick={() => setShowLibrary(v => !v)}
            style={{
              height: 20, padding: '0 8px', borderRadius: 3,
              border: `1px solid ${showLibrary ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
              background: showLibrary ? 'var(--accent-cyan-glow)' : 'var(--bg-element)',
              color: showLibrary ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >LIBRARY {showLibrary ? '▲' : '▼'}</button>
        </div>
      </div>

      {/* ── Pattern library ── */}
      {showLibrary && (
        <div style={{
          marginTop: 8,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 8,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 8,
            color: 'var(--text-muted)', letterSpacing: '0.15em',
            marginBottom: 6,
          }}>
            PATTERN LIBRARY — CLICK TO LOAD
          </div>
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 6,
          }}>
            {DRUM_PATTERNS.map((pattern, i) => (
              <PatternTile
                key={i}
                pattern={pattern}
                onLoad={() => loadPattern(pattern)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
