import { useState, useEffect, useRef } from 'react';
import { SampleStore, aiSearch, PRESET_TAGS } from '../audio/SampleStore.js';

const ACCENT = 'var(--accent-cyan)';

function btn(border, color, extra = {}) {
  return {
    padding: '3px 9px', borderRadius: 3, border: `1px solid ${border}`,
    background: 'none', color, fontFamily: 'var(--font-mono)',
    fontSize: 7, letterSpacing: '0.1em', cursor: 'pointer', ...extra,
  };
}

// ── Waveform ─────────────────────────────────────────────────────────────────

function Waveform({ peaks, color, progress = 0 }) {
  if (!peaks?.length) return (
    <div style={{ height: 28, background: 'var(--bg-element)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)' }}>NO WAVEFORM</span>
    </div>
  );
  const W = 240, H = 28, mid = H / 2;
  const bars = peaks.map((p, i) => {
    const x = (i / (peaks.length - 1)) * W;
    const h = p * mid * 0.9;
    return `M${x},${mid - h}L${x},${mid + h}`;
  }).join(' ');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', borderRadius: 2, background: 'var(--bg-element)' }}>
      {/* Played region */}
      <clipPath id={`cp_${peaks.length}`}><rect x={0} y={0} width={W * progress} height={H} /></clipPath>
      <path d={bars} stroke={color} strokeWidth={1.5} fill="none" clipPath={`url(#cp_${peaks.length})`} opacity={0.9} />
      {/* Unplayed region */}
      <clipPath id={`cu_${peaks.length}`}><rect x={W * progress} y={0} width={W} height={H} /></clipPath>
      <path d={bars} stroke="var(--border-strong)" strokeWidth={1.5} fill="none" clipPath={`url(#cu_${peaks.length})`} />
      {/* Playhead */}
      {progress > 0 && <line x1={W * progress} y1={0} x2={W * progress} y2={H} stroke={color} strokeWidth={1} opacity={0.7} />}
    </svg>
  );
}

// ── Tag editor ────────────────────────────────────────────────────────────────

