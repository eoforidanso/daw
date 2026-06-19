// Pure-JS MIDI file writer — no dependencies
export class MIDIExport {
  static download(clips, bpm, filename = 'export.mid') {
    const data = MIDIExport.encode(clips, bpm);
    if (!data.length) return;
    const blob = new Blob([data], { type: 'audio/midi' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  static encode(clips, bpm, ticksPerBeat = 480) {
    const midiClips = clips.filter(c => c.type === 'midi' && c.notes?.length > 0);
    if (!midiClips.length) return new Uint8Array(0);

    const header = MIDIExport._header(1, midiClips.length + 1, ticksPerBeat);

    // Tempo track
    const tempoTrack = MIDIExport._buildTrack([
      { tick: 0, data: MIDIExport._tempoEvent(bpm) },
      { tick: 0, data: [0xFF, 0x2F, 0x00] },
    ]);

    // One track per MIDI clip
    const noteTracks = midiClips.map((clip, ci) => {
      const events = [];
      const ch = ci % 16;

      const nameBytes = [...new TextEncoder().encode(clip.name ?? `Clip ${ci + 1}`)];
      events.push({ tick: 0, data: [0xFF, 0x03, nameBytes.length, ...nameBytes] });

      const sorted = [...(clip.notes ?? [])].sort(
        (a, b) => ((clip.startBeat ?? 0) + a.startBeat) - ((clip.startBeat ?? 0) + b.startBeat)
      );
      for (const note of sorted) {
        const absBeat   = (clip.startBeat ?? 0) + (note.startBeat ?? 0);
        const startTick = Math.round(absBeat * ticksPerBeat);
        const endTick   = startTick + Math.max(1, Math.round((note.durationBeats ?? 0.5) * ticksPerBeat));
        const pitch     = Math.max(0, Math.min(127, note.pitch ?? 60));
        const vel       = Math.max(1, Math.min(127, note.velocity ?? 100));
        events.push({ tick: startTick, data: [0x90 | ch, pitch, vel] });
        events.push({ tick: endTick,   data: [0x80 | ch, pitch, 0] });
      }

      const lastTick = events.reduce((m, e) => Math.max(m, e.tick), 0);
      events.push({ tick: lastTick, data: [0xFF, 0x2F, 0x00] });
      events.sort((a, b) => a.tick - b.tick);
      return MIDIExport._buildTrack(events);
    });

    const parts  = [header, tempoTrack, ...noteTracks];
    const total  = parts.reduce((s, p) => s + p.length, 0);
    const out    = new Uint8Array(total);
    let offset   = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }

  static _header(format, numTracks, tpb) {
    return new Uint8Array([
      0x4D,0x54,0x68,0x64,
      0x00,0x00,0x00,0x06,
      0x00, format & 0xFF,
      (numTracks >> 8) & 0xFF, numTracks & 0xFF,
      (tpb >> 8) & 0xFF, tpb & 0xFF,
    ]);
  }

  static _tempoEvent(bpm) {
    const us = Math.round(60_000_000 / bpm);
    return [0xFF, 0x51, 0x03, (us >> 16) & 0xFF, (us >> 8) & 0xFF, us & 0xFF];
  }

  static _buildTrack(events) {
    const bytes = [];
    let prevTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - prevTick);
      bytes.push(...MIDIExport._varLen(delta));
      bytes.push(...ev.data);
      prevTick = ev.tick;
    }
    const len = bytes.length;
    return new Uint8Array([
      0x4D,0x54,0x72,0x6B,
      (len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF,
      ...bytes,
    ]);
  }

  static _varLen(n) {
    if (n < 0x80) return [n];
    const bytes = [];
    while (n > 0) { bytes.unshift(n & 0x7F); n >>= 7; }
    for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 0x80;
    return bytes;
  }
}
