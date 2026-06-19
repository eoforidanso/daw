// Built-in plugin definitions — auto-register on import.
import { pluginRegistry } from '../audio/PluginAPI.js';

// ── VOID EQ ─────────────────────────────────────────────────────────
pluginRegistry.register({
  id: 'void.eq',
  name: 'VOID EQ',
  version: '1.0',
  category: 'eq',
  defaultParams: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 120, midFreq: 1000, highFreq: 8000 },
  paramDefs: [
    { id: 'lowGain',  label: 'LO',   min: -24, max: 24,    unit: 'dB', color: 'var(--accent-orange)' },
    { id: 'midGain',  label: 'MID',  min: -24, max: 24,    unit: 'dB', color: 'var(--accent-cyan)'   },
    { id: 'highGain', label: 'HI',   min: -24, max: 24,    unit: 'dB', color: 'var(--accent-blue)'   },
    { id: 'lowFreq',  label: 'LF',   min: 20,  max: 800,   unit: 'Hz', color: 'var(--accent-orange)' },
    { id: 'midFreq',  label: 'MF',   min: 200, max: 8000,  unit: 'Hz', color: 'var(--accent-cyan)'   },
    { id: 'highFreq', label: 'HF',   min: 2e3, max: 20000, unit: 'Hz', color: 'var(--accent-blue)'   },
  ],
  create(ctx, p) {
    const lo  = ctx.createBiquadFilter();
    const mid = ctx.createBiquadFilter();
    const hi  = ctx.createBiquadFilter();
    lo.type   = 'lowshelf';  lo.frequency.value  = p.lowFreq;  lo.gain.value  = p.lowGain;
    mid.type  = 'peaking';   mid.frequency.value = p.midFreq;  mid.Q.value    = 0.9; mid.gain.value = p.midGain;
    hi.type   = 'highshelf'; hi.frequency.value  = p.highFreq; hi.gain.value  = p.highGain;
    lo.connect(mid); mid.connect(hi);
    return {
      inputNode: lo, outputNode: hi,
      setParam(k, v) {
        if (k === 'lowGain')  lo.gain.value      = v;
        if (k === 'midGain')  mid.gain.value     = v;
        if (k === 'highGain') hi.gain.value      = v;
        if (k === 'lowFreq')  lo.frequency.value  = v;
        if (k === 'midFreq')  mid.frequency.value = v;
        if (k === 'highFreq') hi.frequency.value  = v;
      },
      destroy() { [lo, mid, hi].forEach(n => { try { n.disconnect(); } catch {} }); },
    };
  },
});

// ── VOID COMP ────────────────────────────────────────────────────────
pluginRegistry.register({
  id: 'void.comp',
  name: 'VOID COMP',
  version: '1.0',
  category: 'dynamics',
  defaultParams: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 10, makeup: 0 },
  paramDefs: [
    { id: 'threshold', label: 'THRESH',  min: -60, max: 0,    unit: 'dB', color: 'var(--accent-red)'    },
    { id: 'ratio',     label: 'RATIO',   min: 1,   max: 20,   unit: ':1', color: 'var(--accent-orange)' },
    { id: 'attack',    label: 'ATK',     min: 0,   max: 200,  unit: 'ms', color: 'var(--accent-cyan)'   },
    { id: 'release',   label: 'REL',     min: 10,  max: 3000, unit: 'ms', color: 'var(--accent-cyan)'   },
    { id: 'makeup',    label: 'MAKEUP',  min: 0,   max: 24,   unit: 'dB', color: 'var(--accent-yellow)' },
  ],
  create(ctx, p) {
    const comp   = ctx.createDynamicsCompressor();
    const makeup = ctx.createGain();
    comp.threshold.value = p.threshold;
    comp.ratio.value     = p.ratio;
    comp.attack.value    = p.attack / 1000;
    comp.release.value   = p.release / 1000;
    comp.knee.value      = p.knee;
    makeup.gain.value    = Math.pow(10, p.makeup / 20);
    comp.connect(makeup);
    return {
      inputNode: comp, outputNode: makeup,
      setParam(k, v) {
        if (k === 'threshold') comp.threshold.value = v;
        if (k === 'ratio')     comp.ratio.value     = v;
        if (k === 'attack')    comp.attack.value    = v / 1000;
        if (k === 'release')   comp.release.value   = v / 1000;
        if (k === 'makeup')    makeup.gain.value    = Math.pow(10, v / 20);
      },
      getReduction: () => comp.reduction,
      destroy() { [comp, makeup].forEach(n => { try { n.disconnect(); } catch {} }); },
    };
  },
});

