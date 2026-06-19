import { useEffect, useRef, useState } from 'react';
import AutomationLane from './AutomationLane';
import { WarpOverlay } from './WarpMarkerEditor';
import { AUTO_PARAMS } from '../audio/AutomationEngine';

const PX_PER_BEAT  = 30;
const TRACK_H      = 60;
const TOTAL_BEATS  = 32;

function ClipAudioWaveform({ waveformData, width }) {
  const canRef = useRef(null);
  useEffect(() => {
    const canvas = canRef.current;
    if (!canvas || !waveformData) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let i = 0; i < waveformData.length; i++) {
      const x   = (i / waveformData.length) * W;
      const amp = waveformData[i] * H * 0.45;
      const mid = H / 2;
      ctx.moveTo(x, mid - amp); ctx.lineTo(x, mid + amp);
    }
    ctx.stroke();
  }, [waveformData, width]);
  return <canvas ref={canRef} width={width} height={36} style={{ position: 'absolute', top: 14, left: 0, width, height: 36 }} />;
}

function MidiMiniRoll({ notes, width, color }) {
  if (!notes?.length) return null;
  const maxB   = Math.max(...notes.map(n => n.startBeat + n.durationBeats)) || 1;
  const pitches = notes.map(n => n.pitch);
  const lo = Math.min(...pitches), hi = Math.max(...pitches);
  const range = Math.max(hi - lo, 4);
  return (
    <svg width={width} height={36} style={{ position: 'absolute', top: 14, left: 0 }}>
      {notes.map(n => {
        const x = (n.startBeat / maxB) * width;
        const w = Math.max(2, (n.durationBeats / maxB) * width - 1);
        const y = 34 - ((n.pitch - lo) / range) * 30;
        return <rect key={n.id} x={x} y={y} width={w} height={2.5} rx={1} fill={color} opacity={0.8} />;
      })}
    </svg>
  );
}

