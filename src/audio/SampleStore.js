import { detectBPMFromBuffer } from './BPMDetector.js';

const DB_NAME    = 'void_samples';
const DB_VERSION = 2;
const STORE      = 'samples';

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

async function extractPeaks(arrayBuffer, n = 80) {
  const ctx     = new AudioContext();
  let decoded;
  try { decoded = await ctx.decodeAudioData(arrayBuffer.slice(0)); }
  catch { return { peaks: [], duration: 0 }; }
  finally { ctx.close(); }

  const ch    = decoded.getChannelData(0);
  const block = Math.floor(ch.length / n);
  const peaks = [];
  for (let i = 0; i < n; i++) {
    let max = 0;
    const s = i * block;
    for (let j = 0; j < block; j++) { const v = Math.abs(ch[s + j] ?? 0); if (v > max) max = v; }
    peaks.push(Math.min(1, max));
  }
  return { peaks, duration: decoded.duration };
}

export const SampleStore = {
  async upload(file) {
    const db     = await openDB();
    const buffer = await file.arrayBuffer();

    const [{ peaks, duration }, bpm] = await Promise.all([
      extractPeaks(buffer),
      detectBPMFromBuffer(buffer).catch(() => null),
    ]);

    const entry = {
      id:          `s_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name:        file.name.replace(/\.[^.]+$/, ''),
      ext:         file.name.split('.').pop().toUpperCase(),
      type:        file.type || 'audio/wav',
      size:        buffer.byteLength,
      duration,
      peaks,
      detectedBpm: bpm,
      userBpm:     null,    // overridable by user
      isLoop:      duration > 0.5 && duration < 30 && bpm !== null,
      tags:        [],
      data:        buffer,
      uploadedAt:  Date.now(),
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });

    const { data: _, ...meta } = entry;
    return meta;
  },

  async list() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(
        req.result
          .map(({ data: _, ...m }) => m)
          .sort((a, b) => b.uploadedAt - a.uploadedAt)
      );
      req.onerror = () => reject(req.error);
    });
  },

  async getBuffer(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  },

  async updateMeta(id, updates) {
    const db = await openDB();
    return new Promise(async (resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        if (!req.result) return resolve();
        tx.objectStore(STORE).put({ ...req.result, ...updates });
      };
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  },

  async delete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  },

  effectiveBpm(sample) {
    return sample.userBpm ?? sample.detectedBpm ?? null;
  },

  formatDuration(s) {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  },

  formatSize(bytes) {
    if (!bytes) return '—';
    return bytes < 1_048_576
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1_048_576).toFixed(1)} MB`;
  },
};

// ── AI sample search ─────────────────────────────────────────────────────────
// Scores each sample by relevance to a free-text query.
// No API call: uses keyword→tag/name matching with weights.

const SYNONYMS = {
  kick: ['kick','808','bass drum','bd'],
  snare: ['snare','sd','clap','snap'],
  hihat: ['hihat','hi-hat','hat','hh','cymbal'],
  bass: ['bass','sub','low end','808'],
  lead: ['lead','melody','riff','hook','synth'],
  pad: ['pad','atmosphere','atmo','ambient','drone'],
  chord: ['chord','stab','pluck','arp','harmonic'],
  vocal: ['vocal','vox','voice','acapella','chop'],
  fx: ['fx','effect','riser','drop','impact','hit','foley'],
  loop: ['loop','groove','break','phrase','pattern'],
  oneshot: ['oneshot','one-shot','single','hit','slam'],
  punchy: ['punchy','tight','aggressive','hard','heavy'],
  soft: ['soft','gentle','mellow','warm','smooth'],
  bright: ['bright','crisp','airy','sparkle','shimmer'],
  dark: ['dark','deep','murky','dirty','distorted'],
};

function expandQuery(query) {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set(words);
  for (const [canonical, syns] of Object.entries(SYNONYMS)) {
    if (words.some(w => syns.includes(w) || w === canonical)) {
      expanded.add(canonical);
      syns.forEach(s => expanded.add(s));
    }
  }
  return [...expanded];
}

export function aiSearch(query, samples) {
  if (!query.trim()) return samples;
  const terms = expandQuery(query);

  const scored = samples.map(s => {
    let score = 0;
    const nameWords = s.name.toLowerCase().split(/[\s_\-\.]+/);
    const allText   = [...nameWords, ...(s.tags ?? []).map(t => t.toLowerCase())];

    for (const term of terms) {
      // Exact tag match (strongest)
      if ((s.tags ?? []).some(t => t.toLowerCase() === term)) score += 10;
      // Partial name match
      if (nameWords.some(w => w.includes(term) || term.includes(w))) score += 5;
      // Ext match (e.g. query "wav")
      if (s.ext?.toLowerCase() === term) score += 3;
      // BPM range query (e.g. "120 bpm")
      const bpmMatch = query.match(/(\d{2,3})\s*bpm/i);
      if (bpmMatch) {
        const target = parseInt(bpmMatch[1]);
        const sbpm   = SampleStore.effectiveBpm(s);
        if (sbpm && Math.abs(sbpm - target) <= 5) score += 8;
      }
    }
    return { sample: s, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.sample);
}

export const PRESET_TAGS = [
  'kick','snare','hihat','clap','bass','lead','pad','chord',
  'vocal','fx','loop','oneshot','punchy','soft','bright','dark',
  '808','break','arp','riser','ambient',
];
