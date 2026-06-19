import { useReducer, useRef, useCallback, useState, useEffect } from 'react';
import { engine }                       from '../audio/engine.js';
import { createReverb, createDelay, createDistortion, createChorus } from '../audio/effects.js';
import { Recorder }                     from '../audio/Recorder.js';
import { midiEngine }                   from '../audio/MIDIEngine.js';
import { applyAutomation }              from '../audio/AutomationEngine.js';
import { Freezer }                      from '../audio/Freezer.js';
import { ProjectIO }                    from '../audio/ProjectIO.js';
import { pluginRegistry }               from '../audio/PluginAPI.js';
import { WarpEngine }                   from '../audio/WarpEngine.js';
import '../plugins/index.js'; // self-registers built-ins

// ── Arp sequence builder ──────────────────────────────────────────
function buildArpSequence(chord, pattern, octaves) {
  if (!chord?.length) return [];
  const sorted = [...chord].sort((a, b) => a - b);
  let notes = [];
  for (let o = 0; o < octaves; o++) notes = [...notes, ...sorted.map(p => p + o * 12)];
  switch (pattern) {
    case 'down':   return [...notes].reverse();
    case 'bounce': return notes.length < 2 ? notes : [...notes, ...[...notes].reverse().slice(1, -1)];
    case 'random': {
      const s = [...notes];
      for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
      }
      return s;
    }
    default: return notes;
  }
}

// ── Real-time synth voice for MIDI clip playback ──────────────────
function scheduleClipNote(ctx, pitch, time, durSec, trackId, params) {
  const freq = 440 * Math.pow(2, (pitch - 69) / 12);
  if (freq > ctx.sampleRate / 2 - 100 || freq < 20) return;
  const bus  = engine.getBus(trackId);
  const dest = bus?.input ?? engine.masterGain;
  const { osc1Type = 'sawtooth', filterCutoff = 2000, filterRes = 20,
          attack = 10, decay = 20, sustain = 70, release = 30 } = params ?? {};
  const osc = ctx.createOscillator();
  osc.type  = ['sawtooth','sine','square','triangle'].includes(osc1Type) ? osc1Type : 'sawtooth';
  osc.frequency.value = freq;
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = Math.min(Math.max(80, filterCutoff), 18000);
  flt.Q.value = Math.max(0.01, filterRes / 10);
  const amp = ctx.createGain();
  const atk = Math.max(0.003, attack  / 5000);
  const dec = Math.max(0.003, decay   / 5000);
  const sus = Math.max(0.001, sustain / 250);
  const rel = Math.max(0.02,  release / 2000);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(sus, time + atk);
  amp.gain.linearRampToValueAtTime(sus * 0.7, time + atk + dec);
  amp.gain.setValueAtTime(sus * 0.7, time + durSec);
  amp.gain.linearRampToValueAtTime(0, time + durSec + rel);
  osc.connect(flt); flt.connect(amp); amp.connect(dest);
  osc.start(time); osc.stop(time + durSec + rel + 0.05);
}

// ── ID helpers ────────────────────────────────────────────────────
let _cid = 1, _nid = 1, _lid = 1;
const cuid = () => `c${_cid++}`;
const nuid = () => `n${_nid++}`;
const luid = () => `l${_lid++}`;

// ── Clip & note defaults ──────────────────────────────────────────
function mkNote(pitch, startBeat, durationBeats = 0.5, velocity = 100) {
  return { id: nuid(), pitch, startBeat, durationBeats, velocity };
}

