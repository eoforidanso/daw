import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to VOID STATION',
    body: 'This quick tour walks through every section of the DAW. Takes about 2 minutes. You can skip at any time and re-launch from the ? button in the transport bar.',
    target: null,
    position: 'center',
    emoji: '◈',
  },
  {
    id: 'transport',
    title: 'Transport Bar',
    body: 'The transport bar lives at the top and controls your entire session — playback, BPM, project management, and all collaboration tools.',
    target: '.transport-bar',
    position: 'below',
  },
  {
    id: 'playback',
    title: 'Playback Controls',
    body: 'Stop · Play/Pause · Record · Loop · Metronome. Click Play or press Space to start. The play button glows cyan when active, red when recording.',
    target: '.transport-controls',
    position: 'below',
  },
  {
    id: 'bpm',
    title: 'BPM & Tempo',
    body: 'Drag the BPM number up or down to change tempo in real-time. Use the ▲▼ arrows for fine control. Range is 40–240 BPM. Works with touch on mobile too.',
    target: '.bpm-section',
    position: 'below',
  },
  {
    id: 'tools',
    title: 'Project Tools',
    body: '⌛ Version History · ⊕ COLLAB for real-time sessions · ♫ Cloud Audio storage · ☁ Cloud Sync · PROJECT button to save, load, or rename.',
    target: '.transport-right',
    position: 'below-left',
  },
  {
    id: 'workspace-tabs',
    title: 'Three Workspace Views',
    body: 'ARRANGE shows your clip timeline. PIANO ROLL is your MIDI note editor — click a clip to dive in. BEAT GRID is the step sequencer for drums and percussion.',
    target: '.workspace-tabs',
    position: 'below',
  },
  {
    id: 'track-headers',
    title: 'Tracks',
    body: 'Each track has M (mute), S (solo), and R (arm for recording). Click the colored bar to change the track color. Drag the volume slider to balance levels.',
    target: '.track-headers',
    position: 'right',
  },
  {
    id: 'track-lanes',
    title: 'Arrangement View',
    body: 'Clips appear on the timeline here. The glowing cyan line is your playhead. Click anywhere on a lane to place a new clip. Drag clips to reposition them.',
    target: '.track-lanes',
    position: 'above',
  },
  {
    id: 'bottom-tabs',
    title: 'Production Tools',
    body: 'MIXER · INSTRUMENT (synth) · EFFECTS · PLUGINS · AI MELODY generator · QUANTIZE · WARP · AI MIX assistant · INPUT monitoring · AI ASSISTANT for advice.',
    target: '.bottom-tabs',
    position: 'above',
  },
  {
    id: 'mixer',
    title: 'Mixer',
    body: 'Each channel has volume fader, pan knob, EQ, mute, and solo. The master channel is on the far right. VU meters show real-time levels while playing.',
    target: '.daw-bottom',
    position: 'above',
  },
  {
    id: 'done',
    title: "You're all set.",
    body: 'Press Play and start making something. Save a version checkpoint with ⌛ anytime. Open AI ASSISTANT in the bottom tabs for mixing and arrangement advice.',
    target: null,
    position: 'center',
    emoji: '✦',
  },
];

function useSpotlight(selector) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [selector]);

  return rect;
}

