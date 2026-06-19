import { useState, useRef, useCallback, useEffect } from 'react';

// ── Constants ─────────────────────────────────────────────────────
const PX_PER_BEAT = 80;
const NOTE_H      = 12;       // px per semitone row
const MIN_PITCH   = 24;       // C2
const MAX_PITCH   = 96;       // C7
const TOTAL_NOTES = MAX_PITCH - MIN_PITCH + 1;
const PIANO_W     = 56;
const DEFAULT_DUR = 0.5;      // beats
const RESIZE_ZONE = 8;        // px on the right edge that starts resize
const TOTAL_BEATS = 32;

const NOTE_NAMES  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const BLACK_SET   = new Set([1,3,6,8,10]);

function pitchToY(pitch) { return (MAX_PITCH - pitch) * NOTE_H; }
function yToPitch(y) { return MAX_PITCH - Math.floor(y / NOTE_H); }
function beatToX(beat) { return beat * PX_PER_BEAT; }
function xToBeat(x) { return Math.max(0, x / PX_PER_BEAT); }
function snapBeat(b, grid = 0.25) { return Math.round(b / grid) * grid; }
function midiFreq(pitch) { return 440 * Math.pow(2, (pitch - 69) / 12); }
function isBlack(pitch) { return BLACK_SET.has(pitch % 12); }

