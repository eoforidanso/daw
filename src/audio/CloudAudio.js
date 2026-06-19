// Cloud Audio Storage — IndexedDB for local/mock storage.
// To connect a real backend, swap the IndexedDB calls with:
//   upload   → fetch presigned S3/GCS PUT URL, then PUT the ArrayBuffer
//   list     → GET /audio-files
//   download → GET presigned download URL
//   delete   → DELETE /audio-files/:id

const DB_NAME    = 'void_audio_db';
const DB_VERSION = 1;
const STORE      = 'audio_files';
const MOCK_QUOTA = 500 * 1024 * 1024; // 500 MB

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export const CloudAudio = {
  async upload(file) {
    await delay(300 + file.size / 50_000); // simulate upload time proportional to size
    const db = await openDB();
    const buffer = await file.arrayBuffer();
    const entry = {
      id:         `af_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name:       file.name,
      type:       file.type || 'audio/wav',
      size:       buffer.byteLength,
      data:       buffer,
      uploadedAt: Date.now(),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
    const { data: _, ...meta } = entry;
    return meta;
  },

  async list() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(
        req.result
          .map(({ data: _, ...meta }) => meta)
          .sort((a, b) => b.uploadedAt - a.uploadedAt)
      );
      req.onerror = () => reject(req.error);
    });
  },

  async download(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  },

  async delete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  },

  async getQuota() {
    const files = await this.list();
    const used  = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    return { used, total: MOCK_QUOTA, files: files.length };
  },

  formatSize(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  },

  relativeTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  },
};