function tooltipPosition(rect, position) {
  const PAD = 18;
  const W   = 320;

  if (!rect) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const clampLeft = (x) => Math.max(PAD, Math.min(window.innerWidth - W - PAD, x));

  switch (position) {
    case 'below':
      return { position: 'fixed', top: rect.top + rect.height + PAD, left: clampLeft(rect.left + rect.width / 2 - W / 2) };
    case 'above':
      return { position: 'fixed', bottom: window.innerHeight - rect.top + PAD, left: clampLeft(rect.left + rect.width / 2 - W / 2) };
    case 'right':
      return { position: 'fixed', top: Math.min(rect.top, window.innerHeight - 260), left: Math.min(rect.left + rect.width + PAD, window.innerWidth - W - PAD) };
    case 'below-left':
      return { position: 'fixed', top: rect.top + rect.height + PAD, right: Math.max(PAD, window.innerWidth - rect.right) };
    default:
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

export default function TutorialOverlay({ onClose }) {
  const [step, setStep]   = useState(0);
  const [fade, setFade]   = useState(true);

  const current = STEPS[step];
  const rect    = useSpotlight(current.target);
  const tipStyle = tooltipPosition(rect, current.position);

  const PADDING = 6;
  const highlight = rect ? {
    top:    rect.top    - PADDING,
    left:   rect.left   - PADDING,
    width:  rect.width  + PADDING * 2,
    height: rect.height + PADDING * 2,
  } : null;

  const advance = useCallback((delta) => {
    setFade(false);
    setTimeout(() => {
      setStep(s => {
        const next = s + delta;
        if (next < 0 || next >= STEPS.length) return s;
        return next;
      });
      setFade(true);
    }, 150);
  }, []);

  const handleDone = () => {
    localStorage.setItem('void_tutorial_seen', '1');
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance(1);
      if (e.key === 'ArrowLeft')  advance(-1);
      if (e.key === 'Escape')     handleDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'all' }}>
      {/* Click-blocker overlay (transparent — spotlight shadow handles darkening) */}
      <div style={{ position: 'absolute', inset: 0 }} />

      {/* Spotlight highlight */}
      {highlight && (
        <div
          style={{
            position: 'fixed',
            top:    highlight.top,
            left:   highlight.left,
            width:  highlight.width,
            height: highlight.height,
            borderRadius: 6,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.84)',
            border: '2px solid var(--accent-cyan)',
            zIndex: 9001,
            pointerEvents: 'none',
            transition: 'top 0.28s ease, left 0.28s ease, width 0.28s ease, height 0.28s ease',
          }}
        />
      )}

      {/* Full dark veil for center (no spotlight) steps */}
      {!highlight && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', zIndex: 9001 }} />
      )}

      {/* Tooltip card */}
      <div
        style={{
          ...tipStyle,
          width: 320,
          zIndex: 9002,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderTop: '3px solid var(--accent-cyan)',
          borderRadius: 8,
          boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,212,180,0.08)',
          overflow: 'hidden',
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 2, background: 'var(--bg-element)' }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: 'var(--accent-cyan)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        <div style={{ padding: '18px 20px 16px' }}>
          {/* Step header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {current.emoji && (
                <span style={{ fontSize: 14, color: 'var(--accent-cyan)' }}>{current.emoji}</span>
              )}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', color: 'var(--text-bright)',
              }}>
                {current.title}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)',
              letterSpacing: '0.1em',
            }}>
              {step + 1} / {STEPS.length}
            </span>
          </div>

          {/* Body */}
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.65,
            color: 'var(--text-secondary)', margin: 0, marginBottom: 18,
          }}>
            {current.body}
          </p>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 16 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => advance(i - step)}
                style={{
                  width: i === step ? 16 : 5,
                  height: 5, borderRadius: 3,
                  background: i === step ? 'var(--accent-cyan)' : i < step ? 'var(--accent-cyan-dim)' : 'var(--border-default)',
                  cursor: 'pointer',
                  transition: 'width 0.2s, background 0.2s',
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDone}
              style={{
                padding: '7px 14px', borderRadius: 3,
                border: '1px solid var(--border-default)', background: 'none',
                color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                fontSize: 7, letterSpacing: '0.15em', cursor: 'pointer',
                flex: isFirst ? 1 : 0,
              }}
            >
              SKIP
            </button>

            {!isFirst && (
              <button
                onClick={() => advance(-1)}
                style={{
                  padding: '7px 14px', borderRadius: 3,
                  border: '1px solid var(--border-default)', background: 'none',
                  color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
                  fontSize: 7, letterSpacing: '0.15em', cursor: 'pointer',
                }}
              >
                ← BACK
              </button>
            )}

            <button
              onClick={isLast ? handleDone : () => advance(1)}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 4,
                border: `1px solid var(--accent-cyan)`,
                background: isLast ? 'var(--accent-cyan)' : 'rgba(0,212,180,0.12)',
                color: isLast ? '#000' : 'var(--accent-cyan)',
                fontFamily: 'var(--font-mono)', fontSize: 8,
                letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              {isLast ? 'START MAKING ✦' : 'NEXT →'}
            </button>
          </div>

          {!isFirst && !isLast && (
            <div style={{ marginTop: 10, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              ← → arrow keys to navigate · Esc to close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
