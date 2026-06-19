import { useState, useRef, useEffect, useCallback } from 'react';

// Context-aware response generator
function generateResponse(message, context) {
  const msg   = message.toLowerCase();
  const bpm   = context.bpm ?? 128;
  const names = (context.tracks ?? []).map(t => t.name);
  const tc    = names.length;
  const genre = inferGenre(context);

  if (msg.includes('mix') || msg.includes('analysi') || msg.includes('analyze')) {
    return analyzeMix(context, genre);
  }
  if (msg.includes('arrange') || msg.includes('structure') || msg.includes('section')) {
    return suggestArrangement(genre, bpm, tc);
  }
  if (msg.includes('master') || msg.includes('mastering')) {
    return suggestMasterChain(genre, bpm);
  }
  if (msg.includes('melody') || msg.includes('lead') || msg.includes('riff')) {
    return suggestMelody(genre, bpm);
  }
  if (msg.includes('drum') || msg.includes('pattern') || msg.includes('beat') || msg.includes('kick') || msg.includes('snare')) {
    return suggestDrums(genre, bpm, context.steps);
  }
  if (msg.includes('bpm') || msg.includes('tempo')) {
    return analyzeTempo(bpm, genre);
  }
  if (msg.includes('eq') || msg.includes('equaliz')) {
    return suggestEQ(context, genre);
  }
  if (msg.includes('compres')) {
    return suggestCompression(context, genre);
  }
  if (msg.includes('reverb') || msg.includes('space') || msg.includes('room')) {
    return suggestReverb(genre);
  }
  if (msg.includes('bass')) {
    return suggestBass(genre, bpm);
  }
  if (msg.includes('track') || msg.includes('layer') || msg.includes('instrument')) {
    return reviewTracks(context, genre);
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return greeting(context, genre);
  }
  return generalAdvice(context, genre);
}

function inferGenre({ bpm, tracks, steps }) {
  const b = bpm ?? 128;
  const names = (tracks ?? []).map(t => t.name.toLowerCase()).join(' ');
  if (names.includes('podcast') || names.includes('host') || names.includes('guest')) return 'podcast';
  if (b >= 100 && b <= 115 && (names.includes('afro') || names.includes('percussion'))) return 'afrobeats';
  if (b >= 70 && b <= 85) return 'lo-fi';
  if (b >= 124 && b <= 145) return 'edm';
  if (b >= 85 && b <= 100) return 'hip-hop';
  if (b >= 120 && b <= 135 && names.includes('guitar')) return 'pop';
  return 'general';
}

function greeting({ tracks, bpm }, genre) {
  const tc = (tracks ?? []).length;
  if (!tc) return `Hey! I'm your AI project assistant. I can see you have an empty project at ${bpm} BPM. Start by picking a template or adding tracks, then ask me anything about mixing, arrangement, sound design, or mastering.`;
  return `Hey! Looking at your project — ${tc} tracks at ${bpm} BPM, feels like ${genre === 'general' ? 'an eclectic vibe' : `a ${genre} vibe`}. What are you working on? I can help with mixing, arrangement, sound design, or creative ideas.`;
}

