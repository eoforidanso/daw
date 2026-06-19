import { useRef, useState } from 'react';

export default function ProjectModal({ projectName, onSave, onLoad, onClose, onRename, onNewProject }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy]     = useState(false);

  const handleSave = async () => {
    setBusy(true); setStatus('Saving…');
    try {
      const name = await onSave();
      setStatus(`Saved as "${name}.void"`);
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    }
    setBusy(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setStatus('Loading…');
    try {
      await onLoad(file);
      setStatus('Loaded successfully');
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
    }
    setBusy(false);
    e.target.value = '';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,8,10,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 340, background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6, padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--accent-cyan)' }}>
            PROJECT
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>

        {/* Project name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>PROJECT NAME</label>
          <input
            value={projectName}
            onChange={e => onRename(e.target.value)}
            style={{
              background: 'var(--bg-element)', border: '1px solid var(--border-default)',
              borderRadius: 3, padding: '6px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--text-bright)', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent-cyan)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
          />
        </div>

        {/* New project */}
        <button
          onClick={onNewProject}
          style={{
            padding: '10px 0', borderRadius: 4, border: '1px solid var(--border-strong)',
            background: 'var(--bg-section)', color: 'var(--accent-purple)',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em',
            cursor: 'pointer', transition: 'all 0.1s', width: '100%',
          }}
        >
          ✦ NEW PROJECT
        </button>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{
              padding: '10px 0', borderRadius: 4, border: '1px solid var(--accent-cyan)',
              background: 'var(--accent-cyan)11', color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
              transition: 'all 0.1s',
            }}
          >
            SAVE .VOID
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              padding: '10px 0', borderRadius: 4, border: '1px solid var(--border-strong)',
              background: 'var(--bg-element)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
              transition: 'all 0.1s',
            }}
          >
            OPEN .VOID
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".void,application/json" style={{ display: 'none' }} onChange={handleFile} />

        {/* Status */}
        {status && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
            color: status.includes('fail') ? 'var(--accent-red)' : 'var(--accent-cyan)',
            background: 'var(--bg-element)', border: '1px solid var(--border-subtle)',
            borderRadius: 3, padding: '6px 10px',
          }}>
            {status}
          </div>
        )}

        {/* Hints */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', lineHeight: 1.8, letterSpacing: '0.08em' }}>
          <div>• Clips, notes, automation lanes and mixer state are saved.</div>
          <div>• Recorded audio is embedded as base64 WAV.</div>
          <div>• Click outside or ✕ to close.</div>
        </div>
      </div>
    </div>
  );
}
