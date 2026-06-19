// StemExport.js — renders each track as a separate WAV file using OfflineAudioContext.
// Self-contained: no imports from other project files. All synthesis is inline.
// Drum track IDs: KICK=1, SNARE=2, HI-HAT=3, CLAP=4.

// ── Helpers ───────────────────────────────────────────────────────────────────

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

function writeStr(v, off, str) {
  for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
}

// Copied from Bouncer.js — 16-bit PCM WAV encoder.
function encodeWAV(buffer) {
  const nc  = buffer.numberOfChannels;
  const sr  = buffer.sampleRate;
  const len = buffer.length;
  const bps = 16;
  const dataBytes = len * nc * 2;
  const ab  = new ArrayBuffer(44 + dataBytes);
  const v   = new DataView(ab);

  writeStr(v, 0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true);
  writeStr(v, 8, 'WAVE'); writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nc, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true);
  v.setUint16(34, bps, true); writeStr(v, 36, 'data');
  v.setUint32(40, dataBytes, true);

  const chs = Array.from({ length: nc }, (_, c) => buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// ── Drum synthesis (matching Bouncer.js) ─────────────────────────────────────

function kick(ctx, t, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  g.gain.setValueAtTime(2.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + 0.5);
}

function noise(ctx, dur) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function snare(ctx, t, dest) {
  const dur = 0.18;
  const ns  = ctx.createBufferSource(); ns.buffer = noise(ctx, dur);
  const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
  const g   = ctx.createGain();
  g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  ns.connect(bp); bp.connect(g); g.connect(dest); ns.start(t);

  const o = ctx.createOscillator(), og = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 200;
  og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.1);
}

function hihat(ctx, t, dest, open = false) {
  const dur = open ? 0.32 : 0.04;
  const ns  = ctx.createBufferSource(); ns.buffer = noise(ctx, dur);
  const hp  = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
  const g   = ctx.createGain();
  g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  ns.connect(hp); hp.connect(g); g.connect(dest); ns.start(t);
}

function clap(ctx, t, dest) {
  [0, 0.008, 0.018].forEach(dt => {
    const s  = t + dt;
    const ns = ctx.createBufferSource(); ns.buffer = noise(ctx, 0.1);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
    const g  = ctx.createGain();
    g.gain.setValueAtTime(0.65, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.1);
    ns.connect(bp); bp.connect(g); g.connect(dest); ns.start(s);
  });
}

// Map track.id → drum voice function.
// KICK=1, SNARE=2, HI-HAT=3, CLAP=4.
const DRUM_ID_TO_KEY = { 1: 'KICK', 2: 'SNARE', 3: 'HI-HAT', 4: 'CLAP' };

/**
 * Schedule only the drum hits that belong to the given track ID.
 * E.g. trackId=1 → only KICK steps are rendered.
 */
function scheduleDrumStem(ctx, steps, bpm, numBars, trackId, dest) {
  const drumKey = DRUM_ID_TO_KEY[trackId];
  if (!drumKey) return;

  // Find the matching step pattern — key may be 'HI-HAT', 'Hi-Hat', etc.
  const pat = (() => {
    for (const [k, v] of Object.entries(steps ?? {})) {
      if (k.toUpperCase().replace(/[\s-]/g, '') === drumKey.replace(/[\s-]/g, '')) return v;
    }
    return null;
  })();

  if (!pat?.length) return;

  const sd = (60 / bpm) / 4; // 16th-note duration in seconds
  for (let bar = 0; bar < numBars; bar++) {
    pat.forEach((on, i) => {
      if (!on) return;
      const t = bar * 16 * sd + i * sd;
      switch (trackId) {
        case 1: kick(ctx, t, dest);   break;
        case 2: snare(ctx, t, dest);  break;
        case 3: hihat(ctx, t, dest, false); break;
        case 4: clap(ctx, t, dest);   break;
      }
    });
  }
}

// ── Synth voices (matching Bouncer.js) ───────────────────────────────────────

function makeIR(ctx) {
  const len = Math.ceil(ctx.sampleRate * 1.8);
  const ir  = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  }
  return ir;
}

/**
 * Schedule only MIDI clips whose trackId matches the given trackId.
 */
