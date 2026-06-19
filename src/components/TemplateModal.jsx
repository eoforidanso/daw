import { useState } from 'react';
import { TEMPLATES, TEMPLATE_ORDER } from '../audio/templates.js';
import { AutoSave } from '../audio/AutoSave.js';

function TrackPills({ tracks }) {
  if (!tracks?.length) {
    return (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginTop: 10, letterSpacing: '0.08em' }}>
        No tracks — add your own
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 10 }}>
      {tracks.map(t => (
        <span
          key={t.id}
          title={t.name}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.08em',
            padding: '2px 6px', borderRadius: 2,
            background: t.color + '22', color: t.color,
            border: `1px solid ${t.color}44`,
          }}
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}

function RecentCard({ entry, onRestore }) {
  const dots = (entry.tracks ?? []).slice(0, 8);
  return (
    <div
      onClick={() => onRestore(entry)}
      style={{
        background: 'var(--bg-section)', border: '1px solid var(--border-faint)',
        borderRadius: 4, padding: '8px 10px', cursor: 'pointer',
        minWidth: 120, transition: 'border-color 0.12s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-faint)'; }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-bright)', marginBottom: 3, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
        {entry.projectName ?? 'Untitled'}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
        {entry.bpm} BPM · {AutoSave.relativeTime(entry.savedAt)}
      </div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {dots.map(t => (
          <div key={t.id} style={{ width: 7, height: 7, borderRadius: 1, background: t.color }} />
        ))}
        {!dots.length && <div style={{ width: 7, height: 7, borderRadius: 1, background: 'var(--border-faint)' }} />}
      </div>
    </div>
  );
}

export default function TemplateModal({ onSelect, recents = [] }) {
  const [selected, setSelected] = useState('edm');
  const tpl = TEMPLATES[selected];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.93)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        width: 680,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 32px 96px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border-faint)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.35em', color: 'var(--text-muted)', marginBottom: 5 }}>
            VOID STATION
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.2em', color: 'var(--text-bright)', fontWeight: 700 }}>
            NEW PROJECT
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.1em' }}>
            Choose a template to get started
          </div>
        </div>

        {/* Recent sessions */}
        {recents.length > 0 && (
          <div style={{ padding: '12px 20px 0' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.22em', color: 'var(--text-muted)', marginBottom: 8 }}>
              RECENT SESSIONS
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, borderBottom: '1px solid var(--border-faint)' }}>
              {recents.map(entry => (
                <RecentCard key={entry.id} entry={entry} onRestore={onSelect} />
              ))}
            </div>
          </div>
        )}

        {/* Template section header */}
        <div style={{ padding: `${recents.length ? '10' : '0'}px 20px 0` }}>
          {recents.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.22em', color: 'var(--text-muted)', marginBottom: 8, paddingTop: 4 }}>
              NEW FROM TEMPLATE
            </div>
          )}
        </div>

        {/* Template cards */}
        <div style={{ padding: `${recents.length ? '0' : '16px'} 20px 12px`, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {TEMPLATE_ORDER.map(id => {
            const t = TEMPLATES[id];
            const isSelected = selected === id;
            return (
              <div
                key={id}
                onClick={() => setSelected(id)}
                style={{
                  border: `1px solid ${isSelected ? t.accent : 'var(--border-faint)'}`,
                  borderTop: `3px solid ${t.accent}`,
                  borderRadius: 4,
                  background: isSelected ? t.accent + '12' : 'var(--bg-section)',
                  padding: '10px 9px 9px',
                  cursor: 'pointer',
                  transition: 'border-color 0.12s, background 0.12s',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', fontWeight: 700,
                  color: isSelected ? t.accent : 'var(--text-primary)',
                  marginBottom: 4, transition: 'color 0.12s',
                }}>
                  {t.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {t.bpm} BPM
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {t.tracks.length ? `${t.tracks.length} tracks` : 'blank'}
                </div>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 8 }}>
                  {t.tracks.slice(0, 8).map(tr => (
                    <div key={tr.id} style={{ width: 7, height: 7, borderRadius: 1, background: tr.color }} />
                  ))}
                  {!t.tracks.length && (
                    <div style={{ width: 7, height: 7, borderRadius: 1, background: 'var(--border-faint)' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', background: 'var(--bg-element)', borderRadius: 4, border: `1px solid ${tpl.accent}30`, borderLeft: `3px solid ${tpl.accent}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: tpl.accent, letterSpacing: '0.18em', marginBottom: 5 }}>
            {tpl.name.toUpperCase()} · {tpl.bpm} BPM
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>
            {tpl.description}
          </div>
          <TrackPills tracks={tpl.tracks} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={() => onSelect(TEMPLATES['empty'])}
            style={{
              padding: '8px 18px', borderRadius: 3,
              border: '1px solid var(--border-default)', background: 'none',
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              fontSize: 8, letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            SKIP
          </button>
          <button
            onClick={() => onSelect(tpl)}
            style={{
              padding: '10px 32px', borderRadius: 4,
              border: `1px solid ${tpl.accent}`,
              background: tpl.accent + '18', color: tpl.accent,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.25em', cursor: 'pointer', fontWeight: 700,
            }}
          >
            CREATE PROJECT
          </button>
        </div>
      </div>
    </div>
  );
}