function makeInitialClips() {
  const bass = [
    mkNote(36, 0, 0.5, 110), mkNote(36, 0.5, 0.25, 80),
    mkNote(43, 1, 0.75, 100), mkNote(41, 2, 0.5, 90),
    mkNote(38, 2.5, 0.5, 85), mkNote(36, 3, 1, 110),
    mkNote(36, 4, 0.5, 100), mkNote(43, 5, 1, 90),
    mkNote(38, 6.5, 0.5, 95), mkNote(36, 7, 1, 110),
  ];
  const lead = [
    mkNote(60, 0, 0.5, 100), mkNote(64, 0.5, 0.5, 90),
    mkNote(67, 1, 0.5, 85),  mkNote(69, 1.5, 0.5, 80),
    mkNote(67, 2, 1, 95),    mkNote(65, 3, 0.5, 90),
    mkNote(64, 3.5, 0.5, 85),mkNote(62, 4, 0.5, 100),
  ];
  return [
    { id: cuid(), trackId: 1, startBeat: 0,  durationBeats: 16, type: 'midi', name: 'KICK A',  color: '#ff6b35', notes: [] },
    { id: cuid(), trackId: 1, startBeat: 16, durationBeats: 16, type: 'midi', name: 'KICK B',  color: '#ff6b35', notes: [] },
    { id: cuid(), trackId: 2, startBeat: 0,  durationBeats: 32, type: 'midi', name: 'SNR A',   color: '#4a9eff', notes: [] },
    { id: cuid(), trackId: 3, startBeat: 0,  durationBeats: 32, type: 'midi', name: 'HH A',    color: '#00d4b4', notes: [] },
    { id: cuid(), trackId: 4, startBeat: 4,  durationBeats: 12, type: 'midi', name: 'CLP A',   color: '#ff4466', notes: [] },
    { id: cuid(), trackId: 5, startBeat: 0,  durationBeats: 16, type: 'midi', name: 'BASS A',  color: '#9b72ff', notes: bass },
    { id: cuid(), trackId: 5, startBeat: 16, durationBeats: 16, type: 'midi', name: 'BASS B',  color: '#9b72ff', notes: [] },
    { id: cuid(), trackId: 6, startBeat: 0,  durationBeats: 8,  type: 'midi', name: 'LEAD A',  color: '#ffbe45', notes: lead },
    { id: cuid(), trackId: 6, startBeat: 16, durationBeats: 8,  type: 'midi', name: 'LEAD B',  color: '#ffbe45', notes: [] },
    { id: cuid(), trackId: 7, startBeat: 0,  durationBeats: 32, type: 'midi', name: 'PAD A',   color: '#00d4b4', notes: [] },
  ];
}

// ── Clips reducer ─────────────────────────────────────────────────
function clipsReducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':      return action.clips;
    case 'ADD_CLIP':     return [...state, action.clip];
    case 'REMOVE_CLIP':  return state.filter(c => c.id !== action.id);
    case 'UPDATE_CLIP':  return state.map(c => c.id === action.id ? { ...c, ...action.updates } : c);
    case 'ADD_NOTE':     return state.map(c => c.id === action.clipId
      ? { ...c, notes: [...(c.notes || []), { id: nuid(), ...action.note }] } : c);
    case 'REMOVE_NOTE':  return state.map(c =>
      ({ ...c, notes: (c.notes || []).filter(n => n.id !== action.noteId) }));
    case 'UPDATE_NOTE':  return state.map(c =>
      ({ ...c, notes: (c.notes || []).map(n => n.id === action.noteId ? { ...n, ...action.updates } : n) }));
    default: return state;
  }
}

// ── Automation reducer ────────────────────────────────────────────
function autoReducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':        return action.lanes;
    case 'ADD_LANE':       return [...state, action.lane];
    case 'REMOVE_LANE':    return state.filter(l => l.id !== action.id);
    case 'ADD_POINT':      return state.map(l => l.id !== action.laneId ? l :
      { ...l, points: [...l.points, action.point] });
    case 'UPDATE_POINT':   return state.map(l =>
      ({ ...l, points: l.points.map(p => p.id !== action.pointId ? p : { ...p, ...action.updates }) }));
    case 'REMOVE_POINT':   return state.map(l =>
      ({ ...l, points: l.points.filter(p => p.id !== action.pointId) }));
    default: return state;
  }
}

// ── Default step velocity (100 = full) ───────────────────────────
const DEFAULT_VELS = {
  KICK:     Array(16).fill(100),
  SNARE:    Array(16).fill(100),
  'HI-HAT': Array(16).fill(100),
  CLAP:     Array(16).fill(100),
};

// ── Default step probability (all steps fire 100% of the time) ───
const DEFAULT_PROBS = {
  KICK:     Array(16).fill(100),
  SNARE:    Array(16).fill(100),
  'HI-HAT': Array(16).fill(100),
  CLAP:     Array(16).fill(100),
};

