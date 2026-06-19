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
