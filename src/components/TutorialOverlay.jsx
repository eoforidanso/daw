import { useState, useEffect, useCallback } from 'react';

// ── Sections ──────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'start',       label: 'START',       color: '#00d4b4' },
  { id: 'transport',   label: 'TRANSPORT',   color: '#4a9eff' },
  { id: 'arrange',     label: 'ARRANGEMENT', color: '#ff6b35' },
  { id: 'piano',       label: 'PIANO ROLL',  color: '#c47fff' },
  { id: 'beat',        label: 'BEAT GRID',   color: '#ff4466' },
  { id: 'production',  label: 'PRODUCTION',  color: '#ffcc00' },
  { id: 'finish',      label: 'FINISH',      color: '#00d4b4' },
];

const STEPS = [
  // ── START ─────────────────────────────────────────────────────
  {
    section: 'start',
    id: 'welcome',
    title: 'Welcome to VOID STATION',
    body: 'A full browser-based DAW — no installs, no plugins, no limits. This tour covers every section in depth. Takes about 4 minutes. You can re-open it any time with the ? button in the transport bar.',
    target: null,
    position: 'center',
    emoji: '◈',
  },
  {
    section: 'start',
    id: 'template',
    title: 'Project Templates',
    body: 'Every new session starts with the Template Picker. Choose a genre (Hip-Hop, House, Ambient…) to get pre-built tracks, BPM, and a synth preset. Pick BLANK for a clean slate. Recent projects appear at the bottom — click to restore.',
    target: null,
    position: 'center',
    tip: 'Your last session is auto-saved every 30 seconds. If the browser closes unexpectedly, VOID STATION prompts you to restore the draft.',
  },

  // ── TRANSPORT ─────────────────────────────────────────────────
  {
    section: 'transport',
    id: 'transport-bar',
    title: 'The Transport Bar',
    body: 'Everything you need to run a session lives here: playback, BPM, project tools, and real-time collab. It stays at the top at all times.',
    target: '.transport-bar',
    position: 'below',
  },
  {
    section: 'transport',
    id: 'playback',
    title: 'Playback Controls',
    body: '■ Stop rewinds to bar 1. ▶ Play starts the engine and lights the playhead. ● Record arms all armed tracks — they capture MIDI from your controller or the onscreen keyboard. ↩ Loop toggles loop mode. ♩ Metronome clicks on subdivisions.',
    target: '.transport-controls',
    position: 'below',
    tip: 'Space = Play/Stop · R = Record · L = Toggle loop',
  },
  {
    section: 'transport',
    id: 'bpm',
    title: 'BPM & Tempo',
    body: 'Drag the BPM number up or down to change tempo in real-time — the whole engine re-syncs immediately. Click the ▲▼ arrows for ±1 BPM nudges. Range is 40–240 BPM. Tap tempo not yet in the UI — use a BPM calculator and drag.',
    target: '.bpm-section',
    position: 'below',
    tip: 'Hold Shift while dragging for fine ±0.1 BPM control (if your template shows it).',
  },
  {
    section: 'transport',
    id: 'project-tools',
    title: 'Project Tools',
    body: 'PROJECT → rename, save, load from JSON, or start a new session. ⌛ Version History → snapshot labeled checkpoints and roll back anytime.',
    target: '.transport-right',
    position: 'below-left',
    tip: 'Version History keeps an unlimited local chain in IndexedDB — nothing is lost.',
  },
  {
    section: 'transport',
    id: 'export',
    title: 'Export',
    body: 'Hit EXPORT (or the ↓ icon) to open the Export Modal. Bounce the full mix to WAV/MP3, download per-scene stems as a ZIP, or export MIDI clips — all rendered in the browser with zero server round-trips.',
    target: '.transport-bar',
    position: 'below',
    tip: 'Per-track MIDI export is also available directly from each mixer channel — look for the tiny .mid button.',
  },

  // ── ARRANGEMENT ───────────────────────────────────────────────
  {
    section: 'arrange',
    id: 'workspace-tabs',
    title: 'Four Workspace Views',
    body: 'ARRANGE — timeline with clips and the automation lane editor. PIANO ROLL — zoom into any MIDI clip to draw notes. BEAT GRID — 16-step drum sequencer. PERFORM — scene-based launch pad for live sets.',
    target: '.workspace-tabs',
    position: 'below',
    tip: 'Your view is remembered between bottom-tab switches — the BEAT GRID keeps your grid while you tweak the mixer.',
  },
  {
    section: 'arrange',
    id: 'tracks',
    title: 'Track Headers',
    body: 'Each track has: colored dot (click to repaint) · track name · M mute · S solo · R arm for recording · volume mini-slider. Drag the separator line between headers to resize the panel. Drum tracks feed the Beat Grid. MIDI tracks feed the Piano Roll.',
    target: '.track-headers',
    position: 'right',
    tip: 'Shift+click S (Solo) to solo multiple tracks simultaneously.',
  },
  {
    section: 'arrange',
    id: 'clips',
    title: 'Clips & the Timeline',
    body: 'Click an empty lane to place a new MIDI clip. Drag a clip left/right to reposition. Click a clip to select it — then open PIANO ROLL to edit its notes. Clips show their note content as a tiny preview. The glowing cyan line is the playhead; it moves in real-time during playback.',
    target: '.track-lanes',
    position: 'above',
    tip: 'Audio clips can be imported via the SAMPLES tab. Drag a sample onto a track and it becomes an audio clip in the timeline.',
  },
  {
    section: 'arrange',
    id: 'automation',
    title: 'Automation Lanes',
    body: 'Click the A button on any track header to open an automation lane. Pick a parameter (volume, pan, filter cutoff…) from the dropdown. Click the lane to place a point, drag points to shape the curve. The engine follows the curve in real-time during playback.',
    target: '.track-headers',
    position: 'right',
    tip: 'Automation is recorded live during playback if the track is armed and you move a knob or fader — it auto-creates points.',
  },
  {
    section: 'arrange',
    id: 'freeze',
    title: 'Track Freeze',
    body: 'Freeze a track (❄ button) to render it to an audio buffer — the CPU load for that track drops to near zero. The track turns grey and locks. Unfreeze any time to edit the MIDI again. Use freeze on complex synth tracks before a live performance.',
    target: '.track-headers',
    position: 'right',
    tip: 'Freezing is local to your browser session. Frozen audio is not included in MIDI exports — bounce the mix first if you want stems.',
  },

  // ── PIANO ROLL ────────────────────────────────────────────────
  {
    section: 'piano',
    id: 'piano-overview',
    title: 'Piano Roll Overview',
    body: 'Select a MIDI clip in the Arrange view, then switch to PIANO ROLL. The horizontal axis is time in beats; the vertical axis is pitch. Each colored bar is a note. The keyboard on the left plays notes when clicked so you can audition pitches.',
    target: '.workspace-tabs',
    position: 'below',
    tip: 'The Piano Roll always shows the most recently selected clip. Click a different clip in ARRANGE to jump to it.',
  },
  {
    section: 'piano',
    id: 'piano-editing',
    title: 'Drawing & Editing Notes',
    body: 'Click empty space to draw a note at the default length. Drag its right edge to resize. Drag the body to move pitch or time. Right-click to delete. Select multiple notes by drag-selecting. The velocity bar at the bottom of each note shows loudness — drag it up/down.',
    target: '.workspace-content',
    position: 'above',
    tip: 'Hold Shift while clicking to add notes without switching to move mode.',
  },
  {
    section: 'piano',
    id: 'piano-quantize',
    title: 'Quantize & Humanize',
    body: 'Open the QUANTIZE tab (bottom panel) to snap note start-times to a grid (1/4 to 1/32). Strength 0–100% blends between original and snapped. HUMANIZE does the opposite — adds micro-timing and velocity variation to make patterns feel more organic.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Apply quantize at 70–80% strength for a tight-but-human feel. 100% is robotic; 0% leaves it raw.',
  },

  // ── BEAT GRID ─────────────────────────────────────────────────
  {
    section: 'beat',
    id: 'beat-overview',
    title: 'Beat Grid (Step Sequencer)',
    body: 'Switch to BEAT GRID for your drum tracks. 16 steps per bar, one row per instrument (KICK, SNARE, HI-HAT, CLAP). Click any step to toggle it on/off. Steps light up as the playhead passes through them. Groupings of 4 show the beat subdivisions.',
    target: '.workspace-tabs',
    position: 'below',
    tip: 'BEAT GRID syncs live with ARRANGE — patterns loop alongside your MIDI clips.',
  },
  {
    section: 'beat',
    id: 'beat-prob',
    title: 'Step Probability',
    body: 'Toggle PROB to reveal a row of draggable bars below each drum row. Each bar = the fire chance for that step (0–100%). A step at 60% fires roughly 3 out of 5 loops — great for rolls, ghost shuffles, and anything that needs controlled randomness without full randomize.',
    target: '.workspace-content',
    position: 'above',
    tip: 'Double-click a probability bar to reset it to 100%. The step button fades proportionally so you can see ghost steps at a glance.',
  },
  {
    section: 'beat',
    id: 'beat-vel',
    title: 'Velocity Lanes — Ghost Notes & Accents',
    body: 'Toggle VEL to reveal velocity bars (0–127) per step. Low-velocity steps (shown in blue) are ghost notes — they\'re quiet and soft. High-velocity steps (yellow) are accents. Use GHOST to auto-set ~38% of active steps to ghost velocity, and ACCENT to boost every 4th hit to full volume.',
    target: '.workspace-content',
    position: 'above',
    tip: 'Ghost notes + reduced probability = the classic "drunk drummer" feel. Try GHOST then set a few step probabilities to 50%.',
  },
  {
    section: 'beat',
    id: 'beat-patterns',
    title: 'Pattern Library & Randomize',
    body: 'LIBRARY opens a scrollable grid of 24 genre presets — Boom Bap, Trap, House, Techno, Afrobeats, Jungle, and more. Hover a tile to preview the mini-grid; click to load. RND randomizes steps with genre-weighted density (kick biased to beat 1, snare biased to beat 3). CLR clears everything.',
    target: '.workspace-content',
    position: 'above',
    tip: 'PATTERN A/B/C/D slots will store 4 banks per session. SWING slider offsets even-numbered 8th steps for groove.',
  },

  // ── PRODUCTION TOOLS ──────────────────────────────────────────
  {
    section: 'production',
    id: 'mixer',
    title: 'Mixer',
    body: 'Every track gets a channel strip: EQ (L/M/H knobs + visual curve), 4 insert FX slots (REV · DLY · DIST · CHO), pan knob, volume fader, and VU meter. The MASTER strip is at the far right — adjust it last. Mute and Solo work per-strip. Per-track MIDI export: click the tiny .mid button on any channel header.',
    target: '.daw-bottom',
    position: 'above',
    tip: 'Clip the EQ Low knob above 0 dB to add warmth, or cut below to reduce mud. The visual curve updates in real-time.',
  },
  {
    section: 'production',
    id: 'spectrum',
    title: 'Spectrum Analyzer',
    body: 'Above the mixer channels a real-time frequency spectrum shows the master output. The analyzer updates at ~30fps during playback. Low end is on the left; highs on the right. Use it to spot frequency clashes between tracks — if the kick and bass both pile up at 80Hz, separate them with EQ.',
    target: '.daw-bottom',
    position: 'above',
    tip: 'A healthy mix shows energy spread across the full spectrum. A very spiky low end usually means the kick and bass need sidechain compression.',
  },
  {
    section: 'production',
    id: 'synth',
    title: 'Synth / Instrument',
    body: 'The INSTRUMENT tab opens the synth engine. Osc 1 and Osc 2 can each be sine, square, sawtooth, or triangle. Detune Osc 2 a few cents for a wide, chorus-like sound. The filter shapes the tone (cutoff = brightness, resonance = character). ADSR controls the amplitude envelope over time.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'LFO modulates the filter cutoff for a wobble/wah effect. Connect it to OSC pitch for vibrato. Rate and depth are independent.',
  },
  {
    section: 'production',
    id: 'effects',
    title: 'Effects Chain',
    body: 'The EFFECTS tab shows the synth\'s built-in send effects. Reverb: mix = wet/dry, size = room size. Delay: time in beats, feedback = number of repeats, mix = wetness. Distortion adds harmonic overtones. Chorus thickens the sound by layering slightly detuned copies.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Keep reverb mix below 30% for most instruments — too much pushes things to the back. Use short delay (1/16) for slapback on bass.',
  },
  {
    section: 'production',
    id: 'chords',
    title: 'Chord Progression Panel',
    body: 'Pick a root note and scale, then browse chord voicings with the arrow keys. Click a chord to hear it and instantly send those MIDI notes to the Arpeggiator. Use INSERT to write the chord as a MIDI clip. The panel understands major, minor, dorian, phrygian, lydian, and more.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Selecting a chord here auto-populates the Arpeggiator — switch to ARP and hit Enable immediately after clicking a chord.',
  },
  {
    section: 'production',
    id: 'arp',
    title: 'Arpeggiator',
    body: 'The ARP tab plays the active chord as an arpeggio in real-time. Rate: 1/32 (fastest) to 1/4. Pattern: UP, DOWN, BOUNCE (up-then-down), RANDOM. Octaves 1–3 add octave jumps. Gate controls note length (short = staccato, long = legato). Output track selects which synth plays the arp.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Enable the arp while playing to hear it sync to the tempo. The sequence preview in the panel shows exactly which notes will trigger and in what order.',
  },
  {
    section: 'production',
    id: 'song-seed',
    title: 'Song Seed Generator',
    body: 'SONG SEED is a one-click arrangement starter. Pick a genre, set complexity (Drums / Drums+Bass / Full), then hit ⚡ GENERATE. It creates a genre-appropriate drum pattern, bass line, chord stabs, and lead motif — all derived from the chord you selected in CHORDS. Hit INSERT to load them into your tracks.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Re-generate as many times as you like — each press randomises the lead motif and bass rhythm while keeping the genre DNA. Great for breaking writer\'s block.',
  },
  {
    section: 'production',
    id: 'melody',
    title: 'AI Melody Generator',
    body: 'AI MELODY uses pattern-based generation to create melodic phrases over your chord. Choose mood (happy, tense, dreamy…), length (1–4 bars), and density. The preview shows the generated notes before you commit. INSERT writes it as a MIDI clip on the Lead track.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Pair AI MELODY with the Arpeggiator running on the same chord for dense layered textures.',
  },
  {
    section: 'production',
    id: 'warp',
    title: 'Warp Markers',
    body: 'WARP lets you time-stretch audio clips without changing pitch. Click AUTO DETECT to find transients; the engine places warp markers at beats. Drag a marker to shift where that beat falls in time. Great for aligning a live recording or a sample that was played slightly off-tempo.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Select the audio clip in ARRANGE before opening WARP — the panel operates on the currently selected clip only.',
  },
  {
    section: 'production',
    id: 'samples',
    title: 'Sample Browser',
    body: 'SAMPLES lets you audition and drag samples directly onto tracks. Samples are loaded from your uploaded audio files. The waveform previews on hover. Click a track in the track list to drop the sample there — it becomes an audio clip that plays back through the audio engine.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Audio clips respect track mute/solo. They\'re also exported with the full mix in the Export modal.',
  },
  {
    section: 'production',
    id: 'ai-mix',
    title: 'AI Mix Assistant',
    body: 'AI MIX analyzes your mix and suggests EQ, volume, and pan adjustments per track. It uses loudness targets and frequency balance heuristics. Click APPLY ALL to let it adjust everything, or expand each suggestion and apply individually. Re-run after any major change.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'AI MIX suggestions are starting points, not final answers. Always use your ears — the analyzer gives you data, not taste.',
  },
  {
    section: 'production',
    id: 'input',
    title: 'Audio Input & MIDI',
    body: 'INPUT opens the monitoring panel. Select an audio input device, set gain, and toggle Monitor to hear yourself through the DAW. Arm a track (R button) and hit Record to capture audio. MIDI devices are detected automatically — a MIDI chip appears in the workspace tabs when one is connected.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'Latency Compensation setting offsets recorded audio backward by the interface\'s round-trip latency. Check your interface specs for the value.',
  },
  {
    section: 'production',
    id: 'ai-chat',
    title: 'AI Assistant',
    body: 'AI ASSISTANT is a context-aware chat panel that knows your current tracks, BPM, and clips. Ask it: "How do I get a punchier kick?" or "What chords work over a C minor pattern?" or "Suggest a structure for this track." It gives DAW-specific, actionable advice.',
    target: '.bottom-tabs',
    position: 'above',
    tip: 'The assistant can read your current project state — mention "my current track" or "the mix" and it understands the context.',
  },

  // ── FINISH ────────────────────────────────────────────────────
  {
    section: 'finish',
    id: 'performance',
    title: 'Performance Mode',
    body: 'Switch to PERFORM in the workspace tabs for live performance. Scenes are columns of clips that launch together. Build scenes, assign keyboard keys or MIDI pads to each, and trigger them during a set. Hit CAPTURE to record a scene sequence back to the Arrange timeline.',
    target: '.workspace-tabs',
    position: 'below',
    tip: 'Export → Stems by Scene is designed for PERFORM mode — it bounces each scene as a separate audio file.',
  },
  {
    section: 'finish',
    id: 'done',
    title: "You're ready to make music.",
    body: 'You now know every section of VOID STATION. Start by picking a chord in CHORDS, running SONG SEED for an instant foundation, then shaping the sound in the Synth panel. Save a version checkpoint often with ⌛. Good luck.',
    target: null,
    position: 'center',
    emoji: '✦',
    tip: 'Keyboard: Space = play/stop · ← → = navigate this tour · Esc = close tour',
  },
];

