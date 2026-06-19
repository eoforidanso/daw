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

    // Brick-wall limiter on master
    this.masterLimiter = this._ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -3;
    this.masterLimiter.knee.value = 2;
    this.masterLimiter.ratio.value = 20;
    this.masterLimiter.attack.value = 0.001;
    this.masterLimiter.release.value = 0.1;

    this.masterAnalyser = this._ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.masterAnalyser.smoothingTimeConstant = 0.75;

    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this._ctx.destination);
  }

  resume() {
    const c = this.ctx;
    if (c.state === 'suspended') c.resume();
    return c;
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v / 100;
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
