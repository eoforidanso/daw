import { useState, useEffect, useRef } from 'react';
import { CollabSync } from '../audio/CollabSync.js';

const ACCENT = 'var(--accent-blue)';

function btn(border, color, extra = {}) {
  return {
    padding: '6px 14px', borderRadius: 3,
    border: `1px solid ${border}`, background: 'none',
    color, fontFamily: 'var(--font-mono)', fontSize: 7,
    letterSpacing: '0.14em', cursor: 'pointer', ...extra,
  };
}

function Avatar({ user }) {
  return (
    <div title={user.name} style={{
      width: 26, height: 26, borderRadius: 13,
      background: user.color + '30', border: `2px solid ${user.color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 8, color: user.color, fontWeight: 700,
      flexShrink: 0,
    }}>
      {user.avatar ?? user.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function EventFeed({ events }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events]);

  if (!events?.length) {
    return (
      <div style={{ padding: '12px 0', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em', textAlign: 'center' }}>
        Waiting for activity…
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 140, overflowY: 'auto' }}>
      {events.slice(-20).map((ev, i) => (
        <div key={i} style={{ padding: '4px 0', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700, color: ev.color, flexShrink: 0 }}>{ev.userName}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-secondary)', flex: 1 }}>{ev.text}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', flexShrink: 0 }}>{CollabSync.relativeTime(ev.ts)}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

export default function CollabModal({ onClose, currentState, onJoinSnapshot }) {
  const [view, setView]         = useState('start'); // start | create | join | active
  const [userName, setUserName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [session, setSession]   = useState(null);
  const [myUser, setMyUser]     = useState(null);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');
  const pollRef                 = useRef(null);

  const startPoll = (code) => {
    pollRef.current = setInterval(() => {
      const s = CollabSync.getSession(code);
      if (s) setSession({ ...s });
    }, 2500);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleCreate = () => {
    if (!userName.trim()) { setError('Enter your name first'); return; }
    const { code, user } = CollabSync.createSession(currentState, userName.trim());
    setSession(CollabSync.getSession(code));
    setMyUser(user);
    setView('active');
    startPoll(code);
    CollabSync.simulateActivity(code, currentState);
  };

  const handleJoin = () => {
    if (!userName.trim()) { setError('Enter your name first'); return; }
    if (!joinCode.trim()) { setError('Enter the session code'); return; }
    const result = CollabSync.joinSession(joinCode.trim().toUpperCase(), userName.trim());
    if (!result) { setError('Session not found — check the code'); return; }
    setSession(result.session);
    setMyUser(result.user);
    setView('active');
    startPoll(joinCode.trim().toUpperCase());
    if (result.session.snapshot && onJoinSnapshot) onJoinSnapshot(result.session.snapshot);
  };

  const handleLeave = () => {
    if (!session || !myUser) return;
    clearInterval(pollRef.current);
    CollabSync.leaveSession(session.code, myUser.id);
    setSession(null); setMyUser(null);
    setView('start');
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(session.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onlineUsers = session?.users?.filter(u => Date.now() - (u.lastSeen ?? 0) < 12000) ?? [];

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
        borderRadius: 8, width: 460,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 32px 96px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 13px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.35em', color: 'var(--text-muted)', marginBottom: 4 }}>VOID STATION</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.18em', color: 'var(--text-bright)', fontWeight: 700 }}>COLLABORATION</div>
          </div>
          {view === 'active' && onlineUsers.length > 0 && (
            <div style={{ display: 'flex', gap: -6 }}>
              {onlineUsers.slice(0, 5).map(u => <Avatar key={u.id} user={u} />)}
            </div>
          )}
          <button onClick={onClose} style={btn('var(--border-faint)', 'var(--text-muted)', { padding: '4px 8px' })}>✕</button>
        </div>

        <div style={{ padding: '18px 20px 20px' }}>
          {/* Start screen */}
          {view === 'start' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 6 }}>YOUR NAME</div>
                <input
                  value={userName}
                  onChange={e => { setUserName(e.target.value); setError(''); }}
                  placeholder="Enter your display name"
                  style={{
                    width: '100%', fontFamily: 'var(--font-mono)', fontSize: 9,
                    background: 'var(--bg-element)', border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)', borderRadius: 3, padding: '8px 10px',
                    outline: 'none', letterSpacing: '0.06em',
                  }}
                />
              </div>
              {error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-red)', marginBottom: 10, letterSpacing: '0.1em' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCreate}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 4,
                    border: `1px solid ${ACCENT}`, background: 'rgba(74,158,255,0.1)', color: ACCENT,
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em',
                    cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  HOST SESSION
                </button>
                <button
                  onClick={() => { setError(''); setView('join'); }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 4,
                    border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', cursor: 'pointer',
                  }}
                >
                  JOIN SESSION
                </button>
              </div>
              <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-element)', borderRadius: 4, border: '1px solid var(--border-faint)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em', lineHeight: 1.7 }}>
                  Host a session to share your project in real-time. Share the 6-character code with collaborators. Changes and chat are synced automatically.
                </div>
              </div>
            </>
          )}

          {/* Join screen */}
          {view === 'join' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 6 }}>SESSION CODE</div>
                <input
                  autoFocus
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="XXXXXX"
                  maxLength={6}
                  style={{
                    width: '100%', fontFamily: 'var(--font-mono)', fontSize: 20, textAlign: 'center',
                    letterSpacing: '0.5em', background: 'var(--bg-element)',
                    border: '1px solid var(--border-default)', color: 'var(--text-bright)',
                    borderRadius: 3, padding: '10px', outline: 'none',
                  }}
                />
              </div>
              {error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-red)', marginBottom: 10, letterSpacing: '0.1em' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setView('start'); setError(''); }} style={{ ...btn('var(--border-default)', 'var(--text-muted)'), flex: 1 }}>BACK</button>
                <button
                  onClick={handleJoin}
                  style={{
                    flex: 2, padding: '8px', borderRadius: 3,
                    border: `1px solid ${ACCENT}`, background: 'rgba(74,158,255,0.1)', color: ACCENT,
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  JOIN
                </button>
              </div>
            </>
          )}

          {/* Active session */}
          {view === 'active' && session && myUser && (
            <>
              {/* Session code card */}
              <div style={{ background: 'var(--bg-element)', border: '1px solid var(--border-faint)', borderLeft: `3px solid ${ACCENT}`, borderRadius: 4, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.18em', marginBottom: 4 }}>SESSION CODE</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, letterSpacing: '0.4em', color: ACCENT, fontWeight: 700 }}>{session.code}</div>
                  </div>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: '8px 14px', borderRadius: 3,
                      border: `1px solid ${copied ? 'var(--accent-cyan)' : ACCENT}`,
                      background: copied ? 'rgba(0,212,180,0.1)' : 'rgba(74,158,255,0.08)',
                      color: copied ? 'var(--accent-cyan)' : ACCENT,
                      fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', cursor: 'pointer',
                    }}
                  >
                    {copied ? '✓ COPIED' : 'COPY CODE'}
                  </button>
                </div>
              </div>

              {/* Online users */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  ONLINE NOW ({onlineUsers.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {onlineUsers.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Avatar user={u} />
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: u.id === myUser.id ? 'var(--text-bright)' : 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                          {u.name}{u.id === myUser.id ? ' (you)' : ''}{u.isHost ? ' ★' : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 6 }}>ACTIVITY</div>
                <div style={{ background: 'var(--bg-element)', border: '1px solid var(--border-faint)', borderRadius: 4, padding: '8px 12px' }}>
                  <EventFeed events={session.events} />
                </div>
              </div>

              <button onClick={handleLeave} style={{ ...btn('var(--accent-red)', 'var(--accent-red)'), width: '100%', padding: '8px' }}>
                {myUser.isHost ? 'END SESSION' : 'LEAVE SESSION'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
