import { useState, useEffect } from 'react';
import Knob from './Knob';

function InputLevelMeter({ level, vertical = true }) {
  const segs = vertical ? 20 : 16;
  return (
    <div style={{
      display: 'flex',
      flexDirection: vertical ? 'column-reverse' : 'row',
      gap: 2,
      alignItems: 'center',
      ...(vertical ? { height: 80, width: 10 } : { width: '100%', height: 10 }),
    }}>
      {Array.from({ length: segs }, (_, i) => {
        const threshold = i / segs;
        const lit = level > threshold;
        const color = i >= segs - 2 ? 'var(--meter-red)' : i >= segs - 5 ? 'var(--meter-yellow)' : 'var(--meter-green)';
        return (
          <div key={i} style={{
            ...(vertical
              ? { width: '100%', height: `${100 / segs}%` }
              : { height: '100%', flex: 1 }),
            borderRadius: 1,
            background: color,
            opacity: lit ? 1 : 0.1,
            transition: 'opacity 0.04s',
          }} />
        );
      })}
    </div>
  );
}

function DeviceIcon({ label = '' }) {
  const lower = label.toLowerCase();
  if (lower.includes('usb') || lower.includes('piano') || lower.includes('keyboard'))
    return <span style={{ fontSize: 14 }}>🎹</span>;
  if (lower.includes('interface') || lower.includes('focusrite') || lower.includes('scarlett') || lower.includes('apollo') || lower.includes('motu'))
    return <span style={{ fontSize: 14 }}>🎛</span>;
  if (lower.includes('headset') || lower.includes('airpod') || lower.includes('bluetooth'))
    return <span style={{ fontSize: 14 }}>🎧</span>;
  return <span style={{ fontSize: 14 }}>🎙</span>;
}

