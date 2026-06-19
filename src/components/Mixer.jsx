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
function EQSection({ trackId, color, onEQChange }) {
  const [eq, setEQ] = useState({ low: 0, mid: 0, high: 0 });
  const update = (band, val) => {
    const next = { ...eq, [band]: val };
    setEQ(next);
    onEQChange(trackId, band, val);
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
const FX_ORDER = ['REV', 'DLY', 'DIST', 'CHO'];

function ChannelStrip({ track, onUpdate, getLevel, isPlaying, onEQChange, isMaster, onExportMidi, onInsertToggle }) {
  const [effects, setEffects] = useState({ REV: false, DLY: false, DIST: false, CHO: false });
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
        <EQSection trackId={track.id} color={color} onEQChange={onEQChange} />
      )}

      {/* Insert FX slots */}
      {!isMaster && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {Object.keys(effects).map(fx => (
            <InsertSlot key={fx} name={fx}
              color={fx === 'REV' ? 'var(--accent-blue)' : fx === 'DLY' ? 'var(--accent-cyan)' : fx === 'DIST' ? 'var(--accent-orange)' : 'var(--accent-purple)'}
              active={effects[fx]}
              onToggle={() => handleFxToggle(fx)}
            />
          ))}
        </div>
      )}

      {/* Pan */}
      <Knob
        value={track.pan + 50} min={0} max={100}
        onChange={v => !isMaster && onUpdate(track.id, { pan: v - 50 })}
        label="PAN" size={26}
        color={typeof color === 'string' && color.startsWith('var') ? 'var(--accent-cyan)' : color}
        showValue={false}
      />

      {/* Fader + VU */}
      <div className="mixer-fader-area">
        <div className="mixer-fader-wrap">
          <input
            type="range" min="0" max="100" value={track.volume}
            onChange={e => !isMaster && onUpdate(track.id, { volume: +e.target.value })}
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

export default function Mixer({ tracks, onTrackUpdate, isPlaying, getTrackLevel, getMasterLevel, setTrackEQ, clips, bpm, onInsertToggle }) {
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
    </div>
  );
}
