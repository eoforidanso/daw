import { useState, useEffect, useRef, useCallback } from 'react';
import { SampleStore } from '../audio/SampleStore.js';
import { SceneAutomation, AUTOMATABLE_PARAMS } from '../audio/SceneAutomation.js';

const NUM_SCENES = 8;
const SCENE_LABELS_DEFAULT = Array.from({ length: NUM_SCENES }, (_, i) => `SCENE ${i + 1}`);
const TRACK_PARAMS = ['volume', 'pan'];

function makeGrid(tracks) {
  return Array.from({ length: NUM_SCENES }, () => (tracks ?? []).map(() => true));
}

function miniPattern(steps, trackName) {
  const key = Object.keys(steps ?? {}).find(k => k.toUpperCase() === trackName.toUpperCase());
  return key ? (steps[key] ?? []) : [];
}

// ── Cell ──────────────────────────────────────────────────────────────────────

function Cell({ active, color, isLaunching, isCurrentScene, pattern, onClick }) {
  const [hov, setHov] = useState(false);
  const hasPattern = pattern.some(Boolean);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 72, height: 54, borderRadius: 4, cursor: 'pointer',
        border: `1px solid ${active ? color + '80' : 'var(--border-faint)'}`,
        background: active ? isCurrentScene ? color + '28' : color + '12' : 'var(--bg-element)',
        position: 'relative', overflow: 'hidden', transition: 'all 0.12s',
        outline: isCurrentScene && active ? `2px solid ${color}` : 'none',
        outlineOffset: -2, transform: hov ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {hasPattern && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 1, padding: '4px 4px 6px' }}>
          {pattern.slice(0, 16).map((on, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 1,
              height: on ? (isCurrentScene && active ? '70%' : '50%') : '15%',
              background: on ? (active ? (isCurrentScene ? color : color + '80') : 'var(--border-strong)') : 'var(--border-faint)',
              transition: 'height 0.15s',
            }} />
          ))}
        </div>
      )}
      {active && !hasPattern && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isCurrentScene ? color : color + '60',
            boxShadow: isCurrentScene ? `0 0 8px ${color}` : 'none',
            animation: isCurrentScene ? 'pulse-cell 1.2s ease-in-out infinite' : 'none',
          }} />
        </div>
      )}
      {!active && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 1, background: 'var(--border-strong)', borderRadius: 1 }} />
        </div>
      )}
      {isLaunching && (
        <div style={{ position: 'absolute', inset: 0, background: color + '20', animation: 'launch-flash 0.4s ease-out forwards' }} />
      )}
    </div>
  );
}

// ── Scene launch button ───────────────────────────────────────────────────────

function SceneLaunch({ label, isCurrent, onLaunch, onRename, idx, autoCount, onAutoClick }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);

  const commit = () => { onRename(idx, val.trim() || label); setEditing(false); };

  if (editing) return (
    <input
      autoFocus value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      style={{
        width: 72, padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: 7,
        background: 'var(--bg-element)', border: '1px solid var(--accent-cyan)',
        color: 'var(--text-bright)', borderRadius: 3, outline: 'none', textAlign: 'center',
      }}
    />
  );

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={onLaunch}
        onDoubleClick={() => setEditing(true)}
        title="Double-click to rename"
        style={{
          width: 72, padding: '6px 4px', borderRadius: 3, cursor: 'pointer',
          border: `1px solid ${isCurrent ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
          background: isCurrent ? 'var(--accent-cyan)' : 'var(--bg-element)',
          color: isCurrent ? '#000' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.08em',
          fontWeight: isCurrent ? 700 : 400, transition: 'all 0.12s',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {isCurrent ? '▶ ' : ''}{label}
      </button>
      {/* AUTO badge */}
      <div
        onClick={e => { e.stopPropagation(); onAutoClick(idx); }}
        title={`Scene ${idx + 1} automation (${autoCount} action${autoCount !== 1 ? 's' : ''})`}
        style={{
          position: 'absolute', top: -5, right: -5,
          width: 14, height: 14, borderRadius: '50%', cursor: 'pointer',
          background: autoCount > 0 ? 'var(--accent-purple)' : 'var(--border-faint)',
          border: `1px solid ${autoCount > 0 ? 'var(--accent-purple)' : 'var(--border-strong)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 5, color: autoCount > 0 ? '#fff' : 'var(--text-muted)',
          letterSpacing: 0, fontWeight: 700, transition: 'all 0.15s',
        }}
      >
        {autoCount > 0 ? autoCount : '◈'}
      </div>
    </div>
  );
}

