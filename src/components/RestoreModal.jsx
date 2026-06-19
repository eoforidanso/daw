import { AutoSave } from '../audio/AutoSave.js';

function Row({ icon, label, ok = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em', color: ok ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: ok ? 1 : 0.5 }}>
      <span style={{ color: ok ? 'var(--accent-cyan)' : 'var(--text-muted)', minWidth: 10 }}>{ok ? '✓' : '✗'}</span>
      {label}
    </div>
  );
}

export default function RestoreModal({ draft, onRestore, onDiscard }) {
  const trackCount = draft.tracks?.length ?? 0;
  const clipCount  = draft.clips?.length ?? 0;
  const laneCount  = draft.autoLanes?.length ?? 0;
  const stepCount  = Object.values(draft.steps ?? {}).filter(s => s.some(Boolean)).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.96)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8, width: 420,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 32px 96px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 13px',
          borderBottom: '1px solid var(--border-faint)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 15, color: 'var(--accent-yellow)', lineHeight: 1 }}>⚠</span>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em', color: 'var(--accent-yellow)', fontWeight: 700 }}>
              SESSION RECOVERY
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 3 }}>
              An unsaved session was detected from your last visit
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* Session card */}
          <div style={{
            background: 'var(--bg-element)',
            border: '1px solid var(--border-faint)',
            borderLeft: '3px solid var(--accent-yellow)',
            borderRadius: 4, padding: '12px 14px',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-bright)', fontWeight: 700, letterSpacing: '0.06em' }}>
                {draft.projectName ?? 'Untitled'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-yellow)', letterSpacing: '0.1em' }}>
                {draft.bpm} BPM
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>
              {trackCount} tracks · {clipCount} MIDI clips · Saved {AutoSave.relativeTime(draft.savedAt)}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {(draft.tracks ?? []).slice(0, 10).map(t => (
                <div key={t.id} title={t.name} style={{ width: 9, height: 9, borderRadius: 2, background: t.color }} />
              ))}
            </div>
          </div>

          {/* What's recovered */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 8 }}>
            WHAT WILL BE RESTORED
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            <Row label={`${trackCount} tracks · mixer settings · BPM`} />
            <Row label={`${clipCount} MIDI clip${clipCount !== 1 ? 's' : ''} with notes`} ok={clipCount > 0} />
            <Row label={`${stepCount} active drum patterns`} ok={stepCount > 0} />
            <Row label={`${laneCount} automation lane${laneCount !== 1 ? 's' : ''}`} ok={laneCount > 0} />
            <Row label="Recorded audio (not stored in recovery)" ok={false} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-faint)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onDiscard}
            style={{
              padding: '8px 18px', borderRadius: 3,
              border: '1px solid var(--border-default)', background: 'none',
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              fontSize: 8, letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            START FRESH
          </button>
          <button
            onClick={() => onRestore(draft)}
            style={{
              padding: '10px 28px', borderRadius: 4,
              border: '1px solid var(--accent-yellow)',
              background: 'rgba(255,190,69,0.12)', color: 'var(--accent-yellow)',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 700,
            }}
          >
            RESTORE SESSION
          </button>
        </div>
      </div>
    </div>
  );
}