function analyzeMix({ tracks, bpm, steps }, genre) {
  const tc = (tracks ?? []).length;
  if (!tc) return "No tracks to analyze yet. Add some tracks first and I'll give you a full mix breakdown.";

  const hasDrum  = tracks.some(t => t.type === 'drum' || t.name.toLowerCase().includes('kick') || t.name.toLowerCase().includes('drum'));
  const hasBass  = tracks.some(t => t.name.toLowerCase().includes('bass'));
  const hasLead  = tracks.some(t => t.name.toLowerCase().includes('lead') || t.name.toLowerCase().includes('synth') || t.name.toLowerCase().includes('melody'));
  const hasPad   = tracks.some(t => t.name.toLowerCase().includes('pad') || t.name.toLowerCase().includes('chord'));

  const missing = [];
  if (!hasDrum) missing.push('a rhythm element');
  if (!hasBass) missing.push('a bass layer');
  if (!hasLead) missing.push('a lead/melody');

  const lines = [`**Mix Analysis — ${tc} tracks @ ${bpm} BPM**\n`];
  if (missing.length) lines.push(`Missing: ${missing.join(', ')}. These are foundational for ${genre === 'general' ? 'most genres' : genre}.`);
  if (hasDrum && hasBass) lines.push('Good low-end foundation. Consider sidechaining your bass to the kick for clarity — use a fast attack (1–2ms) and medium release (80–120ms).');
  if (hasLead && hasPad) lines.push('Lead + pad combo: high-pass the pad around 200Hz to give the lead space. Keep the pad in the mid-field, push the lead center.');
  lines.push(`Headroom: aim for -6 dBFS peaks on the mix bus, leaving space for the mastering chain.`);
  if (genre === 'edm')       lines.push('EDM tip: the kick should be the loudest element at around -6 dBFS. Build the mix around that.');
  if (genre === 'lo-fi')     lines.push('Lo-fi tip: slight vinyl crackle, gentle tape saturation, and a soft high-frequency rolloff above 12kHz gives the signature warmth.');
  if (genre === 'afrobeats') lines.push('Afrobeats tip: keep the percussion wide and the vocals upfront. The bass groove drives everything — use subtle chorus on it.');
  return lines.join('\n');
}

function suggestArrangement(genre, bpm, tc) {
  const bar = Math.round(60000 / bpm * 4 / 1000);
  const structures = {
    edm:       '8-bar intro → 16-bar build → 4-bar drop → 32-bar drop → 8-bar break → 16-bar build → 32-bar final drop → 8-bar outro',
    'lo-fi':   'Intro (4 bars) → Main loop A (8) → Variation B (8) → Bridge (4) → Main loop A (8) → Outro (4)',
    afrobeats: 'Intro (4) → Verse 1 (8) → Pre-chorus (4) → Chorus (8) → Verse 2 (8) → Chorus (8) → Bridge (4) → Final chorus (8) → Outro (4)',
    podcast:   'Cold open (30s) → Intro music sting (5s) → Content block 1 → Music bed at -20 dBFS → Content block 2 → Outro (15s)',
    general:   'Intro (4) → Verse (8) → Chorus (8) → Verse 2 (8) → Chorus (8) → Bridge (4) → Final chorus (8) → Outro (4)',
  };
  const struct = structures[genre] ?? structures.general;
  const beatDur = bar;
  return `**Arrangement for ${genre} @ ${bpm} BPM** (1 bar ≈ ${beatDur}s)\n\n${struct}\n\nWith ${tc} tracks, layer them progressively — strip back to 2–3 elements in the intro/outro, build to full arrangement in the main sections. Automation on volume and filter cutoff works better than hard cuts.`;
}

function suggestMasterChain(genre, bpm) {
  const chains = {
    edm:       '1. Surgical EQ (cut 200–400Hz mud) → 2. Multiband comp (glue low-mids) → 3. Stereo imager → 4. Limiter (ceiling -0.3 dBFS, target -7 to -8 LUFS)',
    'lo-fi':   '1. Tape saturation (gentle) → 2. Vintage EQ (+2dB @ 100Hz, -3dB @ 8kHz) → 3. Optical comp (slow) → 4. Limiter (-0.5 dBFS ceiling, -14 LUFS)',
    afrobeats: '1. EQ (+2dB @ 60Hz, subtle 5kHz air) → 2. Glue comp (2:1, slow attack) → 3. Stereo width → 4. Limiter (-9 to -10 LUFS)',
    podcast:   '1. High-pass @ 80Hz → 2. De-esser → 3. Comp (3:1, fast attack) → 4. Loudness normalization (-16 LUFS for podcasts)',
    general:   '1. Linear phase EQ → 2. Multiband comp → 3. Stereo imager → 4. Limiter (-0.3 dBFS ceiling, -10 LUFS)',
  };
  const chain = chains[genre] ?? chains.general;
  return `**Mastering Chain for ${genre}**\n\n${chain}\n\nProcess in this order — EQ before compression so you're not compressing frequencies you'll cut anyway. Use true peak limiting, not just sample peak.`;
}

