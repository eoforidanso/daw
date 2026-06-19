import { useState, useEffect, useRef, useCallback } from 'react';
import { engine } from '../audio/engine.js';

// ── Biquad frequency response (pure math, no AudioContext needed) ─────────────
// Returns gain in dB at frequency f for a biquad filter.
function biquadDB(type, fc, gainDB, Q, f, sr = 44100) {
  const A     = Math.pow(10, gainDB / 40);
  const ω0    = (2 * Math.PI * fc) / sr;
  const s0    = Math.sin(ω0), c0 = Math.cos(ω0);
  const α     = s0 / (2 * Q);
  const sA    = Math.sqrt(A);
  let b0, b1, b2, a0, a1, a2;

  if (type === 'peaking') {
    b0 = 1 + α * A;  b1 = -2 * c0; b2 = 1 - α * A;
    a0 = 1 + α / A;  a1 = -2 * c0; a2 = 1 - α / A;
  } else if (type === 'lowshelf') {
    b0 = A*((A+1)-(A-1)*c0+2*sA*α); b1=2*A*((A-1)-(A+1)*c0); b2=A*((A+1)-(A-1)*c0-2*sA*α);
    a0=(A+1)+(A-1)*c0+2*sA*α;       a1=-2*((A-1)+(A+1)*c0);   a2=(A+1)+(A-1)*c0-2*sA*α;
  } else { // highshelf
    b0=A*((A+1)+(A-1)*c0+2*sA*α); b1=-2*A*((A-1)+(A+1)*c0); b2=A*((A+1)+(A-1)*c0-2*sA*α);
    a0=(A+1)-(A-1)*c0+2*sA*α;     a1=2*((A-1)-(A+1)*c0);    a2=(A+1)-(A-1)*c0-2*sA*α;
  }

  const φ   = (2 * Math.PI * f) / sr;
  const cφ  = Math.cos(φ), sφ = Math.sin(φ);
  const c2φ = Math.cos(2*φ), s2φ = Math.sin(2*φ);
  const nr  = b0 + b1*cφ + b2*c2φ, ni = -(b1*sφ + b2*s2φ);
  const dr  = a0 + a1*cφ + a2*c2φ, di = -(a1*sφ + a2*s2φ);
  const denom = dr*dr + di*di;
  if (denom < 1e-20) return 0;
  return 10 * Math.log10((nr*nr + ni*ni) / denom);
}

// Generate N log-spaced frequencies from 20Hz to 20kHz
function logFreqs(N = 256) {
  return Array.from({ length: N }, (_, i) => 20 * Math.pow(1000, i / (N - 1)));
}

const FREQS = logFreqs(256);

function computeCombinedDB(bands) {
  return FREQS.map(f =>
    bands.reduce((sum, b) => sum + biquadDB(b.type, b.freq, b.gain, b.Q, f), 0)
  );
}

// ── Default 4-band parametric EQ ─────────────────────────────────────────────
const DEFAULT_BANDS = [
  { id: 'lo',  label: 'LO',  type: 'lowshelf',  freq:   80, gain: 0, Q: 0.7, color: 'var(--accent-orange)' },
  { id: 'lm',  label: 'LO-M', type: 'peaking',  freq:  500, gain: 0, Q: 1.0, color: 'var(--accent-yellow)' },
  { id: 'hm',  label: 'HI-M', type: 'peaking',  freq: 3000, gain: 0, Q: 1.0, color: 'var(--accent-cyan)'   },
  { id: 'hi',  label: 'HI',  type: 'highshelf', freq: 8000, gain: 0, Q: 0.7, color: 'var(--accent-blue)'   },
];

const MAX_DB   = 12;
const PLOT_W   = 560;
const PLOT_H   = 100;
const SPEC_H   = 60;  // spectrum height below EQ curve

// Map frequency (20–20000) to X in [0, PLOT_W]
function freqToX(f) { return (Math.log10(f / 20) / Math.log10(1000)) * PLOT_W; }
function xToFreq(x) { return 20 * Math.pow(1000, x / PLOT_W); }
// Map gain (-MAX_DB to +MAX_DB) to Y in [0, PLOT_H]
function gainToY(g) { return PLOT_H / 2 - (g / MAX_DB) * (PLOT_H / 2); }
function yToGain(y) { return ((PLOT_H / 2 - y) / (PLOT_H / 2)) * MAX_DB; }

// ── Spectrum canvas ───────────────────────────────────────────────────────────