function VelocityBar({ note, onChange }) {
  const h = Math.round((note.velocity / 127) * 48);
  return (
    <div
      title={`Velocity: ${note.velocity}`}
      style={{
        position: 'absolute',
        left: beatToX(note.startBeat),
        bottom: 0,
        width: Math.max(4, beatToX(note.durationBeats) - 1),
        height: h,
        background: 'var(--accent-cyan)',
        borderRadius: '1px 1px 0 0',
        opacity: 0.7,
        cursor: 'ns-resize',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        const startY = e.clientY, startVel = note.velocity;
        const onMove = (ev) => {
          const delta = startY - ev.clientY;
          onChange(Math.max(1, Math.min(127, Math.round(startVel + delta * 0.8))));
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }}
    />
  );
}

export default function PianoRoll({ notes = [], onAddNote, onRemoveNote, onUpdateNote, onNotePlay }) {
  const [playingPitch, setPlayingPitch] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverBeat, setHoverBeat] = useState(null);
  const gridRef = useRef(null);
  const dragRef = useRef({ type: 'none' });

  // ── Hit testing ──────────────────────────────────────────────────
  const noteAt = useCallback((pitch, beat) =>
    notes.find(n =>
      n.pitch === pitch &&
      beat >= n.startBeat &&
      beat < n.startBeat + n.durationBeats
    ), [notes]);

  // ── Coordinate helpers ───────────────────────────────────────────
  const eventToGrid = (e) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = e.clientX - rect.left + (gridRef.current?.scrollLeft ?? 0);
    const y = e.clientY - rect.top  + (gridRef.current?.scrollTop  ?? 0) - NOTE_H; // ruler offset
    const pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, yToPitch(y)));
    const beat  = xToBeat(x);
    return { x, y, pitch, beat };
  };

  // ── Mouse handlers on note elements ─────────────────────────────
  const handleNoteMouseDown = (e, note) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(note.id);
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const isResizing = localX > rect.width - RESIZE_ZONE;
    dragRef.current = {
      type: isResizing ? 'resize' : 'move',
      noteId: note.id,
      startX: e.clientX,
      startBeat: note.startBeat,
      startPitch: note.pitch,
      startDur: note.durationBeats,
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (d.type === 'none') return;
      const dx = ev.clientX - d.startX;
      const dBeats = dx / PX_PER_BEAT;
      if (d.type === 'move') {
        // Vertical: compute delta pitch from mouse Y (use grid scroll)
        const gridEl = gridRef.current;
        const gy = ev.clientY - (gridEl?.getBoundingClientRect().top ?? 0) + (gridEl?.scrollTop ?? 0) - NOTE_H;
        const newPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, yToPitch(gy)));
        onUpdateNote(d.noteId, {
          startBeat: Math.max(0, snapBeat(d.startBeat + dBeats)),
          pitch: newPitch,
        });
      } else if (d.type === 'resize') {
        const newDur = Math.max(0.25, snapBeat(d.startDur + dBeats));
        onUpdateNote(d.noteId, { durationBeats: newDur });
      }
    };
    const onUp = () => {
      dragRef.current = { type: 'none' };
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Click on empty grid → add note ──────────────────────────────
  const handleGridMouseDown = (e) => {
    if (e.button === 2) return;
    const g = eventToGrid(e);
    if (!g) return;
    const snappedBeat  = snapBeat(g.beat);
    const snappedPitch = g.pitch;
    const existing = noteAt(snappedPitch, snappedBeat);
    if (!existing) {
      onAddNote({ pitch: snappedPitch, startBeat: snappedBeat, durationBeats: DEFAULT_DUR, velocity: 100 });
    }
    setSelectedId(null);
  };

  const handleNoteRightClick = (e, note) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveNote(note.id);
    if (selectedId === note.id) setSelectedId(null);
  };

  // ── Piano keyboard click ─────────────────────────────────────────
  const handleKeyClick = (pitch) => {
    setPlayingPitch(pitch);
    onNotePlay?.(midiFreq(pitch), 0.5);
    setTimeout(() => setPlayingPitch(null), 500);
  };

  // ── Grid hover for visual feedback ──────────────────────────────
  const handleGridMouseMove = (e) => {
    const g = eventToGrid(e);
    if (g) setHoverBeat(snapBeat(g.beat));
  };

  // Build rows from MAX_PITCH down to MIN_PITCH
  const rows = [];
  for (let p = MAX_PITCH; p >= MIN_PITCH; p--) rows.push(p);

  const gridWidth = TOTAL_BEATS * PX_PER_BEAT;

  return (
    <div className="piano-roll">
      {/* ── Piano keyboard ── */}
      <div className="piano-keys">
        <div style={{ height: NOTE_H + 4, background: 'var(--bg-void)', borderBottom: '1px solid var(--border-default)' }} />
        {rows.map(pitch => {
          const black = isBlack(pitch);
          const name  = NOTE_NAMES[pitch % 12];
          const oct   = Math.floor(pitch / 12) - 1;
          return (
            <div key={pitch} className="piano-key-row" onClick={() => handleKeyClick(pitch)}>
              {black ? (
                <div className={`piano-key-black ${playingPitch === pitch ? 'playing' : ''}`} />
              ) : (
                <div className={`piano-key-white ${playingPitch === pitch ? 'playing' : ''}`}>
                  <span>{name === 'C' ? `C${oct}` : ''}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Note grid ── */}
      <div
        ref={gridRef}
        className="piano-roll-grid-area"
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleGridMouseMove}
        onMouseLeave={() => setHoverBeat(null)}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Ruler */}
        <div className="pr-ruler" style={{ width: gridWidth }}>
          {Array.from({ length: TOTAL_BEATS / 4 }, (_, i) => (
            <div key={i} className="pr-bar-mark" style={{ width: PX_PER_BEAT * 4 }}>
              <span>Bar {i + 1}</span>
            </div>
          ))}
        </div>

        {/* Grid rows + notes */}
        <div className="pr-canvas" style={{ width: gridWidth, position: 'relative' }}>
          {rows.map((pitch) => {
            const black  = isBlack(pitch);
            const isC    = pitch % 12 === 0;
            return (
              <div
                key={pitch}
                className={`pr-row${black ? ' black-key' : ''}${isC ? ' bar-start' : ''}`}
                style={{ width: gridWidth }}
              >
                {/* Beat grid lines */}
                {Array.from({ length: TOTAL_BEATS }, (_, i) => (
                  <div key={i} className="pr-grid-line" style={{
                    left: i * PX_PER_BEAT,
                    background: i % 4 === 0 ? 'var(--border-subtle)' : 'var(--border-faint)',
                  }} />
                ))}
              </div>
            );
          })}

          {/* MIDI notes — rendered over the rows */}
          {notes.map(note => {
            const top     = pitchToY(note.pitch);
            const left    = beatToX(note.startBeat);
            const width   = Math.max(8, beatToX(note.durationBeats) - 2);
            const isSel   = selectedId === note.id;
            const color   = isBlack(note.pitch) ? '#9b72ff' : '#4a9eff';
            const alpha   = Math.round((note.velocity / 127) * 80 + 60).toString(16);
            return (
              <div
                key={note.id}
                className="pr-note"
                style={{
                  top, left, width,
                  background: color + alpha,
                  border: `1px solid ${isSel ? '#fff' : color}`,
                  boxShadow: isSel ? `0 0 6px ${color}` : 'none',
                  cursor: 'grab',
                  userSelect: 'none',
                }}
                onMouseDown={(e) => handleNoteMouseDown(e, note)}
                onContextMenu={(e) => handleNoteRightClick(e, note)}
              >
                <span style={{ fontSize: 7, color: '#fff', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
                  {NOTE_NAMES[note.pitch % 12]}
                </span>
                {/* Resize handle */}
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: RESIZE_ZONE, height: '100%',
                  cursor: 'ew-resize', opacity: 0,
                }} />
              </div>
            );
          })}

          {/* Ghost note on hover */}
          {hoverBeat !== null && (
            <div style={{
              position: 'absolute',
              left: beatToX(hoverBeat),
              top: 0, bottom: 0,
              width: 2, background: 'var(--accent-cyan)',
              opacity: 0.3, pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Velocity editor */}
        <div style={{
          height: 56, borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-section)', position: 'relative',
          width: gridWidth, flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', top: 2, left: 4,
            fontFamily: 'var(--font-mono)', fontSize: 7,
            color: 'var(--text-muted)', letterSpacing: '0.12em',
          }}>VEL</div>
          {notes.map(note => (
            <VelocityBar
              key={note.id}
              note={note}
              onChange={(vel) => onUpdateNote(note.id, { velocity: vel })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