function suggestMelody(genre, bpm) {
  const ideas = {
    edm:       `Try a 4-bar motif: quarter notes on 1 and 3, a 16th-note run on bar 2, silence on bar 4 for tension. Keep it in a minor pentatonic — it works over most EDM chord progressions. Play the root on the downbeat.`,
    'lo-fi':   `Lo-fi melodies breathe. Try a 2-bar phrase with lots of space — 3–4 notes max. Start on the 3rd of the scale, resolve to the root. Add slight swing and humanize timing by ±10ms. A soft Rhodes or vibraphone patch works perfectly.`,
    afrobeats: `Afro melodies are often call-and-response. 4-bar phrase: bars 1–2 as the call (ascending), bars 3–4 as the response (descending to rest). Use the major pentatonic + ♭7 for that West African feel. Syncopate on the "and" of beat 2.`,
    general:   `Start with a 4-note motif. Play it at different rhythmic positions to create variation. Invert it (flip high/low) for the B section. Land on the root or 5th at phrase endings for resolution.`,
  };
  return `**Melody Idea for ${genre} @ ${bpm} BPM**\n\n${ideas[genre] ?? ideas.general}\n\nRecord it in the Piano Roll and try different velocity dynamics — quieter notes on the upbeats add groove.`;
}

function suggestDrums(genre, bpm, steps) {
  const hasSteps = steps && Object.values(steps).some(s => s?.some(Boolean));
  const base = hasSteps ? 'I can see you have a drum pattern loaded. ' : '';
  const tips = {
    edm:       `${base}EDM drums: four-on-the-floor kick, open hi-hat on the "and" of 2 and 4, clap/snare on 2 and 4. Add ghost snares at 1/16th velocity for texture. Try cutting all hats in the drop buildup for tension.`,
    'lo-fi':   `${base}Lo-fi drums: swing the hi-hats to ~55–60% (almost triplet feel). Kick on 1 and the "and" of 3. Snare on 2 and 4 with brushed texture. Keep velocity variation high — 40–80 range. Avoid quantize, or humanize after.`,
    afrobeats: `${base}Afrobeats: the clave pattern is your foundation. Layer kick, snare, shaker, and agogo bell. Kick heavy on 1, lighter ghost on the "and" of 3. The shaker runs 8th notes throughout. Keep it syncopated.`,
    general:   `${base}Start with kick on 1 and 3, snare on 2 and 4, 8th-note hi-hats. Once the foundation works, add a ghost note one 16th before each snare, and open the hi-hat on the "and" of 4 in bar 2 and 4 for movement.`,
  };
  return tips[genre] ?? tips.general;
}

function analyzeTempo(bpm, genre) {
  let feel = '';
  if (bpm < 70)        feel = 'very slow — great for ambient or experimental music';
  else if (bpm < 85)   feel = 'slow — perfect for lo-fi, soul, and downtempo';
  else if (bpm < 100)  feel = 'mid-tempo — hip-hop and R&B territory';
  else if (bpm < 115)  feel = 'groovy — afrobeats, dancehall, or mid-tempo house';
  else if (bpm < 125)  feel = 'dance-ready — most pop and house lives here';
  else if (bpm < 140)  feel = 'energetic EDM and techno range';
  else if (bpm < 160)  feel = 'fast — trance, hardcore, or drum and bass';
  else                 feel = 'very fast — DnB, footwork, or speedcore territory';

  return `**${bpm} BPM Analysis**\n\n${bpm} BPM is ${feel}. ${genre !== 'general' ? `This fits well for ${genre}.` : ''}\n\nHalf-time feel: ${Math.round(bpm / 2)} BPM — useful for slow sections or breakdowns.\nDouble-time feel: ${bpm * 2} BPM — adds energy in drops or bridges.\nDelay sync at 1/4 note: ${Math.round(60000 / bpm)}ms · 1/8 note: ${Math.round(30000 / bpm)}ms`;
}

