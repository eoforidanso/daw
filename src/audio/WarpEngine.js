// Warp markers anchor audio time positions to beat positions, enabling tempo-matched playback.
// A warp marker { id, audioTime, beatTime } means:
//   at project beat `beatTime`, play the audio sample at `audioTime` seconds.
// Between markers, linear interpolation of playback rate is applied.

let _wid = 1;
export const mkWarpId = () => `w${_wid++}`;

export const WarpEngine = {
  // Compute playback position and local rate for a clip at a given project beat.
  // markers must be sorted by beatTime.
  getPlayback(markers, clipStartBeat, beatTime, bpm) {
    const sorted   = [...markers].sort((a, b) => a.beatTime - b.beatTime);
    const beatInClip = beatTime - clipStartBeat;
    const secPerBeat = 60 / bpm;

    if (!sorted.length) {
      // No warp markers: play back at natural rate
      return { audioTime: beatInClip * secPerBeat, playbackRate: 1 };
    }

    // Before first marker
    if (beatInClip <= sorted[0].beatTime) {
      const rate = sorted[0].beatTime > 0
        ? sorted[0].audioTime / (sorted[0].beatTime * secPerBeat)
        : 1;
      return { audioTime: sorted[0].audioTime - (sorted[0].beatTime - beatInClip) * secPerBeat * rate, playbackRate: rate };
    }

    // After last marker
    const last = sorted[sorted.length - 1];
    if (beatInClip >= last.beatTime) {
      return { audioTime: last.audioTime + (beatInClip - last.beatTime) * secPerBeat, playbackRate: 1 };
    }

    // Between two markers: linear interpolation
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (beatInClip >= a.beatTime && beatInClip < b.beatTime) {
        const beatSpan  = (b.beatTime - a.beatTime) * secPerBeat;
        const audioSpan = b.audioTime - a.audioTime;
        const rate      = beatSpan > 0 ? audioSpan / beatSpan : 1;
        const t         = (beatInClip - a.beatTime) / (b.beatTime - a.beatTime);
        const audioTime = a.audioTime + t * audioSpan;
        return { audioTime, playbackRate: rate };
      }
    }

    return { audioTime: beatInClip * secPerBeat, playbackRate: 1 };
  },

  // Auto-detect transients in an AudioBuffer and create warp markers at each transient
  async detectTransients(audioBuffer, bpm, clipStartBeat, sensitivity = 0.5) {
    const sr       = audioBuffer.sampleRate;
    const data     = audioBuffer.getChannelData(0);
    const hopSize  = Math.floor(sr * 0.01); // 10ms hops
    const markers  = [];
    let   prevRMS  = 0;
    const threshold = 0.15 + sensitivity * 0.4;

    for (let i = hopSize; i < data.length - hopSize; i += hopSize) {
      let sum = 0;
      for (let j = 0; j < hopSize; j++) sum += data[i + j] ** 2;
      const rms = Math.sqrt(sum / hopSize);
      const flux = rms - prevRMS;
      if (flux > threshold && i > hopSize * 3) {
        const audioTime = i / sr;
        const beatTime  = (audioTime / (60 / bpm));
        markers.push({ id: mkWarpId(), audioTime, beatTime, beatTime });
        i += hopSize * 4; // Skip ahead to avoid dense detections
      }
      prevRMS = rms;
    }
    return markers;
  },

  // Snap all warp marker beat positions to nearest beat grid
  snapToGrid(markers, grid = 0.25) {
    return markers.map(m => ({
      ...m,
      beatTime: Math.round(m.beatTime / grid) * grid,
    }));
  },
};