// ── Per-track automation panel header ────────────────────────────
function AutoHeader({ trackId, trackColor, autoLanes, onAddLane, onRemoveLane }) {
  const [open, setOpen] = useState(false);
  const params = Object.keys(AUTO_PARAMS);

  return (
    <div style={{ borderTop: '1px solid var(--border-faint)', background: 'var(--bg-panel)' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', padding: '4px 8px', background: 'none',
            border: 'none', display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em', color: trackColor }}>
            AUTO
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>+</span>
        </button>
        {open && (
          <div style={{
            position: 'absolute', left: 0, top: '100%', zIndex: 50, width: '100%',
            background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            {params.map(param => {
              const def     = AUTO_PARAMS[param];
              const exists  = autoLanes.some(l => l.trackId === trackId && l.param === param);
              return (
                <div
                  key={param}
                  onClick={() => { if (!exists) onAddLane(trackId, param); setOpen(false); }}
                  style={{
                    padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6,
                    cursor: exists ? 'default' : 'pointer', opacity: exists ? 0.4 : 1,
                    borderBottom: '1px solid var(--border-faint)',
                    fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                    color: def.color,
                  }}
                  onMouseEnter={e => { if (!exists) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  {def.label} {exists && '✓'}
                </div>
              );
            })}
          </div>
        )}
        {/* Existing lanes - close button */}
        {autoLanes.filter(l => l.trackId === trackId).map(lane => (
          <div key={lane.id} style={{ display: 'flex', alignItems: 'center', padding: '2px 8px', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: AUTO_PARAMS[lane.param]?.color ?? '#fff', flex: 1 }}>
              {AUTO_PARAMS[lane.param]?.label ?? lane.param}
            </span>
            <button
              onClick={() => onRemoveLane(lane.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackView({
  tracks, clips, onTrackUpdate, armedTracks, onArmTrack,
  currentBeat, isPlaying, isRecording, bpm,
  // automation
  autoLanes, onAddAutoLane, onRemoveAutoLane,
  onAddAutoPoint, onUpdateAutoPoint, onRemoveAutoPoint,
  // freeze
  frozenTracks, onFreezeTrack,
  // clip selection + warp
  selectedClipId, onClipSelect,
  warpMarkers, onAddWarpMarker, onUpdateWarpMarker, onDeleteWarpMarker,
}) {
  const rafRef   = useRef(null);
  const phRef    = useRef(null);
  const startRef = useRef(null);

  // Track which tracks show automation
  const [autoOpen, setAutoOpen] = useState({});

  useEffect(() => {
    if (!isPlaying) {
      if (phRef.current) phRef.current.style.left = '0px';
      return;
    }
    startRef.current = performance.now();
    const totalPx   = TOTAL_BEATS * PX_PER_BEAT;
    const secPerBeat = 60 / bpm;
    const animate = (now) => {
      const elapsed = (now - startRef.current) / 1000;
      const px = Math.min((elapsed / secPerBeat) * PX_PER_BEAT, totalPx);
      if (phRef.current) phRef.current.style.left = `${px}px`;
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, bpm]);

  const laneWidth = TOTAL_BEATS * PX_PER_BEAT;

  const toggleAuto = (trackId) => setAutoOpen(prev => ({ ...prev, [trackId]: !prev[trackId] }));

  return (
    <div className="track-view">
      {/* Track headers */}
      <div className="track-headers">
        <div className="track-ruler-spacer"><span>TRACKS</span></div>
        {tracks.map(t => {
          const isArmed  = armedTracks?.has(t.id) ?? false;
          const isFrozen = frozenTracks?.has(t.id) ?? false;
          const trackAuto = (autoLanes ?? []).filter(l => l.trackId === t.id);
          return (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={`track-header ${t.mute ? 'muted' : ''}`}>
                <div className="track-header-top">
                  <div className="track-color-bar" style={{ background: t.color }} />
                  <span className="track-name">{t.name}</span>
                  <span className="track-type-badge">{t.type.toUpperCase()}</span>
                </div>
                <div className="track-header-bottom">
                  <button className={`track-btn mute ${t.mute ? 'active' : ''}`}
                    onClick={() => onTrackUpdate(t.id, { mute: !t.mute })}>M</button>
                  <button className={`track-btn solo ${t.solo ? 'active' : ''}`}
                    onClick={() => onTrackUpdate(t.id, { solo: !t.solo })}>S</button>
                  <button
                    className="track-btn"
                    style={isArmed ? { background: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: '#fff', boxShadow: '0 0 6px rgba(255,68,102,0.5)' } : {}}
                    onClick={() => onArmTrack?.(t.id, !isArmed)}
                    title="Arm for recording"
                  >R</button>
                  <button
                    className="track-btn"
                    style={isFrozen ? { color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' } : {}}
                    onClick={() => onFreezeTrack?.(t.id)}
                    title={isFrozen ? 'Track frozen' : 'Freeze track'}
                  >❄</button>
                  <input type="range" min="0" max="100" value={t.volume}
                    onChange={e => onTrackUpdate(t.id, { volume: +e.target.value })}
                    className="track-vol-slider"
                    style={{ background: `linear-gradient(to right, ${t.color}88 ${t.volume}%, var(--bg-section) ${t.volume}%)` }}
                  />
                </div>
              </div>
              {/* Automation header (shows below track when toggled) */}
              {onAddAutoLane && (
                <AutoHeader
                  trackId={t.id}
                  trackColor={t.color}
                  autoLanes={autoLanes ?? []}
                  onAddLane={(tid, param) => { onAddAutoLane(tid, param); setAutoOpen(p => ({ ...p, [tid]: true })); }}
                  onRemoveLane={onRemoveAutoLane}
                />
              )}
              {/* Automation spacer for each lane */}
              {autoOpen[t.id] && trackAuto.map(lane => (
                <div key={lane.id} style={{ height: 52, background: 'var(--bg-panel)' }} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Arrangement lanes */}
      <div className="track-lanes">
        <div className="lanes-content" style={{ width: laneWidth }}>
          {/* Ruler */}
          <div className="lane-ruler">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="ruler-mark" style={{ width: PX_PER_BEAT * 4 }}>
                <span>Bar {i + 1}</span>
              </div>
            ))}
          </div>

          {/* Track lanes */}
          {tracks.map(t => {
            const trackClips  = (clips ?? []).filter(c => c.trackId === t.id);
            const trackLanes  = (autoLanes ?? []).filter(l => l.trackId === t.id);
            const showAuto    = autoOpen[t.id] && trackLanes.length > 0;
            return (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Clip lane */}
                <div className={`track-lane ${t.mute ? 'muted' : ''}`} style={{ position: 'relative', width: laneWidth }}>
                  <div className="track-lane-grid" />
                  {trackClips.map(clip => {
                    const left  = clip.startBeat * PX_PER_BEAT;
                    const width = Math.max(4, clip.durationBeats * PX_PER_BEAT - 2);
                    const isSelected = selectedClipId === clip.id;
                    const clipWarp   = warpMarkers?.[clip.id] ?? [];
                    return (
                      <div
                        key={clip.id}
                        className="clip"
                        style={{ left, width, outline: isSelected ? `2px solid var(--accent-cyan)` : 'none', outlineOffset: -1 }}
                        onClick={e => { e.stopPropagation(); onClipSelect?.(clip.id); }}
                      >
                        <div className="clip-body" style={{ background: clip.color + (clip.frozen ? '88' : 'cc') }} />
                        <div className="clip-header">
                          <span className="clip-label">{clip.name}</span>
                          {clip.frozen && (
                            <span style={{ marginLeft: 4, fontSize: 7, color: 'var(--accent-blue)' }}>❄</span>
                          )}
                          {clipWarp.length > 0 && (
                            <span style={{ marginLeft: 4, fontSize: 7, color: 'var(--accent-orange)' }}>◈{clipWarp.length}</span>
                          )}
                        </div>
                        {clip.type === 'audio' && clip.waveformData && (
                          <ClipAudioWaveform waveformData={clip.waveformData} width={width} />
                        )}
                        {clip.type === 'midi' && (
                          <MidiMiniRoll notes={clip.notes} width={width} color={clip.color} />
                        )}
                        {/* Warp marker overlay for selected audio clips */}
                        {isSelected && onAddWarpMarker && (
                          <WarpOverlay
                            clip={clip}
                            markers={clipWarp}
                            onAdd={onAddWarpMarker}
                            onUpdate={onUpdateWarpMarker}
                            onDelete={onDeleteWarpMarker}
                            bpm={bpm}
                          />
                        )}
                      </div>
                    );
                  })}
                  {/* Playhead */}
                  {isPlaying && <div ref={phRef} className="playhead" />}
                  {/* Recording flash */}
                  {isRecording && armedTracks?.has(t.id) && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(255,68,102,0.08)',
                      borderBottom: '1px solid rgba(255,68,102,0.4)',
                      pointerEvents: 'none', animation: 'blink 1s step-start infinite',
                    }} />
                  )}
                </div>

                {/* Automation lane header spacer + lanes */}
                {onAddAutoLane && (
                  <div style={{ height: 18, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-faint)' }} />
                )}
                {showAuto && trackLanes.map(lane => (
                  <AutomationLane
                    key={lane.id}
                    lane={lane}
                    onAdd={onAddAutoPoint}
                    onUpdate={onUpdateAutoPoint}
                    onRemove={onRemoveAutoPoint}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