function suggestEQ(context, genre) {
  const freq = {
    edm:       '• Kick: boost 60Hz (punch), cut 250Hz (mud), boost 3–5kHz (click)\n• Bass: high-pass at 40Hz, boost 80–100Hz, notch 300Hz\n• Synths: high-pass at 120Hz, boost 2–4kHz for presence',
    'lo-fi':   '• Drums: gentle rolloff above 10kHz for warmth\n• Bass: boost 80Hz, gentle cut 400Hz\n• Piano/Rhodes: cut below 200Hz slightly, subtle 3kHz air',
    afrobeats: '• Kick: boost 60–80Hz, cut 250Hz, boost 4kHz\n• Shakers/percussion: high-pass 800Hz, boost 8–10kHz for shimmer\n• Vocals: cut 300Hz, boost 3kHz presence, air at 12kHz',
    general:   '• Sub bass: shelve 60Hz\n• Kick/bass: cut one at 80Hz to give the other room (sidechain EQ)\n• Mids: cut 300–400Hz on most elements to reduce "boxiness"\n• Highs: gentle air boost at 10–12kHz on lead elements',
  };
  return `**EQ Guidelines for ${genre}**\n\n${freq[genre] ?? freq.general}\n\nAlways cut before boosting. Use your ears — these are starting points, not rules.`;
}

function suggestCompression({ tracks }, genre) {
  const settings = {
    edm:       'Kick: 4:1 ratio, 1ms attack, 80ms release. Bass: 3:1, 10ms attack, auto release. Mix bus: 2:1, slow attack (20ms), fast release (50ms).',
    'lo-fi':   'Optical-style comp on everything — slow attack (30ms), slow release (150ms), 2:1 ratio. This gives the "breathing" lo-fi character. Heavy GR (8–10dB) for that squashed vintage sound.',
    afrobeats: 'Percussion: fast attack (1ms), fast release (30ms), 6:1 for tight control. Vocals: 3:1, 8ms attack, 100ms release, aim for 4–6dB GR. Glue bus comp: 2:1, 20ms attack.',
    general:   'Vocals: 3:1 ratio, 5–10ms attack, 100ms release, aim for 4–6dB gain reduction. Drums: fast attack to tighten transients. Mix bus: 2:1 glue comp, slow attack to preserve dynamics.',
  };
  return `**Compression for ${genre}**\n\n${settings[genre] ?? settings.general}\n\nThumb rule: attack controls punch (longer = more punch through), release controls groove (match to BPM).`;
}

function suggestReverb(genre) {
  const settings = {
    edm:       'Pads: large hall (4–6s decay), pre-delay 40ms. Synths: plate reverb (1.2s), 100% wet on aux. Kick: NO reverb — keep it dry and punchy.',
    'lo-fi':   'Room reverb on everything (short, 0.5–1s). Tape echo (dotted 8th note delay) on the melody. A little reverb on the drums gives that bedroom-recording feel.',
    afrobeats: 'Vocals: short room (0.4s), subtle pre-delay (20ms). Percussion: tight room (0.3s). Avoid over-reverbing — keep the groove dry and tight.',
    general:   'Lead vocals: room reverb (0.8–1.2s) + short delay (1/8 note). Pads: hall (2–3s). Drums: subtle room on snare only. Send to a single stereo reverb bus for consistency.',
  };
  return `**Reverb & Space for ${genre}**\n\n${settings[genre] ?? settings.general}\n\nRule: use reverb sparingly on bass frequencies — it muddies the low end. Use a shelf or HPF on your reverb return around 200Hz.`;
}

