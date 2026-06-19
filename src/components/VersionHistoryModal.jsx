import { useState, useCallback } from 'react';
import { VersionHistory } from '../audio/VersionHistory.js';

const ACCENT = 'var(--accent-purple)';

function btn(border, color, extra = {}) {
  return {
    padding: '4px 12px', borderRadius: 3,
    border: `1px solid ${border}`, background: 'none',
    color, fontFamily: 'var(--font-mono)', fontSize: 7,
    letterSpacing: '0.12em', cursor: 'pointer', ...extra,
  };
}

function VersionRow({ v, isCurrent, onRestore, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel]     = useState(v.label);

  const commitRename = () => {
    onRename(v.id, label);
    setEditing(false);
  };

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid var(--border-faint)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: isCurrent ? 'rgba(155,114,255,0.06)' : 'transparent',
      transition: 'background 0.1s',
    }}>
      {/* Timeline dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: isCurrent ? ACCENT : 'var(--border-strong)',
          boxShadow: isCurrent ? `0 0 6px ${ACCENT}` : 'none',
        }} />
        <div style={{ width: 1, flex: 1, background: 'var(--border-faint)', minHeight: 8, marginTop: 3 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-bright)',
              background: 'var(--bg-element)', border: '1px solid var(--accent-purple)',
              borderRadius: 2, padding: '2px 6px', width: '100%', outline: 'none',
            }}
          />
        ) : (
          <div
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isCurrent ? 'var(--text-bright)' : 'var(--text-primary)', letterSpacing: '0.06em', cursor: 'text' }}
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {v.label}
            {isCurrent && <span style={{ marginLeft: 6, fontSize: 6, letterSpacing: '0.15em', color: ACCENT, verticalAlign: 'middle' }}>CURRENT</span>}
          </div>
        )}

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
          {v.projectName} · {v.bpm} BPM · {v.trackCount} tracks · {v.clipCount} clips · {VersionHistory.relativeTime(v.savedAt)}
        </div>

        {/* Track color dots */}
        <div style={{ display: 'flex', gap: 2, marginTop: 5 }}>
          {(v.tracks ?? []).slice(0, 12).map(t => (
            <div key={t.id} style={{ width: 6, height: 6, borderRadius: 1, background: t.color }} title={t.name} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'flex-start', paddingTop: 1 }}>
        {!isCurrent && (
          <>
            <button onClick={() => onRestore(v)} style={btn('var(--accent-purple)', ACCENT)}>RESTORE</button>
            <button onClick={() => onDelete(v.id)} style={btn('var(--border-faint)', 'var(--text-muted)')}>✕</button>
          </>
        )}
        {isCurrent && (
          <button onClick={() => setEditing(true)} style={btn('var(--border-faint)', 'var(--text-muted)')}>RENAME</button>
        )}
      </div>
    </div>
  );
}

export default function VersionHistoryModal({ onClose, onRestore, onSnapshot, currentVersionId }) {
  const [versions, setVersions] = useState(() => VersionHistory.getAll());
  const [snapLabel, setSnapLabel] = useState('');
  const [snapping, setSnapping]   = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = () => setVersions(VersionHistory.getAll());

  const handleSnapshot = () => {
    setSnapping(true);
    onSnapshot(snapLabel.trim() || undefined);
    setTimeout(() => {
      refresh();
      setSnapLabel('');
      setSnapping(false);
    }, 150);
  };

  const handleRestore = useCallback((v) => {
    onRestore(v);
    onClose();
  }, [onRestore, onClose]);

  const handleDelete = (id) => {
    VersionHistory.remove(id);
    refresh();
  };

  const handleRename = (id, label) => {
    VersionHistory.rename(id, label);
    refresh();
  };

  const handleClear = () => {
    VersionHistory.clear();
    refresh();
    setConfirmClear(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8, width: 520,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 96px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 13px', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.35em', color: 'var(--text-muted)', marginBottom: 4 }}>
                VOID STATION
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.18em', color: 'var(--text-bright)', fontWeight: 700 }}>
                VERSION HISTORY
              </div>
            </div>
            <button onClick={onClose} style={{ ...btn('var(--border-faint)', 'var(--text-muted)'), padding: '4px 8px' }}>✕</button>
          </div>

          {/* Snapshot controls */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={snapLabel}
              onChange={e => setSnapLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSnapshot()}
              placeholder="Snapshot label (optional)"
              style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8,
                background: 'var(--bg-element)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '6px 10px',
                outline: 'none', letterSpacing: '0.06em',
              }}
            />
            <button
              onClick={handleSnapshot}
              disabled={snapping}
              style={{
                padding: '6px 16px', borderRadius: 3,
                border: `1px solid ${ACCENT}`, background: 'rgba(155,114,255,0.12)', color: ACCENT,
                fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em',
                cursor: snapping ? 'default' : 'pointer', fontWeight: 700,
                opacity: snapping ? 0.6 : 1,
              }}
            >
              {snapping ? '...' : '+ SNAPSHOT'}
            </button>
          </div>
        </div>

        {/* Version list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {versions.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
              No snapshots yet.<br/>
              <span style={{ fontSize: 7, marginTop: 6, display: 'block', opacity: 0.6 }}>Create one above or save a project.</span>
            </div>
          ) : (
            versions.map(v => (
              <VersionRow
                key={v.id}
                v={v}
                isCurrent={v.id === currentVersionId}
                onRestore={handleRestore}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {versions.length > 0 && (
          <div style={{
            padding: '10px 20px 14px',
            borderTop: '1px solid var(--border-faint)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              {versions.length} / {20} snapshots · double-click label to rename
            </span>
            {confirmClear ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-red)', letterSpacing: '0.1em' }}>Delete all?</span>
                <button onClick={() => setConfirmClear(false)} style={btn('var(--border-default)', 'var(--text-muted)')}>CANCEL</button>
                <button onClick={handleClear} style={btn('var(--accent-red)', 'var(--accent-red)')}>DELETE ALL</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} style={btn('var(--border-faint)', 'var(--text-muted)')}>CLEAR HISTORY</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