// ── Helpers ──────────────────────────────────────────────────────
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
  const W   = 370;
  if (!rect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const clampLeft = x => Math.max(PAD, Math.min(window.innerWidth - W - PAD, x));
  switch (position) {
    case 'below':      return { position: 'fixed', top: rect.top + rect.height + PAD, left: clampLeft(rect.left + rect.width / 2 - W / 2) };
    case 'above':      return { position: 'fixed', bottom: window.innerHeight - rect.top + PAD, left: clampLeft(rect.left + rect.width / 2 - W / 2) };
    case 'right':      return { position: 'fixed', top: Math.min(rect.top, window.innerHeight - 320), left: Math.min(rect.left + rect.width + PAD, window.innerWidth - W - PAD) };
    case 'below-left': return { position: 'fixed', top: rect.top + rect.height + PAD, right: Math.max(PAD, window.innerWidth - rect.right) };
    default:           return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

// Build a section → first-step-index map for jump navigation
const SECTION_STARTS = {};
STEPS.forEach((s, i) => { if (!(s.section in SECTION_STARTS)) SECTION_STARTS[s.section] = i; });

export default function TutorialOverlay({ onClose }) {
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(true);

  const current   = STEPS[step];
  const rect      = useSpotlight(current.target);
  const tipStyle  = tooltipPosition(rect, current.position);
  const sectionCfg = SECTIONS.find(s => s.id === current.section) ?? SECTIONS[0];

  const PADDING   = 6;
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
    }, 140);
  }, []);

  const jumpTo = useCallback((idx) => {
    setFade(false);
    setTimeout(() => { setStep(idx); setFade(true); }, 140);
  }, []);

  const handleDone = useCallback(() => {
    localStorage.setItem('void_tutorial_seen', '1');
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance(1);
      if (e.key === 'ArrowLeft')  advance(-1);
      if (e.key === 'Escape')     handleDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, handleDone]);

  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const pct     = ((step + 1) / STEPS.length) * 100;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'all' }}>
      <div style={{ position: 'absolute', inset: 0 }} />

      {/* Spotlight */}
      {highlight && (
        <div style={{
          position: 'fixed',
          top: highlight.top, left: highlight.left,
          width: highlight.width, height: highlight.height,
          borderRadius: 6,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.82)',
          border: `2px solid ${sectionCfg.color}`,
          zIndex: 9001, pointerEvents: 'none',
          transition: 'top 0.28s ease, left 0.28s ease, width 0.28s ease, height 0.28s ease, border-color 0.3s',
        }} />
      )}

      {/* Full veil for center steps */}
      {!highlight && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.87)', zIndex: 9001 }} />
      )}

      {/* Tooltip card */}
      <div style={{
        ...tipStyle,
        width: 370,
        zIndex: 9002,
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderTop: `3px solid ${sectionCfg.color}`,
        borderRadius: 8,
        boxShadow: '0 24px 80px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.03)',
        overflow: 'hidden',
        opacity: fade ? 1 : 0,
        transition: 'opacity 0.15s ease',
      }}>

        {/* Section tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SECTIONS.map(sec => {
            const isActive = sec.id === current.section;
            const firstIdx = SECTION_STARTS[sec.id] ?? 0;
            return (
              <button
                key={sec.id}
                onClick={() => jumpTo(firstIdx)}
                style={{
                  padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.1em',
                  color: isActive ? sec.color : 'var(--text-muted)',
                  borderBottom: isActive ? `2px solid ${sec.color}` : '2px solid transparent',
                  flexShrink: 0, transition: 'color 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: 'var(--bg-element)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: sectionCfg.color, transition: 'width 0.3s ease' }} />
        </div>

        <div style={{ padding: '16px 20px 14px' }}>
          {/* Section tag + title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {current.emoji && (
                <span style={{ fontSize: 14, color: sectionCfg.color }}>{current.emoji}</span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-bright)' }}>
                {current.title}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0, marginLeft: 8 }}>
              {step + 1} / {STEPS.length}
            </span>
          </div>

          {/* Body */}
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, marginBottom: current.tip ? 12 : 18 }}>
            {current.body}
          </p>

          {/* Tip callout */}
          {current.tip && (
            <div style={{ borderLeft: `2px solid ${sectionCfg.color}`, background: `${sectionCfg.color}0e`, borderRadius: '0 3px 3px 0', padding: '7px 10px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: sectionCfg.color, letterSpacing: '0.12em', marginBottom: 3 }}>TIP</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{current.tip}</div>
            </div>
          )}

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            {STEPS.map((s, i) => {
              const sc = SECTIONS.find(sec => sec.id === s.section);
              const isCur = i === step;
              return (
                <div
                  key={i}
                  onClick={() => jumpTo(i)}
                  style={{
                    width: isCur ? 14 : 4, height: 4, borderRadius: 3,
                    background: isCur ? (sc?.color ?? 'var(--accent-cyan)') : i < step ? 'var(--border-strong)' : 'var(--border-subtle)',
                    cursor: 'pointer', transition: 'width 0.2s, background 0.2s',
                    flexShrink: 0,
                  }}
                />
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={handleDone} style={{ padding: '7px 12px', borderRadius: 3, border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', cursor: 'pointer' }}>
              SKIP
            </button>

            {!isFirst && (
              <button onClick={() => advance(-1)} style={{ padding: '7px 12px', borderRadius: 3, border: '1px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', cursor: 'pointer' }}>
                ← BACK
              </button>
            )}

            <button
              onClick={isLast ? handleDone : () => advance(1)}
              style={{
                flex: 1, padding: '8px 14px', borderRadius: 4,
                border: `1px solid ${sectionCfg.color}`,
                background: isLast ? sectionCfg.color : `${sectionCfg.color}1a`,
                color: isLast ? '#000' : sectionCfg.color,
                fontFamily: 'var(--font-mono)', fontSize: 8,
                letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              {isLast ? 'START MAKING ✦' : 'NEXT →'}
            </button>
          </div>

          {!isFirst && !isLast && (
            <div style={{ marginTop: 9, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              ← → to navigate · click any dot to jump · Esc to close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
