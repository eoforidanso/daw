import { useState } from 'react';
import { pluginRegistry } from '../audio/PluginAPI.js';
import Knob from './Knob';

// ── Parameter knob for a plugin instance ─────────────────────────────
function ParamKnob({ def, value, onChange }) {
  const range  = def.max - def.min;
  const norm   = (value - def.min) / range;
  const pct    = norm * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Knob
        value={pct} min={0} max={100}
        onChange={v => onChange(def.id, def.min + (v / 100) * range)}
        label={def.label} size={28}
        color={def.color}
        showValue
        formatValue={v => {
          const real = def.min + (v / 100) * range;
          return def.unit === 'dB'  ? `${real.toFixed(1)}dB`
               : def.unit === 'Hz'  ? real >= 1000 ? `${(real/1000).toFixed(1)}k` : `${real.toFixed(0)}`
               : def.unit === 'ms'  ? `${real.toFixed(0)}`
               : real.toFixed(2);
        }}
      />
    </div>
  );
}

// ── Single plugin instance card ───────────────────────────────────────
function PluginCard({ instance, onParam, onRemove }) {
  const [collapsed, setCollapsed] = useState(false);
  const { def, params } = instance;

  return (
    <div style={{
      background: 'var(--bg-element)', border: '1px solid var(--border-default)',
      borderRadius: 4, overflow: 'hidden', marginBottom: 6,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
        background: 'var(--bg-section)', borderBottom: collapsed ? 'none' : '1px solid var(--border-faint)',
        cursor: 'pointer',
      }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-bright)', flex: 1 }}>
          {def.name}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>
          {collapsed ? '▶' : '▼'}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(instance.instanceId); }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Params */}
      {!collapsed && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px' }}>
          {def.paramDefs.map(pd => (
            <ParamKnob
              key={pd.id}
              def={pd}
              value={params[pd.id] ?? pd.min}
              onChange={(k, v) => onParam(instance.instanceId, k, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Plugin browser (add new) ──────────────────────────────────────────
function PluginBrowser({ onAdd }) {
  const [open, setOpen] = useState(false);
  const plugins = pluginRegistry.list();

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '7px 0', borderRadius: 3,
          border: '1px dashed var(--border-strong)', background: 'none',
          color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 8,
          letterSpacing: '0.18em', cursor: 'pointer', transition: 'all 0.1s',
        }}
      >
        + ADD PLUGIN
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', marginTop: 4, overflow: 'hidden',
        }}>
          {plugins.map(p => (
            <div
              key={p.id}
              onClick={() => { onAdd(p.id); setOpen(false); }}
              style={{
                padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid var(--border-faint)', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.08em',
                background: 'var(--bg-element)', border: '1px solid var(--border-default)',
                borderRadius: 2, padding: '1px 5px', color: 'var(--text-muted)',
              }}>
                {p.category.toUpperCase()}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
                {p.name}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>
                v{p.version}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Track plugin chain ────────────────────────────────────────────────
function TrackPluginChain({ track, instances, onAdd, onParam, onRemove }) {
  return (
    <div style={{ minWidth: 200, maxWidth: 260, flexShrink: 0 }}>
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid var(--border-faint)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: track.color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
          {track.name}
        </span>
      </div>
      <div style={{ padding: '8px 10px' }}>
        {instances.map(inst => (
          <PluginCard key={inst.instanceId} instance={inst} onParam={onParam} onRemove={onRemove} />
        ))}
        <PluginBrowser onAdd={id => onAdd(track.id, id)} />
      </div>
    </div>
  );
}

// ── Main PluginRack component ─────────────────────────────────────────
export default function PluginRack({ tracks, pluginInstances, onAddPlugin, onSetPluginParam, onRemovePlugin }) {
  return (
    <div style={{
      display: 'flex', height: '100%', gap: 0,
      overflowX: 'auto', overflowY: 'hidden',
      background: 'var(--bg-void)',
    }}>
      {tracks.map((track, i) => (
        <div key={track.id} style={{ display: 'flex', flexShrink: 0 }}>
          <TrackPluginChain
            track={track}
            instances={pluginInstances[track.id] ?? []}
            onAdd={onAddPlugin}
            onParam={onSetPluginParam}
            onRemove={id => onRemovePlugin(track.id, id)}
          />
          {i < tracks.length - 1 && (
            <div style={{ width: 1, background: 'var(--border-faint)', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}
