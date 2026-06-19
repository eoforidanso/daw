// Warp marker overlay on audio clips in the arrangement view.
// Each marker is a draggable triangle anchoring audioTime → beatTime.

import { useRef, useCallback } from 'react';
import { mkWarpId, WarpEngine } from '../audio/WarpEngine.js';

const PX_PER_BEAT = 30;
const CLIP_H      = 50;

// Format seconds nicely
function fmtSec(s) {
  const m = Math.floor(s / 60), sec = (s % 60).toFixed(2);
  return `${m}:${String(sec).padStart(5, '0')}`;
}

// Single draggable warp marker
function WarpMarkerPin({ marker, clipDurationBeats, audioBuffer, onUpdate, onDelete }) {
  const totalBeats = clipDurationBeats;
  const left = (marker.beatTime / totalBeats) * 100;
  const color = 'var(--accent-orange)';

  const divRef = useRef(null);
  const startDrag = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const parentRect = divRef.current?.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    const onMove = (ev) => {
      const x       = ev.clientX - parentRect.left;
      const pct     = Math.max(0, Math.min(1, x / parentRect.width));
      const newBeat = pct * totalBeats;
      onUpdate(marker.id, { beatTime: newBeat });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [marker.id, totalBeats, onUpdate]);

  return (
    <div
      ref={divRef}
      title={`Audio: ${fmtSec(marker.audioTime)}\nBeat: ${marker.beatTime.toFixed(2)}\nRight-click to delete`}
      style={{
        position: 'absolute',
        left: `calc(${left}% - 6px)`,
        top: 0,
        width: 12,
        height: CLIP_H,
        cursor: 'ew-resize',
        zIndex: 30,
      }}
      onMouseDown={startDrag}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onDelete(marker.id); }}
    >
      {/* Vertical line */}
      <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 2, background: color, opacity: 0.85 }} />
      {/* Triangle head at top */}
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `8px solid ${color}`,
      }} />
      {/* Beat label */}
      <div style={{
        position: 'absolute', left: 8, top: 2,
        fontFamily: 'var(--font-mono)', fontSize: 6,
        color, letterSpacing: '0.05em', whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {marker.beatTime.toFixed(1)}
      </div>
    </div>
  );
}

// Full warp marker overlay — rendered inside a clip element
export function WarpOverlay({ clip, markers = [], onAdd, onUpdate, onDelete, bpm }) {
  if (clip.type !== 'audio' || !clip.audioBuffer) return null;

  const handleClick = (e) => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const pct   = (e.clientX - rect.left) / rect.width;
    const beat  = pct * clip.durationBeats;
    const audio = (beat / bpm) * 60; // approximate audio time
    onAdd(clip.id, { id: mkWarpId(), beatTime: beat, audioTime: audio });
  };

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'crosshair' }}
      onClick={handleClick}
    >
      {markers.map(m => (
        <WarpMarkerPin
          key={m.id}
          marker={m}
          clipDurationBeats={clip.durationBeats}
          audioBuffer={clip.audioBuffer}
          onUpdate={(id, upd) => onUpdate(clip.id, id, upd)}
          onDelete={(id) => onDelete(clip.id, id)}
        />
      ))}
    </div>
  );
}

// Warp controls panel (shown in bottom panel when warp mode is active)
export function WarpPanel({ selectedClip, markers = [], onAdd, onUpdate, onDelete, onAutoDetect, bpm }) {
  if (!selectedClip) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-void)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.18em' }}>
          SELECT AN AUDIO CLIP TO EDIT WARP MARKERS
        </span>
      </div>
    );
  }

  const clipMarkers = markers;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em', color: 'var(--accent-orange)' }}>WARP</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginLeft: 8, letterSpacing: '0.12em' }}>
            {selectedClip.name} — {clipMarkers.length} MARKER{clipMarkers.length !== 1 ? 'S' : ''}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={() => onAutoDetect(selectedClip.id, bpm)}
            style={{
              padding: '4px 12px', borderRadius: 3,
              border: '1px solid var(--border-strong)', background: 'var(--bg-element)',
              color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 8,
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            AUTO-DETECT TRANSIENTS
          </button>
          <button
            onClick={() => { const snap = WarpEngine.snapToGrid(clipMarkers, 0.25); snap.forEach(m => onUpdate(selectedClip.id, m.id, { beatTime: m.beatTime })); }}
            style={{
              padding: '4px 12px', borderRadius: 3,
              border: '1px solid var(--border-strong)', background: 'var(--bg-element)',
              color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 8,
              letterSpacing: '0.15em', cursor: 'pointer',
            }}
          >
            SNAP TO GRID
          </button>
        </div>
      </div>

      {/* Marker list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
        {clipMarkers.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em', padding: '12px 0' }}>
            Click on an audio clip in the arrangement to add warp markers.
            Drag markers to realign audio to the beat grid.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[...clipMarkers].sort((a, b) => a.beatTime - b.beatTime).map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px',
                background: 'var(--bg-element)', border: '1px solid var(--border-faint)', borderRadius: 3,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', width: 20 }}>
                  #{i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-orange)' }}>
                    Beat {m.beatTime.toFixed(3)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>
                    Audio {fmtSec(m.audioTime)}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>
                  {i > 0 ? `Δ${(m.beatTime - clipMarkers[i - 1]?.beatTime).toFixed(2)}b` : 'START'}
                </div>
                <button
                  onClick={() => onDelete(selectedClip.id, m.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
