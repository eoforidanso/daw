import { useRef, useCallback } from 'react';

export default function Knob({ value = 50, min = 0, max = 100, onChange, label, size = 36, color = 'var(--accent-cyan)', showValue = true, formatValue }) {
  const drag = useRef({ active: false, startY: 0, startVal: 0 });

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    drag.current = { active: true, startY: e.clientY, startVal: value };
    const onMove = (e) => {
      if (!drag.current.active) return;
      const delta = drag.current.startY - e.clientY;
      const range = max - min;
      const next = Math.max(min, Math.min(max, drag.current.startVal + (delta / 120) * range));
      onChange(Math.round(next * 10) / 10);
    };
    const onUp = () => {
      drag.current.active = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [value, min, max, onChange]);

  const norm = (value - min) / (max - min);
  const angle = -135 + norm * 270;
  const rad = (angle - 90) * (Math.PI / 180);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 3;
  const il = r - 5;
  const x2 = cx + il * Math.cos(rad);
  const y2 = cy + il * Math.sin(rad);
  const sRad = (-135 - 90) * (Math.PI / 180);
  const ax1 = cx + r * Math.cos(sRad), ay1 = cy + r * Math.sin(sRad);
  const ax2 = cx + r * Math.cos(rad), ay2 = cy + r * Math.sin(rad);
  const lg = norm > 0.5 ? 1 : 0;

  const displayVal = formatValue ? formatValue(value) : Number.isInteger(value) ? value : value.toFixed(1);

  return (
    <div className="knob-wrapper" onMouseDown={onMouseDown}>
      <svg width={size} height={size} className="knob-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-default)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * r * 0.75} ${2 * Math.PI * r}`}
          strokeDashoffset={`${-2 * Math.PI * r * 0.125}`}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {norm > 0 && (
          <path d={`M ${ax1} ${ay1} A ${r} ${r} 0 ${lg} 1 ${ax2} ${ay2}`}
            fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        )}
        <circle cx={cx} cy={cy} r={r - 6} fill="var(--bg-element)" />
        <circle cx={cx} cy={cy} r={r - 8} fill="var(--bg-hover)" />
        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2" fill={color} />
      </svg>
      {label && <div className="knob-label">{label}</div>}
      {showValue && <div className="knob-val">{displayVal}</div>}
    </div>
  );
}
