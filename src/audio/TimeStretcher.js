// Time-stretching via linear resampling for now (changes pitch).
// A real phase vocoder would require an AudioWorklet — this ships fast.

import { Recorder } from './Recorder.js';

export class TimeStretcher {
  // Resample an AudioBuffer to a different length using linear interpolation
  static resample(buffer, ratio) {
    if (ratio === 1) return buffer;
    const channels = buffer.numberOfChannels;
    const newLen   = Math.max(1, Math.round(buffer.length / ratio));
    const out      = new Array(channels).fill(null).map((_, ch) => {
      const src = buffer.getChannelData(ch);
      const dst = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) {
        const pos = i * ratio;
        const lo  = Math.floor(pos);
        const hi  = Math.min(lo + 1, src.length - 1);
        const t   = pos - lo;
        dst[i]    = (1 - t) * (src[lo] ?? 0) + t * (src[hi] ?? 0);
      }
      return dst;
    });
    // We can't create an AudioBuffer without a context here, so return raw data
    return { length: newLen, sampleRate: buffer.sampleRate, numberOfChannels: channels, _data: out };
  }

  // Produce a real AudioBuffer in an offline context
  static async stretch(audioBuffer, ctx, ratio) {
    if (ratio === 1) return audioBuffer;
    const raw = TimeStretcher.resample(audioBuffer, ratio);
    const off = new OfflineAudioContext(raw.numberOfChannels, raw.length, raw.sampleRate);
    const buf = off.createBuffer(raw.numberOfChannels, raw.length, raw.sampleRate);
    for (let ch = 0; ch < raw.numberOfChannels; ch++) {
      buf.copyToChannel(raw._data[ch], ch);
    }
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start(0);
    const result = await off.startRendering();
    return result;
  }

  // Helper: derive ratio such that an audio clip spanning originalSecs fits targetBeats at bpm
  static ratioForFit(originalSecs, targetBeats, bpm) {
    if (!originalSecs || !targetBeats || !bpm) return 1;
    const targetSecs = (targetBeats / bpm) * 60;
    return originalSecs / targetSecs; // > 1 → compress, < 1 → expand
  }

  static waveformFromRaw(rawData, count = 200) {
    const out    = new Float32Array(count);
    const srcLen = rawData[0].length;
    const step   = srcLen / count;
    for (let i = 0; i < count; i++) {
      let sum = 0;
      const start = Math.floor(i * step);
      const end   = Math.floor((i + 1) * step);
      for (let j = start; j < end; j++) {
        for (let ch = 0; ch < rawData.length; ch++) {
          sum += Math.abs(rawData[ch][j] ?? 0);
        }
      }
      out[i] = sum / ((end - start) * rawData.length);
    }
    return out;
  }
}
