import { useState, useCallback, useEffect } from 'react';
import { AUTO_PARAMS } from '../audio/AutomationEngine.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_COUNT = 8;

const SOURCE_TYPES = [
  { value: 'LFO_SINE', label: 'LFO SIN' },
  { value: 'LFO_TRI',  label: 'LFO TRI' },
  { value: 'LFO_SQ',   label: 'LFO SQ'  },
  { value: 'RANDOM',   label: 'RANDOM'  },
  { value: 'VELOCITY', label: 'VEL'     },
  { value: 'ENV_FOLLOW',label: 'ENV'    },
];

const LFO_TYPES = new Set(['LFO_SINE', 'LFO_TRI', 'LFO_SQ']);

const PARAM_OPTIONS = Object.entries(AUTO_PARAMS).map(([key, def]) => ({
  value: key,
  label: def.label,
}));

function makeSlot(id) {
  return {
    id,
    sourceType:    'LFO_SINE',
    sourceRate:    1.0,
    sourceTrackId: null,
    destTrackId:   null,
    destParam:     PARAM_OPTIONS[0]?.value ?? 'volume',
    depth:         0,
    enabled:       false,
  };
}

function initSlots() {
  return Array.from({ length: SLOT_COUNT }, (_, i) => makeSlot(i + 1));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToggleDot({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Disable slot' : 'Enable slot'}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: '1px solid',
        borderColor: enabled ? 'var(--accent-cyan)' : 'var(--border-dim, #333)',
        background: enabled ? 'var(--accent-cyan)' : 'transparent',
        boxShadow: enabled ? '0 0 6px var(--accent-cyan)' : 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
    />
  );
}

function SourceDestBadge({ slot, tracks }) {
  const srcLabel = SOURCE_TYPES.find((s) => s.value === slot.sourceType)?.label ?? '?';
  const destTrack = tracks.find((t) => String(t.id) === String(slot.destTrackId));
  const paramLabel = AUTO_PARAMS[slot.destParam]?.label ?? slot.destParam;
  const trackColor = destTrack?.color ?? 'var(--text-dim, #666)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 8,
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        background: 'var(--accent-purple)',
        color: '#000',
        padding: '1px 3px',
        borderRadius: 2,
        fontWeight: 700,
      }}>
        {srcLabel}
      </span>
      <span style={{ color: 'var(--text-dim, #666)' }}>→</span>
      <span style={{
        background: trackColor,
        color: '#000',
        padding: '1px 3px',
        borderRadius: 2,
        fontWeight: 700,
        maxWidth: 52,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {destTrack ? destTrack.name : '?'}
      </span>
      <span style={{ color: 'var(--text-dim, #666)', fontSize: 7 }}>{paramLabel}</span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tdStyle = {
  padding: '0 4px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const selectStyle = {
  background: 'var(--bg-surface, #1a1a1a)',
  border: '1px solid var(--border-dim, #333)',
  color: 'var(--text-primary, #e0e0e0)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  padding: '1px 2px',
  borderRadius: 2,
  cursor: 'pointer',
  outline: 'none',
  height: 18,
  maxWidth: 90,
};

const rateInputStyle = {
  background: 'var(--bg-surface, #1a1a1a)',
  border: '1px solid var(--border-dim, #333)',
  color: 'var(--text-primary, #e0e0e0)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  width: 38,
  padding: '1px 3px',
  borderRadius: 2,
  outline: 'none',
  height: 18,
  textAlign: 'right',
};

const sliderStyle = {
  WebkitAppearance: 'none',
  appearance: 'none',
  width: 70,
  height: 3,
  borderRadius: 2,
  background: 'var(--border-dim, #333)',
  outline: 'none',
  cursor: 'pointer',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ModMatrix({ tracks = [], onModSlotsChange }) {
  const [slots, setSlots] = useState(initSlots);

  // Notify parent whenever slots change
  useEffect(() => {
    onModSlotsChange?.(slots);
  }, [slots, onModSlotsChange]);

  const updateSlot = useCallback((slotId, changes) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, ...changes } : s))
    );
  }, []);

  const resetSlot = useCallback((slotId) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? makeSlot(slotId) : s))
    );
  }, []);

  const enabledCount = slots.filter((s) => s.enabled).length;

  return (
    <div style={{
      background: 'var(--bg-panel, #141414)',
      border: '1px solid var(--border-dim, #2a2a2a)',
      borderRadius: 4,
      padding: '8px 0',
      fontFamily: 'var(--font-mono)',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px 6px',
        borderBottom: '1px solid var(--border-dim, #2a2a2a)',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-primary, #e0e0e0)' }}>
          MOD MATRIX
        </span>
        <span style={{ fontSize: 9, color: enabledCount > 0 ? 'var(--accent-cyan)' : 'var(--text-dim, #666)' }}>
          {enabledCount}/{SLOT_COUNT} ACTIVE
        </span>
      </div>

      {/* Column headers */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 540 }}>
          <colgroup>
            <col style={{ width: 22  }} /> {/* toggle */}
            <col style={{ width: 72  }} /> {/* source */}
            <col style={{ width: 64  }} /> {/* rate   */}
            <col style={{ width: 18  }} /> {/* arrow  */}
            <col style={{ width: 88  }} /> {/* track  */}
            <col style={{ width: 88  }} /> {/* param  */}
            <col style={{ width: 116 }} /> {/* depth  */}
            <col />                        {/* badge  */}
          </colgroup>
          <thead>
            <tr style={{ height: 18 }}>
              {['', 'SOURCE', 'RATE', '', 'TRACK', 'PARAM', 'DEPTH', 'ROUTE'].map((h, i) => (
                <th key={i} style={{
                  padding: '0 4px',
                  textAlign: 'left',
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: 'var(--text-dim, #666)',
                  borderBottom: '1px solid var(--border-dim, #2a2a2a)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr
                key={slot.id}
                style={{
                  height: 28,
                  borderBottom: '1px solid var(--border-dim, #1e1e1e)',
                }}
                onContextMenu={(e) => { e.preventDefault(); resetSlot(slot.id); }}
              >
                {/* Render via SlotRow but inline to keep table structure */}
                <SlotCells slot={slot} tracks={tracks} onUpdate={updateSlot} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '4px 10px 0',
        fontSize: 8,
        color: 'var(--text-dim, #555)',
        borderTop: '1px solid var(--border-dim, #1e1e1e)',
        marginTop: 2,
      }}>
        right-click row to reset slot · depth 0 = no modulation
      </div>

      {/* Inline slider thumb styles */}
      <style>{`
        .mod-matrix-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--thumb-color, var(--accent-cyan));
          cursor: pointer;
        }
        .mod-matrix-slider::-moz-range-thumb {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: var(--thumb-color, var(--accent-cyan));
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ─── Inlined cell renderer (avoids <tr> inside <tr> nesting issue) ───────────

function SlotCells({ slot, tracks, onUpdate }) {
  const isLFO = LFO_TYPES.has(slot.sourceType);
  const sliderVal = slot.depth + 100;
  const depthPct  = `${slot.depth > 0 ? '+' : ''}${slot.depth}%`;
  const depthColor = slot.depth >= 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)';
  const set = (key, val) => onUpdate(slot.id, { [key]: val });

  return (
    <>
      {/* 1 — toggle */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <ToggleDot enabled={slot.enabled} onChange={(v) => set('enabled', v)} />
      </td>

      {/* 2 — source */}
      <td style={tdStyle}>
        <select
          value={slot.sourceType}
          onChange={(e) => set('sourceType', e.target.value)}
          style={{ ...selectStyle, borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', maxWidth: 68 }}
          disabled={!slot.enabled}
        >
          {SOURCE_TYPES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </td>

      {/* 3 — rate */}
      <td style={{ ...tdStyle, minWidth: 60 }}>
        {isLFO ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: 'var(--text-dim, #888)' }}>
            <input
              type="number"
              min={0.1}
              max={16}
              step={0.1}
              value={slot.sourceRate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) set('sourceRate', Math.max(0.1, Math.min(16, v)));
              }}
              style={rateInputStyle}
              disabled={!slot.enabled}
            />
            <span>Hz</span>
          </label>
        ) : (
          <span style={{ color: 'var(--text-dim, #555)', fontSize: 9 }}>—</span>
        )}
      </td>

      {/* 4 — arrow */}
      <td style={{ ...tdStyle, color: 'var(--text-dim, #666)', fontSize: 11, textAlign: 'center' }}>→</td>

      {/* 5 — track */}
      <td style={tdStyle}>
        <select
          value={slot.destTrackId ?? ''}
          onChange={(e) => set('destTrackId', e.target.value || null)}
          style={{ ...selectStyle, maxWidth: 84 }}
          disabled={!slot.enabled}
        >
          <option value="">-- track --</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </td>

      {/* 6 — param */}
      <td style={tdStyle}>
        <select
          value={slot.destParam}
          onChange={(e) => set('destParam', e.target.value)}
          style={{ ...selectStyle, maxWidth: 84 }}
          disabled={!slot.enabled}
        >
          {PARAM_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </td>

      {/* 7 — depth */}
      <td style={{ ...tdStyle, minWidth: 110 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={sliderVal}
            onChange={(e) => set('depth', parseInt(e.target.value, 10) - 100)}
            className="mod-matrix-slider"
            style={{
              ...sliderStyle,
              '--thumb-color': depthColor,
              opacity: slot.enabled ? 1 : 0.4,
            }}
            disabled={!slot.enabled}
          />
          <span style={{ fontSize: 9, color: depthColor, minWidth: 36, textAlign: 'right' }}>
            {depthPct}
          </span>
        </div>
      </td>

      {/* 8 — route badge */}
      <td style={{ ...tdStyle, paddingLeft: 6 }}>
        <SourceDestBadge slot={slot} tracks={tracks} />
      </td>
    </>
  );
}
