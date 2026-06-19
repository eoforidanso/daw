import { useState, useCallback } from 'react';
import { MixAssistant } from '../audio/MixAssistant.js';
import { engine } from '../audio/engine.js';

const SEVERITY_COLOR = {
  warn: 'var(--accent-red)',
  info: 'var(--accent-blue)',
  tip:  'var(--accent-cyan)',
};
const SEVERITY_ICON = { warn: '⚠', info: 'ℹ', tip: '✦' };

function SuggestionCard({ suggestion, onApply, trackColor }) {
  const color = SEVERITY_COLOR[suggestion.severity] ?? 'var(--text-secondary)';
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 4,
      background: 'var(--bg-element)', border: `1px solid var(--border-faint)`,
      borderLeft: `3px solid ${color}`,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{ width: 18, flexShrink: 0, paddingTop: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color }}>{SEVERITY_ICON[suggestion.severity] ?? '○'}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {trackColor && (
            <div style={{ width: 8, height: 8, borderRadius: 2, background: trackColor, flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-bright)' }}>
            {suggestion.trackName ?? 'MIX'}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.08em', color,
            background: color + '22', border: `1px solid ${color}33`,
            borderRadius: 2, padding: '1px 5px',
          }}>
            {suggestion.type?.toUpperCase() ?? 'NOTE'}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {suggestion.text}
        </div>
      </div>
      {suggestion.action && (
        <button
          onClick={() => onApply(suggestion)}
          style={{
            flexShrink: 0, padding: '4px 10px', borderRadius: 3,
            border: `1px solid ${color}`, background: color + '15',
            color, fontFamily: 'var(--font-mono)', fontSize: 7,
            letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.1s',
            whiteSpace: 'nowrap',
          }}
        >
          APPLY
        </button>
      )}
    </div>
  );
}

// Spectrum bar showing rough frequency balance (approximated from known track types)
function SpectrumBar({ track }) {
  const isKick  = track.name.toUpperCase().includes('KICK');
  const isBass  = track.name.toUpperCase().includes('BASS');
  const isHat   = track.name.toUpperCase().includes('HAT') || track.name.toUpperCase().includes('HH');
  const isLead  = track.name.toUpperCase().includes('LEAD');
  const isPad   = track.name.toUpperCase().includes('PAD');
  const isSnare = track.name.toUpperCase().includes('SNARE');

  const bands = {
    sub:  isKick || isBass ? 0.8 : 0.1,
    low:  isKick ? 0.6 : isBass ? 0.7 : isSnare ? 0.3 : 0.15,
    mid:  isSnare ? 0.7 : isLead ? 0.8 : isPad ? 0.65 : 0.4,
    hi:   isHat ? 0.9 : isLead ? 0.75 : isSnare ? 0.6 : 0.2,
    air:  isHat ? 0.85 : isPad ? 0.4 : 0.1,
  };

  return (
    <div style={{ display: 'flex', gap: 1, height: 20, alignItems: 'flex-end' }}>
      {Object.entries(bands).map(([band, level]) => (
        <div key={band} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
          <div style={{
            width: '100%', height: Math.round(level * 18), borderRadius: '1px 1px 0 0',
            background: `linear-gradient(to top, ${track.color}cc, ${track.color}44)`,
            minHeight: 2,
          }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 5, color: 'var(--text-muted)' }}>{band}</div>
        </div>
      ))}
    </div>
  );
}

function TrackCard({ track, suggestions, onApply }) {
  const warnCount = suggestions.filter(s => s.severity === 'warn').length;
  return (
    <div style={{ background: 'var(--bg-section)', border: `1px solid var(--border-subtle)`, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: track.color }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--text-bright)', flex: 1 }}>{track.name}</span>
        {warnCount > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-red)', letterSpacing: '0.1em' }}>
            {warnCount} WARN
          </span>
        )}
        <SpectrumBar track={track} />
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {suggestions.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>✓ No issues found</div>
        ) : suggestions.map((s, i) => (
          <SuggestionCard key={i} suggestion={{ ...s, trackName: track.name }} onApply={onApply} trackColor={track.color} />
        ))}
      </div>
    </div>
  );
}

