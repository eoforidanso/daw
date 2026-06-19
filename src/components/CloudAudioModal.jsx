import { useState, useEffect, useRef } from 'react';
import { CloudAudio } from '../audio/CloudAudio.js';

const ACCENT = 'var(--accent-cyan)';

function btn(border, color, extra = {}) {
  return {
    padding: '4px 12px', borderRadius: 3,
    border: `1px solid ${border}`, background: 'none',
    color, fontFamily: 'var(--font-mono)', fontSize: 7,
    letterSpacing: '0.12em', cursor: 'pointer', ...extra,
  };
}

function FileTypeIcon({ type }) {
  const isWav  = type?.includes('wav');
  const isMp3  = type?.includes('mpeg') || type?.includes('mp3');
  const isFlac = type?.includes('flac');
  const label  = isWav ? 'WAV' : isMp3 ? 'MP3' : isFlac ? 'FLAC' : 'AUD';
  const color  = isWav ? 'var(--accent-cyan)' : isMp3 ? 'var(--accent-blue)' : 'var(--accent-purple)';
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 4, flexShrink: 0,
      background: color + '18', border: `1px solid ${color}40`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 7, color, letterSpacing: '0.06em', fontWeight: 700,
    }}>
      {label}
    </div>
  );
}

function QuotaBar({ quota }) {
  if (!quota) return null;
  const pct = Math.min(100, (quota.used / quota.total) * 100);
  const color = pct > 80 ? 'var(--accent-red)' : pct > 60 ? 'var(--accent-yellow)' : ACCENT;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>STORAGE</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
          {CloudAudio.formatSize(quota.used)} / {CloudAudio.formatSize(quota.total)} · {quota.files} files
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--bg-element)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function AudioRow({ file, onDelete, onDownload }) {
  const [confirm, setConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await onDownload(file.id);
      if (result?.data) {
        const blob = new Blob([result.data], { type: file.type });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: '1px solid var(--border-faint)',
    }}>
      <FileTypeIcon type={file.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-bright)', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
          {CloudAudio.formatSize(file.size)} · {CloudAudio.relativeTime(file.uploadedAt)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {confirm ? (
          <>
            <button onClick={() => setConfirm(false)} style={btn('var(--border-default)', 'var(--text-muted)')}>CANCEL</button>
            <button onClick={() => onDelete(file.id)} style={btn('var(--accent-red)', 'var(--accent-red)')}>DELETE</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirm(true)} style={{ ...btn('var(--border-faint)', 'var(--text-muted)'), fontSize: 10 }}>✕</button>
            <button onClick={handleDownload} disabled={downloading} style={btn(ACCENT, ACCENT)}>
              {downloading ? '…' : '↓ SAVE'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CloudAudioModal({ onClose }) {
  const [files, setFiles]     = useState([]);
  const [quota, setQuota]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError]     = useState('');
  const fileInputRef          = useRef(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [list, q] = await Promise.all([CloudAudio.list(), CloudAudio.getQuota()]);
      setFiles(list);
      setQuota(q);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleUpload = async (e) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setUploading(true);
    setError('');
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      setUploadPct(Math.round(((i) / picked.length) * 100));
      try {
        await CloudAudio.upload(file);
      } catch (err) {
        setError(`Upload failed: ${err?.message ?? 'unknown error'}`);
        break;
      }
    }
    setUploadPct(0);
    setUploading(false);
    e.target.value = '';
    refresh();
  };

  const handleDelete = async (id) => {
    await CloudAudio.delete(id);
    refresh();
  };

  const handleDownload = (id) => CloudAudio.download(id);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8, width: 500,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 96px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 13px', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.35em', color: 'var(--text-muted)', marginBottom: 4 }}>VOID STATION</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.18em', color: 'var(--text-bright)', fontWeight: 700 }}>CLOUD AUDIO</div>
            </div>
            <button onClick={onClose} style={btn('var(--border-faint)', 'var(--text-muted)', { padding: '4px 8px' })}>✕</button>
          </div>
        </div>

        <div style={{ padding: '14px 20px', flexShrink: 0, borderBottom: '1px solid var(--border-faint)' }}>
          <QuotaBar quota={quota} />

          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '1px dashed var(--border-strong)', borderRadius: 4, padding: '16px',
              textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
              background: uploading ? 'rgba(0,212,180,0.04)' : 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; e.currentTarget.style.background = 'rgba(0,212,180,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = uploading ? 'rgba(0,212,180,0.04)' : 'transparent'; }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: ACCENT, letterSpacing: '0.15em', marginBottom: 8 }}>
                  UPLOADING… {uploadPct}%
                </div>
                <div style={{ height: 2, background: 'var(--bg-element)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ width: `${uploadPct}%`, height: '100%', background: ACCENT, transition: 'width 0.2s' }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, marginBottom: 6, color: 'var(--text-muted)' }}>♫</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: 3 }}>
                  UPLOAD AUDIO FILES
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  WAV · MP3 · FLAC · AIFF · Click or drag
                </div>
              </>
            )}
          </div>
          {error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--accent-red)', marginTop: 7, letterSpacing: '0.1em' }}>{error}</div>}
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
              Loading…
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
              No files uploaded yet.<br/>
              <span style={{ fontSize: 7, marginTop: 6, display: 'block', opacity: 0.6 }}>Upload WAV, MP3, or FLAC files above.</span>
            </div>
          ) : (
            files.map(f => (
              <AudioRow
                key={f.id}
                file={f}
                onDelete={handleDelete}
                onDownload={handleDownload}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
