import { useState, useEffect, useRef } from 'react';

// ── Tour content ─────────────────────────────────────────────────────────────

export const MICRO_TOURS = {
  warp: {
    label: 'WARP',
    prompt: 'Want a quick warp tutorial?',
    accent: 'var(--accent-orange)',
    steps: [
      {
        title: 'What is Warping?',
        body: 'Warp time-stretches audio to match your project BPM — like fitting a 130 BPM drum loop into a 107 BPM project — without changing pitch.',
      },
      {
        title: 'Placing Warp Markers',
        body: 'Click on any transient in the audio waveform to drop a marker. The marker pins that moment in time. Drag it left or right to pull that beat earlier or later.',
      },
      {
        title: 'Auto-Detect',
        body: 'Hit ⟳ AUTO DETECT to scan the audio and place markers on every transient (kick, snare, attack). Works great for drum loops and percussion.',
      },
      {
        title: 'The Workflow',
        body: 'Select a clip in Arrange view → open WARP tab → auto-detect → your loop snaps to the grid at any tempo. Works with live recorded audio too.',
      },
    ],
  },

  aimix: {
    label: 'AI MIX',
    prompt: 'Want to learn EQ basics?',
    accent: 'var(--accent-purple)',
    steps: [
      {
        title: 'What is EQ?',
        body: 'Equalization boosts or cuts specific frequency ranges. Every instrument occupies a slice of the spectrum — EQ carves out space so nothing clashes.',
      },
      {
        title: 'Low End  (20–250 Hz)',
        body: 'Sub bass is felt at 20–80 Hz. Bass fundamentals sit at 80–250 Hz. High-pass every non-bass track above 100 Hz — this single cut clears 80% of muddy mixes.',
      },
      {
        title: 'Mids  (250 Hz–4 kHz)',
        body: 'Vocals and most instruments live here. 300–500 Hz sounds "boxy" — a small cut on pads and guitars opens the mix instantly. 2–4 kHz adds presence and cut-through.',
      },
      {
        title: 'Highs  (4–20 kHz)',
        body: '4–8 kHz adds definition and attack. 10–20 kHz adds air and shimmer. Gentle boosts here make mixes sound open and modern. Avoid boosting above the noise floor.',
      },
      {
        title: 'Using AI Mix',
        body: 'Hit ANALYZE — the assistant reads your track names and levels, then suggests EQ and volume moves. Apply all or cherry-pick. Always adjust by ear after.',
      },
    ],
  },

  melody: {
    label: 'AI MELODY',
    prompt: 'Want to understand scales?',
    accent: 'var(--accent-cyan)',
    steps: [
      {
        title: 'What is a Scale?',
        body: 'A scale is a set of notes that sound harmonically related. Play C D E F G A B on a piano — that\'s C Major. Melodies that stay inside a scale almost always sound good.',
      },
      {
        title: 'Major vs Minor',
        body: 'Major scales (C D E F G A B) sound bright and resolved — pop, funk, gospel. Minor scales (C D Eb F G Ab Bb) sound darker and emotional — hip-hop, lo-fi, cinematic.',
      },
      {
        title: 'The Pentatonic Shortcut',
        body: 'Drop the 4th and 7th from a major scale → 5 notes remain. These 5 notes almost never clash with each other. Blues, rock, R&B, and soul are built on pentatonic.',
      },
      {
        title: 'Using AI Melody',
        body: 'Pick a root note + scale, set length (2 or 4 bars), choose a style, then GENERATE. The result drops into your Piano Roll — edit notes freely from there.',
      },
    ],
  },

  mixer: {
    label: 'MIXER',
    prompt: 'Learn mixer fundamentals?',
    accent: 'var(--accent-cyan)',
    steps: [
      {
        title: 'Channel Strips',
        body: 'Volume fader (up/down level), pan knob (stereo position), M (mute — silences the track), S (solo — mutes everything else). Each track has its own strip.',
      },
      {
        title: 'Gain Staging',
        body: 'Individual channels should peak around -12 to -6 dBFS. The master VU meter should peak near -6 dBFS. This headroom prevents distortion and leaves room for the limiter.',
      },
      {
        title: 'High-Pass Every Track',
        body: 'Apply a high-pass filter at 80–120 Hz on every track that isn\'t kick or bass. Removes low-frequency rumble that accumulates and muddies the mix.',
      },
      {
        title: 'The Master Channel',
        body: 'The MASTER strip sums everything. Keep it at 0 dB while mixing — use individual track faders to balance levels. The master fader is for monitoring only.',
      },
    ],
  },

  quant: {
    label: 'QUANTIZE',
    prompt: 'Quick guide to quantizing?',
    accent: 'var(--accent-yellow)',
    steps: [
      {
        title: 'What is Quantize?',
        body: 'Quantize snaps MIDI notes to the nearest beat subdivision. If you played a note 20ms late, quantize pulls it to the exact grid position. Essential for tight production.',
      },
      {
        title: 'Strength Setting',
        body: '100% = perfectly on the grid. 50% = halfway between where you played and the grid. 80% is a good starting point — tight but not robotic.',
      },
      {
        title: 'Humanize',
        body: 'Adds small random timing variations (±10–30ms) back into heavily quantized parts. Makes machine-perfect timing feel played by a human again.',
      },
      {
        title: 'Swing',
        body: 'Delays every second 16th note slightly. At 55–60% swing, straight 16ths start feeling like shuffled triplets. This is the groove foundation of hip-hop and lo-fi.',
      },
    ],
  },

  synth: {
    label: 'INSTRUMENT',
    prompt: 'Learn the synth basics?',
    accent: 'var(--accent-orange)',
    steps: [
      {
        title: 'Oscillators',
        body: 'OSC 1 + 2 generate the raw waveform. Sawtooth = bright and buzzy (leads). Sine = pure tone (sub bass). Square = hollow and mid-heavy. Triangle = soft and mellow.',
      },
      {
        title: 'Filter',
        body: 'Shapes which frequencies pass through. Lowpass (most common) removes everything above the cutoff. Automate the cutoff over time for classic synth sweeps and builds.',
      },
      {
        title: 'ADSR Envelope',
        body: 'Attack = fade-in time. Decay = fall to sustain. Sustain = held volume level. Release = ring-out after note ends. Slow attack + long release = lush pad. Fast attack = punchy lead.',
      },
      {
        title: 'LFO & Effects',
        body: 'LFO modulates the filter cyclically — set rate to 1/4 note for a rhythmic wobble. Reverb adds depth, delay adds rhythm, chorus widens the stereo image.',
      },
    ],
  },

  plugins: {
    label: 'PLUGINS',
    prompt: 'How do plugins work?',
    accent: 'var(--accent-blue)',
    steps: [
      {
        title: 'What are Plugins?',
        body: 'Plugins are effects loaded per track — compressors, EQs, saturators, reverbs. Each processes only that track\'s signal independently of everything else.',
      },
      {
        title: 'Signal Chain Order',
        body: 'Order matters: EQ → Compressor → Saturation → Reverb/Delay. EQ first so you don\'t compress frequencies you\'ll cut. Reverb always last — it adds space to the processed signal.',
      },
      {
        title: 'Adding Plugins',
        body: 'Select a track, pick a plugin type, click ADD PLUGIN. Adjust the parameter knobs. Each plugin has a wet/dry control — start at 50% and adjust to taste.',
      },
    ],
  },
};