function SpectrumCanvas({ width, height, curveDBs }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      ctx2d.clearRect(0, 0, W, H);

      // ── live spectrum from master analyser ──
      if (engine._ctx && engine.masterAnalyser) {
        const bins  = engine.masterAnalyser.frequencyBinCount;
        const data  = new Uint8Array(bins);
        engine.masterAnalyser.getByteFrequencyData(data);
        const nyq   = engine._ctx.sampleRate / 2;

        ctx2d.beginPath();
        let first = true;
        for (let i = 1; i < bins; i++) {
          const f = (i / bins) * nyq;
          if (f < 20 || f > 20000) continue;
          const x = (Math.log10(f / 20) / Math.log10(1000)) * W;
          const y = H * (1 - data[i] / 255);
          if (first) { ctx2d.moveTo(x, H); ctx2d.lineTo(x, y); first = false; }
          else ctx2d.lineTo(x, y);
        }
        ctx2d.lineTo(W, H);
        ctx2d.closePath();
        const grad = ctx2d.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(0,212,180,0.5)');
        grad.addColorStop(1, 'rgba(0,212,180,0.05)');
        ctx2d.fillStyle = grad;
        ctx2d.fill();
      }

      // ── EQ curve overlay ──
      if (curveDBs?.length) {
        ctx2d.beginPath();
        curveDBs.forEach((db, i) => {
          const x = (i / (curveDBs.length - 1)) * W;
          const y = H / 2 - (db / MAX_DB) * (H / 2);
          i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
        });
        ctx2d.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [curveDBs]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: '0 0 4px 4px' }}
    />
  );
}

// ── Parametric EQ SVG ─────────────────────────────────────────────────────────