function suggestBass(genre, bpm) {
  const tips = {
    edm:       `Sub bass for EDM: keep below 150Hz for the sub, add a mid-bass layer (150–400Hz) for speaker translation. Use LFO to modulate the filter cutoff in sync with the beat (1/4 or 1/2 note). Sidechain to kick — 4:1, fast attack, medium release.`,
    'lo-fi':   `Lo-fi bass: Rhodes-style electric bass or muffled acoustic bass. Keep it in the 60–200Hz range with a soft high-end rolloff. A light tube saturation plugin adds warmth. Play it slightly behind the beat for that laid-back feel.`,
    afrobeats: `Afrobeats bass is melodic and syncopated. The bassline often carries the groove more than the drums. Try a guitar bass tone or synth bass with slight chorus. Emphasize the "and" of beats 2 and 4.`,
    general:   `A good bass sits in 60–200Hz (sub below 80Hz, mid-bass above). Layer a sine wave sub with a slightly distorted mid-bass for translation across speakers. Don't quantize fully — 10–15ms humanization adds groove.`,
  };
  return `**Bass Design for ${genre} @ ${bpm} BPM**\n\n${tips[genre] ?? tips.general}`;
}

function reviewTracks({ tracks }, genre) {
  const tc = (tracks ?? []).length;
  if (!tc) return 'No tracks to review yet. Add some tracks and I can give specific advice on each one.';
  const names = tracks.map(t => `• ${t.name} (${t.type ?? 'audio'})`).join('\n');
  return `**Your ${tc} Tracks**\n\n${names}\n\nFor ${genre === 'general' ? 'this project' : `${genre}`}, a good arrangement usually has:\n• 1 kick, 1 snare, 2–3 percussion layers\n• 1 sub bass + optional mid-bass layer\n• 1–2 harmonic elements (pad, chord, guitar)\n• 1 lead melody\n• 1 effects/atmo track\n\nYou're ${tc > 6 ? 'well-stocked' : 'a bit lean'} on layers. ${tc < 4 ? 'Consider adding more texture.' : 'Good foundation to work with.'}`;
}

