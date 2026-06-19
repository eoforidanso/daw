import { TrackBus } from './TrackBus.js';

class AudioEngine {
  constructor() {
    this._ctx = null;
    this.masterGain = null;
    this.masterLimiter = null;
    this.masterAnalyser = null;
    this.trackBuses = new Map();
    this._transportStart = null;
    this._startBeat = 0;
    this._bpm = 120;
  }

  get ctx() {
    if (!this._ctx) this._boot();
    return this._ctx;
  }

  _boot() {
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this._ctx.createGain();
    this.masterGain.gain.value = 0.85;

    // User-controllable master compressor
    this.masterCompressor = this._ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -18;
    this.masterCompressor.knee.value = 8;
    this.masterCompressor.ratio.value = 4;
    this.masterCompressor.attack.value = 0.01;
    this.masterCompressor.release.value = 0.25;

    // Brick-wall limiter on master
    this.masterLimiter = this._ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1;
    this.masterLimiter.knee.value = 0;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.001;
    this.masterLimiter.release.value = 0.05;

    this.masterAnalyser = this._ctx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    // chain: masterGain → masterCompressor → masterLimiter → masterAnalyser → destination
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this._ctx.destination);

    // ── Send/return buses ──────────────────────────────────────────
    // Tracks can send to FX A or FX B; returns go into masterGain
    this.sendReturnA = this._ctx.createGain(); // e.g. reverb send
    this.sendReturnB = this._ctx.createGain(); // e.g. delay send
    this.sendReturnA.gain.value = 1;
    this.sendReturnB.gain.value = 1;
    this.sendReturnA.connect(this.masterGain);
    this.sendReturnB.connect(this.masterGain);

    // ── LUFS estimation (moving RMS over 400ms window) ────────────
    this._lufsBuffer = [];
    this._lufsMs = 400;
  }

  resume() {
    const c = this.ctx;
    if (c.state === 'suspended') c.resume();
    return c;
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v / 100;
  }

  setMasterComp({ threshold, ratio, attack, release, knee } = {}) {
    const c = this.masterCompressor;
    if (!c) return;
    if (threshold !== undefined) c.threshold.value = threshold;
    if (ratio     !== undefined) c.ratio.value     = ratio;
    if (attack    !== undefined) c.attack.value    = attack;
    if (release   !== undefined) c.release.value   = release;
    if (knee      !== undefined) c.knee.value      = knee;
  }

  getMasterCompReduction() {
    return this.masterCompressor?.reduction ?? 0;
  }

  // Integrated LUFS approximation (momentary RMS → LUFS-M ≈ -0.691 + 10*log10(RMS²))
  getLUFS() {
    if (!this.masterAnalyser) return -70;
    const buf = new Float32Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    if (rms < 1e-9) return -70;
    return Math.max(-70, -0.691 + 10 * Math.log10(rms * rms));
  }

  // ── Track buses ─────────────────────────────────────────────────
  createBus(trackId, opts = {}) {
    const existing = this.trackBuses.get(trackId);
    if (existing) existing.disconnect();
    const bus = new TrackBus(this.ctx, this.masterGain, opts);
    this.trackBuses.set(trackId, bus);
    return bus;
  }

  getBus(trackId) { return this.trackBuses.get(trackId); }

  removeBus(trackId) {
    const bus = this.trackBuses.get(trackId);
    if (bus) { bus.disconnect(); this.trackBuses.delete(trackId); }
  }

  // ── Master level ─────────────────────────────────────────────────
  getFFTData() {
    if (!this.masterAnalyser) return null;
    const buf = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteFrequencyData(buf);
    return buf;
  }

  getMasterLevel() {
    if (!this.masterAnalyser) return 0;
    const buf = new Float32Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.min(1, Math.sqrt(sum / buf.length) * 4);
  }

  // ── Transport clock ──────────────────────────────────────────────
  startTransport(bpm, startBeat = 0) {
    this._bpm = bpm;
    this._startBeat = startBeat;
    this._transportStart = this.ctx.currentTime;
  }

  getCurrentBeat() {
    if (this._transportStart === null) return 0;
    const elapsed = this.ctx.currentTime - this._transportStart;
    return this._startBeat + (elapsed * this._bpm) / 60;
  }

  beatToTime(beat) {
    if (this._transportStart === null) return this.ctx.currentTime;
    return (beat - this._startBeat) * (60 / this._bpm) + this._transportStart;
  }

  get baseLatencyMs() {
    try {
      const c = this.ctx;
      return Math.round(((c.baseLatency || 0) + (c.outputLatency || 0)) * 1000);
    } catch { return 0; }
  }

  destroy() {
    this.trackBuses.forEach(b => b.disconnect());
    this.trackBuses.clear();
    this._ctx?.close();
    this._ctx = null;
  }
}

export const engine = new AudioEngine();
