import { useState, useEffect, useRef, useCallback } from 'react';
import Knob from './Knob';
import SpectrumEQ from './SpectrumEQ';
import { MIDIExport } from '../audio/MIDIExport.js';

// ── Live VU meter ─────────────────────────────────────────────────
function VUMeter({ getLevel, active }) {
  const [segs, setSegs] = useState(Array(16).fill(0));
  const rafRef = useRef(null);
  const peakRef = useRef(0);

  useEffect(() => {
    if (!active) { setSegs(Array(16).fill(0)); return; }
    const tick = () => {
      const raw = getLevel();
      peakRef.current = Math.max(raw, peakRef.current * 0.97);
      const lit = Math.round(peakRef.current * 16);
      setSegs(Array(16).fill(0).map((_, i) => i < lit ? 1 : 0));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, getLevel]);

  return (
    <div className="vu-meter">
      {segs.map((lit, i) => {
        const cls = i >= 14 ? 'r' : i >= 11 ? 'y' : 'g';
        return <div key={i} className={`vu-seg ${cls}`} style={{ opacity: lit ? 1 : 0.1 }} />;
      })}
    </div>
  );
}

// ── Mini EQ frequency response SVG ───────────────────────────────
function EQCurve({ low, mid, high, color }) {
  const W = 60, H = 26;
  // Approximate the EQ curve visually (not real bode plot, just impression)
  const pts = [];
  for (let i = 0; i <= W; i++) {
    const logF = Math.pow(10, 1.7 + (i / W) * 2.7); // 50Hz – 20kHz
    let db = 0;
    if (logF < 400) db += low * (1 - logF / 400);
    const midGain = mid * Math.exp(-Math.pow(Math.log(logF / 1500), 2) * 3);
    db += midGain;
    if (logF > 3000) db += high * ((logF - 3000) / 17000);
    const y = H / 2 - (db / 24) * (H / 2);
    pts.push(`${i},${Math.max(2, Math.min(H - 2, y))}`);
  }
  const path = `M ${pts.join(' L ')}`;
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <line x1={0} y1={H/2} x2={W} y2={H/2} stroke="var(--border-faint)" strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ── EQ section per channel ────────────────────────────────────────
function EQSection({ trackId, color, onEQChange, onRecordParam }) {
  const [eq, setEQ] = useState({ low: 0, mid: 0, high: 0 });
  const update = (band, val) => {
    const next = { ...eq, [band]: val };
    setEQ(next);
    onEQChange(trackId, band, val);
    onRecordParam?.(trackId, `eq${band.charAt(0).toUpperCase() + band.slice(1)}`, val);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <EQCurve {...eq} color={color} />
      <div style={{ display: 'flex', gap: 4 }}>
        {[['low','L'],['mid','M'],['high','H']].map(([band, label]) => (
          <Knob key={band} value={eq[band] + 12} min={0} max={24}
            onChange={v => update(band, v - 12)}
            label={label} size={22}
            color={band === 'low' ? 'var(--accent-orange)' : band === 'mid' ? 'var(--accent-cyan)' : 'var(--accent-blue)'}
            showValue={false}
          />
        ))}
      </div>
    </div>
  );
}

// ── Insert effect slot ────────────────────────────────────────────
function InsertSlot({ name, color, active, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        height: 14, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? color + '33' : 'var(--bg-element)',
        border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.08em', color: active ? color : 'var(--text-muted)' }}>
        {name}
      </span>
    </div>
  );
}

// ── Channel strip ─────────────────────────────────────────────────
const FX_ORDER = ['REV', 'DLY', 'DIST', 'CHO', 'PHA', 'FLG', 'BIT', 'TAPE'];
const FX_COLORS = {
  REV:'var(--accent-blue)', DLY:'var(--accent-cyan)', DIST:'var(--accent-orange)', CHO:'var(--accent-purple)',
  PHA:'#7bffcc', FLG:'#ffdb4d', BIT:'#ff4d4d', TAPE:'#c8a06e',
};

function ChannelStrip({ track, onUpdate, getLevel, isPlaying, onEQChange, isMaster, onExportMidi, onInsertToggle, onRecordParam, tracks, sidechainSource, onSidechainChange }) {
  const [effects, setEffects] = useState(Object.fromEntries(FX_ORDER.map(k => [k, false])));
  const color = isMaster ? 'var(--accent-cyan)' : track.color;
  const getBound = useCallback(() => getLevel(track.id), [getLevel, track.id]);

  const handleFxToggle = useCallback((fx) => {
    if (isMaster) return;
    const next = !effects[fx];
    setEffects(e => ({ ...e, [fx]: next }));
    onInsertToggle?.(track.id, FX_ORDER.indexOf(fx), next ? fx : null);
  }, [effects, isMaster, track.id, onInsertToggle]);

  return (
    <div className={`mixer-channel ${isMaster ? 'master' : ''}`}
      style={{ borderColor: isMaster ? 'var(--accent-cyan)' : undefined }}>

      {/* Track label */}
      <div className="mixer-channel-top">
        <div className="mixer-color-dot" style={{
          background: typeof color === 'string' && color.startsWith('var') ? 'var(--accent-cyan)' : color
        }} />
        <span className="mixer-channel-name">{track.name}</span>
        {!isMaster && onExportMidi && (
          <button
            onClick={() => onExportMidi(track.id, track.name)}
            title="Export MIDI"
            style={{ marginLeft: 'auto', flexShrink: 0, padding: '0 3px', height: 12, borderRadius: 2, border: '1px solid var(--border-subtle)', background: 'var(--bg-element)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 6, cursor: 'pointer', lineHeight: 1 }}
          >.mid</button>
        )}
      </div>

      {/* EQ */}
      {!isMaster && (
        <EQSection trackId={track.id} color={color} onEQChange={onEQChange} onRecordParam={onRecordParam} />
      )}

      {/* Insert FX slots */}
      {!isMaster && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {FX_ORDER.map(fx => (
            <InsertSlot key={fx} name={fx} color={FX_COLORS[fx] ?? 'var(--accent-cyan)'}
              active={effects[fx]} onToggle={() => handleFxToggle(fx)} />
          ))}
        </div>
      )}
      {/* Sidechain source selector */}
      {!isMaster && tracks?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 5, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SC</span>
          <select value={sidechainSource ?? ''} onChange={e => onSidechainChange?.(track.id, e.target.value || null)}
            style={{ flex: 1, fontSize: 6, fontFamily: 'var(--font-mono)', background: 'var(--bg-element)', color: 'var(--text-secondary)', border: '1px solid var(--border-faint)', borderRadius: 2, padding: '1px 2px' }}>
            <option value="">OFF</option>
            {tracks.filter(t => t.id !== track.id).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Pan */}
      <Knob
        value={track.pan + 50} min={0} max={100}
        onChange={v => { if (isMaster) return; onUpdate(track.id, { pan: v - 50 }); onRecordParam?.(track.id, 'pan', v - 50); }}
        label="PAN" size={26}
        color={typeof color === 'string' && color.startsWith('var') ? 'var(--accent-cyan)' : color}
        showValue={false}
      />

      {/* Fader + VU */}
      <div className="mixer-fader-area">
        <div className="mixer-fader-wrap">
          <input
            type="range" min="0" max="100" value={track.volume}
            onChange={e => { if (isMaster) return; const v = +e.target.value; onUpdate(track.id, { volume: v }); onRecordParam?.(track.id, 'volume', v); }}
            className="mixer-fader"
            style={{
              background: `linear-gradient(to top,
                ${typeof color === 'string' && color.startsWith('var') ? 'var(--accent-cyan)' : color}88 ${track.volume}%,
                var(--bg-void) ${track.volume}%)`
            }}
          />
        </div>
        <VUMeter getLevel={getBound} active={isPlaying && !track.mute} />
      </div>

      {/* dB readout */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', textAlign: 'center' }}>
        {track.volume === 0 ? '–∞' : `${Math.round(20 * Math.log10(track.volume / 100))} dB`}
      </div>

      {/* Mute/Solo */}
      <div className="mixer-channel-btns">
        <button className={`mx-btn mute ${track.mute ? 'on' : ''}`}
          onClick={() => !isMaster && onUpdate(track.id, { mute: !track.mute })}>M</button>
        <button className={`mx-btn solo ${track.solo ? 'on' : ''}`}
          onClick={() => !isMaster && onUpdate(track.id, { solo: !track.solo })}>S</button>
      </div>
    </div>
  );
}

const MASTER = { id: 0, name: 'MASTER', color: 'var(--accent-cyan)', volume: 80, pan: 0, mute: false, solo: false };

// ── Master bus chain controls ─────────────────────────────────────
function MasterChain({ setMasterComp, getMasterCompReduction, getLUFS, isPlaying }) {
  const [comp, setComp] = useState({ threshold: -18, ratio: 4, attack: 10, release: 250, knee: 8 });
  const [lufs, setLufs] = useState(-70);
  const [gr,   setGr]   = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setLufs(Math.round((getLUFS?.() ?? -70) * 10) / 10);
      setGr(Math.round((getMasterCompReduction?.() ?? 0) * 10) / 10);
    }, 100);
    return () => clearInterval(id);
  }, [isPlaying, getLUFS, getMasterCompReduction]);

  const update = (key, val) => {
    const next = { ...comp, [key]: val };
    setComp(next);
    setMasterComp?.({ [key]: key === 'attack' ? val / 1000 : key === 'release' ? val / 1000 : val });
  };

  const knobDefs = [
    { key: 'threshold', label: 'THR', min: -40, max: 0, color: 'var(--accent-cyan)', unit: 'dB' },
    { key: 'ratio',     label: 'RATIO', min: 1, max: 20, color: 'var(--accent-purple)', unit: ':1' },
    { key: 'attack',    label: 'ATK', min: 1, max: 100, color: 'var(--accent-orange)', unit: 'ms' },
    { key: 'release',   label: 'REL', min: 50, max: 1000, color: 'var(--accent-blue)', unit: 'ms' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border-faint)', background: 'var(--bg-section)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>MASTER BUS COMPRESSOR</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {knobDefs.map(({ key, label, min, max, color, unit }) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Knob value={comp[key]} min={min} max={max} onChange={v => update(key, v)}
              label={label} size={24} color={color} showValue={false} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)' }}>{comp[key]}{unit}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: gr < -0.5 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
            GR: {gr.toFixed(1)} dB
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: lufs > -9 ? 'var(--accent-orange)' : lufs > -14 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
            LUFS: {lufs.toFixed(1)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)' }}>
            {lufs > -9 ? 'LOUD' : lufs > -14 ? 'OK' : lufs > -23 ? 'SOFT' : 'QUIET'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Mixer({ tracks, onTrackUpdate, isPlaying, getTrackLevel, getMasterLevel, setTrackEQ, clips, bpm, onInsertToggle, onRecordParam, sidechainMap, onSidechainChange, setMasterComp, getMasterCompReduction, getLUFS }) {
  const safeGetLevel = getTrackLevel ?? (() => 0);
  const safeGetMaster = getMasterLevel ?? (() => 0);
  const safeSetEQ = setTrackEQ ?? (() => {});

  const masterGetLevel = useCallback(() => safeGetMaster(), [safeGetMaster]);

  const handleExportMidi = useCallback((trackId, trackName) => {
    const trackClips = (clips ?? []).filter(c => c.trackId === trackId && c.type === 'midi' && c.notes?.length > 0);
    if (!trackClips.length) return;
    MIDIExport.download(trackClips, bpm ?? 120, `${trackName.toLowerCase().replace(/\s+/g, '_')}.mid`);
  }, [clips, bpm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SpectrumEQ />
      <div className="mixer" style={{ flex: 1, overflow: 'auto' }}>
      {tracks.map(t => (
        <ChannelStrip
          key={t.id}
          track={t}
          onUpdate={onTrackUpdate}
          getLevel={safeGetLevel}
          isPlaying={isPlaying}
          onEQChange={safeSetEQ}
          isMaster={false}
          onExportMidi={handleExportMidi}
          onInsertToggle={onInsertToggle}
          onRecordParam={onRecordParam}
          tracks={tracks}
          sidechainSource={sidechainMap?.[t.id]}
          onSidechainChange={onSidechainChange}
        />
      ))}
      <div style={{ width: 1, background: 'var(--border-default)', margin: '0 4px', flexShrink: 0 }} />
      <ChannelStrip
        track={MASTER}
        onUpdate={() => {}}
        getLevel={masterGetLevel}
        isPlaying={isPlaying}
        onEQChange={() => {}}
        isMaster
      />
      </div>
      <MasterChain
        setMasterComp={setMasterComp}
        getMasterCompReduction={getMasterCompReduction}
        getLUFS={getLUFS}
        isPlaying={isPlaying}
      />
    </div>
  );
}
