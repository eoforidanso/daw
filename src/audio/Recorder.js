export class Recorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.isRecording = false;
  }

  async start(deviceId) {
    const constraints = {
      audio: {
        deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0,
      },
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.chunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.mediaRecorder.start(50);
    this.isRecording = true;
  }

  stop(audioCtx) {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Not recording'));
      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
          const ab = await blob.arrayBuffer();
          const audioBuffer = await audioCtx.decodeAudioData(ab);
          this.stream?.getTracks().forEach(t => t.stop());
          this.isRecording = false;
          resolve(audioBuffer);
        } catch (e) { reject(e); }
      };
      this.mediaRecorder.stop();
    });
  }

  abort() {
    try { this.mediaRecorder?.stop(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.isRecording = false;
    this.chunks = [];
  }

  // Extract peak data for waveform display (returns normalized Float32Array)
  static peaks(audioBuffer, count = 200) {
    const ch = audioBuffer.getChannelData(0);
    const step = Math.floor(ch.length / count) || 1;
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(ch[i * step + j] || 0));
      out[i] = max;
    }
    return out;
  }
}