function TagEditor({ tags, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const toggle = (tag) => {
    const next = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    onUpdate(next);
  };

  const addCustom = () => {
    const t = custom.trim().toLowerCase();
    if (t && !tags.includes(t)) onUpdate([...tags, t]);
    setCustom('');
  };

  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
        {tags.map(t => (
          <span
            key={t}
            onClick={() => toggle(t)}
            style={{
              padding: '2px 7px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(0,212,180,0.15)', border: '1px solid rgba(0,212,180,0.35)',
              color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.08em',
            }}
          >
            {t} ✕
          </span>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          style={{ ...btn(open ? ACCENT : 'var(--border-faint)', open ? ACCENT : 'var(--text-muted)'), padding: '2px 7px', fontSize: 6 }}
        >
          + TAG
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 5, padding: '7px 9px', background: 'var(--bg-element)', borderRadius: 3, border: '1px solid var(--border-faint)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {PRESET_TAGS.map(t => (
              <span
                key={t}
                onClick={() => toggle(t)}
                style={{
                  padding: '2px 7px', borderRadius: 10, cursor: 'pointer',
                  background: tags.includes(t) ? 'rgba(0,212,180,0.15)' : 'var(--bg-section)',
                  border: `1px solid ${tags.includes(t) ? 'rgba(0,212,180,0.4)' : 'var(--border-faint)'}`,
                  color: tags.includes(t) ? ACCENT : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.06em',
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="custom tag…"
              style={{
                flex: 1, fontFamily: 'var(--font-mono)', fontSize: 7,
                background: 'var(--bg-section)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '3px 7px', outline: 'none',
              }}
            />
            <button onClick={addCustom} style={btn(ACCENT, ACCENT)}>ADD</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sample row ────────────────────────────────────────────────────────────────

function SampleRow({ sample, tracks, playing, progress, onPreview, onStop, onDelete, onAdd, onUpdateMeta, projectBpm, tempoSync }) {
  const [showAdd,  setShowAdd]  = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  const [editBpm,  setEditBpm]  = useState(false);
  const [bpmVal,   setBpmVal]   = useState(String(SampleStore.effectiveBpm(sample) ?? ''));
  const isPlaying = playing === sample.id;

  const extColors = { WAV:'var(--accent-cyan)', MP3:'var(--accent-blue)', FLAC:'var(--accent-purple)', AIFF:'var(--accent-orange)' };
  const color = extColors[sample.ext] ?? 'var(--text-muted)';
  const sbpm  = SampleStore.effectiveBpm(sample);
  const rate  = tempoSync && sbpm && projectBpm ? (projectBpm / sbpm) : 1;

  const commitBpm = () => {
    const v = parseInt(bpmVal);
    if (v >= 40 && v <= 240) onUpdateMeta(sample.id, { userBpm: v });
    else onUpdateMeta(sample.id, { userBpm: null });
    setEditBpm(false);
  };

  return (
    <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-faint)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 3, flexShrink: 0,
          background: color + '18', border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 6, color, fontWeight: 700,
        }}>{sample.ext}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-bright)', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sample.name}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {SampleStore.formatDuration(sample.duration)} · {SampleStore.formatSize(sample.size)}
            </span>
            {/* BPM badge */}
            {sbpm && (
              <span
                onClick={() => setEditBpm(e => !e)}
                title="Click to override BPM"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 6, letterSpacing: '0.08em',
                  padding: '1px 5px', borderRadius: 2, cursor: 'pointer',
                  background: tempoSync && projectBpm ? 'rgba(0,212,180,0.15)' : 'var(--bg-element)',
                  color: tempoSync && projectBpm ? ACCENT : 'var(--text-muted)',
                  border: `1px solid ${tempoSync && projectBpm ? 'rgba(0,212,180,0.3)' : 'var(--border-faint)'}`,
                }}>
                {sample.userBpm ? '✎ ' : ''}{sbpm} BPM
                {tempoSync && projectBpm && rate !== 1 && ` → ×${rate.toFixed(2)}`}
              </span>
            )}
            {!sbpm && (
              <button onClick={() => setEditBpm(e => !e)} style={{ ...btn('var(--border-faint)', 'var(--text-muted)'), padding: '1px 5px', fontSize: 6 }}>
                + BPM
              </button>
            )}
          </div>
          {editBpm && (
            <div style={{ marginTop: 4, display: 'flex', gap: 5 }}>
              <input
                autoFocus value={bpmVal}
                onChange={e => setBpmVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') setEditBpm(false); }}
                placeholder="BPM e.g. 128"
                style={{
                  width: 80, fontFamily: 'var(--font-mono)', fontSize: 8,
                  background: 'var(--bg-element)', border: '1px solid var(--accent-cyan)',
                  color: 'var(--text-primary)', borderRadius: 2, padding: '2px 6px', outline: 'none',
                }}
              />
              <button onClick={commitBpm} style={btn(ACCENT, ACCENT)}>SET</button>
              <button onClick={() => { onUpdateMeta(sample.id, { userBpm: null }); setEditBpm(false); }} style={btn('var(--border-faint)', 'var(--text-muted)')}>CLEAR</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => isPlaying ? onStop() : onPreview(sample.id, rate)}
            style={{ ...btn(isPlaying ? ACCENT : 'var(--border-faint)', isPlaying ? ACCENT : 'var(--text-muted)'), padding: '2px 8px', fontSize: 10 }}
          >
            {isPlaying ? '■' : '▶'}
          </button>
          {confirm ? (
            <>
              <button onClick={() => setConfirm(false)} style={btn('var(--border-default)', 'var(--text-muted)')}>CANCEL</button>
              <button onClick={() => { onDelete(sample.id); setConfirm(false); }} style={btn('var(--accent-red)', 'var(--accent-red)')}>DEL</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirm(true)} style={{ ...btn('var(--border-faint)', 'var(--text-muted)'), padding: '2px 6px', fontSize: 10 }}>✕</button>
              <button onClick={() => setShowAdd(a => !a)} style={btn(showAdd ? ACCENT : 'var(--border-default)', showAdd ? ACCENT : 'var(--text-secondary)')}>+ ADD</button>
            </>
          )}
        </div>
      </div>

      <Waveform peaks={sample.peaks} color={color} progress={isPlaying ? progress : 0} />

      <TagEditor
        tags={sample.tags ?? []}
        onUpdate={tags => onUpdateMeta(sample.id, { tags })}
      />

      {showAdd && (
        <div style={{ marginTop: 7, padding: '7px 9px', background: 'var(--bg-element)', borderRadius: 3, border: '1px solid var(--border-faint)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.14em', marginBottom: 5 }}>ADD TO TRACK</div>
          {!tracks.length ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)' }}>No tracks yet</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {tracks.map(t => (
                <button key={t.id} onClick={() => { onAdd(sample, t); setShowAdd(false); }}
                  style={{ padding: '3px 9px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${t.color}44`, background: t.color + '18', color: t.color, fontFamily: 'var(--font-mono)', fontSize: 7 }}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SampleBrowserPanel({ tracks, bpm, onAddSampleToTrack }) {
  const [samples,   setSamples]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [query,     setQuery]     = useState('');
  const [aiMode,    setAiMode]    = useState(false);
  const [tempoSync, setTempoSync] = useState(false);
  const [playing,   setPlaying]   = useState(null);
  const [progress,  setProgress]  = useState(0);
  const fileRef    = useRef(null);
  const actxRef    = useRef(null);
  const srcRef     = useRef(null);
  const rafRef     = useRef(null);
  const startRef   = useRef(0);
  const durRef     = useRef(0);

  const refresh = async () => {
    setLoading(true);
    setSamples(await SampleStore.list());
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const stopPreview = () => {
    srcRef.current?.stop?.();
    actxRef.current?.close?.();
    cancelAnimationFrame(rafRef.current);
    actxRef.current = srcRef.current = null;
    setPlaying(null); setProgress(0);
  };

  useEffect(() => () => stopPreview(), []);

  const handlePreview = async (id, rate = 1) => {
    stopPreview();
    const entry = await SampleStore.getBuffer(id);
    if (!entry?.data) return;
    try {
      const ctx = new AudioContext();
      actxRef.current = ctx;
      const buf = await ctx.decodeAudioData(entry.data.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.loop = false;
      src.connect(ctx.destination);
      src.start(0);
      durRef.current  = buf.duration / rate;
      startRef.current = ctx.currentTime;
      srcRef.current  = src;
      setPlaying(id);

      const tick = () => {
        if (!actxRef.current) return;
        const elapsed = actxRef.current.currentTime - startRef.current;
        setProgress(Math.min(1, elapsed / durRef.current));
        if (elapsed < durRef.current) rafRef.current = requestAnimationFrame(tick);
        else { setPlaying(null); setProgress(0); }
      };
      rafRef.current = requestAnimationFrame(tick);
      src.onended = () => { if (actxRef.current === ctx) { ctx.close(); setPlaying(null); setProgress(0); } };
    } catch { setPlaying(null); }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    for (const f of files) await SampleStore.upload(f).catch(() => {});
    e.target.value = '';
    setUploading(false);
    refresh();
  };

  const handleDelete  = async (id) => { if (playing === id) stopPreview(); await SampleStore.delete(id); refresh(); };
  const handleUpdateMeta = async (id, updates) => { await SampleStore.updateMeta(id, updates); refresh(); };

  // Filter / AI search
  const trimmed = query.trim();
  let visible = samples;
  if (trimmed) {
    if (aiMode) {
      visible = aiSearch(trimmed, samples);
    } else {
      const lq = trimmed.toLowerCase();
      visible = samples.filter(s =>
        s.name.toLowerCase().includes(lq) ||
        (s.tags ?? []).some(t => t.toLowerCase().includes(lq))
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-void)' }}>
      {/* Toolbar */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.16em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>SAMPLES</span>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 120, position: 'relative' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={aiMode ? 'AI: "punchy kick" or "dark pad loop"…' : 'Search by name or tag…'}
            style={{
              width: '100%', fontFamily: 'var(--font-mono)', fontSize: 8,
              background: 'var(--bg-element)', border: `1px solid ${aiMode ? 'var(--accent-purple)' : 'var(--border-default)'}`,
              color: 'var(--text-primary)', borderRadius: 3, padding: '4px 8px', outline: 'none',
            }}
          />
        </div>

        {/* AI search toggle */}
        <button
          onClick={() => setAiMode(m => !m)}
          title="Toggle AI search"
          style={{
            ...btn(aiMode ? 'var(--accent-purple)' : 'var(--border-default)', aiMode ? 'var(--accent-purple)' : 'var(--text-muted)'),
            fontWeight: aiMode ? 700 : 400,
          }}
        >
          ◈ AI
        </button>

        {/* Tempo sync toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
          <div
            onClick={() => setTempoSync(t => !t)}
            style={{
              width: 26, height: 13, borderRadius: 7, position: 'relative',
              background: tempoSync ? ACCENT : 'var(--bg-element)',
              border: `1px solid ${tempoSync ? ACCENT : 'var(--border-default)'}`,
              transition: 'all 0.15s', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{ position: 'absolute', top: 2, left: tempoSync ? 13 : 2, width: 7, height: 7, borderRadius: '50%', background: tempoSync ? '#000' : 'var(--border-strong)', transition: 'left 0.15s' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: tempoSync ? ACCENT : 'var(--text-muted)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            TEMPO SYNC{tempoSync && bpm ? ` ${bpm}` : ''}
          </span>
        </label>

        <input ref={fileRef} type="file" accept="audio/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ ...btn(ACCENT, ACCENT), fontWeight: 700, opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap', padding: '4px 12px' }}>
          {uploading ? 'IMPORTING…' : '+ IMPORT'}
        </button>
      </div>

      {/* AI search mode hint */}
      {aiMode && (
        <div style={{ padding: '4px 12px', background: 'rgba(155,114,255,0.06)', borderBottom: '1px solid var(--border-faint)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--accent-purple)', letterSpacing: '0.1em' }}>
            AI SEARCH — try: "punchy kick" · "dark 808 bass" · "bright pad loop" · "120 bpm break"
          </span>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div onClick={() => !query && fileRef.current?.click()}
            style={{ padding: '32px 24px', textAlign: 'center', cursor: query ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 24, color: 'var(--border-strong)' }}>♬</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.14em' }}>
              {query ? (aiMode ? 'No matches — try different keywords' : 'No results') : 'No samples yet'}
            </div>
            {!query && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', opacity: 0.6 }}>Click + IMPORT or drag WAV · MP3 · FLAC</div>}
          </div>
        ) : (
          visible.map(s => (
            <SampleRow
              key={s.id} sample={s} tracks={tracks}
              playing={playing} progress={progress}
              onPreview={handlePreview} onStop={stopPreview}
              onDelete={handleDelete} onAdd={onAddSampleToTrack}
              onUpdateMeta={handleUpdateMeta}
              projectBpm={bpm} tempoSync={tempoSync}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {samples.length > 0 && (
        <div style={{ padding: '4px 12px', borderTop: '1px solid var(--border-faint)', fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>
          {visible.length}/{samples.length} samples
          {tempoSync && ' · TEMPO SYNC ON'}
          {playing && ' · PLAYING'}
        </div>
      )}
    </div>
  );
}