// ── Nudge chip ────────────────────────────────────────────────────────────────

function NudgeChip({ tour, onAccept, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 7000);
    return () => { cancelAnimationFrame(raf); clearTimeout(timerRef.current); };
  }, [onDismiss]);

  const dismiss = () => { setVisible(false); clearTimeout(timerRef.current); setTimeout(onDismiss, 280); };
  const accept  = () => { setVisible(false); clearTimeout(timerRef.current); setTimeout(onAccept, 160); };

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--bottom-panel-height, 220px) + 46px)',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      opacity: visible ? 1 : 0,
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
      zIndex: 8000,
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'var(--bg-panel)',
      border: `1px solid ${tour.accent}`,
      borderRadius: 20,
      boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${tour.accent}22`,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '7px 14px 7px 12px',
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tour.accent, flexShrink: 0, boxShadow: `0 0 6px ${tour.accent}` }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {tour.prompt}
        </span>
      </div>

      <button
        onClick={accept}
        style={{
          padding: '7px 14px', background: tour.accent, border: 'none',
          color: '#000', fontFamily: 'var(--font-mono)', fontSize: 7,
          letterSpacing: '0.15em', fontWeight: 700, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        SHOW ME
      </button>

      <button
        onClick={dismiss}
        style={{
          padding: '7px 10px', background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Tour card (the step-through panel) ───────────────────────────────────────

function TourCard({ tour, onClose }) {
  const [step, setStep] = useState(0);
  const [dir, setDir]   = useState(1); // 1 = forward, -1 = backward
  const [anim, setAnim] = useState(true);

  const current  = tour.steps[step];
  const isLast   = step === tour.steps.length - 1;
  const isFirst  = step === 0;

  const go = (delta) => {
    setDir(delta);
    setAnim(false);
    setTimeout(() => { setStep(s => Math.max(0, Math.min(tour.steps.length - 1, s + delta))); setAnim(true); }, 120);
  };

  const done = () => {
    localStorage.setItem(`void_micro_${Object.keys(MICRO_TOURS).find(k => MICRO_TOURS[k] === tour)}`, '1');
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') isLast ? done() : go(1);
      if (e.key === 'ArrowLeft' && !isFirst) go(-1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, isLast, isFirst]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--bottom-panel-height, 220px) + 46px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 340,
      zIndex: 8100,
      background: 'var(--bg-panel)',
      border: `1px solid ${tour.accent}`,
      borderTop: `3px solid ${tour.accent}`,
      borderRadius: 8,
      boxShadow: `0 16px 56px rgba(0,0,0,0.75), 0 0 0 1px ${tour.accent}18`,
      overflow: 'hidden',
    }}>
      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--bg-element)' }}>
        <div style={{
          height: '100%',
          width: `${((step + 1) / tour.steps.length) * 100}%`,
          background: tour.accent,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Header */}
      <div style={{
        padding: '10px 14px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.2em',
            color: tour.accent, fontWeight: 700,
          }}>
            {tour.label} GUIDE
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            {step + 1}/{tour.steps.length}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2 }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        padding: '10px 14px 14px',
        opacity: anim ? 1 : 0,
        transform: `translateX(${anim ? 0 : dir * 12}px)`,
        transition: 'opacity 0.14s ease, transform 0.14s ease',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.1em', color: 'var(--text-bright)', marginBottom: 7,
        }}>
          {current.title}
        </div>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: 11.5, lineHeight: 1.65,
          color: 'var(--text-secondary)', margin: 0, marginBottom: 14,
        }}>
          {current.body}
        </p>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
          {tour.steps.map((_, i) => (
            <div
              key={i}
              onClick={() => go(i - step)}
              style={{
                width: i === step ? 14 : 5, height: 5, borderRadius: 3,
                background: i === step ? tour.accent : i < step ? tour.accent + '60' : 'var(--border-default)',
                cursor: 'pointer', transition: 'width 0.18s, background 0.18s',
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 7 }}>
          {!isFirst && (
            <button
              onClick={() => go(-1)}
              style={{
                padding: '6px 12px', borderRadius: 3,
                border: '1px solid var(--border-default)', background: 'none',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
                fontSize: 7, letterSpacing: '0.12em', cursor: 'pointer',
              }}
            >
              ← BACK
            </button>
          )}
          <button
            onClick={isLast ? done : () => go(1)}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 3,
              border: `1px solid ${tour.accent}`,
              background: isLast ? tour.accent : tour.accent + '18',
              color: isLast ? '#000' : tour.accent,
              fontFamily: 'var(--font-mono)', fontSize: 7,
              letterSpacing: '0.18em', cursor: 'pointer', fontWeight: 700,
            }}
          >
            {isLast ? 'GOT IT ✓' : 'NEXT →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export default function MicroTour({ tabId }) {
  const [phase, setPhase] = useState('nudge'); // nudge | tour | null

  const tour    = MICRO_TOURS[tabId];
  const seenKey = `void_micro_${tabId}`;

  // Reset when tab changes
  useEffect(() => {
    if (!tour) return;
    if (localStorage.getItem(seenKey)) return;
    setPhase('nudge');
  }, [tabId]);

  if (!tour || phase === null) return null;
  if (localStorage.getItem(seenKey)) return null;

  if (phase === 'nudge') {
    return (
      <NudgeChip
        tour={tour}
        onAccept={() => setPhase('tour')}
        onDismiss={() => setPhase(null)}
      />
    );
  }

  return (
    <TourCard
      tour={tour}
      onClose={() => {
        localStorage.setItem(seenKey, '1');
        setPhase(null);
      }}
    />
  );
}