// ── Default step sequencer ────────────────────────────────────────
const DEFAULT_STEPS = {
  KICK:    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
  SNARE:   [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
  'HI-HAT':[1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
  CLAP:    [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,1,0].map(Boolean),
};

// ── Drum sound generator ──────────────────────────────────────────
function synthDrum(ctx, masterGain, type, time, trackBus, velocity = 100) {
  const dest   = trackBus?.input ?? masterGain;
  const vScale = Math.max(0.01, Math.min(2, velocity / 100));
  const noise  = (dur) => {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; return src;
  };
  if (type === 'KICK') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(dest);
    o.frequency.setValueAtTime(160, time);
    o.frequency.exponentialRampToValueAtTime(0.001, time + 0.44);
    g.gain.setValueAtTime(vScale, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.44);
    o.start(time); o.stop(time + 0.5);
  } else if (type === 'SNARE') {
    const n = noise(0.18), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 0.9;
    n.connect(f); f.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.8 * vScale, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    n.start(time); n.stop(time + 0.2);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.connect(g2); g2.connect(dest); o2.frequency.value = 185;
    g2.gain.setValueAtTime(0.3 * vScale, time); g2.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    o2.start(time); o2.stop(time + 0.1);
  } else if (type === 'HI-HAT') {
    const n = noise(0.07), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 9000;
    n.connect(f); f.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.35 * vScale, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    n.start(time); n.stop(time + 0.09);
  } else if (type === 'CLAP') {
    [0, 0.008, 0.018].forEach(d => {
      const n = noise(0.1), g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.6;
      n.connect(f); f.connect(g); g.connect(dest);
      g.gain.setValueAtTime(0.5 * vScale, time + d); g.gain.exponentialRampToValueAtTime(0.001, time + d + 0.1);
      n.start(time + d); n.stop(time + d + 0.12);
    });
  }
}

// ── Main hook ─────────────────────────────────────────────────────
export function useDAWEngine(tracks, bpm, synthParams = {}) {
  const [clips, dispatchClips]     = useReducer(clipsReducer, null, makeInitialClips);
  const [autoLanes, dispatchAuto]  = useReducer(autoReducer, []);
  const [isPlaying, setIsPlayingState]       = useState(false);
  const [isRecording, setIsRecordingState]   = useState(false);
  const [currentBeat, setCurrentBeat]        = useState(-1);
  const [sequencerSteps, setSequencerSteps]  = useState(DEFAULT_STEPS);
  const [stepProbs, setStepProbs]            = useState(DEFAULT_PROBS);
  const [stepVels,  setStepVels]             = useState(DEFAULT_VELS);
  const [swing, setSwing] = useState(0);
  // Arpeggiator
  const [arpEnabled,  setArpEnabled]  = useState(false);
  const [arpChord,    setArpChord]    = useState([]);
  const [arpRate,     setArpRate]     = useState('1/8');
  const [arpPattern,  setArpPattern]  = useState('up');
  const [arpOctaves,  setArpOctaves]  = useState(1);
  const [arpGate,     setArpGate]     = useState(0.7);
  const [arpTrackId,  setArpTrackId]  = useState(6);
  const [armedTracks, setArmedTracks]        = useState(new Set());
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [projectName, setProjectName]        = useState('Untitled');

  // Plugin instances: { [trackId]: [{ pluginId, instanceId, def, node, params }] }
  const [pluginInstances, setPluginInstances] = useState({});

  // Frozen tracks: Set<trackId>
  const [frozenTracks, setFrozenTracks] = useState(new Set());

  // Warp markers: { [clipId]: [{ id, audioTime, beatTime }] }
  const [warpMarkers, setWarpMarkers] = useState({});

  // Input state
  const [inputDevices, setInputDevices]   = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('default');
  const [isMonitoring, setIsMonitoringState]    = useState(false);
  const [inputGain, setInputGainState]          = useState(75);
  const [latencyCompensation, setLatencyCompensation] = useState(0);
  const [inputLevel, setInputLevel]     = useState(0);
  const [inputActive, setInputActive]   = useState(false);

  // MIDI state
  const [midiInputs, setMidiInputs]   = useState([]);
  const [selectedMidiId, setSelectedMidiId] = useState(null);

  const timerRef        = useRef(null);
  const stepRef         = useRef(0);
  const nextTimeRef     = useRef(0);
  const isPlayingRef    = useRef(false);
  const bpmRef          = useRef(bpm);
  const tracksRef       = useRef(tracks);
  const stepsRef        = useRef(sequencerSteps);
  const autoRef         = useRef(autoLanes);
  const clipsRef        = useRef(clips);
  const synthParamsRef  = useRef(synthParams);
  const schedNotesRef   = useRef(new Set());
  const audioCacheRef   = useRef(new Map()); // clipId → decoded AudioBuffer (for non-inline buffers)
  const probsRef        = useRef(DEFAULT_PROBS);
  const velsRef         = useRef(DEFAULT_VELS);
  const swingRef        = useRef(0);
  const trackInsertsRef = useRef(new Map());   // key: `${trackId}:${slot}` → effect instance
  const arpEnabledRef   = useRef(false);
  const arpRateRef      = useRef('1/8');
  const arpGateRef      = useRef(0.7);
  const arpTrackIdRef   = useRef(6);
  const arpSeqRef       = useRef([]);
  // Always keep live: updated each render (safe — scheduler reads asynchronously)
  clipsRef.current       = clips;
  synthParamsRef.current = synthParams;
  probsRef.current       = stepProbs;
  velsRef.current        = stepVels;
  swingRef.current       = swing;
  const recorderRef  = useRef(new Recorder());
  const recStartRef  = useRef(0);
  const inputStreamRef   = useRef(null);
  const inputGainRef     = useRef(null);
  const inputSourceRef   = useRef(null);
  const inputAnalyserRef = useRef(null);
  const levelRafRef      = useRef(null);
  const isMonRef         = useRef(false);
  const armedRef         = useRef(armedTracks);
  const devIdRef         = useRef(selectedDeviceId);

  useEffect(() => { bpmRef.current    = bpm; },            [bpm]);
  useEffect(() => { tracksRef.current = tracks; },         [tracks]);
  useEffect(() => { stepsRef.current  = sequencerSteps; }, [sequencerSteps]);
  useEffect(() => { armedRef.current  = armedTracks; },    [armedTracks]);
  useEffect(() => { devIdRef.current  = selectedDeviceId; },[selectedDeviceId]);
  useEffect(() => { autoRef.current   = autoLanes; },      [autoLanes]);
  useEffect(() => { arpEnabledRef.current  = arpEnabled; },  [arpEnabled]);
  useEffect(() => { arpRateRef.current     = arpRate; },     [arpRate]);
  useEffect(() => { arpGateRef.current     = arpGate; },     [arpGate]);
  useEffect(() => { arpTrackIdRef.current  = arpTrackId; },  [arpTrackId]);
  useEffect(() => { arpSeqRef.current = buildArpSequence(arpChord, arpPattern, arpOctaves); },
    [arpChord, arpPattern, arpOctaves]);

  // ── Boot track buses once on mount ──────────────────────────────
  useEffect(() => {
    tracks.forEach(t => {
      if (!engine.getBus(t.id)) engine.createBus(t.id, { volume: t.volume, pan: t.pan, mute: t.mute });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync track → bus on every track update ───────────────────────
  useEffect(() => {
    tracks.forEach(t => {
      const bus = engine.getBus(t.id);
      if (!bus) return;
      bus.setVolume(t.volume);
      bus.setPan(t.pan);
      bus.setMute(t.mute);
    });
  }, [tracks]);

  // ── Sequencer scheduler ──────────────────────────────────────────
  const scheduler = useCallback(() => {
    const ctx = engine.ctx;
    const comp = latencyCompensation / 1000;
    const secsPerStep = (60 / bpmRef.current) / 4;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const idx  = stepRef.current;
      const when = Math.max(ctx.currentTime, nextTimeRef.current - comp);
      // Swing: push odd-numbered 16th steps (the "ands") forward in time
      const swingOffset = (idx % 2 === 1) ? (swingRef.current / 100) * secsPerStep * 0.5 : 0;
      const swungWhen   = Math.max(ctx.currentTime, when + swingOffset);
      const steps = stepsRef.current;
      const tr    = tracksRef.current;
      const muted = (name) => tr.find(x => x.name === name)?.mute ?? false;
      const pairs = [['KICK',1],['SNARE',2],['HI-HAT',3],['CLAP',4]];
      pairs.forEach(([name, tid]) => {
        if (steps[name]?.[idx] && !muted(name)) {
          const prob = probsRef.current[name]?.[idx] ?? 100;
          if (prob >= 100 || Math.random() * 100 < prob) {
            const vel = velsRef.current[name]?.[idx] ?? 100;
            synthDrum(ctx, engine.masterGain, name, swungWhen, engine.getBus(tid), vel);
          }
        }
      });
      // Apply automation at this beat
      const beat = idx;
      applyAutomation(autoRef.current, beat, engine);

      // ── MIDI clip note scheduling ──────────────────────────────
      const LOOP_BEATS   = 32;
      const beatNow      = engine.getCurrentBeat();
      const spb          = 60 / bpmRef.current;
      const lookBeats    = 0.13 / spb;
      const loopCount    = Math.floor(beatNow / LOOP_BEATS);
      clipsRef.current.forEach(clip => {
        if (clip.type !== 'midi' || !clip.notes?.length) return;
        const tr = tracksRef.current.find(t => t.id === clip.trackId);
        if (!tr || tr.mute) return;
        clip.notes.forEach(note => {
          const localBeat = (clip.startBeat ?? 0) + (note.startBeat ?? 0);
          for (let lc = loopCount; lc <= loopCount + 1; lc++) {
            const absBeat = lc * LOOP_BEATS + localBeat;
            if (absBeat >= beatNow && absBeat < beatNow + lookBeats) {
              const key = `${clip.id}:${note.id}:${lc}`;
              if (!schedNotesRef.current.has(key)) {
                schedNotesRef.current.add(key);
                const startT  = Math.max(ctx.currentTime, engine.beatToTime(absBeat));
                const durSec  = Math.max(0.05, (note.durationBeats ?? 0.5) * spb);
                scheduleClipNote(ctx, note.pitch, startT, durSec, clip.trackId, synthParamsRef.current);
              }
            }
          }
        });
      });

      // ── Audio clip scheduling ────────────────────────────────────
      clipsRef.current.forEach(clip => {
        if (clip.type !== 'audio') return;
        const buf = clip.audioBuffer ?? audioCacheRef.current.get(clip.id);
        if (!buf) return;
        const tr2 = tracksRef.current.find(t => t.id === clip.trackId);
        if (!tr2 || tr2.mute) return;
        for (let lc = loopCount; lc <= loopCount + 1; lc++) {
          const absBeat = lc * LOOP_BEATS + (clip.startBeat ?? 0);
          if (absBeat >= beatNow && absBeat < beatNow + lookBeats) {
            const key = `audio:${clip.id}:${lc}`;
            if (!schedNotesRef.current.has(key)) {
              schedNotesRef.current.add(key);
              const when2 = Math.max(ctx.currentTime, engine.beatToTime(absBeat));
              const src = ctx.createBufferSource();
              src.buffer = buf;
              const bus2 = engine.getBus(clip.trackId);
              src.connect(bus2?.input ?? engine.masterGain);
              src.start(when2);
            }
          }
        }
      });

      // ── Arpeggiator scheduling ───────────────────────────────────
      if (arpEnabledRef.current && arpSeqRef.current.length > 0) {
        const rateMap      = { '1/4': 1, '1/8': 2, '1/16': 4, '1/32': 8 };
        const stepsPerBeat = rateMap[arpRateRef.current] ?? 2;
        const stepBeats    = 1 / stepsPerBeat;
        const firstStep    = Math.ceil(beatNow * stepsPerBeat);
        const lastStep     = Math.floor((beatNow + lookBeats) * stepsPerBeat);
        for (let s = firstStep; s <= lastStep; s++) {
          const absBeat = s * stepBeats;
          if (absBeat >= beatNow && absBeat < beatNow + lookBeats) {
            const key = `arp:${s}`;
            if (!schedNotesRef.current.has(key)) {
              schedNotesRef.current.add(key);
              const seq    = arpSeqRef.current;
              const pitch  = seq[((s % seq.length) + seq.length) % seq.length];
              const when3  = Math.max(ctx.currentTime, engine.beatToTime(absBeat));
              const durSec = Math.max(0.05, stepBeats * arpGateRef.current * spb);
              scheduleClipNote(ctx, pitch, when3, durSec, arpTrackIdRef.current, synthParamsRef.current);
            }
          }
        }
      }

      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      setTimeout(() => { if (isPlayingRef.current) setCurrentBeat(idx); }, delay);
      nextTimeRef.current += secsPerStep;
      stepRef.current = (stepRef.current + 1) % 16;
    }
    timerRef.current = setTimeout(scheduler, 25);
  }, [latencyCompensation]);

  const setIsPlaying = useCallback(async (playing) => {
    setIsPlayingState(playing);
    isPlayingRef.current = playing;
    if (playing) {
      engine.resume();
      engine.startTransport(bpmRef.current);
      schedNotesRef.current.clear();
      stepRef.current = 0;
      nextTimeRef.current = engine.ctx.currentTime + 0.05;
      scheduler();
      if (armedRef.current.size > 0) {
        try {
          setIsRecordingState(true);
          recStartRef.current = 0;
          await recorderRef.current.start(devIdRef.current);
        } catch (e) { console.warn('Record start failed:', e.message); setIsRecordingState(false); }
      }
    } else {
      clearTimeout(timerRef.current);
      setCurrentBeat(-1);
      if (recorderRef.current.isRecording) {
        try {
          const audioBuffer   = await recorderRef.current.stop(engine.ctx);
          const waveformData  = Recorder.peaks(audioBuffer);
          const durationBeats = (audioBuffer.duration * bpmRef.current) / 60;
          armedRef.current.forEach(trackId => {
            const track = tracksRef.current.find(t => t.id === trackId);
            dispatchClips({
              type: 'ADD_CLIP',
              clip: {
                id: cuid(), trackId, startBeat: recStartRef.current, durationBeats,
                type: 'audio', name: 'REC', color: track?.color ?? '#ff4466',
                audioBuffer, waveformData,
              },
            });
          });
        } catch (e) { console.warn('Record stop failed:', e.message); }
        setIsRecordingState(false);
      }
    }
  }, [scheduler]);

  // ── Piano / MIDI note playback ───────────────────────────────────
  const playNote = useCallback((freq, duration = 0.4, trackId = 6) => {
    engine.resume();
    const ctx = engine.ctx;
    const bus = engine.getBus(trackId);
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    osc.connect(g);
    g.connect(bus?.input ?? engine.masterGain);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration + 0.05);
  }, []);

  // ── MIDI init ────────────────────────────────────────────────────
  const initMIDI = useCallback(async () => {
    midiEngine.onNoteOn = (pitch) => {
      playNote(440 * Math.pow(2, (pitch - 69) / 12), 0.5, 6);
    };
    const inputs = await midiEngine.init();
    setMidiInputs([...inputs]);
    setSelectedMidiId(midiEngine.selectedId);
    return inputs;
  }, [playNote]);

  const selectMidiInput = useCallback((id) => {
    midiEngine.select(id); setSelectedMidiId(id);
  }, []);

  // ── Input device ─────────────────────────────────────────────────
  const loadInputDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const all = await navigator.mediaDevices.enumerateDevices();
      const inp = all.filter(d => d.kind === 'audioinput');
      setInputDevices(inp);
      if (inp.length > 0) setSelectedDeviceId(inp[0].deviceId);
      return inp;
    } catch (e) { console.warn('Audio permission:', e.message); return []; }
  }, []);

  const stopInput = useCallback(() => {
    cancelAnimationFrame(levelRafRef.current);
    [inputSourceRef, inputGainRef, inputAnalyserRef].forEach(r => {
      try { r.current?.disconnect(); } catch {}
      r.current = null;
    });
    inputStreamRef.current?.getTracks().forEach(t => t.stop());
    inputStreamRef.current = null;
    setInputLevel(0); setInputActive(false);
  }, []);

  const startInput = useCallback(async (deviceId, gain, monitor) => {
    stopInput();
    engine.resume();
    const ctx = engine.ctx;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
          echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0,
        },
      });
      inputStreamRef.current = stream;
      const source   = ctx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain / 100;
      inputGainRef.current = gainNode;
      source.connect(gainNode);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.6;
      inputAnalyserRef.current = analyser;
      gainNode.connect(analyser);
      if (monitor) gainNode.connect(engine.masterGain);
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        setInputLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);
      setInputActive(true);
    } catch (e) { console.warn('Input open failed:', e.message); setInputActive(false); }
  }, [stopInput]);

  const setInputGain = useCallback((v) => {
    setInputGainState(v);
    if (inputGainRef.current) inputGainRef.current.gain.value = v / 100;
  }, []);

  const setIsMonitoring = useCallback((mon) => {
    setIsMonitoringState(mon); isMonRef.current = mon;
    if (!inputGainRef.current) return;
    if (mon) { try { inputGainRef.current.connect(engine.masterGain); } catch {} }
    else      { try { inputGainRef.current.disconnect(engine.masterGain); } catch {} }
  }, []);

  const setSelectedDevice = useCallback(async (id) => {
    setSelectedDeviceId(id);
    if (inputActive) await startInput(id, inputGain, isMonRef.current);
  }, [inputActive, inputGain, startInput]);

  const getSystemLatency = useCallback(() => engine.baseLatencyMs, []);

  // ── Clip / note mutations ────────────────────────────────────────
  const addClip    = useCallback((clip)            => dispatchClips({ type: 'ADD_CLIP', clip: { id: cuid(), ...clip } }), []);
  const removeClip = useCallback((id)              => dispatchClips({ type: 'REMOVE_CLIP', id }), []);
  const updateClip = useCallback((id, updates)     => dispatchClips({ type: 'UPDATE_CLIP', id, updates }), []);
  const addNote    = useCallback((clipId, note)    => dispatchClips({ type: 'ADD_NOTE', clipId, note }), []);
  const removeNote = useCallback((noteId)          => dispatchClips({ type: 'REMOVE_NOTE', noteId }), []);
  const updateNote = useCallback((noteId, updates) => dispatchClips({ type: 'UPDATE_NOTE', noteId, updates }), []);

  const armTrack = useCallback((trackId, armed) => {
    setArmedTracks(prev => { const n = new Set(prev); armed ? n.add(trackId) : n.delete(trackId); return n; });
  }, []);

  // ── Automation ────────────────────────────────────────────────────
  const addAutoLane = useCallback((trackId, param) => {
    const lane = { id: luid(), trackId, param, points: [] };
    dispatchAuto({ type: 'ADD_LANE', lane });
    return lane.id;
  }, []);

  const removeAutoLane = useCallback((id) => dispatchAuto({ type: 'REMOVE_LANE', id }), []);

  const addAutoPoint = useCallback((laneId, point) => {
    dispatchAuto({ type: 'ADD_POINT', laneId, point });
  }, []);

  const updateAutoPoint = useCallback((laneId, pointId, updates) => {
    dispatchAuto({ type: 'UPDATE_POINT', laneId, pointId, updates });
  }, []);

  const removeAutoPoint = useCallback((laneId, pointId) => {
    dispatchAuto({ type: 'REMOVE_POINT', laneId, pointId });
  }, []);

  // ── Plugin instances ──────────────────────────────────────────────
  const addPlugin = useCallback((trackId, pluginId) => {
    engine.resume();
    const ctx = engine.ctx;
    try {
      const instance = pluginRegistry.instantiate(pluginId, ctx);
      // Connect: plugin input ← masterGain (simplified routing; real insert would wrap bus)
      // For now we wire into the master chain externally as a monitor send
      setPluginInstances(prev => ({
        ...prev,
        [trackId]: [...(prev[trackId] ?? []), instance],
      }));
    } catch (e) { console.warn('Plugin instantiate failed:', e.message); }
  }, []);

  const removePlugin = useCallback((trackId, instanceId) => {
    setPluginInstances(prev => {
      const list = (prev[trackId] ?? []);
      const inst = list.find(i => i.instanceId === instanceId);
      if (inst) { try { inst.node.destroy(); } catch {} }
      return { ...prev, [trackId]: list.filter(i => i.instanceId !== instanceId) };
    });
  }, []);

  const setPluginParam = useCallback((instanceId, key, value) => {
    setPluginInstances(prev => {
      const next = { ...prev };
      for (const trackId of Object.keys(next)) {
        next[trackId] = next[trackId].map(inst => {
          if (inst.instanceId !== instanceId) return inst;
          inst.node.setParam(key, value);
          return { ...inst, params: { ...inst.params, [key]: value } };
        });
      }
      return next;
    });
  }, []);

  // ── Freeze / flatten ──────────────────────────────────────────────
  const freezeTrack = useCallback(async (trackId) => {
    const clipsSnap = clips; // closure captures current
    try {
      const { frozen, peaks } = await Freezer.freeze(trackId, 32, bpmRef.current, clipsSnap);
      // Replace audio clips with frozen version
      const audioClips = clipsSnap.filter(c => c.trackId === trackId && c.audioBuffer);
      audioClips.forEach(c => dispatchClips({ type: 'REMOVE_CLIP', id: c.id }));
      dispatchClips({
        type: 'ADD_CLIP',
        clip: {
          id: cuid(), trackId, startBeat: 0, durationBeats: 32,
          type: 'audio', name: 'FROZEN', color: '#888888',
          audioBuffer: frozen, waveformData: peaks, frozen: true,
        },
      });
      setFrozenTracks(prev => new Set([...prev, trackId]));
    } catch (e) { console.warn('Freeze failed:', e.message); }
  }, [clips]);

  const unfreezeTrack = useCallback((trackId) => {
    setFrozenTracks(prev => { const n = new Set(prev); n.delete(trackId); return n; });
  }, []);

  // ── Project save / load ───────────────────────────────────────────
  const saveProject = useCallback(async () => {
    return ProjectIO.save({
      name: projectName,
      bpm,
      tracks,
      clips,
      automationLanes: autoLanes,
    });
  }, [projectName, bpm, tracks, clips, autoLanes]);

  const loadProject = useCallback(async (file) => {
    const project = await ProjectIO.load(file, engine.ctx);
    dispatchClips({ type: 'SET_ALL', clips: project.clips });
    dispatchAuto({ type: 'SET_ALL', lanes: project.automationLanes ?? [] });
    if (project.name) setProjectName(project.name);
  }, []);

  // ── Mixer helpers ────────────────────────────────────────────────
  const setTrackEQ    = useCallback((trackId, band, db) => engine.getBus(trackId)?.setEQ(band, db), []);
  const getTrackLevel = useCallback((trackId) => engine.getBus(trackId)?.getLevel() ?? 0, []);
  const getMasterLevel= useCallback(() => engine.getMasterLevel(), []);

  const FX_FACTORIES = {
    REV:  (ctx) => createReverb(ctx),
    DLY:  (ctx) => createDelay(ctx),
    DIST: (ctx) => createDistortion(ctx, { drive: 0.5 }),
    CHO:  (ctx) => createChorus(ctx),
  };

  const setTrackInsert = useCallback((trackId, slot, effectType) => {
    const bus = engine.getBus(trackId);
    if (!bus) return;
    const key = `${trackId}:${slot}`;
    const old = trackInsertsRef.current.get(key);
    if (old?.destroy) old.destroy();
    trackInsertsRef.current.delete(key);
    if (!effectType) {
      bus.setInsert(slot, null);
      return;
    }
    const factory = FX_FACTORIES[effectType];
    if (!factory) return;
    const effect = factory(engine.ctx);
    trackInsertsRef.current.set(key, effect);
    bus.setInsert(slot, effect);
  }, []);

  // ── Warp markers ─────────────────────────────────────────────────
  const addWarpMarker = useCallback((clipId, marker) => {
    setWarpMarkers(prev => ({ ...prev, [clipId]: [...(prev[clipId] ?? []), marker] }));
  }, []);

  const updateWarpMarker = useCallback((clipId, markerId, updates) => {
    setWarpMarkers(prev => ({
      ...prev,
      [clipId]: (prev[clipId] ?? []).map(m => m.id === markerId ? { ...m, ...updates } : m),
    }));
  }, []);

  const deleteWarpMarker = useCallback((clipId, markerId) => {
    setWarpMarkers(prev => ({
      ...prev,
      [clipId]: (prev[clipId] ?? []).filter(m => m.id !== markerId),
    }));
  }, []);

  const autoDetectWarp = useCallback(async (clipId, currentBpm) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip?.audioBuffer) return;
    const markers = await WarpEngine.detectTransients(clip.audioBuffer, currentBpm, clip.startBeat, 0.5);
    setWarpMarkers(prev => ({ ...prev, [clipId]: markers }));
  }, [clips]);

  // ── Melody insert ─────────────────────────────────────────────────
  // Insert generated notes into the first MIDI clip on the target track.
  // Creates a new clip if none exists.
  const insertMelody = useCallback(({ notes, trackId, bars }) => {
    const target = tracks.find(t => t.id === trackId);
    const existingClip = clips.find(c => c.trackId === trackId && c.type === 'midi');
    if (existingClip) {
      // Replace notes in existing clip
      notes.forEach(n => dispatchClips({ type: 'ADD_NOTE', clipId: existingClip.id, note: n }));
    } else {
      // Create new clip
      dispatchClips({
        type: 'ADD_CLIP',
        clip: {
          id: cuid(), trackId, startBeat: 0, durationBeats: bars * 4,
          type: 'midi', name: 'AI MELODY', color: target?.color ?? '#00d4b4',
          notes,
        },
      });
    }
  }, [clips, tracks]);

  // ── Quantize clip notes ───────────────────────────────────────────
  const setClipNotes = useCallback((clipId, newNotes) => {
    dispatchClips({ type: 'UPDATE_CLIP', id: clipId, updates: { notes: newNotes } });
  }, []);

  // ── Apply template / restore snapshot ────────────────────────────
  // Templates use template.name for display; snapshots use template.projectName.
  const applyTemplate = useCallback((template) => {
    (template.tracks ?? []).forEach(t => {
      if (!engine.getBus(t.id)) engine.createBus(t.id, { volume: t.volume, pan: t.pan, mute: t.mute });
    });
    dispatchClips({ type: 'SET_ALL', clips: template.clips ?? [] });
    dispatchAuto({ type: 'SET_ALL', lanes: template.autoLanes ?? [] });
    setWarpMarkers(template.warpMarkers ?? {});
    setFrozenTracks(new Set());
    setPluginInstances({});
    setProjectName(template.projectName ?? 'Untitled');
    setSequencerSteps(template.steps ?? {});
    setStepProbs(template.stepProbs ?? DEFAULT_PROBS);
    setStepVels(template.stepVels  ?? DEFAULT_VELS);
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    stopInput();
    midiEngine.destroy();
    // Destroy all plugin instances
    Object.values(pluginInstances).flat().forEach(inst => { try { inst.node.destroy(); } catch {} });
  }, [stopInput]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Clips
    clips, selectedClipId, setSelectedClipId,
    addClip, removeClip, updateClip,
    addNote, removeNote, updateNote,
    // Transport
    isPlaying, setIsPlaying, isRecording, currentBeat,
    armedTracks, armTrack,
    // Sequencer
    sequencerSteps, setSequencerSteps,
    stepProbs, setStepProbs,
    stepVels,  setStepVels,
    swing, setSwing,
    // Arp
    arpEnabled, setArpEnabled,
    arpChord,   setArpChord,
    arpRate,    setArpRate,
    arpPattern, setArpPattern,
    arpOctaves, setArpOctaves,
    arpGate,    setArpGate,
    arpTrackId, setArpTrackId,
    // Note playback
    playNote,
    // MIDI
    midiInputs, selectedMidiId, initMIDI, selectMidiInput,
    // Input
    inputDevices, selectedDeviceId, setSelectedDevice,
    isMonitoring, setIsMonitoring,
    inputGain, setInputGain,
    latencyCompensation, setLatencyCompensation,
    inputLevel, inputActive,
    loadInputDevices, startInput, stopInput,
    getSystemLatency,
    // Mixer
    setTrackEQ, getTrackLevel, getMasterLevel, setTrackInsert,
    // Automation
    autoLanes, addAutoLane, removeAutoLane,
    addAutoPoint, updateAutoPoint, removeAutoPoint,
    // Plugins
    pluginInstances, addPlugin, removePlugin, setPluginParam,
    // Freeze
    frozenTracks, freezeTrack, unfreezeTrack,
    // Warp markers
    warpMarkers, addWarpMarker, updateWarpMarker, deleteWarpMarker, autoDetectWarp,
    // Melody + Quantize
    insertMelody, setClipNotes,
    // Project
    projectName, setProjectName, saveProject, loadProject,
    // Template
    applyTemplate,
  };
}
