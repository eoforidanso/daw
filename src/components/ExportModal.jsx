import { useState, useCallback } from 'react';
import { Bouncer } from '../audio/Bouncer.js';

const ACCENT = 'var(--accent-cyan)';

function btn(border, color, extra = {}) {
  return {
    padding: '6px 14px', borderRadius: 3, border: `1px solid ${border}`,
    background: 'none', color, fontFamily: 'var(--font-mono)',
    fontSize: 7, letterSpacing: '0.14em', cursor: 'pointer', ...extra,
  };
}

const BAR_OPTIONS    = [4, 8, 16, 32];
const FORMAT_OPTIONS = [
  { id: 'wav-44', label: 'WAV — 44.1 kHz · 16-bit', sr: 44100 },
  { id: 'wav-48', label: 'WAV — 48 kHz · 16-bit',   sr: 48000 },
];

function ProgressRing({ pct }) {
  const r = 22, circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  return (
    <svg width={54} height={54} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={27} cy={27} r={r} fill="none" stroke="var(--border-default)" strokeWidth={4} />
      <circle cx={27} cy={27} r={r} fill="none" stroke={ACCENT} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={dash}
        style={{ transition: 'stroke-dashoffset 0.2s ease' }} strokeLinecap="round"
      />
    </svg>
  );
}

function BounceState({ status, pct, errMsg, blob, fmt, duration, onBounce, onRebounce, onDownload }) {
  if (status === 'idle') return (
    <button onClick={onBounce} style={{
      width: '100%', padding: '13px', borderRadius: 4, cursor: 'pointer',
      border: `1px solid ${ACCENT}`, background: 'rgba(0,212,180,0.12)', color: ACCENT,
      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.25em', fontWeight: 700,
    }}>
      ↓  BOUNCE TO WAV
    </button>
  );

  if (status === 'bouncing') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', background: 'var(--bg-element)', borderRadius: 4, border: '1px solid var(--border-faint)' }}>
      <ProgressRing pct={pct} />
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: ACCENT, letterSpacing: '0.15em', fontWeight: 700 }}>RENDERING…</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 3 }}>
          {pct < 50 ? 'Scheduling audio events' : pct < 80 ? 'Synthesizing audio' : 'Encoding WAV'}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14, color: ACCENT, fontWeight: 700 }}>{pct}%</div>
    </div>
  );

  if (status === 'done' && blob) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(0,212,180,0.07)', borderRadius: 4, border: '1px solid rgba(0,212,180,0.25)' }}>
        <span style={{ fontSize: 16, color: ACCENT }}>✓</span>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: ACCENT, letterSpacing: '0.12em', fontWeight: 700 }}>BOUNCE COMPLETE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>
            {duration} · {fmt?.label} · {(blob.size / 1048576).toFixed(1)} MB
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRebounce} style={{ ...btn('var(--border-default)', 'var(--text-muted)'), flex: 1 }}>RE-BOUNCE</button>
        <button onClick={onDownload} style={{ flex: 2, padding: '10px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${ACCENT}`, background: ACCENT, color: '#000', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', fontWeight: 700 }}>
          ↓  DOWNLOAD WAV
        </button>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div style={{ padding: '12px 14px', background: 'rgba(255,68,102,0.08)', borderRadius: 4, border: '1px solid rgba(255,68,102,0.3)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-red)', letterSpacing: '0.12em', marginBottom: 6 }}>RENDER FAILED</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>{errMsg}</div>
      <button onClick={onRebounce} style={btn('var(--border-default)', 'var(--text-muted)')}>TRY AGAIN</button>
    </div>
  );

  return null;
}

// ── Stems by scene ────────────────────────────────────────────────────────────

