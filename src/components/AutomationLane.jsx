import { useRef, useCallback } from 'react';
import { mkPtId, AUTO_PARAMS } from '../audio/AutomationEngine.js';

const LANE_H       = 52;
const PX_PER_BEAT  = 30;
const TOTAL_BEATS  = 32;
const LANE_W       = TOTAL_BEATS * PX_PER_BEAT;
const PT_R         = 5;

function beatToX(beat) { return (beat / TOTAL_BEATS) * LANE_W; }
function xToBeat(x)    { return Math.max(0, Math.min(TOTAL_BEATS, (x / LANE_W) * TOTAL_BEATS)); }

export default function AutomationLane({ lane, onAdd, onUpdate, onRemove }) {
  const svgRef = useRef(null);
  const def    = AUTO_PARAMS[lane.param] ?? { min: 0, max: 100, color: 'var(--accent-cyan)', label: lane.param };
  const { min, max, color } = def;

  const valToY  = (v) => LANE_H - ((v - min) / (max - min)) * LANE_H;
  const yToVal  = (y) => Math.max(min, Math.min(max, min + (1 - y / LANE_H) * (max - min)));
  const sorted  = [...lane.points].sort((a, b) => a.beat - b.beat);

  const svgClick = (e) => {
    if (e.target.tagName === 'circle') return;
    const rect  = svgRef.current.getBoundingClientRect();
    const x     = e.clientX - rect.left;
    const y     = e.clientY - rect.top;
    onAdd(lane.id, { id: mkPtId(), beat: xToBeat(x), value: yToVal(y) });
  };

  const startDrag = useCallback((e, pt) => {
    e.stopPropagation();
    const rect  = svgRef.current.getBoundingClientRect();
    const onMove = (ev) => {
      onUpdate(lane.id, pt.id, {
        beat:  xToBeat(ev.clientX - rect.left),
        value: yToVal(ev.clientY - rect.top),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [lane.id, onUpdate]);

  // Build SVG polyline path
  let pathD = '';
  if (sorted.length > 0) {
    const first = sorted[0];
    pathD += `M0,${valToY(first.value).toFixed(1)} L${beatToX(first.beat).toFixed(1)},${valToY(first.value).toFixed(1)}`;
    for (const pt of sorted) {
      pathD += ` L${beatToX(pt.beat).toFixed(1)},${valToY(pt.value).toFixed(1)}`;
    }
    const last = sorted[sorted.length - 1];
    pathD += ` L${LANE_W},${valToY(last.value).toFixed(1)}`;
  }
  const fillD = pathD ? `${pathD} L${LANE_W},${LANE_H} L0,${LANE_H} Z` : '';
  const zeroY = valToY(0);

  return (
    <div style={{ height: LANE_H, position: 'relative', background: 'rgba(0,0,0,0.28)', borderBottom: '1px solid var(--border-faint)' }}>
      <svg
        ref={svgRef}
        width={LANE_W}
        height={LANE_H}
        style={{ display: 'block', cursor: 'crosshair' }}
        onClick={svgClick}
        onContextMenu={e => e.preventDefault()}
      >
        {/* zero line */}
        <line x1={0} y1={zeroY} x2={LANE_W} y2={zeroY}
          stroke="var(--border-subtle)" strokeWidth={1} />

        {/* beat dividers */}
        {Array.from({ length: TOTAL_BEATS / 4 }, (_, i) => (
          <line key={i}
            x1={beatToX(i * 4)} y1={0} x2={beatToX(i * 4)} y2={LANE_H}
            stroke="var(--border-faint)" strokeWidth={1} />
        ))}

        {/* fill */}
        {fillD && <path d={fillD} fill={color + '22'} />}

        {/* line */}
        {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />}

        {/* breakpoints */}
        {sorted.map(pt => (
          <circle
            key={pt.id}
            cx={beatToX(pt.beat)}
            cy={valToY(pt.value)}
            r={PT_R}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onMouseDown={e => startDrag(e, pt)}
            onContextMenu={e => { e.preventDefault(); onRemove(lane.id, pt.id); }}
          />
        ))}
      </svg>

      {/* param label */}
      <div style={{
        position: 'absolute', left: 4, top: 2,
        fontFamily: 'var(--font-mono)', fontSize: 7,
        color, letterSpacing: '0.12em', pointerEvents: 'none',
      }}>
        {def.label}
      </div>
    </div>
  );
}