function EQPlot({ bands, onBandChange }) {
  const [dragging, setDragging] = useState(null); // { id, startX, startY, startFreq, startGain }
  const svgRef = useRef(null);

  const curveDBs = computeCombinedDB(bands);

  // Build SVG path for the combined EQ curve
  const pts = curveDBs.map((db, i) => {
    const x = (i / (FREQS.length - 1)) * PLOT_W;
    const y = gainToY(db);
    return `${x},${Math.max(2, Math.min(PLOT_H - 2, y))}`;
  });
  const curvePath = `M ${pts.join(' L ')}`;

  // Grid lines
  const gridFreqs  = [50,100,200,500,1000,2000,5000,10000,20000];
  const gridGains  = [-MAX_DB,-6,0,6,MAX_DB];

  const onMouseDown = (bandId, e) => {
    e.stopPropagation();
    const band = bands.find(b => b.id === bandId);
    setDragging({ id: bandId, startX: e.clientX, startY: e.clientY, startFreq: band.freq, startGain: band.gain });
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const scaleX  = PLOT_W / svgRect.width;
    const scaleY  = PLOT_H / svgRect.height;
    const dx = (e.clientX - dragging.startX) * scaleX;
    const dy = (e.clientY - dragging.startY) * scaleY;

    const newFreqX = freqToX(dragging.startFreq) + dx;
    const newFreq  = Math.max(20, Math.min(20000, xToFreq(newFreqX)));
    const newGain  = Math.max(-MAX_DB, Math.min(MAX_DB, dragging.startGain - dy * (MAX_DB / (PLOT_H/2))));

    onBandChange(dragging.id, { freq: Math.round(newFreq), gain: Math.round(newGain * 10) / 10 });
  }, [dragging, onBandChange]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
      width="100%"
      height={PLOT_H}
      style={{ display: 'block', cursor: dragging ? 'grabbing' : 'default', overflow: 'visible' }}
    >
      {/* Frequency grid lines */}
      {gridFreqs.map(f => {
        const x = freqToX(f);
        return (
          <g key={f}>
            <line x1={x} y1={0} x2={x} y2={PLOT_H} stroke="var(--border-faint)" strokeWidth={0.5} />
            <text x={x} y={PLOT_H - 2} textAnchor="middle" fill="var(--text-muted)" fontSize={7} fontFamily="monospace">
              {f >= 1000 ? `${f/1000}k` : f}
            </text>
          </g>
        );
      })}
      {/* Gain grid lines */}
      {gridGains.map(g => {
        const y = gainToY(g);
        return (
          <g key={g}>
            <line x1={0} y1={y} x2={PLOT_W} y2={y}
              stroke={g === 0 ? 'var(--border-default)' : 'var(--border-faint)'}
              strokeWidth={g === 0 ? 1 : 0.5}
              strokeDasharray={g === 0 ? 'none' : '2,4'}
            />
            <text x={3} y={y - 2} fill="var(--text-muted)" fontSize={7} fontFamily="monospace">{g > 0 ? `+${g}` : g}</text>
          </g>
        );
      })}

      {/* Combined EQ curve */}
      <path d={curvePath} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      {/* Zero gain fill */}
      <path d={`${curvePath} L ${PLOT_W},${gainToY(0)} L 0,${gainToY(0)} Z`}
        fill="rgba(255,255,255,0.04)" />

      {/* Band nodes */}
      {bands.map(band => {
        const x = freqToX(band.freq);
        const y = gainToY(band.gain);
        const isDrag = dragging?.id === band.id;
        return (
          <g key={band.id} transform={`translate(${x},${y})`}>
            {/* Frequency indicator line */}
            <line x1={0} y1={y - PLOT_H} x2={0} y2={0} stroke={band.color} strokeWidth={0.5} opacity={0.3} strokeDasharray="3,3" />
            {/* Node circle */}
            <circle
              r={isDrag ? 8 : 6}
              fill={band.color}
              fillOpacity={isDrag ? 0.9 : 0.7}
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={1.5}
              cursor="grab"
              style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
              onMouseDown={e => onMouseDown(band.id, e)}
            />
            <text textAnchor="middle" y={-10} fill="white" fontSize={7} fontFamily="monospace" fontWeight="bold" style={{ pointerEvents: 'none' }}>
              {band.label}
            </text>
            {isDrag && (
              <text textAnchor="middle" y={-20} fill="white" fontSize={6} fontFamily="monospace" style={{ pointerEvents: 'none' }}>
                {band.freq >= 1000 ? `${(band.freq/1000).toFixed(1)}kHz` : `${band.freq}Hz`}  {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}dB
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Band list (quick numeric edit) ───────────────────────────────────────────

function BandList({ bands, onBandChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
      {bands.map(band => (
        <div key={band.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 7px', background: 'var(--bg-element)', borderRadius: 3, border: `1px solid ${band.color}44` }}>
          <div style={{ width: 3, height: 28, borderRadius: 1, background: band.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{band.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: band.color }}>
              {band.freq >= 1000 ? `${(band.freq/1000).toFixed(1)}k` : band.freq}Hz
            </div>
          </div>
          {/* Gain slider */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: band.gain !== 0 ? band.color : 'var(--text-muted)' }}>
              {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}
            </span>
            <input
              type="range" min={-MAX_DB} max={MAX_DB} step={0.5} value={band.gain}
              onChange={e => onBandChange(band.id, { gain: parseFloat(e.target.value) })}
              style={{ width: 60, accentColor: band.color }}
            />
          </div>
          <button
            onClick={() => onBandChange(band.id, { gain: 0 })}
            style={{ padding: '2px 5px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border-faint)', background: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 6 }}
          >0</button>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SpectrumEQ({ compact = false }) {
  const [bands, setBands]     = useState(DEFAULT_BANDS);
  const [show,  setShow]      = useState(true);
  const curveDBs = computeCombinedDB(bands);

  const handleBandChange = useCallback((id, updates) => {
    setBands(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const resetAll = () => setBands(DEFAULT_BANDS.map(b => ({ ...b, gain: 0 })));

  return (
    <div style={{ background: 'var(--bg-void)', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: show ? '1px solid var(--border-faint)' : 'none' }}>
        <button onClick={() => setShow(s => !s)} style={{ padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border-faint)', background: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.1em' }}>
          {show ? '▾' : '▸'}
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.2em', color: 'var(--text-muted)' }}>MASTER EQ + SPECTRUM</span>
        {show && (
          <>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {bands.map(b => (
                <div key={b.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: b.gain !== 0 ? b.color : 'var(--border-strong)', transition: 'color 0.2s' }}>
                  {b.label}: {b.gain > 0 ? '+' : ''}{b.gain.toFixed(1)}
                </div>
              ))}
              <button onClick={resetAll} style={{ padding: '2px 8px', borderRadius: 2, cursor: 'pointer', border: '1px solid var(--border-faint)', background: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 6 }}>FLAT</button>
            </div>
          </>
        )}
      </div>

      {show && (
        <div style={{ padding: '8px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* EQ plot */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', background: 'var(--bg-section)', borderRadius: '4px 4px 0 0', border: '1px solid var(--border-faint)', borderBottom: 'none', padding: '6px 4px 2px' }}>
              <EQPlot bands={bands} onBandChange={handleBandChange} />
            </div>
            {/* Spectrum canvas below the EQ curve */}
            <div style={{ background: 'var(--bg-section)', border: '1px solid var(--border-faint)', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
              <SpectrumCanvas width={PLOT_W} height={SPEC_H} curveDBs={curveDBs} />
            </div>
          </div>
          {/* Band list */}
          <BandList bands={bands} onBandChange={handleBandChange} />
        </div>
      )}
    </div>
  );
}
