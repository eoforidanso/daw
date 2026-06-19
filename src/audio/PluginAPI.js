// Plugin registry — plugins register themselves; the host creates instances from the registry.

class PluginRegistry {
  constructor() { this._map = new Map(); }

  register(def) {
    if (!def.id || !def.create || !def.paramDefs) throw new Error(`Invalid plugin: ${def.id}`);
    this._map.set(def.id, def);
  }

  get(id) { return this._map.get(id) ?? null; }

  list()                 { return Array.from(this._map.values()); }
  byCategory(cat)        { return this.list().filter(p => p.category === cat); }

  instantiate(id, ctx, overrides = {}) {
    const def = this.get(id);
    if (!def) throw new Error(`Plugin not found: ${id}`);
    const params = { ...def.defaultParams, ...overrides };
    const node   = def.create(ctx, params);
    return { pluginId: id, instanceId: `${id}#${Date.now()}`, def, node, params: { ...params } };
  }
}

export const pluginRegistry = new PluginRegistry();
