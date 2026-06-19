// Onset-detection + autocorrelation BPM estimator.
// Works entirely in the main thread on a decoded Float32Array channel.

export function detectBPM(channelData, sampleRate) {
  const HOP = 512;
  const frames = Math.floor(channelData.length / HOP);
  if (frames < 4) return null;

  // RMS energy per frame
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const s = f * HOP;
    let e = 0;
    const end = Math.min(s + HOP, channelData.length);
    for (let i = s; i < end; i++) e += channelData[i] ** 2;
    energy[f] = Math.sqrt(e / (end - s));
  }

  // Half-wave rectified spectral flux (onset strength)
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, energy[f] - energy[f - 1]);

  // Autocorrelation of flux over BPM range 60–200
  const fps    = sampleRate / HOP;
  const minLag = Math.max(1, Math.floor(fps * 60 / 200));
  const maxLag = Math.min(frames - 1, Math.ceil(fps * 60 / 60));

  let bestLag = minLag, bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const n = frames - lag;
    for (let i = 0; i < n; i++) corr += flux[i] * flux[i + lag];
    if (corr / n > bestCorr) { bestCorr = corr / n; bestLag = lag; }
  }

  let bpm = (fps * 60) / bestLag;
  // Prefer musically common range 80–160; fold if outside
  if (bpm < 80  && bpm * 2 <= 200) bpm *= 2;
  if (bpm > 160 && bpm / 2 >= 60)  bpm /= 2;

  return Math.round(bpm);
}

// Convenience wrapper: decodes a File/Blob then runs detectBPM
export async function detectBPMFromBuffer(arrayBuffer, sampleRate) {
  const ctx     = new AudioContext({ sampleRate: 22050 }); // downsample for speed
  let decoded;
  try { decoded = await ctx.decodeAudioData(arrayBuffer.slice(0)); }
  catch { return null; }
  finally { ctx.close(); }
  return detectBPM(decoded.getChannelData(0), decoded.sampleRate);
}
