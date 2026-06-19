import { useState, useMemo, useRef } from 'react';
import { AUTO_PARAMS, mkPtId } from '../audio/AutomationEngine.js';

// ── Shape generators (t = 0..1, output = -1..1) ──────────────────────────────

const SHAPES = {
  SINE:     (t)       => Math.sin(t * Math.PI * 2),
  TRIANGLE: (t)       => t < 0.5 ? 4 * t - 1 : 3 - 4 * t,
  SQUARE:   (t)       => t < 0.5 ? 1 : -1,
  SAW:      (t)       => 2 * t - 1,
  'S&H':    (t, seed) => {
    // 8 deterministic steps derived from seed
    const step = Math.floor(t * 8);
    // LCG cheap pseudo-random seeded per step
    const h = (seed * 1664525 + (step * 22695477)) & 0xffffffff;
    return ((h >>> 0) / 0x100000000) * 2 - 1;
  },
};

const SHAPE_NAMES = ['SINE', 'TRIANGLE', 'SQUARE', 'SAW', 'S&H'];

const LOOP_BEATS    = 32;
const SAMPLES_PER_BEAT = 8;
const TOTAL_SAMPLES = LOOP_BEATS * SAMPLES_PER_BEAT;

// ── Preview SVG path builder ──────────────────────────────────────────────────

