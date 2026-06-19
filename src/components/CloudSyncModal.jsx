import { useState, useEffect, useCallback, useRef } from 'react';
import { CloudSync } from '../audio/CloudSync.js';

const ACCENT = 'var(--accent-blue)';

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--border-faint)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  );
}

function StatusBadge({ text, color }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em',
      padding: '3px 8px', borderRadius: 2,
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>
      {text}
    </div>
  );
}

function CloudProjectRow({ project, onPull, onDelete, busy }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{
      padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: '1px solid var(--border-faint)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-bright)', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.projectName}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
          {project.bpm} BPM · {project.tracks?.length ?? 0} tracks · {CloudSync.relativeTime(project.pushedAt)}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          {(project.tracks ?? []).slice(0, 8).map(t => (
            <div key={t.id} style={{ width: 7, height: 7, borderRadius: 1, background: t.color }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {confirm ? (
          <>
            <button onClick={() => setConfirm(false)} style={btnStyle('var(--border-default)', 'var(--text-muted)')}>CANCEL</button>
            <button onClick={() => onDelete(project.id)} disabled={busy} style={btnStyle('var(--accent-red)', 'var(--accent-red)')}>DELETE</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirm(true)} disabled={busy} style={{ ...btnStyle('var(--border-faint)', 'var(--text-muted)'), fontSize: 10 }}>✕</button>
            <button onClick={() => onPull(project)} disabled={busy} style={btnStyle(ACCENT, ACCENT)}>↓ OPEN</button>
          </>
        )}
      </div>
    </div>
  );
}

function btnStyle(border, color) {
  return {
    padding: '4px 10px', borderRadius: 3,
    border: `1px solid ${border}`, background: 'none',
    color, fontFamily: 'var(--font-mono)', fontSize: 7,
    letterSpacing: '0.12em', cursor: 'pointer',
  };
}

export default function CloudSyncModal({ onClose, onOpenProject, currentState }) {
  const [user, setUser]         = useState(() => CloudSync.getUser());
  const [email, setEmail]       = useState('');
  const [projects, setProjects] = useState([]);
  const [busy, setBusy]         = useState(false);
  const [status, setStatus]     = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const [autoSync, setAutoSync] = useState(false);
  const autoSyncRef = useRef(null);

  const toast = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 3500); };

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await CloudSync.listProjects());
    } catch {
      toast('Could not load cloud projects');
    }
  }, []);

  useEffect(() => {
    if (user) { setBusy(true); loadProjects().finally(() => setBusy(false)); }
  }, [user, loadProjects]);

  // Auto-sync interval
  useEffect(() => {
    if (!autoSync || !user) { clearInterval(autoSyncRef.current); return; }
    autoSyncRef.current = setInterval(async () => {
      try {
        await CloudSync.push(currentState);
        setLastSynced(Date.now());
        loadProjects();
      } catch {}
    }, 120_000); // every 2 min
    return () => clearInterval(autoSyncRef.current);
  }, [autoSync, user, currentState, loadProjects]);

  const handleSignIn = async () => {
    if (!email.trim() || !email.includes('@')) { toast('Enter a valid email'); return; }
    setBusy(true); toast('Signing in…');
    try {
      setUser(await CloudSync.signIn(email.trim()));
      setStatus('');
    } catch (e) { toast(`Sign-in failed: ${e.message}`); }
    setBusy(false);
  };

  const handlePush = async () => {
    setBusy(true); toast('Uploading…');
    try {
      await CloudSync.push(currentState);
      setLastSynced(Date.now());
      toast(`✓ Synced "${currentState.name ?? 'Untitled'}" to cloud`);
      loadProjects();
    } catch (e) { toast(`Upload failed: ${e.message}`); }
    setBusy(false);
  };

  const handlePull = async (project) => {
    setBusy(true); toast('Downloading…');
    try {
      const data = await CloudSync.pull(project.id);
      if (data) { onOpenProject(data); return; }
      toast('Project not found');
    } catch (e) { toast(`Download failed: ${e.message}`); }
    setBusy(false);
  };

  const handleDelete = async (id) => {
    setBusy(true);
    try { await CloudSync.deleteProject(id); await loadProjects(); }
    catch (e) { toast(`Delete failed: ${e.message}`); }
    setBusy(false);
  };

  const handleSignOut = async () => {
    await CloudSync.signOut();
    setUser(null); setProjects([]);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 8, width: 420, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 32px 96px rgba(0,0,0,0.9)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 14, color: ACCENT }}>☁</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em', color: ACCENT, fontWeight: 700 }}>CLOUD SYNC</div>
            {user && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
                {user.email}
              </div>
            )}
          </div>
          {user && <StatusBadge text={busy ? 'SYNCING' : 'CONNECTED'} color={busy ? 'var(--accent-yellow)' : 'var(--accent-cyan)'} />}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!user ? (
            /* ── Sign-in form ── */
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, color: ACCENT, marginBottom: 10 }}>☁</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)', letterSpacing: '0.15em', marginBottom: 6 }}>SYNC YOUR PROJECTS</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 280 }}>
                  Sign in to back up and restore projects across devices. Audio clips are not uploaded.
                </div>
              </div>
              <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  placeholder="your@email.com"
                  style={{ background: 'var(--bg-element)', border: '1px solid var(--border-default)', borderRadius: 3, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-bright)', outline: 'none', width: '100%' }}
                  onFocus={e => { e.target.style.borderColor = ACCENT; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
                />
                <button
                  onClick={handleSignIn}
                  disabled={busy}
                  style={{ padding: '10px 0', borderRadius: 4, border: `1px solid ${ACCENT}`, background: ACCENT + '18', color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {busy ? <><Spinner /> SIGNING IN</> : 'SIGN IN'}
                </button>
              </div>
              {status && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: status.startsWith('✓') ? 'var(--accent-cyan)' : 'var(--accent-red)', letterSpacing: '0.08em' }}>{status}</div>}
            </div>
          ) : (
            /* ── Signed-in view ── */
            <>
              {/* Current project / push */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-faint)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 8 }}>CURRENT PROJECT</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-bright)', letterSpacing: '0.08em' }}>
                      {currentState?.name ?? 'Untitled'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
                      {currentState?.bpm} BPM · {currentState?.tracks?.length ?? 0} tracks
                      {lastSynced ? ` · Synced ${CloudSync.relativeTime(lastSynced)}` : ' · Not yet synced'}
                    </div>
                  </div>
                  <button
                    onClick={handlePush}
                    disabled={busy}
                    style={{ padding: '7px 14px', borderRadius: 3, border: `1px solid ${ACCENT}`, background: ACCENT + '18', color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {busy ? <Spinner /> : '↑'} PUSH
                  </button>
                </div>

                {/* Auto-sync toggle */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setAutoSync(v => !v)}
                    style={{
                      width: 32, height: 16, borderRadius: 8, border: 'none',
                      background: autoSync ? ACCENT : 'var(--bg-element)',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{ position: 'absolute', top: 2, left: autoSync ? 18 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: autoSync ? ACCENT : 'var(--text-muted)', letterSpacing: '0.12em' }}>
                    AUTO-SYNC {autoSync ? 'ON' : 'OFF'}
                  </span>
                  {autoSync && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>every 2 min</span>}
                </div>
              </div>

              {/* Cloud project list */}
              <div>
                <div style={{ padding: '10px 18px 6px', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  CLOUD PROJECTS
                  {busy && <Spinner />}
                </div>
                {projects.length === 0 ? (
                  <div style={{ padding: '20px 18px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em', textAlign: 'center' }}>
                    No cloud projects yet. Push your first project above.
                  </div>
                ) : projects.map(p => (
                  <CloudProjectRow
                    key={p.id}
                    project={p}
                    onPull={handlePull}
                    onDelete={handleDelete}
                    busy={busy}
                  />
                ))}
              </div>

              {/* Status toast */}
              {status && (
                <div style={{ padding: '8px 18px', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em', color: status.startsWith('✓') ? 'var(--accent-cyan)' : status.startsWith('Could') || status.includes('failed') ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                  {status}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer (sign out) */}
        {user && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-faint)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={handleSignOut} style={{ ...btnStyle('var(--border-faint)', 'var(--text-muted)'), fontSize: 7 }}>
              SIGN OUT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
