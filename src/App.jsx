import { useState, useCallback, useEffect, useRef } from 'react'
import TransportBar       from './components/TransportBar'
import TrackView          from './components/TrackView'
import PianoRoll          from './components/PianoRoll'
import StepSequencer      from './components/StepSequencer'
import Mixer              from './components/Mixer'
import SynthPanel         from './components/SynthPanel'
import InputPanel         from './components/InputPanel'
import PluginRack         from './components/PluginRack'
import ProjectModal       from './components/ProjectModal'
import TemplateModal      from './components/TemplateModal'
import RestoreModal       from './components/RestoreModal'
import VersionHistoryModal from './components/VersionHistoryModal'
import AIAssistant        from './components/AIAssistant'
import TutorialOverlay    from './components/TutorialOverlay'
import MicroTour          from './components/MicroTour'
import ExportModal             from './components/ExportModal'
import SampleBrowserPanel      from './components/SampleBrowserPanel'
import PerformanceMode         from './components/PerformanceMode'
import ChordProgressionPanel   from './components/ChordProgressionPanel'
import ArpeggiatorPanel        from './components/ArpeggiatorPanel'
import SongSeedPanel           from './components/SongSeedPanel'
import MelodyGenerator    from './components/MelodyGenerator'
import QuantizerPanel     from './components/QuantizerPanel'
import MixAssistantPanel  from './components/MixAssistantPanel'
import { WarpPanel }      from './components/WarpMarkerEditor'
import LFODesigner        from './components/LFODesigner'
import MelodicSequencer   from './components/MelodicSequencer'
import ModMatrix          from './components/ModMatrix'
import HighlifePanel      from './components/HighlifePanel'
import AmapianoPanel     from './components/AmapianoPanel'
import { useDAWEngine }   from './hooks/useDAWEngine'
import { AutoSave }       from './audio/AutoSave.js'
import { VersionHistory } from './audio/VersionHistory.js'
import { StemExport }     from './audio/StemExport.js'

const INITIAL_SYNTH = {
  osc1Type: 'sawtooth', osc1Detune: 0,
  osc2Type: 'sine',     osc2Detune: 7,
  filterType: 'lowpass', filterCutoff: 2000, filterRes: 30,
  attack: 10, decay: 20, sustain: 70, release: 30,
  lfoRate: 50, lfoDepth: 30,
  reverbMix: 30, reverbSize: 70,
  delayTime: 25, delayFeedback: 40, delayMix: 20,
  distortion: 0, chorus: 20,
};

