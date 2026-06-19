export default function StepSequencer({ tracks, steps, onStepsChange, currentBeat, isPlaying }) {
  const toggleStep = (trackName, idx) => {
    onStepsChange(prev => ({
      ...prev,
      [trackName]: prev[trackName].map((v, i) => i === idx ? !v : v),
    }));
  };

  const beatLabels = ['1', '+', '2', '+', '3', '+', '4', '+', '1', '+', '2', '+', '3', '+', '4', '+'];

  return (
    <div className="step-sequencer">
      <div className="seq-header">
        <span className="seq-title">BEAT GRID — 16 STEPS / BAR</span>
        <span className="seq-title">{isPlaying ? `▶ STEP ${(currentBeat + 1) || 1}` : '■ STOPPED'}</span>
      </div>

      <div style={{ display: 'flex', marginLeft: 72, gap: 3, marginBottom: 4 }}>
        {beatLabels.map((l, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 7,
            color: i % 4 === 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
            borderLeft: i % 4 === 0 ? '1px solid var(--border-subtle)' : 'none',
            paddingLeft: i % 4 === 0 ? 2 : 0,
          }}>{l}</div>
        ))}
      </div>

      {tracks.map(track => {
        const trackSteps = steps[track.name] || Array(16).fill(false);
        return (
          <div key={track.id} className="step-seq-track">
            <div className="step-seq-track-info">
              <span className="step-seq-track-name" style={{ color: track.color }}>{track.name}</span>
              <input type="range" min="0" max="100" defaultValue={track.volume} className="step-seq-track-vol"
                style={{ background: `linear-gradient(to right, ${track.color}88 ${track.volume}%, var(--bg-section) ${track.volume}%)` }}
              />
            </div>
            <div className="step-seq-steps">
              {[0, 4, 8, 12].map((groupStart, gi) => (
                <div key={gi} style={{ display: 'flex', gap: 3, flex: 1 }}>
                  {Array.from({ length: 4 }, (_, j) => {
                    const idx = groupStart + j;
                    const on = trackSteps[idx];
                    const isCurrent = isPlaying && currentBeat === idx;
                    return (
                      <button
                        key={idx}
                        className={`step-btn ${on ? 'on' : ''} ${isCurrent ? 'current' : ''}`}
                        style={{ '--step-color': track.color, flex: 1 }}
                        onClick={() => toggleStep(track.name, idx)}
                      />
                    );
                  })}
                  {gi < 3 && <div style={{ width: 4, flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>PATTERN</span>
        {['A','B','C','D'].map(p => (
          <button key={p} style={{
            width: 28, height: 20, borderRadius: 3,
            border: `1px solid ${p === 'A' ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
            background: p === 'A' ? 'var(--accent-cyan-glow)' : 'var(--bg-element)',
            color: p === 'A' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
          }}>{p}</button>
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.15em', marginLeft: 8 }}>SWING</span>
        <input type="range" min="0" max="100" defaultValue={0} style={{
          WebkitAppearance: 'none', width: 80, height: 3,
          background: 'var(--bg-section)', outline: 'none', borderRadius: 2,
        }} />
      </div>
    </div>
  );
}
