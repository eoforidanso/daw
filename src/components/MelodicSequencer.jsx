import { useState, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const NUM_STEPS   = 16;
const TOP_PITCH   = 71; // B4
const BOT_PITCH   = 48; // C3
const NUM_ROWS    = TOP_PITCH - BOT_PITCH + 1; // 24

const NOTE_NAMES  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// pitches that are black keys
const BLACK_OFFSETS = new Set([1, 3, 6, 8, 10]);

function isBlackKey(pitch) {
  return BLACK_OFFSETS.has(pitch % 12);
}

// Row index 0 = top of grid = pitch TOP_PITCH; row 23 = BOT_PITCH
function rowToPitch(row) {
  return TOP_PITCH - row;
}

function pitchLabel(pitch) {
  const octave = Math.floor(pitch / 12) - 1;
  const name   = NOTE_NAMES[pitch % 12];
  return `${name}${octave}`;
}

// ── Empty grid factory ────────────────────────────────────────────────────────

function makeEmptyGrid() {
  return Array.from({ length: NUM_ROWS }, () => Array(NUM_STEPS).fill(false));
}

// ── Convert MIDI clip notes → grid ───────────────────────────────────────────

function notesToGrid(notes) {
  const grid = makeEmptyGrid();
  if (!notes) return grid;
  notes.forEach(({ pitch, startBeat }) => {
    const col = Math.round(startBeat * 4); // startBeat = col/4 → col = startBeat*4
    const row = TOP_PITCH - pitch;
    if (row >= 0 && row < NUM_ROWS && col >= 0 && col < NUM_STEPS) {
      grid[row][col] = true;
    }
  });
  return grid;
}

// ── Convert grid → MIDI notes ─────────────────────────────────────────────────

function gridToNotes(grid) {
  const notes = [];
  grid.forEach((rowArr, row) => {
    const pitch = rowToPitch(row);
    rowArr.forEach((active, col) => {
      if (active) {
        notes.push({
          id:            `mel-${pitch}-${col}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          pitch,
          startBeat:     col / 4,
          durationBeats: 0.25,
          velocity:      100,
        });
      }
    });
  });
  return notes;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CELL_SIZE = 18;
const GAP       = 2;
const LABEL_W   = 28; // left label column width

function Cell({ active, isBlack, isC, trackColor, onClick }) {
  let bg;
  if (active) {
    bg = trackColor || 'var(--accent-cyan)';
  } else if (isBlack) {
    bg = 'var(--bg-void)';
  } else {
    bg = 'var(--bg-section)';
  }

  return (
    <button
      onClick={onClick}
      style={{
        width:        CELL_SIZE,
        height:       CELL_SIZE,
        flexShrink:   0,
        background:   bg,
        border:       'none',
        borderLeft:   isC ? '2px solid var(--accent-cyan)' : `1px solid var(--bg-void)`,
        borderRadius: 2,
        cursor:       'pointer',
        opacity:      active ? 1 : isBlack ? 0.55 : 0.7,
        transition:   'background 0.06s, opacity 0.06s',
        padding:      0,
        boxSizing:    'border-box',
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MelodicSequencer({ clips, tracks, onUpdateClip }) {
  // Filter to melodic (non-drum) tracks
  const melodicTracks = (tracks ?? []).filter(t => t.type !== 'drum');

  const [selectedTrackId, setSelectedTrackId] = useState(
    melodicTracks.length > 0 ? melodicTracks[0].id : null,
  );

  const selectedTrack = melodicTracks.find(t => t.id === selectedTrackId) ?? melodicTracks[0] ?? null;

  // Find first MIDI clip for the selected track (to initialise grid)
  const selectedClip = (clips ?? []).find(c => c.trackId === selectedTrackId) ?? null;

  // Grid state: 24 rows × 16 cols of booleans
  const [grid, setGrid] = useState(() =>
    selectedClip ? notesToGrid(selectedClip.notes) : makeEmptyGrid(),
  );

  // When user picks a different track, reload grid from that track's clip
  const handleSelectTrack = useCallback((trackId) => {
    setSelectedTrackId(trackId);
    const clip = (clips ?? []).find(c => c.trackId === trackId) ?? null;
    setGrid(clip ? notesToGrid(clip.notes) : makeEmptyGrid());
  }, [clips]);

  const toggleCell = useCallback((row, col) => {
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      next[row][col] = !next[row][col];
      return next;
    });
  }, []);

  const handleWrite = useCallback(() => {
    if (!selectedClip || !onUpdateClip) return;
    onUpdateClip(selectedClip.id, { notes: gridToNotes(grid) });
  }, [selectedClip, grid, onUpdateClip]);

  const handleClear = useCallback(() => {
    setGrid(makeEmptyGrid());
  }, []);

  const handleRandom = useCallback(() => {
    setGrid(
      Array.from({ length: NUM_ROWS }, () =>
        Array.from({ length: NUM_STEPS }, () => Math.random() < 0.12),
      ),
    );
  }, []);

  const trackColor = selectedTrack?.color ?? 'var(--accent-cyan)';

  // Beat labels: 1-4 repeated twice
  const beatLabels = Array.from({ length: NUM_STEPS }, (_, i) => {
    const beat = (i % 4) + 1;
    return i % 4 === 0 ? String(beat) : '';
  });

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:            8,
      fontFamily:    'var(--font-mono)',
      userSelect:    'none',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
          MELODIC SEQUENCER — 16 STEPS / 2 OCT
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <ActionBtn label="RANDOM" onClick={handleRandom} color="var(--accent-purple)" />
          <ActionBtn label="CLEAR"  onClick={handleClear}  color="var(--text-muted)"    />
          <ActionBtn
            label="WRITE"
            onClick={handleWrite}
            color={trackColor}
            disabled={!selectedClip}
            highlight
          />
        </div>
      </div>

      {/* ── Step column headers ── */}
      <div style={{ display: 'flex', marginLeft: LABEL_W }}>
        {[0, 4, 8, 12].map((groupStart, gi) => (
          <div key={gi} style={{ display: 'flex', gap: GAP, marginLeft: gi > 0 ? 6 : 0 }}>
            {Array.from({ length: 4 }, (_, j) => {
              const col   = groupStart + j;
              const label = beatLabels[col];
              return (
                <div key={col} style={{
                  width:     CELL_SIZE,
                  textAlign: 'center',
                  fontSize:  7,
                  color:     label ? 'var(--text-secondary)' : 'transparent',
                  borderLeft: col % 4 === 0 && col > 0 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  {label || '.'}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        {Array.from({ length: NUM_ROWS }, (_, row) => {
          const pitch   = rowToPitch(row);
          const isBlack = isBlackKey(pitch);
          const isC     = pitch % 12 === 0;
          const showLabel = isC;

          return (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {/* Pitch label */}
              <div style={{
                width:     LABEL_W,
                flexShrink: 0,
                fontSize:   8,
                textAlign:  'right',
                paddingRight: 5,
                color:      showLabel ? 'var(--text-secondary)' : 'transparent',
                letterSpacing: '0.05em',
              }}>
                {showLabel ? pitchLabel(pitch) : '·'}
              </div>

              {/* Step cells, grouped in fours */}
              <div style={{ display: 'flex', gap: 0 }}>
                {[0, 4, 8, 12].map((groupStart, gi) => (
                  <div key={gi} style={{ display: 'flex', gap: GAP, marginLeft: gi > 0 ? 6 : 0 }}>
                    {Array.from({ length: 4 }, (_, j) => {
                      const col = groupStart + j;
                      return (
                        <Cell
                          key={col}
                          active={grid[row][col]}
                          isBlack={isBlack}
                          isC={isC}
                          trackColor={trackColor}
                          onClick={() => toggleCell(row, col)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Track selector ── */}
      {melodicTracks.length > 0 ? (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em', alignSelf: 'center' }}>
            TRACK
          </span>
          {melodicTracks.map(track => {
            const active = track.id === selectedTrackId;
            return (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track.id)}
                style={{
                  padding:      '2px 10px',
                  borderRadius:  10,
                  border:       `1px solid ${active ? track.color : 'var(--border-subtle)'}`,
                  background:    active ? `${track.color}22` : 'var(--bg-element)',
                  color:         active ? track.color : 'var(--text-muted)',
                  fontFamily:   'var(--font-mono)',
                  fontSize:      9,
                  cursor:       'pointer',
                  transition:   'all 0.1s',
                  letterSpacing: '0.05em',
                }}
              >
                {track.name}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
          No melodic tracks available.
        </div>
      )}
    </div>
  );
}

// ── Helper: small action button ───────────────────────────────────────────────

function ActionBtn({ label, onClick, color, disabled, highlight }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height:       20,
        padding:      '0 8px',
        borderRadius:  3,
        border:       `1px solid ${disabled ? 'var(--border-subtle)' : color}`,
        background:    highlight && !disabled ? `${color}22` : 'var(--bg-element)',
        color:         disabled ? 'var(--text-muted)' : color,
        fontFamily:   'var(--font-mono)',
        fontSize:      8,
        cursor:        disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.12em',
        opacity:       disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