export default function MixAssistantPanel({ tracks, onTrackUpdate, setTrackEQ }) {
  const [analysis, setAnalysis]     = useState(null);
  const [running, setRunning]       = useState(false);
  const [applied, setApplied]       = useState([]);
  const [view, setView]             = useState('tracks'); // 'tracks' | 'global'

  const runAnalysis = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const result = MixAssistant.analyze(tracks, engine);
      setAnalysis(result);
      setRunning(false);
    }, 600); // Simulated analysis delay for feel
  }, [tracks]);

  const applyOne = useCallback((suggestion) => {
    if (!suggestion.action) return;
    const { kind, value } = suggestion.action;
    if (kind === 'volume' && suggestion.trackId != null) {
      onTrackUpdate(suggestion.trackId, { volume: value });
    } else if (kind === 'eq' && suggestion.trackId != null) {
      setTrackEQ(suggestion.trackId, suggestion.action.band, value);
    }
    setApplied(prev => [...prev, suggestion.text]);
  }, [onTrackUpdate, setTrackEQ]);

  const applyAll = useCallback(() => {
    if (!analysis) return;
    const all = MixAssistant.flatSuggestions(analysis);
    all.filter(s => s.action).forEach(s => applyOne(s));
  }, [analysis, applyOne]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-void)', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em', color: 'var(--accent-purple)' }}>AI MIX</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', marginLeft: 8, letterSpacing: '0.12em' }}>
            INTELLIGENT MIXING ASSISTANT
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {analysis && (
            <button onClick={applyAll} style={{
              padding: '5px 14px', borderRadius: 3,
              border: '1px solid var(--accent-purple)', background: 'rgba(155,114,255,0.12)',
              color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)', fontSize: 8,
              letterSpacing: '0.15em', cursor: 'pointer',
            }}>AUTO-MIX ALL</button>
          )}
          <button onClick={runAnalysis} disabled={running} style={{
            padding: '5px 16px', borderRadius: 3,
            border: '1px solid var(--accent-cyan)', background: 'rgba(0,212,180,0.1)',
            color: running ? 'var(--text-muted)' : 'var(--accent-cyan)',
            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em',
            cursor: running ? 'not-allowed' : 'pointer',
          }}>
            {running ? 'ANALYZING…' : 'ANALYZE MIX'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      {analysis && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
          {[['tracks','PER TRACK'],['global','GLOBAL']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: '6px 16px', background: 'none', border: 'none',
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', cursor: 'pointer',
              color: view === id ? 'var(--accent-purple)' : 'var(--text-muted)',
              borderBottom: `2px solid ${view === id ? 'var(--accent-purple)' : 'transparent'}`,
            }}>{label}</button>
          ))}
          <div style={{ marginLeft: 'auto', padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em', alignSelf: 'center' }}>
            {MixAssistant.flatSuggestions(analysis).length} suggestions · {applied.length} applied
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {!analysis && !running && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
              CLICK ANALYZE MIX TO BEGIN
            </div>
            <div style={{ maxWidth: 360, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              The assistant analyzes frequency content, level relationships, and masking issues across all tracks,
              then generates specific EQ and level suggestions.
            </div>
          </div>
        )}

        {running && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--accent-purple)' }}>
              ANALYZING…
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
              Inspecting frequency bands, levels, and stereo field
            </div>
          </div>
        )}

        {analysis && !running && view === 'tracks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.perTrack.map(({ trackId, suggestions }) => {
              const track = tracks.find(t => t.id === trackId);
              if (!track) return null;
              return (
                <TrackCard
                  key={trackId}
                  track={track}
                  suggestions={suggestions.map(s => ({ ...s, trackId }))}
                  onApply={applyOne}
                />
              );
            })}
          </div>
        )}

        {analysis && !running && view === 'global' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analysis.global.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-cyan)', padding: '16px 0' }}>
                ✓ No global mix issues detected.
              </div>
            ) : analysis.global.map((s, i) => (
              <SuggestionCard key={i} suggestion={s} onApply={applyOne} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