function buildPreviewPath(shapeName, cycles, depth, offset, shSeed, W = 200, H = 60) {
  const shapeFn = SHAPES[shapeName];
  const points = [];
  const steps  = 200; // visual resolution

  for (let i = 0; i <= steps; i++) {
    const beatFrac = i / steps;                       // 0..1 across full 32-beat loop
    const t        = (beatFrac * cycles) % 1;
    const raw      = shapeFn(t, shSeed);
    const norm     = (raw + 1) / 2;                   // 0..1
    // Map to 0..1 with depth + offset (we just use abstract 0–1 for preview)
    const val      = Math.min(1, Math.max(0, norm * (depth / 100) + (offset / 100) * (1 - depth / 100)));
    const x        = (i / steps) * W;
    const y        = H - val * H;
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

// ── Inline slider component ───────────────────────────────────────────────────

function ParamSlider({ label, min, max, step = 0.01, value, onChange, unit = '', color = 'var(--accent-cyan)' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 7,
          letterSpacing: '0.14em', color: 'var(--text-muted)',
        }}>{label}</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 8,
          color, letterSpacing: '0.05em',
        }}>{typeof value === 'number' ? (step < 1 ? value.toFixed(1) : value) : value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          WebkitAppearance: 'none',
          height: 3, outline: 'none', borderRadius: 2,
          cursor: 'pointer',
          background: `linear-gradient(to right, ${color} ${pct}%, var(--bg-section) ${pct}%)`,
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LFODesigner({ tracks = [], autoLanes = [], onAddAutoLane, onAddAutoPoint }) {
  const [shape,   setShape]   = useState('SINE');
  const [rate,    setRate]    = useState(1.0);   // Hz (cosmetic — affects how cycles maps to time)
  const [depth,   setDepth]   = useState(80);    // 0–100 %
  const [cycles,  setCycles]  = useState(2);     // 1–8
  const [offset,  setOffset]  = useState(0);     // 0–100 %
  const [trackId, setTrackId] = useState('');
  const [param,   setParam]   = useState('volume');
  const [status,  setStatus]  = useState(null);  // { ok, msg }

  // Seed for S&H preview (regenerated on each write, stable in preview)
  const shSeedRef = useRef(Math.random() * 0xffffffff | 0);

  const paramKeys = Object.keys(AUTO_PARAMS);

  // Resolve trackId: if blank and there are tracks, default to first
  const resolvedTrackId = trackId || (tracks[0]?.id ?? '');

  // ── Preview path ─────────────────────────────────────────────────────────
  const previewPath = useMemo(
    () => buildPreviewPath(shape, cycles, depth, offset, shSeedRef.current),
    [shape, cycles, depth, offset]
  );

  // ── Write automation to lane ──────────────────────────────────────────────
  const handleWrite = () => {
    if (!resolvedTrackId) {
      setStatus({ ok: false, msg: 'NO TRACK SELECTED' });
      return;
    }

    const def = AUTO_PARAMS[param];
    if (!def) {
      setStatus({ ok: false, msg: 'UNKNOWN PARAM' });
      return;
    }

    const { min, max } = def;

    // Regenerate S&H seed on each write for musical variation
    shSeedRef.current = Math.random() * 0xffffffff | 0;
    const seed = shSeedRef.current;

    const shapeFn = SHAPES[shape];

    // Find existing lane for this track + param, or create one
    let lane = autoLanes.find(l => String(l.trackId) === String(resolvedTrackId) && l.param === param);
    let laneId;
    if (lane) {
      laneId = lane.id;
    } else {
      laneId = onAddAutoLane(resolvedTrackId, param);
    }

    // Generate points
    const points = [];
    for (let i = 0; i < TOTAL_SAMPLES; i++) {
      const beat  = i / SAMPLES_PER_BEAT;                           // 0..31.875
      const t     = ((beat / LOOP_BEATS) * cycles) % 1;            // phase 0..1
      const raw   = shapeFn(t, seed);                              // -1..1
      const norm  = (raw + 1) / 2;                                  // 0..1
      const raw01 = norm * (depth / 100) + (offset / 100) * (1 - depth / 100);
      const value = Math.min(max, Math.max(min, min + (max - min) * raw01));
      points.push({ id: mkPtId(), beat, value });
    }

    for (const pt of points) {
      onAddAutoPoint(laneId, pt);
    }

    setStatus({ ok: true, msg: `WROTE ${points.length} PTS → ${def.label}` });
    setTimeout(() => setStatus(null), 2200);
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    root: {
      background: 'var(--bg-void)',
      border: '1px solid var(--border-default)',
      borderRadius: 5,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 9,
      fontFamily: 'var(--font-mono)',
      minWidth: 260,
      maxWidth: 300,
    },
    title: {
      fontSize: 8,
      letterSpacing: '0.28em',
      color: 'var(--text-muted)',
      borderBottom: '1px solid var(--border-faint)',
      paddingBottom: 6,
    },
    shapeRow: {
      display: 'flex',
      gap: 3,
    },
    shapeBtn: (active) => ({
      flex: 1,
      height: 22,
      borderRadius: 2,
      border: active ? '1px solid var(--accent-cyan)' : '1px solid var(--border-default)',
      background: active ? 'rgba(0,212,180,0.12)' : 'var(--bg-element)',
      color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 7,
      letterSpacing: '0.1em',
      cursor: 'pointer',
      transition: 'all 0.1s',
    }),
    sliders: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
    },
    targetRow: {
      display: 'flex',
      gap: 6,
    },
    select: {
      flex: 1,
      height: 24,
      background: 'var(--bg-element)',
      border: '1px solid var(--border-default)',
      borderRadius: 3,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 8,
      padding: '0 6px',
      cursor: 'pointer',
      outline: 'none',
      letterSpacing: '0.05em',
    },
    previewBox: {
      background: 'var(--bg-panel)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 3,
      overflow: 'hidden',
      position: 'relative',
    },
    writeBtn: {
      height: 28,
      background: 'rgba(0,212,180,0.10)',
      border: '1px solid var(--accent-cyan)',
      borderRadius: 3,
      color: 'var(--accent-cyan)',
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.22em',
      cursor: 'pointer',
      transition: 'background 0.1s',
    },
    statusOk: {
      fontFamily: 'var(--font-mono)',
      fontSize: 7,
      letterSpacing: '0.12em',
      color: 'var(--accent-cyan)',
      textAlign: 'center',
    },
    statusErr: {
      fontFamily: 'var(--font-mono)',
      fontSize: 7,
      letterSpacing: '0.12em',
      color: 'var(--accent-red)',
      textAlign: 'center',
    },
    targetLabel: {
      fontSize: 7,
      letterSpacing: '0.14em',
      color: 'var(--text-muted)',
      marginBottom: 3,
      display: 'block',
    },
    targetGroup: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
  };

  const W = 276, H = 60;

  return (
    <div style={s.root}>
      {/* Title */}
      <div style={s.title}>LFO DESIGNER</div>

      {/* Shape selector */}
      <div>
        <span style={{ ...s.targetLabel }}>SHAPE</span>
        <div style={s.shapeRow}>
          {SHAPE_NAMES.map(n => (
            <button
              key={n}
              style={s.shapeBtn(shape === n)}
              onClick={() => setShape(n)}
              title={n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={s.sliders}>
        <ParamSlider
          label="RATE"
          min={0.1} max={8} step={0.1}
          value={rate}
          onChange={setRate}
          unit=" Hz"
          color="var(--accent-cyan)"
        />
        <ParamSlider
          label="DEPTH"
          min={0} max={100} step={1}
          value={depth}
          onChange={setDepth}
          unit="%"
          color="var(--accent-cyan)"
        />
        <ParamSlider
          label="CYCLES"
          min={1} max={8} step={1}
          value={cycles}
          onChange={setCycles}
          unit=""
          color="var(--accent-purple)"
        />
        <ParamSlider
          label="OFFSET"
          min={0} max={100} step={1}
          value={offset}
          onChange={setOffset}
          unit="%"
          color="var(--accent-orange)"
        />
      </div>

      {/* Target */}
      <div>
        <span style={s.targetLabel}>TARGET</span>
        <div style={s.targetRow}>
          <div style={s.targetGroup}>
            <span style={{ ...s.targetLabel, marginBottom: 2 }}>TRACK</span>
            <select
              style={s.select}
              value={resolvedTrackId}
              onChange={e => setTrackId(e.target.value)}
            >
              {tracks.length === 0 && (
                <option value="">— no tracks —</option>
              )}
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div style={s.targetGroup}>
            <span style={{ ...s.targetLabel, marginBottom: 2 }}>PARAM</span>
            <select
              style={s.select}
              value={param}
              onChange={e => setParam(e.target.value)}
            >
              {paramKeys.map(k => (
                <option key={k} value={k}>{AUTO_PARAMS[k].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Preview SVG */}
      <div style={s.previewBox}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {/* Background grid lines */}
          <line x1={0} y1={H / 2} x2={W} y2={H / 2}
            stroke="var(--border-faint)" strokeWidth={1} strokeDasharray="3 3" />
          {Array.from({ length: cycles }, (_, i) => (
            <line
              key={i}
              x1={((i + 1) / cycles) * W} y1={0}
              x2={((i + 1) / cycles) * W} y2={H}
              stroke="var(--border-faint)" strokeWidth={1}
            />
          ))}

          {/* Waveform fill */}
          <path
            d={`${previewPath} L${W},${H} L0,${H} Z`}
            fill="rgba(0,212,180,0.07)"
          />

          {/* Waveform line */}
          <path
            d={previewPath}
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth={1.5}
          />

          {/* Shape label */}
          <text
            x={4} y={10}
            fontFamily="var(--font-mono)"
            fontSize={7}
            fill="var(--text-muted)"
            letterSpacing="0.12em"
          >
            {shape}  {cycles}×  D{depth}%  O{offset}%
          </text>
        </svg>
      </div>

      {/* Write button */}
      <button
        style={s.writeBtn}
        onClick={handleWrite}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,180,0.2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,180,0.10)'; }}
      >
        WRITE TO LANE
      </button>

      {/* Status */}
      {status && (
        <div style={status.ok ? s.statusOk : s.statusErr}>
          {status.msg}
        </div>
      )}
    </div>
  );
}
