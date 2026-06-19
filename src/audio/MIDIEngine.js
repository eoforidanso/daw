class MIDIEngine {
  constructor() {
    this.access = null;
    this.inputs = [];        // [{ id, name, manufacturer }]
    this.selectedId = null;
    this._listener = null;
    this._ready = false;

    this.onNoteOn  = null;   // (pitch, velocity, channel) => void
    this.onNoteOff = null;   // (pitch, channel) => void
    this.onCC      = null;   // (cc, value, channel) => void
    this.onPitchBend = null; // (value -1..1, channel) => void
  }

  async init() {
    if (this._ready) return this.inputs;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this._refresh();
      this.access.onstatechange = () => this._refresh();
      this._ready = true;
    } catch (e) {
      console.warn('Web MIDI unavailable:', e.message);
    }
    return this.inputs;
  }

  _refresh() {
    const prev = this.selectedId;
    this.inputs = [];
    this.access?.inputs.forEach(p =>
      this.inputs.push({ id: p.id, name: p.name || 'MIDI Device', manufacturer: p.manufacturer || '' })
    );
    const stillExists = prev && this.inputs.find(i => i.id === prev);
    this.select(stillExists ? prev : this.inputs[0]?.id ?? null);
  }

  select(id) {
    // Detach old listener
    if (this.selectedId && this._listener) {
      this.access?.inputs.get(this.selectedId)?.removeEventListener('midimessage', this._listener);
    }
    this.selectedId = id;
    const port = id ? this.access?.inputs.get(id) : null;
    if (!port) return;
    this._listener = (ev) => this._parse(ev);
    port.addEventListener('midimessage', this._listener);
  }

  _parse(ev) {
    const [s, d1, d2] = ev.data;
    const type = s & 0xf0;
    const ch   = s & 0x0f;
    if      (type === 0x90 && d2 > 0) this.onNoteOn?.(d1, d2, ch);
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) this.onNoteOff?.(d1, ch);
    else if (type === 0xb0) this.onCC?.(d1, d2 / 127, ch);
    else if (type === 0xe0) {
      const bend = ((d2 << 7 | d1) - 8192) / 8192;
      this.onPitchBend?.(bend, ch);
    }
  }

  destroy() {
    if (this.selectedId && this._listener) {
      this.access?.inputs.get(this.selectedId)?.removeEventListener('midimessage', this._listener);
    }
    this._ready = false;
  }
}

export const midiEngine = new MIDIEngine();
