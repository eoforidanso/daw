// Serialize full project state to .void JSON, including AudioBuffers as base64 WAV.

function encodeWAV(audioBuffer) {
  const nCh  = audioBuffer.numberOfChannels;
  const sr   = audioBuffer.sampleRate;
  const nS   = audioBuffer.length;
  const data = new ArrayBuffer(44 + nS * nCh * 2);
  const v    = new DataView(data);
  const w4   = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  const u32  = (o, n) => v.setUint32(o, n, true);
  const u16  = (o, n) => v.setUint16(o, n, true);
  w4(0, 'RIFF'); u32(4, 36 + nS * nCh * 2); w4(8, 'WAVE');
  w4(12, 'fmt '); u32(16, 16); u16(20, 1); u16(22, nCh);
  u32(24, sr); u32(28, sr * nCh * 2); u16(32, nCh * 2); u16(34, 16);
  w4(36, 'data'); u32(40, nS * nCh * 2);
  let o = 44;
  for (let i = 0; i < nS; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
  }
  return data;
}

function ab2b64(ab) {
  const bytes  = new Uint8Array(ab);
  let binary   = '';
  const chunk  = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function b64toAudioBuffer(b64, ctx) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return ctx.decodeAudioData(bytes.buffer.slice(0));
}

export const ProjectIO = {
  async save(state) {
    const { name = 'Untitled', bpm, tracks, clips, automationLanes = [], synthParams = {}, mixerEQ = {} } = state;

    const serializedClips = await Promise.all(clips.map(async (clip) => {
      const c = { ...clip, audioBuffer: null, waveformData: null };
      if (clip.audioBuffer) {
        c.audioBuffer  = ab2b64(encodeWAV(clip.audioBuffer));
        c.waveformData = Array.from(clip.waveformData ?? []);
      }
      return c;
    }));

    const project = {
      _version: '2.0',
      name,
      bpm,
      tracks,
      clips: serializedClips,
      automationLanes,
      synthParams,
      mixerEQ,
      savedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${name.replace(/\s+/g, '_')}.void`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return name;
  },

  async load(file, audioCtx) {
    const text    = await file.text();
    const project = JSON.parse(text);

    const clips = await Promise.all((project.clips ?? []).map(async (clip) => {
      if (clip.audioBuffer && typeof clip.audioBuffer === 'string') {
        try {
          const audioBuffer  = await b64toAudioBuffer(clip.audioBuffer, audioCtx);
          const waveformData = clip.waveformData ? Float32Array.from(clip.waveformData) : null;
          return { ...clip, audioBuffer, waveformData };
        } catch (e) {
          console.warn('Could not restore audio clip:', clip.name, e.message);
        }
      }
      return { ...clip, audioBuffer: null };
    }));

    return { ...project, clips };
  },
};