export default function InputPanel({
  inputDevices, selectedDeviceId, onDeviceChange,
  isMonitoring, onMonitoringChange,
  inputGain, onGainChange,
  latencyCompensation, onLatencyChange,
  inputLevel, inputActive,
  onLoadDevices, onStartInput, onStopInput,
  getSystemLatency,
}) {
  const [inputType, setInputType] = useState('MIC');
  const [phaseInvert, setPhaseInvert] = useState(false);
  const [hpf, setHpf] = useState(false);
  const [pad, setPad] = useState(false);
  const [systemLatency, setSystemLatency] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    setSystemLatency(getSystemLatency());
  }, [getSystemLatency]);

  const handleLoadDevices = async () => {
    const devices = await onLoadDevices();
    setPermissionDenied(devices.length === 0);
    setSystemLatency(getSystemLatency());
  };

  const handleStartStop = async () => {
    if (inputActive) {
      onStopInput();
    } else {
      await onStartInput(selectedDeviceId, inputGain, isMonitoring);
    }
  };

  const dbVal = inputLevel > 0
    ? Math.max(-60, Math.round(20 * Math.log10(inputLevel)))
    : null;

  const selectedDevice = inputDevices.find(d => d.deviceId === selectedDeviceId);
  const adjustedLatency = systemLatency !== null ? Math.max(0, systemLatency + latencyCompensation) : null;

  return (
    <div className="input-panel">

      {/* ── Device Selection ─────────────────────────── */}
      <div className="input-section">
        <div className="input-section-title">INPUT DEVICE</div>

        <div className="input-device-row">
          {selectedDevice && <DeviceIcon label={selectedDevice.label} />}
          <select
            className="device-select"
            value={selectedDeviceId}
            onChange={e => onDeviceChange(e.target.value)}
          >
            {inputDevices.length === 0
              ? <option value="default">No devices — click SCAN</option>
              : inputDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`}
                </option>
              ))}
          </select>
          <button className="input-action-btn" onClick={handleLoadDevices} title="Scan for audio devices">
            SCAN
          </button>
        </div>

        {permissionDenied && (
          <div className="input-warning">
            Microphone access denied — check browser/OS permissions
          </div>
        )}

        <div className="input-type-row">
          {[['MIC','Condenser / Dynamic microphone'],
            ['INST','Guitar, bass, or line instrument'],
            ['LINE','Line-level source (keyboard, synth)'],
            ['STEREO','Stereo input pair']].map(([t, tip]) => (
            <button key={t} className={`input-type-btn ${inputType === t ? 'on' : ''}`}
              onClick={() => setInputType(t)} title={tip}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Input Gain + Level Meter ─────────────────── */}
      <div className="input-section">
        <div className="input-section-title">INPUT GAIN</div>
        <div className="gain-row">
          <Knob
            value={inputGain} min={0} max={100}
            onChange={v => { onGainChange(v); }}
            label="GAIN" size={54}
            color="var(--accent-orange)"
          />
          <div className="vu-pair">
            <InputLevelMeter level={inputLevel} vertical />
            <InputLevelMeter level={inputLevel * 0.97} vertical />
          </div>
          <div className="gain-info">
            <div className="db-readout">
              {dbVal !== null ? `${dbVal} dBFS` : '— dBFS'}
            </div>
            <div className="clip-indicator" style={{ opacity: inputLevel > 0.95 ? 1 : 0.15 }}>
              CLIP
            </div>
            <div className="input-options-row">
              {[['Ø', phaseInvert, setPhaseInvert, 'Phase invert'],
                ['HPF', hpf, setHpf, 'High-pass filter at 80Hz'],
                ['-10', pad, setPad, '-10dB input pad']
              ].map(([label, active, set, title]) => (
                <button key={label}
                  className={`input-option-btn ${active ? 'on' : ''}`}
                  onClick={() => set(a => !a)}
                  title={title}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Monitoring ────────────────────────────────── */}
      <div className="input-section">
        <div className="input-section-title">MONITORING</div>
        <div className="monitor-row">
          <button
            className={`start-stop-btn ${inputActive ? 'active' : ''}`}
            onClick={handleStartStop}
          >
            {inputActive ? '■ STOP' : '▶ ARM INPUT'}
          </button>
          <button
            className={`monitor-toggle ${isMonitoring ? 'on' : ''}`}
            onClick={() => onMonitoringChange(!isMonitoring)}
            disabled={!inputActive}
            title="Hear your input through the DAW output"
          >
            <span className="monitor-dot" />
            {isMonitoring ? 'MON ON' : 'MON OFF'}
          </button>
        </div>
        {isMonitoring && inputActive && (
          <div className="monitor-warning">
            ⚠ USE HEADPHONES — speaker output may cause feedback
          </div>
        )}
        {inputActive && !isMonitoring && (
          <div className="monitor-info">
            Direct monitoring off — enable to hear yourself through DAW
          </div>
        )}
      </div>

      {/* ── Latency Compensation ─────────────────────── */}
      <div className="input-section latency-section">
        <div className="input-section-title">LATENCY COMPENSATION</div>
        <div className="latency-row">
          <div className="latency-stat">
            <div className="latency-stat-label">SYSTEM</div>
            <div className="latency-stat-value">
              {systemLatency !== null ? `${systemLatency}ms` : '—'}
            </div>
          </div>

          <div className="latency-slider-wrap">
            <div className="latency-slider-label">
              OFFSET&nbsp;
              <span style={{ color: latencyCompensation < 0 ? 'var(--accent-orange)' : 'var(--accent-cyan)' }}>
                {latencyCompensation >= 0 ? '+' : ''}{latencyCompensation}ms
              </span>
            </div>
            <input
              type="range" min="-50" max="50" step="1"
              value={latencyCompensation}
              onChange={e => onLatencyChange(+e.target.value)}
              className="latency-slider"
              style={{
                background: `linear-gradient(to right,
                  var(--bg-section) 0%,
                  var(--bg-section) ${(latencyCompensation + 50)}%,
                  var(--accent-cyan) ${(latencyCompensation + 50)}%,
                  var(--accent-cyan) 50%,
                  var(--bg-section) 50%,
                  var(--bg-section) 100%
                )`
              }}
            />
            <div className="latency-ticks">
              <span>-50ms</span><span>0</span><span>+50ms</span>
            </div>
          </div>

          <div className="latency-stat" style={{ borderColor: 'var(--accent-cyan)' }}>
            <div className="latency-stat-label">ADJUSTED</div>
            <div className="latency-stat-value" style={{ color: 'var(--accent-cyan)' }}>
              {adjustedLatency !== null ? `${adjustedLatency}ms` : '—'}
            </div>
          </div>
        </div>

        <div className="latency-hint">
          Drag BPM in transport or press PLAY — the compensation offset shifts recording
          timing so clips land on the grid. Negative offset = record early; positive = record late.
        </div>
      </div>

    </div>
  );
}
