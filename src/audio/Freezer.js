// Freeze a track by rendering its audio clips to a single AudioBuffer via OfflineAudioContext.

import { Recorder } from './Recorder.js';

export class Freezer {
  static async freeze(trackId, totalBeats, bpm, clips) {
    const audioClips = clips.filter(c => c.trackId === trackId && c.audioBuffer);
    if (!audioClips.length) throw new Error('No audio clips on track to freeze');

    const sampleRate  = audioClips[0].audioBuffer.sampleRate;
    const durationSec = (totalBeats / bpm) * 60;
    const numSamples  = Math.ceil(durationSec * sampleRate);
    const numChannels = Math.max(...audioClips.map(c => c.audioBuffer.numberOfChannels));

    const off = new OfflineAudioContext(numChannels, numSamples, sampleRate);

    for (const clip of audioClips) {
      const startSec  = (clip.startBeat / bpm) * 60;
      const src       = off.createBufferSource();
      src.buffer      = clip.audioBuffer;
      if (clip.stretchRatio && clip.stretchRatio !== 1) {
        src.playbackRate.value = clip.stretchRatio;
      }
      src.connect(off.destination);
      src.start(Math.max(0, startSec));
    }

    const frozen = await off.startRendering();
    const peaks  = Recorder.peaks(frozen, 200);
    return { frozen, peaks };
  }
}
