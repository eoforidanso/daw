import { useState, useRef, useEffect } from 'react';

const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 22 22">
    <rect x="1" y="1" width="7" height="20" rx="1.5" fill="var(--accent-cyan)" opacity="0.95"/>
    <rect x="10" y="6" width="11" height="15" rx="1.5" fill="var(--accent-cyan)" opacity="0.6"/>
    <rect x="10" y="1" width="11" height="4" rx="1.5" fill="var(--accent-cyan)" opacity="0.25"/>
  </svg>
);

const Icon = ({ d, w = 11, h = 11 }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><path d={d} fill="currentColor"/></svg>
);

export default function TransportBar({ isPlaying, onPlayToggle, bpm, onBpmChange, onProjectOpen, onVersionOpen, onTutorialOpen, onExportOpen, onStemExport, projectName, lastSaved, autoRecording, onAutoRecordToggle }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [isMetronome, setIsMetronome] = useState(false);
  const [masterVol, setMasterVol] = useState(75);
  const [bar, setBar] = useState(1);
  const [savedFlash, setSavedFlash] = useState(false);
  const bpmDrag   = useRef({ on: false, startY: 0, startBpm: bpm });
  const tickRef   = useRef(null);
  const prevSaved = useRef(null);

  useEffect(() => {
    if (!lastSaved || lastSaved === prevSaved.current) return;
    prevSaved.current = lastSaved;
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 3000);
    return () => clearTimeout(t);
  }, [lastSaved]);

  useEffect(() => {
    if (isPlaying) {
      tickRef.current = setInterval(() => setBar(b => b + 1), (60000 / bpm) * 4);
    } else {
      clearInterval(tickRef.current);
      setBar(1);
    }
    return () => clearInterval(tickRef.current);
  }, [isPlaying, bpm]);

  const handleBpmDown = (e) => {
    e.preventDefault();
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    bpmDrag.current = { on: true, startY, startBpm: bpm };
    const move = (e) => {
      if (!bpmDrag.current.on) return;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const d = bpmDrag.current.startY - y;
      onBpmChange(Math.max(40, Math.min(240, bpmDrag.current.startBpm + Math.round(d * 0.4))));
    };
    const up = () => {
      bpmDrag.current.on = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  };

  const beats = Math.ceil(bar % 4) || 4;
  const bars = Math.ceil(bar / 4);

  return (
    <div className="transport-bar">
      <div className="transport-logo">
        <LogoMark />
        <div>
          <span className="transport-logo-name">VOID</span>
          <span className="transport-logo-sub">STATION v1.0</span>
        </div>
      </div>

      <div className="transport-divider"/>

      <div className="transport-controls">
        <button className="transport-btn" onClick={() => { if (isPlaying) onPlayToggle(); setBar(1); }} title="Stop">
          <Icon d="M1 1h9v9H1z" />
        </button>
        <button className={`transport-btn play-btn ${isPlaying ? 'active' : ''}`} onClick={onPlayToggle} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying
            ? <Icon d="M2 1h3v9H2zm4 0h3v9H6z" />
            : <Icon d="M2 1l8 4.5L2 10z" />}
        </button>
        <button className={`transport-btn record-btn ${isRecording ? 'active' : ''}`} onClick={() => setIsRecording(r => !r)} title="Record">
          <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="5.5" cy="5.5" r="4" fill="currentColor"/></svg>
        </button>
        <button
          className={`transport-btn ${autoRecording ? 'active' : ''}`}
          onClick={onAutoRecordToggle}
          title="Automation Record — records knob/fader moves as automation while playing"
          style={{ fontSize: 6, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: autoRecording ? '#ff6bcc' : undefined, border: autoRecording ? '1px solid #ff6bcc' : undefined, background: autoRecording ? 'rgba(255,107,204,0.15)' : undefined }}
        >A·REC</button>
        <button className={`transport-btn ${isLooping ? 'active' : ''}`} onClick={() => setIsLooping(l => !l)} title="Loop" style={{ fontSize: 14 }}>↺</button>
        <button className={`transport-btn ${isMetronome ? 'active' : ''}`} onClick={() => setIsMetronome(m => !m)} title="Metronome" style={{ fontSize: 12 }}>♩</button>
      </div>

      <div className="transport-divider"/>

      <div className="bpm-section">
        <div className="bpm-display">
          <span className="bpm-label">BPM</span>
          <span className="bpm-value" onMouseDown={handleBpmDown} title="Drag to change BPM">{bpm}</span>
        </div>
        <div className="bpm-controls">
          <button className="bpm-btn" onClick={() => onBpmChange(Math.min(240, bpm + 1))}>▲</button>
          <button className="bpm-btn" onClick={() => onBpmChange(Math.max(40, bpm - 1))}>▼</button>
        </div>
      </div>

      <div className="transport-divider"/>

      <div className="time-display">
        {String(bars).padStart(3, '0')}<span style={{ color: 'var(--text-muted)' }}> : </span>{beats}<span style={{ color: 'var(--text-muted)' }}> : 00</span>
      </div>

      <div className="transport-divider"/>

      <div style={{ display: 'flex', gap: 4 }}>
        {['4/4','3/4','6/8'].map(ts => (
          <button key={ts} className="time-sig" style={{ fontSize: 9 }}>{ts}</button>
        ))}
      </div>

      <div className="transport-right">
        {/* Auto-save indicator */}
        {lastSaved && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em',
            color: savedFlash ? 'var(--accent-cyan)' : 'var(--text-muted)',
            transition: 'color 0.6s',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
            {savedFlash ? 'AUTO-SAVED' : 'AUTO'}
          </div>
        )}

        {/* Stem export */}
        {onStemExport && (
          <button onClick={onStemExport} title="Export each track as a separate WAV stem"
            style={{ height: 26, borderRadius: 3, padding: '0 7px', border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em', transition: 'all 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8a06e'; e.currentTarget.style.color = '#c8a06e'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
            ↓ STEMS
          </button>
        )}

        {/* Export */}
        <button
          onClick={onExportOpen}
          title="Bounce to WAV"
          style={{
            height: 26, borderRadius: 3, padding: '0 9px',
            border: '1px solid var(--border-default)', background: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          ↓ EXPORT
        </button>

        {/* Version History */}
        <button
          onClick={onVersionOpen}
          title="Version History"
          style={{
            width: 26, height: 26, borderRadius: 3,
            border: '1px solid var(--border-default)', background: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          ⌛
        </button>

        {/* Project name + save/load */}
        <button
          onClick={onProjectOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            background: 'var(--bg-element)', border: '1px solid var(--border-default)',
            borderRadius: 3, cursor: 'pointer', transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>PROJECT</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-bright)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectName ?? 'Untitled'}
          </span>
        </button>

        <div className="master-vol-section">
          <span className="master-vol-label">MASTER</span>
          <input type="range" min="0" max="100" value={masterVol} onChange={e => setMasterVol(+e.target.value)}
            className="master-vol-slider"
            style={{ background: `linear-gradient(to right, var(--accent-cyan) ${masterVol}%, var(--bg-section) ${masterVol}%)` }}
          />
        </div>
        <div className="cpu-display">CPU 12%</div>

        <button
          onClick={onTutorialOpen}
          title="Open Tutorial"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '1px solid var(--border-default)', background: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            letterSpacing: 0, transition: 'all 0.1s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          ?
        </button>
      </div>
    </div>
  );
}