function scheduleSynthStem(ctx, clips, bpm, trackId, dest, params = {}) {
  const {
    osc1Type    = 'sawtooth', osc2Type    = 'sine',
    osc1Detune  = 0,          osc2Detune  = 7,
    filterCutoff = 2000,      filterRes   = 20,
    attack  = 10,  decay   = 20,  sustain = 70,  release = 40,
    reverbMix = 20,
  } = params;

  const spb = 60 / bpm;
  const midiClips = (clips ?? []).filter(
    c => c.type === 'midi' && c.trackId === trackId && c.notes?.length,
  );
  if (!midiClips.length) return false; // nothing to render

  const conv = ctx.createConvolver(); conv.buffer = makeIR(ctx);
  const revG = ctx.createGain(); revG.gain.value = Math.max(0, reverbMix) / 120;
  conv.connect(revG); revG.connect(dest);

  midiClips.forEach(clip => {
    const cs = (clip.startBeat ?? 0) * spb;
    (clip.notes ?? []).forEach(n => {
      const t    = cs + (n.startBeat ?? 0) * spb;
      const dur  = Math.max(0.04, (n.durationBeats ?? n.duration ?? 0.5) * spb);
      const freq = midiToFreq(n.pitch ?? n.note ?? 60);

      const atk = Math.max(0.003, (attack  / 1000) * 0.4);
      const dec = Math.max(0.003, (decay   / 1000) * 0.4);
      const sus = Math.max(0.01,  sustain  / 100)   * 0.3;
      const rel = Math.max(0.02,  (release / 1000)  * 0.6);

      const o1 = ctx.createOscillator();
      o1.type = osc1Type; o1.frequency.value = freq; o1.detune.value = osc1Detune;

      const o2 = ctx.createOscillator();
      o2.type = osc2Type; o2.frequency.value = freq; o2.detune.value = osc2Detune;

      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = Math.min(filterCutoff, ctx.sampleRate / 2 - 100);
      flt.Q.value = filterRes / 10;

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.28, t + atk);
      amp.gain.linearRampToValueAtTime(sus, t + atk + dec);
      amp.gain.setValueAtTime(sus, t + dur);
      amp.gain.linearRampToValueAtTime(0, t + dur + rel);

      o1.connect(flt); o2.connect(flt);
      flt.connect(amp);
      amp.connect(dest);
      amp.connect(conv);

      const stop = t + dur + rel + 0.05;
      o1.start(t); o1.stop(stop);
      o2.start(t); o2.stop(stop);
    });
  });

  return true;
}

// ── Download helper ───────────────────────────────────────────────────────────

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Track content detection ───────────────────────────────────────────────────

const DRUM_IDS = new Set([1, 2, 3, 4]);

/**
 * Returns true if a track has any content worth exporting.
 * Drum tracks are non-empty when at least one step is active.
 * Synth tracks are non-empty when they have at least one MIDI clip with notes.
 */
function trackHasContent(track, steps, clips) {
  if (DRUM_IDS.has(track.id)) {
    const drumKey = DRUM_ID_TO_KEY[track.id];
    for (const [k, v] of Object.entries(steps ?? {})) {
      if (k.toUpperCase().replace(/[\s-]/g, '') === drumKey.replace(/[\s-]/g, '')) {
        return (v ?? []).some(Boolean);
      }
    }
    return false;
  }
  // Synth / MIDI track
  return (clips ?? []).some(
    c => c.type === 'midi' && c.trackId === track.id && c.notes?.length,
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export const StemExport = {
  /**
   * Render each non-empty, non-muted track as a separate WAV file and
   * trigger sequential downloads (one file per track, 600 ms apart).
   *
   * @param {object} state          - { bpm, tracks, steps, clips, synthParams }
   * @param {object} [options]
   * @param {number} [options.numBars=8]
   * @param {number} [options.sampleRate=44100]
   * @param {Function} [options.onProgress] - called as onProgress(completedIndex, total)
   */
  async export(state, options = {}) {
    const {
      numBars    = 8,
      sampleRate = 44100,
      onProgress,
    } = options;

    const {
      bpm         = 128,
      tracks      = [],
      steps       = {},
      clips       = [],
      synthParams = {},
    } = state;

    // Determine which tracks to export (skip muted, skip empty).
    const exportable = tracks.filter(
      t => !t.mute && trackHasContent(t, steps, clips),
    );

    const total = exportable.length;
    if (total === 0) return;

    const spBar  = (60 / bpm) * 4;
    const totalS = spBar * numBars + 3; // +3 s reverb tail

    const wavFiles = []; // { blob, name }

    for (let idx = 0; idx < total; idx++) {
      const track = exportable[idx];
      const isDrum = DRUM_IDS.has(track.id);

      // One OfflineAudioContext per stem.
      const ctx = new OfflineAudioContext(
        2,
        Math.ceil(sampleRate * totalS),
        sampleRate,
      );

      // Light compressor to match the full-mix feel.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -3;
      comp.knee.value      = 3;
      comp.ratio.value     = 20;
      comp.attack.value    = 0.001;
      comp.release.value   = 0.1;
      comp.connect(ctx.destination);

      if (isDrum) {
        scheduleDrumStem(ctx, steps, bpm, numBars, track.id, comp);
      } else {
        scheduleSynthStem(ctx, clips, bpm, track.id, comp, synthParams);
      }

      const buffer = await ctx.startRendering();
      const blob   = encodeWAV(buffer);

      // Sanitise track name for use as a filename.
      const safeName = (track.name ?? `track-${track.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      wavFiles.push({ blob, name: `stem-${safeName}.wav` });

      onProgress?.(idx + 1, total);
    }

    // Trigger downloads sequentially with a small delay so browsers don't
    // block multiple simultaneous download initiations.
    for (let i = 0; i < wavFiles.length; i++) {
      const { blob, name } = wavFiles[i];
      download(blob, name);
      if (i < wavFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
  },
};