export default function App() {
  const [tracks, setTracks]       = useState([]);
  const [bpm, setBpm]             = useState(128);
  const [centerTab, setCenterTab] = useState('arrange');
  const [bottomTab, setBottomTab]       = useState('mixer');
  const [microTourTab, setMicroTourTab] = useState(null);
  const prevBottomTab                   = useRef(null);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [synthParams, setSynthParams] = useState(INITIAL_SYNTH);
  // Check for a recoverable draft once on mount
  const [draft] = useState(() => {
    const d = AutoSave.getDraft();
    return d?.tracks?.length ? d : null;
  });

  const [showRestoreModal, setShowRestoreModal]   = useState(!!draft);
  const [showProject, setShowProject]             = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(!draft);
  const [lastSaved, setLastSaved]                 = useState(null);
  const [recents, setRecents]                     = useState(() => AutoSave.getRecents());
  const [currentVersionId, setCurrentVersionId]   = useState(null);
  const [showTutorial, setShowTutorial]           = useState(false);
  const [showExport, setShowExport]               = useState(false);
  const [perfGrid,   setPerfGrid]                 = useState(null);
  const [perfLabels, setPerfLabels]               = useState(null);

  const daw = useDAWEngine(tracks, bpm, synthParams);

  // Undo / Redo keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); daw.undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); daw.redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [daw.undo, daw.redo]);

  // Keep a ref to the latest state so the auto-save interval always reads fresh values
  const autoSaveRef = useRef({});
  autoSaveRef.current = {
    name: daw.projectName, bpm, tracks,
    clips: daw.clips, autoLanes: daw.autoLanes,
    steps: daw.sequencerSteps, warpMarkers: daw.warpMarkers,
  };

  // Show tutorial on first visit, 800ms after a project loads
  useEffect(() => {
    if (showTemplateModal || showRestoreModal) return;
    if (localStorage.getItem('void_tutorial_seen')) return;
    const t = setTimeout(() => setShowTutorial(true), 800);
    return () => clearTimeout(t);
  }, [showTemplateModal, showRestoreModal]);

  // Auto-save every 30 s (only while a project is active)
  useEffect(() => {
    if (showTemplateModal) return;
    const id = setInterval(() => {
      const state = autoSaveRef.current;
      if (!state.tracks?.length) return;
      AutoSave.saveDraft(state);
      AutoSave.addRecent(state);
      setLastSaved(Date.now());
      setRecents(AutoSave.getRecents());
    }, 30_000);
    return () => clearInterval(id);
  }, [showTemplateModal]);

  const handleTrackUpdate = useCallback((id, updates) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const handleStemExport = useCallback(async () => {
    try {
      await StemExport.export({
        bpm, tracks,
        steps: daw.sequencerSteps,
        clips: daw.clips,
        synthParams,
      }, { numBars: 8 });
    } catch (e) { console.error('Stem export failed:', e); }
  }, [bpm, tracks, daw.sequencerSteps, daw.clips, synthParams]);

  const handleSynthUpdate = useCallback((key, value) => {
    setSynthParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApplyTemplate = useCallback((template) => {
    setTracks(template.tracks ?? []);
    setBpm(template.bpm ?? 128);
    if (template.synthParams) setSynthParams(template.synthParams);
    daw.applyTemplate(template);
    setShowTemplateModal(false);
  }, [daw]);

  const handleNewProject = useCallback(() => {
    setShowProject(false);
    setShowTemplateModal(true);
  }, []);

  const handleRestore = useCallback((snapshot) => {
    AutoSave.clearDraft();
    handleApplyTemplate(snapshot);
    setShowRestoreModal(false);
  }, [handleApplyTemplate]);

  const handleDiscardDraft = useCallback(() => {
    AutoSave.clearDraft();
    setShowRestoreModal(false);
    setShowTemplateModal(true);
  }, []);

  const handleVersionSnapshot = useCallback((label) => {
    const entry = VersionHistory.snapshot(autoSaveRef.current, label);
    setCurrentVersionId(entry.id);
  }, []);

  const handleVersionRestore = useCallback((snapshot) => {
    handleApplyTemplate(snapshot);
    setCurrentVersionId(snapshot.id);
  }, [handleApplyTemplate]);

  const handleBottomTab = useCallback((id) => {
    setBottomTab(id);
    if (id !== prevBottomTab.current) {
      prevBottomTab.current = id;
      setMicroTourTab(null); // reset so MicroTour remounts cleanly
      setTimeout(() => setMicroTourTab(id), 50);
    }
  }, []);

  const handleAutomate = useCallback((actions) => {
    actions.forEach(action => {
      if (action.param === 'bpm') setBpm(action.value);
      else if (action.param === 'volume' && action.trackId) handleTrackUpdate(action.trackId, { volume: action.value });
      else if (action.param === 'pan'    && action.trackId) handleTrackUpdate(action.trackId, { pan: action.value });
      else if (['reverbMix','filterCutoff','delayMix'].includes(action.param)) handleSynthUpdate(action.param, action.value);
    });
  }, [handleTrackUpdate, handleSynthUpdate]);

  const handleCaptureArrangement = useCallback((log, grid) => {
    if (!log.length) return;
    log.forEach(({ sceneIdx, beat }) => {
      tracks.forEach((track, ti) => {
        if (grid[sceneIdx]?.[ti] !== false) {
          const existing = daw.clips.find(c => c.trackId === track.id && c.type === 'midi');
          const clip = {
            id: `clip_cap_${Date.now()}_${sceneIdx}_${ti}`,
            trackId: track.id,
            type: existing?.type ?? 'midi',
            startBeat: beat,
            duration: 4,
            notes: existing?.notes ?? [],
            label: `${track.name} · Scene ${sceneIdx + 1}`,
            color: track.color,
          };
          daw.dispatchClips?.({ type: 'ADD', clip });
        }
      });
    });
    setCenterTab('arrange');
  }, [tracks, daw]);

  const handleRecordComplete = useCallback((sample, trackId) => {
    setBottomTab('samples');
  }, []);

  const pianoClip = daw.clips.find(c => c.trackId === 6 && c.type === 'midi') ?? null;
  const drumTracks = tracks.filter(t => t.type === 'drum');

  return (
    <div className="daw-root">
      {showRestoreModal && draft && (
        <RestoreModal
          draft={draft}
          onRestore={handleRestore}
          onDiscard={handleDiscardDraft}
        />
      )}

      {showTemplateModal && !showRestoreModal && (
        <TemplateModal onSelect={handleApplyTemplate} recents={recents} />
      )}

      {showVersionHistory && (
        <VersionHistoryModal
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleVersionRestore}
          onSnapshot={handleVersionSnapshot}
          currentVersionId={currentVersionId}
        />
      )}

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          currentState={autoSaveRef.current}
          projectName={daw.projectName}
          sceneGrid={perfGrid}
          sceneLabels={perfLabels}
          tracks={tracks}
        />
      )}

      {showTutorial && (
        <TutorialOverlay onClose={() => setShowTutorial(false)} />
      )}

      {microTourTab && !showTutorial && (
        <MicroTour key={microTourTab} tabId={microTourTab} />
      )}

      {showProject && !showTemplateModal && !showRestoreModal && (
        <ProjectModal
          projectName={daw.projectName}
          onRename={daw.setProjectName}
          onSave={daw.saveProject}
          onLoad={daw.loadProject}
          onClose={() => setShowProject(false)}
          onNewProject={handleNewProject}
        />
      )}

      <TransportBar
        isPlaying={daw.isPlaying}
        onPlayToggle={() => daw.setIsPlaying(!daw.isPlaying)}
        bpm={bpm}
        onBpmChange={setBpm}
        projectName={daw.projectName}
        onProjectOpen={() => setShowProject(true)}
        onVersionOpen={() => setShowVersionHistory(true)}
        onTutorialOpen={() => setShowTutorial(true)}
        onExportOpen={() => setShowExport(true)}
        lastSaved={lastSaved}
        autoRecording={daw.autoRecording}
        onAutoRecordToggle={() => daw.setAutoRecording(v => !v)}
        onStemExport={handleStemExport}
      />

      <div className="daw-workspace">
        <div className="workspace-tabs">
          {[['arrange','ARRANGE'],['piano','PIANO ROLL'],['beat','BEAT GRID'],['perform','PERFORM']].map(([id, label]) => (
            <button key={id} className={`workspace-tab ${centerTab === id ? 'active' : ''}`}
              onClick={() => setCenterTab(id)}>{label}</button>
          ))}
          {daw.midiInputs.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--accent-purple)', letterSpacing: '0.12em' }}>
                ◆ MIDI
              </span>
              <select
                value={daw.selectedMidiId ?? ''}
                onChange={e => daw.selectMidiInput(e.target.value)}
                style={{ fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--bg-element)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 2, padding: '1px 4px' }}
              >
                {daw.midiInputs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="workspace-content">
          {centerTab === 'arrange' && (
            <TrackView
              tracks={tracks}
              clips={daw.clips}
              onTrackUpdate={handleTrackUpdate}
              armedTracks={daw.armedTracks}
              onArmTrack={daw.armTrack}
              currentBeat={daw.currentBeat}
              isPlaying={daw.isPlaying}
              isRecording={daw.isRecording}
              bpm={bpm}
              autoLanes={daw.autoLanes}
              onAddAutoLane={daw.addAutoLane}
              onRemoveAutoLane={daw.removeAutoLane}
              onAddAutoPoint={daw.addAutoPoint}
              onUpdateAutoPoint={daw.updateAutoPoint}
              onRemoveAutoPoint={daw.removeAutoPoint}
              frozenTracks={daw.frozenTracks}
              onFreezeTrack={daw.freezeTrack}
              selectedClipId={selectedClipId}
              onClipSelect={setSelectedClipId}
              warpMarkers={daw.warpMarkers}
              onAddWarpMarker={daw.addWarpMarker}
              onUpdateWarpMarker={daw.updateWarpMarker}
              onDeleteWarpMarker={daw.deleteWarpMarker}
            />
          )}
          {centerTab === 'piano' && (
            <PianoRoll
              notes={pianoClip?.notes ?? []}
              onAddNote={note => pianoClip && daw.addNote(pianoClip.id, note)}
              onRemoveNote={daw.removeNote}
              onUpdateNote={daw.updateNote}
              onNotePlay={(freq) => daw.playNote(freq, 0.5, 6)}
            />
          )}
          {centerTab === 'perform' && (
            <PerformanceMode
              tracks={tracks}
              steps={daw.sequencerSteps}
              bpm={bpm}
              isPlaying={daw.isPlaying}
              currentBeat={daw.currentBeat}
              onTrackUpdate={handleTrackUpdate}
              onAutomate={handleAutomate}
              onCaptureArrangement={handleCaptureArrangement}
              onRecordComplete={handleRecordComplete}
              onGridChange={(grid, labels) => { setPerfGrid(grid); setPerfLabels(labels); }}
            />
          )}
          {centerTab === 'beat' && (
            <StepSequencer
              tracks={drumTracks}
              steps={daw.sequencerSteps}
              onStepsChange={daw.setSequencerSteps}
              stepProbs={daw.stepProbs}
              onProbsChange={daw.setStepProbs}
              stepVels={daw.stepVels}
              onVelsChange={daw.setStepVels}
              swing={daw.swing}
              onSwingChange={daw.setSwing}
              trackSwings={daw.trackSwings}
              onTrackSwingChange={daw.updateTrackSwing}
              onMorphChange={daw.setMorphData}
              grooveTemplate={daw.grooveTemplate}
              onGrooveChange={daw.setGrooveTemplate}
              currentBeat={daw.currentBeat}
              isPlaying={daw.isPlaying}
            />
          )}
        </div>
      </div>

      <div className="daw-bottom">
        <div className="bottom-tabs">
          {[['mixer','MIXER'],['synth','INSTRUMENT'],['effects','EFFECTS'],['plugins','PLUGINS'],['samples','SAMPLES'],['chords','CHORDS'],['arp','ARP'],['seed','SONG SEED'],['highlife','HIGHLIFE'],['amapiano','AMAPIANO'],['melody','AI MELODY'],['melodic','MELODIC SEQ'],['lfo','LFO'],['modmatrix','MOD MATRIX'],['quant','QUANTIZE'],['warp','WARP'],['aimix','AI MIX'],['input','INPUT'],['aichat','AI ASSISTANT']].map(([id, label]) => (
            <button key={id} className={`bottom-tab ${bottomTab === id ? 'active' : ''}`}
              onClick={() => handleBottomTab(id)}>{label}</button>
          ))}
          {daw.inputActive && (
            <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:'auto', paddingRight:12, fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:'0.15em', color:'var(--accent-red)' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent-red)', boxShadow:'0 0 6px var(--accent-red)', animation:'blink 1s step-start infinite' }} />
              INPUT ARMED
            </div>
          )}
        </div>

        <div className="bottom-content">
          {bottomTab === 'mixer' && (
            <Mixer
              tracks={tracks}
              onTrackUpdate={handleTrackUpdate}
              isPlaying={daw.isPlaying}
              getTrackLevel={daw.getTrackLevel}
              getMasterLevel={daw.getMasterLevel}
              setTrackEQ={daw.setTrackEQ}
              clips={daw.clips}
              bpm={bpm}
              onInsertToggle={daw.setTrackInsert}
              onRecordParam={daw.recordAutomation}
              sidechainMap={daw.sidechainMap}
              onSidechainChange={(targetId, sourceId) => daw.setSidechainMap(prev => ({ ...prev, [targetId]: sourceId }))}
              setMasterComp={daw.setMasterComp}
              getMasterCompReduction={daw.getMasterCompReduction}
              getLUFS={daw.getLUFS}
            />
          )}
          {bottomTab === 'synth' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Chord mode bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', color: 'var(--text-muted)' }}>CHORD MODE</span>
                <button onClick={() => daw.setChordMode(c => ({ ...c, enabled: !c.enabled }))}
                  style={{ height: 18, padding: '0 8px', borderRadius: 2, border: `1px solid ${daw.chordMode.enabled ? 'var(--accent-cyan)' : 'var(--border-default)'}`, background: daw.chordMode.enabled ? 'rgba(0,212,180,0.15)' : 'var(--bg-element)', color: daw.chordMode.enabled ? 'var(--accent-cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 7, cursor: 'pointer' }}>
                  {daw.chordMode.enabled ? 'ON' : 'OFF'}
                </button>
                {daw.chordMode.enabled && ['maj','min','dom7','maj7','min7','sus4','dim','aug'].map(t => (
                  <button key={t} onClick={() => daw.setChordMode(c => ({ ...c, type: t }))}
                    style={{ height: 18, padding: '0 6px', borderRadius: 2, border: `1px solid ${daw.chordMode.type === t ? 'var(--accent-purple)' : 'var(--border-faint)'}`, background: daw.chordMode.type === t ? 'rgba(155,114,255,0.15)' : 'transparent', color: daw.chordMode.type === t ? 'var(--accent-purple)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 7, cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <SynthPanel params={synthParams} onUpdate={handleSynthUpdate} />
              </div>
            </div>
          )}
          {bottomTab === 'effects' && (
            <SynthPanel params={synthParams} onUpdate={handleSynthUpdate} effectsMode />
          )}
          {bottomTab === 'plugins' && (
            <PluginRack
              tracks={tracks}
              pluginInstances={daw.pluginInstances}
              onAddPlugin={daw.addPlugin}
              onSetPluginParam={daw.setPluginParam}
              onRemovePlugin={daw.removePlugin}
            />
          )}
          {bottomTab === 'chords' && (
            <ChordProgressionPanel
              tracks={tracks}
              onInsert={daw.insertMelody}
              playNote={daw.playNote}
              onChordSelect={daw.setArpChord}
            />
          )}
          {bottomTab === 'arp' && (
            <ArpeggiatorPanel
              tracks={tracks}
              isPlaying={daw.isPlaying}
              arpEnabled={daw.arpEnabled}   setArpEnabled={daw.setArpEnabled}
              arpChord={daw.arpChord}       setArpChord={daw.setArpChord}
              arpRate={daw.arpRate}         setArpRate={daw.setArpRate}
              arpPattern={daw.arpPattern}   setArpPattern={daw.setArpPattern}
              arpOctaves={daw.arpOctaves}   setArpOctaves={daw.setArpOctaves}
              arpGate={daw.arpGate}         setArpGate={daw.setArpGate}
              arpTrackId={daw.arpTrackId}   setArpTrackId={daw.setArpTrackId}
            />
          )}
          {bottomTab === 'seed' && (
            <SongSeedPanel
              tracks={tracks}
              arpChord={daw.arpChord}
              onStepsChange={daw.setSequencerSteps}
              dispatchClips={daw.dispatchClips}
            />
          )}
          {bottomTab === 'highlife' && (
            <HighlifePanel
              tracks={tracks}
              arpChord={daw.arpChord}
              onStepsChange={daw.setSequencerSteps}
              onBpmChange={setBpm}
              dispatchClips={daw.dispatchClips}
            />
          )}
          {bottomTab === 'amapiano' && (
            <AmapianoPanel
              tracks={tracks}
              arpChord={daw.arpChord}
              onStepsChange={daw.setSequencerSteps}
              onBpmChange={setBpm}
              dispatchClips={daw.dispatchClips}
            />
          )}
          {bottomTab === 'melody' && (
            <MelodyGenerator
              tracks={tracks}
              onInsert={daw.insertMelody}
            />
          )}
          {bottomTab === 'melodic' && (
            <MelodicSequencer
              tracks={tracks}
              clips={daw.clips}
              onUpdateClip={daw.updateClip}
            />
          )}
          {bottomTab === 'lfo' && (
            <LFODesigner
              tracks={tracks}
              autoLanes={daw.autoLanes}
              onAddAutoLane={daw.addAutoLane}
              onAddAutoPoint={daw.addAutoPoint}
            />
          )}
          {bottomTab === 'modmatrix' && (
            <ModMatrix
              tracks={tracks}
              onModSlotsChange={daw.setModSlots}
            />
          )}
          {bottomTab === 'quant' && (
            <QuantizerPanel
              clips={daw.clips}
              onQuantize={daw.setClipNotes}
              onHumanize={daw.setClipNotes}
            />
          )}
          {bottomTab === 'warp' && (
            <WarpPanel
              selectedClip={daw.clips.find(c => c.id === selectedClipId) ?? null}
              markers={selectedClipId ? (daw.warpMarkers[selectedClipId] ?? []) : []}
              onAdd={daw.addWarpMarker}
              onUpdate={daw.updateWarpMarker}
              onDelete={daw.deleteWarpMarker}
              onAutoDetect={daw.autoDetectWarp}
              bpm={bpm}
            />
          )}
          {bottomTab === 'aimix' && (
            <MixAssistantPanel
              tracks={tracks}
              onTrackUpdate={handleTrackUpdate}
              setTrackEQ={daw.setTrackEQ}
            />
          )}
          {bottomTab === 'samples' && (
            <SampleBrowserPanel
              tracks={tracks}
              bpm={bpm}
              onAddSampleToTrack={(sample, track) => {
                // Create an audio clip placeholder on the track
                const clip = { id: `clip_${Date.now()}`, trackId: track.id, type: 'audio', startBeat: daw.currentBeat, duration: 4, label: sample.name, color: track.color };
                daw.dispatchClips?.({ type: 'ADD', clip });
              }}
            />
          )}
          {bottomTab === 'aichat' && (
            <AIAssistant
              tracks={tracks}
              bpm={bpm}
              steps={daw.sequencerSteps}
              clips={daw.clips}
            />
          )}
          {bottomTab === 'input' && (
            <InputPanel
              inputDevices={daw.inputDevices}
              selectedDeviceId={daw.selectedDeviceId}
              onDeviceChange={daw.setSelectedDevice}
              isMonitoring={daw.isMonitoring}
              onMonitoringChange={daw.setIsMonitoring}
              inputGain={daw.inputGain}
              onGainChange={daw.setInputGain}
              latencyCompensation={daw.latencyCompensation}
              onLatencyChange={daw.setLatencyCompensation}
              inputLevel={daw.inputLevel}
              inputActive={daw.inputActive}
              onLoadDevices={daw.loadInputDevices}
              onStartInput={daw.startInput}
              onStopInput={daw.stopInput}
              getSystemLatency={daw.getSystemLatency}
            />
          )}
        </div>
      </div>
    </div>
  );
}