function generalAdvice({ tracks, bpm }, genre) {
  const tips = [
    `At ${bpm} BPM in ${genre === 'general' ? 'your current project' : genre}, try working in short 2-bar loops until the core groove clicks — then extend. It's easier to scale up from a tight loop than to fix a messy 16-bar section.`,
    `A good mix starts before you mix: commit early. Bounce synths to audio, freeze CPU-heavy tracks. This forces decisions and keeps your signal chain cleaner.`,
    `Reference tracks are your best tool. Load a commercial ${genre === 'general' ? 'track you love' : `${genre} track`} into an extra track, match loudness (-14 LUFS), and A/B constantly. Don't trust your ears in isolation.`,
    `Less is more. Mute 2–3 tracks and see if the mix actually improves. If it does, those tracks were adding clutter, not character.`,
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

const QUICK_ACTIONS = [
  { label: 'ANALYZE MIX',     msg: 'Analyze my mix and tell me what to improve' },
  { label: 'ARRANGEMENT',     msg: 'Suggest an arrangement structure for my project' },
  { label: 'MASTER CHAIN',    msg: 'What mastering chain should I use?' },
  { label: 'MELODY IDEA',     msg: 'Give me a melody idea for this project' },
  { label: 'DRUM TIPS',       msg: 'How should I approach my drum pattern?' },
  { label: 'EQ GUIDE',        msg: 'Give me EQ guidelines for this genre' },
];

export default function AIAssistant({ tracks, bpm, steps, clips }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hey, I'm your AI project assistant. Ask me anything about mixing, arrangement, sound design, mastering, or creative direction. I have context on your current project.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const endRef                  = useRef(null);

  const context = { tracks, bpm, steps, clips };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback((text) => {
    const userMsg = { role: 'user', text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulate streaming delay proportional to response length
    const response = generateResponse(text, context);
    const delay = 600 + Math.min(response.length * 1.5, 2000);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: response, ts: Date.now() }]);
      setTyping(false);
    }, delay);
  }, [context]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !typing) sendMessage(input.trim());
    }
  };

  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, (_, t) => `<strong>${t}</strong>`);
      return (
        <div key={i} style={{ marginBottom: line === '' ? 6 : 2 }}
          dangerouslySetInnerHTML={{ __html: bold || '&nbsp;' }}
        />
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-void)' }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border-faint)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-purple)', boxShadow: '0 0 6px var(--accent-purple)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-secondary)' }}>
          AI PROJECT ASSISTANT
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          {(tracks ?? []).length} tracks · {bpm} BPM
        </span>
      </div>

      {/* Quick actions */}
      <div style={{
        display: 'flex', gap: 5, padding: '7px 12px', overflowX: 'auto',
        borderBottom: '1px solid var(--border-faint)', flexShrink: 0,
      }}>
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => !typing && sendMessage(a.msg)}
            disabled={typing}
            style={{
              padding: '3px 9px', borderRadius: 2, flexShrink: 0,
              border: '1px solid var(--border-default)', background: 'var(--bg-element)',
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 6,
              letterSpacing: '0.1em', cursor: typing ? 'default' : 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.1s',
              opacity: typing ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!typing) { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--accent-purple)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: 14,
            display: 'flex',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            gap: 8, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11, flexShrink: 0,
              background: m.role === 'user' ? 'rgba(0,212,180,0.15)' : 'rgba(155,114,255,0.15)',
              border: `1px solid ${m.role === 'user' ? 'var(--accent-cyan)' : 'var(--accent-purple)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
              color: m.role === 'user' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
            }}>
              {m.role === 'user' ? 'ME' : 'AI'}
            </div>
            <div style={{
              maxWidth: '78%',
              background: m.role === 'user' ? 'rgba(0,212,180,0.06)' : 'var(--bg-element)',
              border: `1px solid ${m.role === 'user' ? 'rgba(0,212,180,0.2)' : 'var(--border-faint)'}`,
              borderRadius: m.role === 'user' ? '8px 2px 8px 8px' : '2px 8px 8px 8px',
              padding: '8px 12px',
              fontFamily: m.role === 'assistant' ? 'var(--font-mono)' : 'var(--font-sans)',
              fontSize: m.role === 'assistant' ? 8 : 10,
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              letterSpacing: m.role === 'assistant' ? '0.04em' : '0',
            }}>
              {renderText(m.text)}
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11, flexShrink: 0,
              background: 'rgba(155,114,255,0.15)', border: '1px solid var(--accent-purple)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-purple)',
            }}>AI</div>
            <div style={{
              background: 'var(--bg-element)', border: '1px solid var(--border-faint)',
              borderRadius: '2px 8px 8px 8px', padding: '10px 16px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--accent-purple)',
                  animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                  opacity: 0.6,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border-faint)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about mixing, arrangement, sound design…"
          rows={2}
          style={{
            flex: 1, resize: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 8,
            background: 'var(--bg-element)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', borderRadius: 3, padding: '7px 10px',
            outline: 'none', letterSpacing: '0.04em', lineHeight: 1.6,
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent-purple)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
        />
        <button
          onClick={() => input.trim() && !typing && sendMessage(input.trim())}
          disabled={!input.trim() || typing}
          style={{
            width: 34, borderRadius: 3, alignSelf: 'stretch',
            border: '1px solid var(--accent-purple)',
            background: input.trim() && !typing ? 'rgba(155,114,255,0.15)' : 'none',
            color: input.trim() && !typing ? 'var(--accent-purple)' : 'var(--text-muted)',
            cursor: input.trim() && !typing ? 'pointer' : 'default',
            fontSize: 16, transition: 'all 0.1s',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
