import { useRef, useEffect } from 'react';
import Knob from './Knob';

function ADSRCanvas({ a, d, s, r }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const atk = (a / 100) * W * 0.25;
    const dec = (d / 100) * W * 0.2;
    const sus = (s / 100) * H * 0.9;
    const rel = (r / 100) * W * 0.25;
    const baseX = W * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(atk, 4);
    ctx.lineTo(atk + dec, H - sus);
    ctx.lineTo(baseX + dec, H - sus);
    ctx.lineTo(baseX + dec + rel, H);
    ctx.strokeStyle = 'var(--accent-cyan)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(0, H);
    ctx.fillStyle = 'rgba(0,212,180,0.08)';
    ctx.fill();
    ctx.beginPath();
    [
      [0, H], [atk, 4], [atk + dec, H - sus],
      [baseX + dec, H - sus], [baseX + dec + rel, H]
    ].forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--accent-cyan)';
      ctx.fill();
    });
  }, [a, d, s, r]);
  return <canvas ref={ref} width={90} height={40} className="adsr-canvas" />;
}

export default function SynthPanel({ params, onUpdate, effectsMode }) {
  if (effectsMode) {
    return (
      <div className="effects-panel">
        {[
          { name: 'REVERB', keys: ['reverbMix', 'reverbSize'], labels: ['MIX', 'SIZE'], color: 'var(--accent-cyan)' },
          { name: 'DELAY', keys: ['delayTime', 'delayFeedback', 'delayMix'], labels: ['TIME', 'FEEDBK', 'MIX'], color: 'var(--accent-blue)' },
          { name: 'DISTORT', keys: ['distortion'], labels: ['DRIVE'], color: 'var(--accent-orange)' },
          { name: 'CHORUS', keys: ['chorus'], labels: ['DEPTH'], color: 'var(--accent-purple)' },
        ].map(fx => (
          <div key={fx.name} className="effect-module">
            <div className="effect-header">
              <span className="effect-title">{fx.name}</span>
              <button className="effect-bypass on">ON</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {fx.keys.map((k, i) => (
                <Knob key={k} value={params[k]} min={0} max={100}
                  onChange={v => onUpdate(k, v)} label={fx.labels[i]}
                  size={34} color={fx.color}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="synth-panel">
      {/* OSC 1 */}
      <div className="synth-section">
        <div className="synth-section-title">OSC 1</div>
        <div className="osc-type-btns">
          {[['∿','sine'],['⊓','square'],['∧','sawtooth'],['⌇','triangle']].map(([icon, type]) => (
            <button key={type} className={`osc-type-btn ${params.osc1Type === type ? 'on' : ''}`}
              onClick={() => onUpdate('osc1Type', type)} title={type}>{icon}</button>
          ))}
        </div>
        <div className="synth-row">
          <Knob value={params.osc1Detune} min={-50} max={50} onChange={v => onUpdate('osc1Detune', v)}
            label="TUNE" size={34} color="var(--accent-purple)" />
          <Knob value={50} min={0} max={100} onChange={() => {}} label="OCT" size={34} color="var(--accent-purple)" />
          <Knob value={70} min={0} max={100} onChange={() => {}} label="LEVEL" size={34} color="var(--accent-purple)" />
        </div>
      </div>

      {/* OSC 2 */}
      <div className="synth-section">
        <div className="synth-section-title">OSC 2</div>
        <div className="osc-type-btns">
          {[['∿','sine'],['⊓','square'],['∧','sawtooth'],['⌇','triangle']].map(([icon, type]) => (
            <button key={type} className={`osc-type-btn ${params.osc2Type === type ? 'on' : ''}`}
              onClick={() => onUpdate('osc2Type', type)} title={type}>{icon}</button>
          ))}
        </div>
        <div className="synth-row">
          <Knob value={params.osc2Detune} min={-50} max={50} onChange={v => onUpdate('osc2Detune', v)}
            label="TUNE" size={34} color="var(--accent-blue)" />
          <Knob value={40} min={0} max={100} onChange={() => {}} label="OCT" size={34} color="var(--accent-blue)" />
          <Knob value={50} min={0} max={100} onChange={() => {}} label="LEVEL" size={34} color="var(--accent-blue)" />
        </div>
      </div>

      {/* FILTER */}
      <div className="synth-section">
        <div className="synth-section-title">FILTER</div>
        <div className="filter-type-btns">
          {['LP','HP','BP','NT'].map(t => (
            <button key={t} className={`filter-type-btn ${params.filterType?.startsWith(t.toLowerCase()) ? 'on' : ''}`}
              onClick={() => onUpdate('filterType', t === 'LP' ? 'lowpass' : t === 'HP' ? 'highpass' : t === 'BP' ? 'bandpass' : 'notch')}>
              {t}
            </button>
          ))}
        </div>
        <div className="synth-row" style={{ marginTop: 4 }}>
          <Knob value={params.filterCutoff / 20} min={0} max={100} onChange={v => onUpdate('filterCutoff', v * 20)}
            label="CUTOFF" size={34} color="var(--accent-cyan)" />
          <Knob value={params.filterRes} min={0} max={100} onChange={v => onUpdate('filterRes', v)}
            label="RESO" size={34} color="var(--accent-cyan)" />
        </div>
      </div>

      {/* ENVELOPE */}
      <div className="synth-section">
        <div className="synth-section-title">ENVELOPE</div>
        <ADSRCanvas a={params.attack} d={params.decay} s={params.sustain} r={params.release} />
        <div className="synth-row">
          {[['attack','A'],['decay','D'],['sustain','S'],['release','R']].map(([k, l]) => (
            <Knob key={k} value={params[k]} min={0} max={100} onChange={v => onUpdate(k, v)}
              label={l} size={28} color="var(--accent-orange)" />
          ))}
        </div>
      </div>

      {/* LFO */}
      <div className="synth-section">
        <div className="synth-section-title">LFO</div>
        <div className="osc-type-btns">
          {['∿','⊓','∧','⌇'].map((icon, i) => (
            <button key={i} className={`osc-type-btn ${i === 0 ? 'on' : ''}`}>{icon}</button>
          ))}
        </div>
        <div className="synth-row">
          <Knob value={params.lfoRate} min={0} max={100} onChange={v => onUpdate('lfoRate', v)}
            label="RATE" size={34} color="var(--accent-yellow)" />
          <Knob value={params.lfoDepth} min={0} max={100} onChange={v => onUpdate('lfoDepth', v)}
            label="DEPTH" size={34} color="var(--accent-yellow)" />
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          {['FILTER','PITCH','AMP'].map(t => (
            <button key={t} style={{
              flex: 1, height: 16, border: '1px solid var(--border-default)',
              background: t === 'FILTER' ? 'var(--accent-yellow)' : 'var(--bg-element)',
              color: t === 'FILTER' ? '#000' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.08em',
              borderRadius: 2, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