// ── Automation editor ─────────────────────────────────────────────────────────

function AutoEditor({ si, tracks, onClose }) {
  const [actions, setActions]   = useState(() => SceneAutomation.getScene(si));
  const [newParam, setNewParam] = useState(AUTOMATABLE_PARAMS[0].param);
  const [newValue, setNewValue] = useState(0);
  const [newTrackId, setNewTrackId] = useState('global');

  const isTrackParam = TRACK_PARAMS.includes(newParam);
  const paramDef = AUTOMATABLE_PARAMS.find(p => p.param === newParam);
  const refresh  = () => setActions(SceneAutomation.getScene(si));

  const handleAdd = () => {
    SceneAutomation.addAction(si, {
      trackId: isTrackParam && newTrackId !== 'global' ? newTrackId : null,
      param: newParam,
      value: Number(newValue),
      label: `${paramDef.label}${isTrackParam && newTrackId !== 'global' ? ` (${tracks.find(t => t.id === newTrackId)?.name ?? newTrackId})` : ''} → ${newValue}${paramDef.unit}`,
    });
    refresh();
  };

  const row = { fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-secondary)', letterSpacing: '0.06em' };
  const inp = { fontFamily: 'var(--font-mono)', fontSize: 7, background: 'var(--bg-section)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 2, padding: '3px 7px', outline: 'none' };
  const btnS = (active) => ({
    padding: '3px 9px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${active ? 'var(--accent-purple)' : 'var(--border-default)'}`,
    background: active ? 'rgba(155,114,255,0.12)' : 'none', color: active ? 'var(--accent-purple)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.1em',
  });

  return (
    <div style={{ background: 'var(--bg-element)', border: '1px solid var(--accent-purple)', borderRadius: 4, padding: '12px 16px', margin: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--accent-purple)' }}>
          ◈ SCENE {si + 1} AUTOMATION
        </span>
        <button onClick={onClose} style={{ ...btnS(false), padding: '2px 7px' }}>CLOSE ✕</button>
      </div>

      {/* Action list */}
      {actions.length === 0 ? (
        <div style={{ ...row, opacity: 0.5, marginBottom: 10 }}>No actions — fires on scene launch</div>
      ) : (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {actions.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', background: 'var(--bg-void)', borderRadius: 3, border: '1px solid var(--border-faint)' }}>
              <div style={{ ...row, flex: 1 }}>{a.label ?? `${a.param} → ${a.value}`}</div>
              <button
                onClick={() => { SceneAutomation.removeAction(si, a.id); refresh(); }}
                style={{ ...btnS(false), padding: '2px 6px', fontSize: 9 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add action form */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
        <div>
          <div style={{ ...row, opacity: 0.6, fontSize: 6, marginBottom: 3 }}>PARAMETER</div>
          <select value={newParam} onChange={e => { setNewParam(e.target.value); setNewValue(AUTOMATABLE_PARAMS.find(p => p.param === e.target.value)?.min ?? 0); }}
            style={{ ...inp }}>
            {AUTOMATABLE_PARAMS.map(p => <option key={p.param} value={p.param}>{p.label} {p.unit ? `(${p.unit})` : ''}</option>)}
          </select>
        </div>
        {isTrackParam && (
          <div>
            <div style={{ ...row, opacity: 0.6, fontSize: 6, marginBottom: 3 }}>TRACK</div>
            <select value={newTrackId} onChange={e => setNewTrackId(e.target.value)} style={{ ...inp }}>
              <option value="global">All tracks</option>
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <div style={{ ...row, opacity: 0.6, fontSize: 6, marginBottom: 3 }}>
            VALUE {paramDef ? `(${paramDef.min}–${paramDef.max})` : ''}
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input
              type="range" min={paramDef?.min ?? 0} max={paramDef?.max ?? 100} step={paramDef?.step ?? 1} value={newValue}
              onChange={e => setNewValue(e.target.value)}
              style={{ width: 90 }}
            />
            <span style={{ ...row, minWidth: 30, textAlign: 'right' }}>{newValue}{paramDef?.unit}</span>
          </div>
        </div>
        <button onClick={handleAdd} style={{ ...btnS(true), padding: '5px 12px', alignSelf: 'flex-end', marginBottom: 1 }}>+ ADD</button>
      </div>
    </div>
  );
}

// ── Capture log ───────────────────────────────────────────────────────────────

function CapturePanel({ log, onStop }) {
  return (
    <div style={{ padding: '8px 14px', background: 'rgba(255,180,0,0.04)', borderTop: '1px solid rgba(255,180,0,0.2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-yellow)', boxShadow: '0 0 6px var(--accent-yellow)', animation: 'pulse-cell 0.8s ease-in-out infinite' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-yellow)', letterSpacing: '0.15em' }}>CAPTURING ARRANGEMENT</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        {log.length} event{log.length !== 1 ? 's' : ''} captured
        {log.length > 0 && ` — last: ${log[log.length - 1].label}`}
      </div>
      <button
        onClick={onStop}
        style={{
          padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
          border: '1px solid var(--accent-yellow)', background: 'rgba(255,180,0,0.1)', color: 'var(--accent-yellow)',
          fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em', marginLeft: 'auto',
        }}
      >
        ■ STOP CAPTURE
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PerformanceMode({
  tracks, steps, bpm, isPlaying, onTrackUpdate, currentBeat,
  onAutomate, onCaptureArrangement, onRecordComplete, onGridChange,
}) {
  const [grid,         setGrid]         = useState(() => makeGrid(tracks));
  const [sceneLabels,  setSceneLabels]  = useState(SCENE_LABELS_DEFAULT.slice());
  const [currentScene, setCurrentScene] = useState(null);
  const [launching,    setLaunching]    = useState(null);
  const [quantized,    setQuantized]    = useState(true);
  const [autoScene,    setAutoScene]    = useState(null); // editing automation for this scene index
  const [captureMode,  setCaptureMode]  = useState(false);
  const [captureLog,   setCaptureLog]   = useState([]);
  const [recArm,       setRecArm]       = useState(false);
  const [recording,    setRecording]    = useState(null); // { trackId, trackIdx, startTime }
  const [recStatus,    setRecStatus]    = useState('idle'); // idle | recording | saving

  const queuedRef      = useRef(null);
  const prevBeat       = useRef(null);
  const gridRef        = useRef(grid);
  const mediaRecRef    = useRef(null);
  const chunksRef      = useRef([]);
  const recTimerRef    = useRef(null);

  // Keep grid ref current
  useEffect(() => { gridRef.current = grid; }, [grid]);

  // Notify parent of grid/label changes (for ExportModal stems)
  useEffect(() => { onGridChange?.(grid, sceneLabels); }, [grid, sceneLabels]);

  // Rebuild grid when track count changes
  useEffect(() => {
    setGrid(prev => Array.from({ length: NUM_SCENES }, (_, si) =>
      (tracks ?? []).map((_, ti) => prev[si]?.[ti] ?? true)
    ));
  }, [tracks.length]);

  // Quantized launch
  useEffect(() => {
    if (!isPlaying || !quantized || queuedRef.current === null) return;
    const beat = Math.floor(currentBeat);
    if (beat !== prevBeat.current && beat % 4 === 0) {
      prevBeat.current = beat;
      const si = queuedRef.current;
      queuedRef.current = null;
      fireScene(si);
    }
  }, [currentBeat, isPlaying, quantized]);

  const fireScene = useCallback((si) => {
    const g = gridRef.current;
    setLaunching(si);
    setCurrentScene(si);

    const sceneActive = g[si] ?? [];
    tracks.forEach((t, ti) => {
      const shouldBeActive = sceneActive[ti] ?? true;
      if (t.mute !== !shouldBeActive) onTrackUpdate?.(t.id, { mute: !shouldBeActive });
    });
    setTimeout(() => setLaunching(null), 400);

    // Apply scene automation
    const actions = SceneAutomation.getScene(si);
    if (actions.length > 0) onAutomate?.(actions);

    // Capture arrangement
    if (captureMode) {
      setCaptureLog(prev => [...prev, { sceneIdx: si, beat: Math.floor(currentBeat), label: sceneLabels[si] }]);
    }
  }, [tracks, onTrackUpdate, onAutomate, captureMode, currentBeat, sceneLabels]);

  const handleLaunchScene = useCallback((si) => {
    if (quantized && isPlaying) queuedRef.current = si;
    else fireScene(si);
  }, [quantized, isPlaying, fireScene]);

  const toggleCell = (si, ti) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[si][ti] = !next[si][ti];
      return next;
    });
  };

  const handleRename = (si, label) => setSceneLabels(prev => prev.map((l, i) => i === si ? label : l));

  const stopAll = () => {
    tracks.forEach(t => { if (t.mute) onTrackUpdate?.(t.id, { mute: false }); });
    setCurrentScene(null);
    queuedRef.current = null;
  };

  const handleStopCapture = () => {
    setCaptureMode(false);
    onCaptureArrangement?.(captureLog, gridRef.current);
    setCaptureLog([]);
  };

  // ── Clip recording ──────────────────────────────────────────────────────────

  const startRecording = useCallback(async (track, trackIdx) => {
    if (recStatus !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!chunksRef.current.length) { setRecStatus('idle'); setRecording(null); return; }
        setRecStatus('saving');
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const ext  = mr.mimeType?.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `rec_${track.name}_${Date.now()}.${ext}`, { type: blob.type });
        try {
          const sample = await SampleStore.upload(file);
          onRecordComplete?.(sample, track.id);
        } catch {}
        setRecStatus('idle');
        setRecording(null);
      };
      mediaRecRef.current = mr;
      mr.start();
      setRecording({ trackId: track.id, trackIdx, startTime: Date.now() });
      setRecStatus('recording');

      // Auto-stop after 8 beats
      const dur = (8 * (60 / bpm)) * 1000;
      recTimerRef.current = setTimeout(() => stopRecording(), dur);
    } catch {
      setRecStatus('idle');
    }
  }, [recStatus, bpm, onRecordComplete]);

  const stopRecording = useCallback(() => {
    clearTimeout(recTimerRef.current);
    mediaRecRef.current?.stop();
  }, []);

  useEffect(() => () => { clearTimeout(recTimerRef.current); mediaRecRef.current?.stop(); }, []);

  const queued = queuedRef.current;
  const autoCounts = Array.from({ length: NUM_SCENES }, (_, si) => SceneAutomation.getScene(si).length);

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-void)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes pulse-cell { 0%,100%{opacity:0.7;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes launch-flash { 0%{opacity:1} 100%{opacity:0} }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--text-muted)' }}>PERFORMANCE</div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Quantize toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <div onClick={() => setQuantized(q => !q)} style={{
              width: 28, height: 14, borderRadius: 7, position: 'relative', cursor: 'pointer',
              background: quantized ? 'var(--accent-cyan)' : 'var(--bg-element)',
              border: `1px solid ${quantized ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
              transition: 'all 0.15s', flexShrink: 0,
            }}>
              <div style={{ position: 'absolute', top: 2, left: quantized ? 14 : 2, width: 8, height: 8, borderRadius: '50%', background: quantized ? '#000' : 'var(--border-strong)', transition: 'left 0.15s' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>QUANTIZE</span>
          </label>

          {/* REC ARM toggle */}
          <button
            onClick={() => { setRecArm(a => !a); if (recStatus === 'recording') stopRecording(); }}
            style={{
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em',
              border: `1px solid ${recArm ? 'var(--accent-red)' : 'var(--border-default)'}`,
              background: recArm ? 'rgba(255,68,102,0.1)' : 'none',
              color: recArm ? 'var(--accent-red)' : 'var(--text-muted)',
            }}
          >
            ⬤ {recStatus === 'recording' ? 'RECORDING…' : recStatus === 'saving' ? 'SAVING…' : 'REC ARM'}
          </button>

          {/* Capture toggle */}
          <button
            onClick={() => { if (captureMode) { handleStopCapture(); } else { setCaptureLog([]); setCaptureMode(true); } }}
            style={{
              padding: '4px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em',
              border: `1px solid ${captureMode ? 'var(--accent-yellow)' : 'var(--border-default)'}`,
              background: captureMode ? 'rgba(255,180,0,0.1)' : 'none',
              color: captureMode ? 'var(--accent-yellow)' : 'var(--text-muted)',
            }}
          >
            {captureMode ? `■ CAPTURE (${captureLog.length})` : '◉ CAPTURE'}
          </button>

          {queued !== null && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-yellow)', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-yellow)', animation: 'pulse-cell 0.8s infinite' }} />
              QUEUED: {sceneLabels[queued]}
            </div>
          )}

          <button
            onClick={stopAll}
            style={{
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
              border: '1px solid var(--accent-red)', background: 'rgba(255,68,102,0.1)', color: 'var(--accent-red)',
              fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em',
            }}
          >
            ■ STOP ALL
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {tracks.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.14em' }}>
            No tracks in the project.<br />
            <span style={{ fontSize: 7, opacity: 0.6, display: 'block', marginTop: 6 }}>Add tracks in the ARRANGE view first.</span>
          </div>
        ) : (
          <>
            <table style={{ borderCollapse: 'separate', borderSpacing: '6px 6px' }}>
              <thead>
                <tr>
                  <th style={{ width: 120, paddingRight: 8 }} />
                  {Array.from({ length: NUM_SCENES }, (_, si) => (
                    <th key={si} style={{ padding: '0 0 10px' }}>
                      <SceneLaunch
                        label={sceneLabels[si]}
                        isCurrent={currentScene === si}
                        onLaunch={() => handleLaunchScene(si)}
                        onRename={handleRename}
                        idx={si}
                        autoCount={autoCounts[si]}
                        onAutoClick={(idx) => setAutoScene(a => a === idx ? null : idx)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, ti) => {
                  const pat = miniPattern(steps, track.name);
                  const isRec = recording?.trackId === track.id;
                  return (
                    <tr key={track.id}>
                      <td style={{ paddingRight: 8, verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 3, height: 28, borderRadius: 2, background: track.color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 85 }}>
                              {track.name}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                              {track.type ?? 'audio'}
                            </div>
                          </div>
                          {/* REC button */}
                          {recArm && (
                            <button
                              onClick={() => isRec ? stopRecording() : startRecording(track, ti)}
                              title={isRec ? 'Stop recording' : 'Record to samples'}
                              style={{
                                width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                                border: `1px solid ${isRec ? 'var(--accent-red)' : 'var(--border-default)'}`,
                                background: isRec ? 'var(--accent-red)' : 'rgba(255,68,102,0.1)',
                                color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: isRec ? 8 : 10, padding: 0, animation: isRec ? 'pulse-cell 0.7s ease-in-out infinite' : 'none',
                              }}
                            >
                              {isRec ? '■' : '⬤'}
                            </button>
                          )}
                        </div>
                      </td>
                      {Array.from({ length: NUM_SCENES }, (_, si) => (
                        <td key={si} style={{ verticalAlign: 'middle' }}>
                          <Cell
                            active={grid[si]?.[ti] ?? true}
                            color={track.color}
                            isLaunching={launching === si}
                            isCurrentScene={currentScene === si}
                            pattern={pat}
                            onClick={() => toggleCell(si, ti)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Automation editor (shown below grid for selected scene) */}
            {autoScene !== null && (
              <AutoEditor si={autoScene} tracks={tracks} onClose={() => setAutoScene(null)} />
            )}
          </>
        )}
      </div>

      {/* Capture panel */}
      {captureMode && (
        <CapturePanel log={captureLog} onStop={handleStopCapture} />
      )}

      {/* Legend */}
      <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border-faint)', display: 'flex', gap: 16, flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          ['Colored cell', 'Active in scene'],
          ['Dash cell', 'Muted in scene'],
          ['Purple ◈ badge', 'Scene automation (click to edit)'],
          ['Double-click label', 'Rename scene'],
          ['⬤ REC ARM', 'Record mic into SAMPLES tab'],
          ['◉ CAPTURE', 'Record scene arrangement'],
        ].map(([k, v]) => (
          <div key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{k}</span> — {v}
          </div>
        ))}
      </div>
    </div>
  );
}