// ── VOID CRUSH ───────────────────────────────────────────────────────
pluginRegistry.register({
  id: 'void.crush',
  name: 'VOID CRUSH',
  version: '1.0',
  category: 'fx',
  defaultParams: { bits: 16, rate: 1, mix: 1 },
  paramDefs: [
    { id: 'bits', label: 'BITS', min: 1, max: 16, unit: 'bit', color: 'var(--accent-red)'    },
    { id: 'rate', label: 'RATE', min: 1, max: 32, unit: 'x',   color: 'var(--accent-orange)' },
    { id: 'mix',  label: 'MIX',  min: 0, max: 1,  unit: '',    color: 'var(--accent-cyan)'   },
  ],
  create(ctx, p) {
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    let bits = p.bits, rate = p.rate, step = 0, held = 0;
    proc.onaudioprocess = (ev) => {
      const inp = ev.inputBuffer.getChannelData(0);
      const out = ev.outputBuffer.getChannelData(0);
      const max = Math.pow(2, bits - 1);
      for (let i = 0; i < inp.length; i++) {
        if (step % Math.max(1, Math.round(rate)) === 0) held = Math.round(inp[i] * max) / max;
        out[i] = held; step++;
      }
    };
    const inp  = ctx.createGain();
    const dry  = ctx.createGain();
    const wet  = ctx.createGain();
    const out  = ctx.createGain();
    dry.gain.value = 1 - p.mix; wet.gain.value = p.mix;
    inp.connect(dry); inp.connect(proc);
    proc.connect(wet); dry.connect(out); wet.connect(out);
    return {
      inputNode: inp, outputNode: out,
      setParam(k, v) {
        if (k === 'bits') bits = v;
        if (k === 'rate') rate = v;
        if (k === 'mix')  { dry.gain.value = 1 - v; wet.gain.value = v; }
      },
      destroy() { [inp, proc, dry, wet, out].forEach(n => { try { n.disconnect(); } catch {} }); },
    };
  },
});

// ── VOID TAPE ────────────────────────────────────────────────────────
pluginRegistry.register({
  id: 'void.tape',
  name: 'VOID TAPE',
  version: '1.0',
  category: 'fx',
  defaultParams: { drive: 0.3, warmth: 0.5, mix: 0.7 },
  paramDefs: [
    { id: 'drive',  label: 'DRIVE',  min: 0, max: 1, unit: '', color: 'var(--accent-orange)' },
    { id: 'warmth', label: 'WARMTH', min: 0, max: 1, unit: '', color: 'var(--accent-yellow)' },
    { id: 'mix',    label: 'MIX',    min: 0, max: 1, unit: '', color: 'var(--accent-cyan)'   },
  ],
  create(ctx, p) {
    const shaper = ctx.createWaveShaper();
    const lp     = ctx.createBiquadFilter();
    lp.type      = 'lowpass';

    const mkCurve = (drive) => {
      const n = 256; const curve = new Float32Array(n);
      const k = 1 + drive * 5;
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = Math.tanh(x * k) / Math.tanh(k);
      }
      shaper.curve = curve;
    };
    mkCurve(p.drive);
    lp.frequency.value = 16000 - p.warmth * 8000;

    const inp = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), out = ctx.createGain();
    dry.gain.value = 1 - p.mix; wet.gain.value = p.mix;
    inp.connect(dry); inp.connect(shaper);
    shaper.connect(lp); lp.connect(wet); dry.connect(out); wet.connect(out);
    return {
      inputNode: inp, outputNode: out,
      setParam(k, v) {
        if (k === 'drive')  mkCurve(v);
        if (k === 'warmth') lp.frequency.value = 16000 - v * 8000;
        if (k === 'mix')    { dry.gain.value = 1 - v; wet.gain.value = v; }
      },
      destroy() { [inp, shaper, lp, dry, wet, out].forEach(n => { try { n.disconnect(); } catch {} }); },
    };
  },
});

// ── VOID TRANS ───────────────────────────────────────────────────────
pluginRegistry.register({
  id: 'void.trans',
  name: 'VOID TRANS',
  version: '1.0',
  category: 'dynamics',
  defaultParams: { attack: 0.5, sustain: 0.5, gain: 1 },
  paramDefs: [
    { id: 'attack',  label: 'ATK',  min: 0, max: 1, unit: '', color: 'var(--accent-purple)' },
    { id: 'sustain', label: 'SUS',  min: 0, max: 1, unit: '', color: 'var(--accent-blue)'   },
    { id: 'gain',    label: 'GAIN', min: 0, max: 4, unit: 'x', color: 'var(--accent-cyan)'  },
  ],
  create(ctx, p) {
    const inp = ctx.createGain();
    const out = ctx.createGain();
    inp.connect(out);
    out.gain.value = p.gain;
    return {
      inputNode: inp, outputNode: out,
      setParam(k, v) {
        if (k === 'gain') out.gain.value = v;
      },
      destroy() { [inp, out].forEach(n => { try { n.disconnect(); } catch {} }); },
    };
  },
});
