// Factory functions for Web Audio API insert effects.
// Each returns an object with { inputNode, outputNode, params, update(key, val) }.

export function createReverb(ctx, { mix = 0.3, size = 0.6 } = {}) {
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const conv = ctx.createConvolver();
  const output = ctx.createGain();

  const buildIR = (s) => {
    const decay = 0.4 + s * 4.5;
    const len = Math.floor(ctx.sampleRate * decay);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t * (2 + (1 - s) * 6));
      }
    }
    return ir;
  };

  conv.buffer = buildIR(size);
  dry.gain.value = 1 - mix;
  wet.gain.value = mix;
  dry.connect(output);
  conv.connect(wet);
  wet.connect(output);

  // The "input" splits into dry and conv in parallel
  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(conv);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
      if (key === 'size') { conv.buffer = buildIR(val); }
    },
  };
}

export function createDelay(ctx, { time = 0.375, feedback = 0.35, mix = 0.25 } = {}) {
  const delay = ctx.createDelay(4);
  delay.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  // Feedback loop
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(delay);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'time') delay.delayTime.value = val;
      if (key === 'feedback') fb.gain.value = Math.min(0.95, val);
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
  };
}

export function createDistortion(ctx, { drive = 0, mix = 0.8 } = {}) {
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';
  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  const makeCurve = (amount) => {
    const n = 512, curve = new Float32Array(n);
    const k = amount === 0 ? 0.001 : amount * 600;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };
  shaper.curve = makeCurve(drive);
  shaper.connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(shaper);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'drive') shaper.curve = makeCurve(val);
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
  };
}

export function createChorus(ctx, { rate = 1.5, depth = 0.003, mix = 0.3 } = {}) {
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const d = ctx.createDelay(0.05);
  d.delayTime.value = 0.02;
  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  lfo.type = 'sine';
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfoGain.connect(d.delayTime);
  lfo.start();

  d.connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(d);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'rate') lfo.frequency.value = val;
      if (key === 'depth') lfoGain.gain.value = val * 0.005;
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
    destroy() { try { lfo.stop(); } catch {} },
  };
}

export function createPhaser(ctx, { rate = 0.5, depth = 0.5, mix = 0.5 } = {}) {
  // 4-stage allpass chain; LFO sweeps frequencies 200-2000 Hz
  const STAGES = 4;
  const allpasses = Array.from({ length: STAGES }, () => ctx.createBiquadFilter());
  allpasses.forEach((ap) => {
    ap.type = 'allpass';
    ap.frequency.value = 1000;
    ap.Q.value = 0.5;
  });

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  // depth 0-1 maps to ±900 Hz swing around 1100 Hz centre → 200-2000 Hz range
  lfoGain.gain.value = depth * 900;
  lfo.connect(lfoGain);
  allpasses.forEach((ap) => lfoGain.connect(ap.frequency));
  // Static centre frequency
  allpasses.forEach((ap) => { ap.frequency.value = 1100; });
  lfo.start();

  // Chain allpasses in series
  for (let i = 0; i < STAGES - 1; i++) allpasses[i].connect(allpasses[i + 1]);

  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  allpasses[STAGES - 1].connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(allpasses[0]);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'rate') lfo.frequency.value = val;
      if (key === 'depth') lfoGain.gain.value = val * 900;
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
    destroy() { try { lfo.stop(); } catch {} },
  };
}

export function createFlanger(ctx, { rate = 0.25, depth = 0.4, mix = 0.5 } = {}) {
  // Short delay 1-8 ms modulated by LFO, with feedback
  const BASE_DELAY = 0.004;   // 4 ms centre
  const MAX_SWING  = 0.003;   // ±3 ms → 1-7 ms range

  const delay = ctx.createDelay(0.02);
  delay.delayTime.value = BASE_DELAY;

  const fb = ctx.createGain();
  fb.gain.value = 0.5;

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth * MAX_SWING;
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  lfo.start();

  // Feedback loop
  delay.connect(fb);
  fb.connect(delay);

  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  delay.connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(delay);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'rate') lfo.frequency.value = val;
      if (key === 'depth') lfoGain.gain.value = val * MAX_SWING;
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
    destroy() { try { lfo.stop(); } catch {} },
  };
}

export function createBitcrusher(ctx, { bits = 8, mix = 0.8 } = {}) {
  const shaper = ctx.createWaveShaper();
  shaper.oversample = 'none';

  const makeCurve = (b) => {
    const n = 4096;
    const curve = new Float32Array(n);
    const steps = Math.pow(2, Math.max(1, Math.min(16, b)));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  };
  shaper.curve = makeCurve(bits);

  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  shaper.connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(shaper);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'bits') shaper.curve = makeCurve(val);
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
  };
}

export function createTapeSaturation(ctx, { drive = 0.3, warmth = 0.5, mix = 0.7 } = {}) {
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';

  const lowshelf = ctx.createBiquadFilter();
  lowshelf.type = 'lowshelf';
  lowshelf.frequency.value = 200;
  lowshelf.gain.value = warmth * 6;   // 0-6 dB

  const makeCurve = (d) => {
    const n = 512;
    const curve = new Float32Array(n);
    const denom = 1 + d * 0.5;
    const scale = 1 + d * 5;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * scale) / denom;
    }
    return curve;
  };
  shaper.curve = makeCurve(drive);

  // Signal path (wet): input → lowshelf → shaper
  lowshelf.connect(shaper);

  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  const output = ctx.createGain();

  shaper.connect(wet);
  wet.connect(output);
  dry.connect(output);

  const inputNode = ctx.createGain();
  inputNode.connect(dry);
  inputNode.connect(lowshelf);

  return {
    inputNode, outputNode: output,
    update(key, val) {
      if (key === 'drive') shaper.curve = makeCurve(val);
      if (key === 'warmth') lowshelf.gain.value = val * 6;
      if (key === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
    },
  };
}
