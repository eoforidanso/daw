import { useRef, useCallback, useState, useEffect } from 'react';

const STEPS = 16;

function createDefaultSteps() {
  return {
    KICK:    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
    SNARE:   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    'HI-HAT':[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    CLAP:    [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0].map(Boolean),
  };
}

export function useAudioEngine(bpm, tracks) {
  // ── Playback state ──────────────────────────────────────────────
  const ctxRef = useRef(null);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [sequencerSteps, setSequencerSteps] = useState(createDefaultSteps);
  const stepRef = useRef(0);
  const nextTimeRef = useRef(0);
  const timerRef = useRef(null);
  const isPlayingRef = useRef(false);
  const bpmRef = useRef(bpm);
  const stepsRef = useRef(sequencerSteps);
  const tracksRef = useRef(tracks);

  // ── Input state ─────────────────────────────────────────────────
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('default');
  const [isMonitoring, setIsMonitoringState] = useState(false);
  const [inputGain, setInputGainState] = useState(75);
  const [latencyCompensation, setLatencyCompensation] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [inputActive, setInputActive] = useState(false);

  const inputStreamRef = useRef(null);
  const inputGainNodeRef = useRef(null);
  const inputSourceRef = useRef(null);
  const inputAnalyserRef = useRef(null);
  const levelRafRef = useRef(null);
  const isMonitoringRef = useRef(false);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { stepsRef.current = sequencerSteps; }, [sequencerSteps]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // ── Audio context ────────────────────────────────────────────────
  const ctx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctxRef.current;
  };

  // ── Drum synthesis ───────────────────────────────────────────────
  const noise = (ac, dur) => {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
  };

  const playKick = (t) => {
    const ac = ctx();
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(0.001, t + 0.45);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t); osc.stop(t + 0.5);
  };

  const playSnare = (t) => {
    const ac = ctx();
    const n = noise(ac, 0.18), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 0.9;
    n.connect(f); f.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.start(t); n.stop(t + 0.2);
    const osc = ac.createOscillator(), og = ac.createGain();
    osc.connect(og); og.connect(ac.destination);
    osc.frequency.value = 185;
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t); osc.stop(t + 0.1);
  };

  const playHiHat = (t) => {
    const ac = ctx();
    const n = noise(ac, 0.07), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 9000;
    n.connect(f); f.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.38, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.start(t); n.stop(t + 0.09);
  };

  const playClap = (t) => {
    const ac = ctx();
    [0, 0.01, 0.02].forEach(delay => {
      const n = noise(ac, 0.12), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.6;
      n.connect(f); f.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.55, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
      n.start(t + delay); n.stop(t + delay + 0.15);
    });
  };

  const scheduleStep = useCallback((idx, t) => {
    const steps = stepsRef.current;
    const tr = tracksRef.current;
    const isMuted = (name) => tr.find(x => x.name === name)?.mute ?? false;
    if (steps.KICK?.[idx] && !isMuted('KICK')) playKick(t);
    if (steps.SNARE?.[idx] && !isMuted('SNARE')) playSnare(t);
    if (steps['HI-HAT']?.[idx] && !isMuted('HI-HAT')) playHiHat(t);
    if (steps.CLAP?.[idx] && !isMuted('CLAP')) playClap(t);
  }, []);

  const scheduler = useCallback(() => {
    const ac = ctx();
    // Apply latency compensation: schedule slightly early to compensate for output lag
    const compensationSec = latencyCompensation / 1000;
    const secsPerStep = (60 / bpmRef.current) / 4;
    while (nextTimeRef.current < ac.currentTime + 0.12) {
      const idx = stepRef.current;
      const when = Math.max(ac.currentTime, nextTimeRef.current - compensationSec);
      scheduleStep(idx, when);
      const delay = Math.max(0, (when - ac.currentTime) * 1000);
      setTimeout(() => { if (isPlayingRef.current) setCurrentBeat(idx); }, delay);
      nextTimeRef.current += secsPerStep;
      stepRef.current = (stepRef.current + 1) % STEPS;
    }
    timerRef.current = setTimeout(scheduler, 25);
  }, [scheduleStep, latencyCompensation]);

  const setIsPlaying = useCallback((playing) => {
    setIsPlayingState(playing);
    isPlayingRef.current = playing;
    if (playing) {
      const ac = ctx();
      if (ac.state === 'suspended') ac.resume();
      stepRef.current = 0;
      nextTimeRef.current = ac.currentTime + 0.05;
      scheduler();
    } else {
      clearTimeout(timerRef.current);
      setCurrentBeat(-1);
    }
  }, [scheduler]);

  const playNote = useCallback((freq, duration = 0.4) => {
    const ac = ctx();
    if (ac.state === 'suspended') ac.resume();
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    osc.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.4, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + duration + 0.05);
  }, []);

  // ── Input device management ──────────────────────────────────────

  const loadInputDevices = useCallback(async () => {
    try {
      // Trigger permission prompt, then enumerate
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter(d => d.kind === 'audioinput');
      setInputDevices(inputs);
      if (inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
      return inputs;
    } catch (err) {
      console.warn('Audio input permission denied or unavailable:', err.message);
      return [];
    }
  }, []);

  const stopInput = useCallback(() => {
    cancelAnimationFrame(levelRafRef.current);
    if (inputSourceRef.current) { try { inputSourceRef.current.disconnect(); } catch {} inputSourceRef.current = null; }
    if (inputGainNodeRef.current) { try { inputGainNodeRef.current.disconnect(); } catch {} inputGainNodeRef.current = null; }
    if (inputAnalyserRef.current) { try { inputAnalyserRef.current.disconnect(); } catch {} inputAnalyserRef.current = null; }
    if (inputStreamRef.current) { inputStreamRef.current.getTracks().forEach(t => t.stop()); inputStreamRef.current = null; }
    setInputLevel(0);
    setInputActive(false);
  }, []);

  const startInput = useCallback(async (deviceId, gainValue, monitor) => {
    stopInput();
    const ac = ctx();
    if (ac.state === 'suspended') ac.resume();
    try {
      const constraints = {
        audio: {
          deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0,
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      inputStreamRef.current = stream;

      const source = ac.createMediaStreamSource(stream);
      inputSourceRef.current = source;

      // Gain node
      const gainNode = ac.createGain();
      gainNode.gain.value = gainValue / 100;
      inputGainNodeRef.current = gainNode;
      source.connect(gainNode);

      // Analyser for level metering (separate from gain chain)
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      inputAnalyserRef.current = analyser;
      gainNode.connect(analyser);

      // Route to output only if monitoring is on
      if (monitor) gainNode.connect(ac.destination);

      // Level metering loop
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        setInputLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);
      setInputActive(true);
    } catch (err) {
      console.warn('Could not open audio input:', err.message);
      setInputActive(false);
    }
  }, [stopInput]);

  const setInputGain = useCallback((v) => {
    setInputGainState(v);
    if (inputGainNodeRef.current) {
      inputGainNodeRef.current.gain.value = v / 100;
    }
  }, []);

  const setIsMonitoring = useCallback((monitor) => {
    setIsMonitoringState(monitor);
    isMonitoringRef.current = monitor;
    if (!inputGainNodeRef.current) return;
    const ac = ctx();
    if (monitor) {
      try { inputGainNodeRef.current.connect(ac.destination); } catch {}
    } else {
      try { inputGainNodeRef.current.disconnect(ac.destination); } catch {}
    }
  }, []);

  const setSelectedDevice = useCallback(async (deviceId) => {
    setSelectedDeviceId(deviceId);
    if (inputActive) {
      await startInput(deviceId, inputGain, isMonitoringRef.current);
    }
  }, [inputActive, inputGain, startInput]);

  // Measure system round-trip latency from AudioContext
  const getSystemLatency = useCallback(() => {
    try {
      const ac = ctx();
      const base = (ac.baseLatency || 0);
      const out = (ac.outputLatency || 0);
      return Math.round((base + out) * 1000);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    stopInput();
  }, [stopInput]);

  return {
    // Playback
    isPlaying, setIsPlaying, currentBeat, playNote, sequencerSteps, setSequencerSteps,
    // Input
    inputDevices, selectedDeviceId, setSelectedDevice,
    isMonitoring, setIsMonitoring,
    inputGain, setInputGain,
    latencyCompensation, setLatencyCompensation,
    inputLevel, inputActive,
    loadInputDevices, startInput, stopInput,
    getSystemLatency,
  };
}
