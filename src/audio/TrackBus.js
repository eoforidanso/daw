export class TrackBus {
  constructor(ctx, masterInput, { volume = 80, pan = 0, mute = false } = {}) {
    this.ctx = ctx;
    this._volume = volume;
    this._muted = mute;

    // ── 3-band EQ ──────────────────────────────────────
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 120;
    this.eqLow.gain.value = 0;

    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1500;
    this.eqMid.Q.value = 0.9;
    this.eqMid.gain.value = 0;

    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 8000;
    this.eqHigh.gain.value = 0;

    // ── Fader ───────────────────────────────────────────
    this.fader = ctx.createGain();
    this.fader.gain.value = mute ? 0 : volume / 100;

    // ── Pan ─────────────────────────────────────────────
    this.panner = ctx.createStereoPanner();
    this.panner.pan.value = pan / 100;

    // ── Post-fader analyser (reads signal after fader) ──
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;

    // ── Chain ───────────────────────────────────────────
    // input → eqLow → eqMid → eqHigh → fader → panner → analyser → master
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.fader);
    this.fader.connect(this.panner);
    this.panner.connect(this.analyser);
    this.analyser.connect(masterInput);

    // Sources connect to this entry point
    this.input = this.eqLow;

    this._analyserBuf = new Float32Array(this.analyser.fftSize);
  }

  // ── Mutations ────────────────────────────────────────
  setVolume(v) {
    this._volume = v;
    if (!this._muted) this.fader.gain.linearRampToValueAtTime(v / 100, this.ctx.currentTime + 0.01);
  }

  setMute(muted) {
    this._muted = muted;
    this.fader.gain.linearRampToValueAtTime(
      muted ? 0 : this._volume / 100,
      this.ctx.currentTime + 0.01,
    );
  }

  setPan(p) { this.panner.pan.value = p / 100; }

  setEQ(band, gainDb) {
    const node = { low: this.eqLow, mid: this.eqMid, high: this.eqHigh }[band];
    if (node) node.gain.linearRampToValueAtTime(gainDb, this.ctx.currentTime + 0.02);
  }

  setEQFreq(band, hz) {
    const node = { low: this.eqLow, mid: this.eqMid, high: this.eqHigh }[band];
    if (node) node.frequency.value = hz;
  }

  // ── Metering ─────────────────────────────────────────
  getLevel() {
    this.analyser.getFloatTimeDomainData(this._analyserBuf);
    let sum = 0;
    for (let i = 0; i < this._analyserBuf.length; i++) {
      sum += this._analyserBuf[i] * this._analyserBuf[i];
    }
    return Math.min(1, Math.sqrt(sum / this._analyserBuf.length) * 5);
  }

  // ── Teardown ─────────────────────────────────────────
  disconnect() {
    [this.eqLow, this.eqMid, this.eqHigh, this.fader, this.panner, this.analyser]
      .forEach(n => { try { n.disconnect(); } catch {} });
  }
}