function StemScene({ si, label, tracks, grid, state, bars, sampleRate, projectName }) {
  const [status, setStatus] = useState('idle');
  const [pct,    setPct]    = useState(0);
  const [err,    setErr]    = useState('');

  const activeCount = (grid[si] ?? []).filter(Boolean).length;

  const bounce = async () => {
    if (status === 'bouncing') return;
    setStatus('bouncing'); setPct(0); setErr('');
    try {
      const activeTrackIds   = tracks.filter((_, ti) => grid[si]?.[ti] ?? true).map(t => t.id);
      const activeTrackNames = tracks.filter((_, ti) => grid[si]?.[ti] ?? true).map(t => t.name.toUpperCase());
      const filteredSteps    = Object.fromEntries(
        Object.entries(state?.steps ?? {}).filter(([k]) => activeTrackNames.includes(k.toUpperCase()))
      );
      const filteredClips    = (state?.clips ?? []).filter(c => activeTrackIds.includes(c.trackId));
      const sceneState = { ...state, steps: filteredSteps, clips: filteredClips };
      const wav = await Bouncer.bounce(sceneState, { numBars: bars, sampleRate, onProgress: setPct });
      const slug = (projectName ?? 'mix').toLowerCase().replace(/\s+/g, '-');
      Bouncer.download(wav, `${slug}-scene${si + 1}-${label.replace(/\s+/g, '-').toLowerCase()}.wav`);
      setStatus('done');
    } catch (e) {
      setErr(e?.message ?? 'Render failed');
      setStatus('error');
    }
  };

  const stateColor = status === 'done' ? 'var(--accent-cyan)' : status === 'error' ? 'var(--accent-red)' : status === 'bouncing' ? 'var(--accent-yellow)' : 'var(--border-default)';
  const stateText  = status === 'done' ? '✓' : status === 'error' ? '✕' : status === 'bouncing' ? `${pct}%` : '↓';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 3, background: 'var(--bg-element)', border: `1px solid var(--border-faint)` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-primary)', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 1 }}>{activeCount}/{tracks.length} tracks active</div>
        {status === 'error' && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--accent-red)', marginTop: 2 }}>{err}</div>}
      </div>
      <button
        onClick={() => status === 'done' ? setStatus('idle') : bounce()}
        disabled={status === 'bouncing'}
        style={{
          padding: '4px 12px', borderRadius: 3, cursor: status === 'bouncing' ? 'default' : 'pointer',
          border: `1px solid ${stateColor}`,
          background: status === 'done' ? 'rgba(0,212,180,0.1)' : 'none',
          color: stateColor,
          fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em', flexShrink: 0,
          opacity: status === 'bouncing' ? 0.7 : 1,
        }}
      >
        {status === 'done' ? 'DONE ✓' : status === 'error' ? 'RETRY' : stateText}
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ExportModal({ onClose, currentState, projectName = 'mix', sceneGrid, sceneLabels, tracks }) {
  const [bars,   setBars]   = useState(16);
  const [fmt,    setFmt]    = useState('wav-44');
  const [status, setStatus] = useState('idle');
  const [pct,    setPct]    = useState(0);
  const [blob,   setBlob]   = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const [tab,    setTab]    = useState('full'); // 'full' | 'stems'

  const format   = FORMAT_OPTIONS.find(f => f.id === fmt);
  const duration = Bouncer.formatDuration(currentState?.bpm ?? 128, bars);
  const hasSteps = Object.values(currentState?.steps ?? {}).some(p => p?.some(Boolean));
  const hasClips = (currentState?.clips ?? []).some(c => c.type === 'midi' && c.notes?.length);
  const hasScenes = sceneGrid && tracks?.length > 0;

  const handleBounce = useCallback(async () => {
    setStatus('bouncing'); setPct(0); setBlob(null); setErrMsg('');
    try {
      const wav = await Bouncer.bounce(currentState, { numBars: bars, sampleRate: format.sr, onProgress: setPct });
      setBlob(wav);
      setStatus('done');
    } catch (e) {
      setErrMsg(e?.message ?? 'Render failed — try a shorter duration');
      setStatus('error');
    }
  }, [currentState, bars, format]);

  const handleDownload = () => {
    if (!blob) return;
    const slug = (projectName ?? 'mix').toLowerCase().replace(/\s+/g, '-');
    Bouncer.download(blob, `${slug}-${bars}bars.wav`);
  };

  const tabBtn = (id, label) => ({
    padding: '6px 14px', borderRadius: '3px 3px 0 0', cursor: 'pointer',
    border: `1px solid ${tab === id ? 'var(--border-strong)' : 'var(--border-faint)'}`,
    borderBottom: tab === id ? '1px solid var(--bg-panel)' : '1px solid var(--border-faint)',
    background: tab === id ? 'var(--bg-panel)' : 'var(--bg-element)',
    color: tab === id ? ACCENT : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.14em',
    marginBottom: -1, position: 'relative',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border-strong)',
        borderRadius: 8, width: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh',
        boxShadow: '0 32px 96px rgba(0,0,0,0.9)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ borderTop: `3px solid ${ACCENT}` }} />
        <div style={{ padding: '16px 20px 13px', borderBottom: '1px solid var(--border-faint)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.35em', color: 'var(--text-muted)', marginBottom: 4 }}>VOID STATION</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.18em', color: 'var(--text-bright)', fontWeight: 700 }}>EXPORT / BOUNCE</div>
          </div>
          <button onClick={onClose} style={{ ...btn('var(--border-faint)', 'var(--text-muted)'), padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '16px 20px 0' }}>
            {/* Project info */}
            <div style={{ background: 'var(--bg-element)', border: '1px solid var(--border-faint)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-bright)', fontWeight: 700, letterSpacing: '0.06em' }}>{projectName ?? 'Untitled'}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>
                  {currentState?.bpm ?? 128} BPM · {(currentState?.tracks ?? []).length} tracks
                  {hasSteps && ' · drum patterns'}{hasClips && ' · MIDI clips'}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ACCENT, letterSpacing: '0.1em' }}>{duration}</div>
            </div>

            {/* Length */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 7 }}>LENGTH</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {BAR_OPTIONS.map(b => (
                  <button key={b} onClick={() => setBars(b)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 3, cursor: 'pointer',
                    border: `1px solid ${bars === b ? ACCENT : 'var(--border-default)'}`,
                    background: bars === b ? 'rgba(0,212,180,0.1)' : 'none',
                    color: bars === b ? ACCENT : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                    fontWeight: bars === b ? 700 : 400,
                  }}>{b} bars</button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 7 }}>FORMAT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {FORMAT_OPTIONS.map(f => (
                  <label key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 3, cursor: 'pointer',
                    border: `1px solid ${fmt === f.id ? ACCENT : 'var(--border-faint)'}`,
                    background: fmt === f.id ? 'rgba(0,212,180,0.06)' : 'var(--bg-element)',
                  }}>
                    <input type="radio" name="fmt" value={f.id} checked={fmt === f.id} onChange={() => setFmt(f.id)} style={{ accentColor: 'var(--accent-cyan)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: fmt === f.id ? ACCENT : 'var(--text-secondary)', letterSpacing: '0.08em' }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Tab bar (only shown if scenes available) */}
          {hasScenes && (
            <div style={{ paddingInline: '20px', display: 'flex', gap: 0, borderBottom: '1px solid var(--border-faint)' }}>
              <button onClick={() => setTab('full')} style={tabBtn('full', 'FULL MIX')}>FULL MIX</button>
              <button onClick={() => setTab('stems')} style={tabBtn('stems', 'STEMS BY SCENE')}>STEMS BY SCENE</button>
            </div>
          )}

          <div style={{ padding: '16px 20px' }}>
            {(!hasScenes || tab === 'full') && (
              <BounceState
                status={status} pct={pct} errMsg={errMsg} blob={blob}
                fmt={format} duration={duration}
                onBounce={handleBounce}
                onRebounce={() => { setStatus('idle'); setBlob(null); }}
                onDownload={handleDownload}
              />
            )}

            {hasScenes && tab === 'stems' && (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
                  EXPORT EACH SCENE AS A SEPARATE WAV — only the active tracks in each scene are rendered.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.from({ length: 8 }, (_, si) => {
                    const label = sceneLabels?.[si] ?? `Scene ${si + 1}`;
                    return (
                      <StemScene
                        key={si} si={si} label={label}
                        tracks={tracks} grid={sceneGrid}
                        state={currentState}
                        bars={bars} sampleRate={format.sr}
                        projectName={projectName}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
