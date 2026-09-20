/* Persistence layer: mirrors the seed arrays from data.js into localStorage.
   Arrays are mutated in place so existing page code keeps working. */
const Store = {
  // NOTE: bump PREFIX whenever the seed data shape changes; old-prefix keys are purged on load/reset.
  PREFIX: "sitegrid.v2.",
  storage: (() => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } })(),
  tables() {
    return { ROLES, DEPARTMENTS, USERS, CLIENTS, SITES, LABOUR, APPROVAL_REQUESTS, ATTENDANCE,
             WAGES, EXPENSES, TOOLS, SAFETY_EQUIPMENT, MATERIALS, AUDIT_LOG };
  },
  /* Remove every "sitegrid.*" key that is not a current-prefix key (orphans from older shapes),
     or, when all=true, every current-prefix key too. Scans storage rather than known table names. */
  purge(all) {
    if (!this.storage) return;
    try {
      const keys = [];
      for (let i = 0; i < this.storage.length; i++) keys.push(this.storage.key(i));
      for (const k of keys) {
        if (k && k.startsWith("sitegrid.") && !k.startsWith("sitegrid.session") && (all || !k.startsWith(this.PREFIX))) this.storage.removeItem(k);
      }
    } catch (e) { /* ignore */ }
  },
  load() {
    if (!this.storage) return false;
    this.purge(false);
    for (const [name, arr] of Object.entries(this.tables())) {
      const raw = this.storage.getItem(this.PREFIX + name);
      if (raw === null) continue;
      try {
        const rows = JSON.parse(raw);
        if (!Array.isArray(rows)) continue;
        arr.length = 0; arr.push(...rows);
      } catch (e) { /* keep seed */ }
    }
    return true;
  },
  save() {
    if (!this.storage) return false;
    try {
      for (const [name, arr] of Object.entries(this.tables())) this.storage.setItem(this.PREFIX + name, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  },
  nextId(arr) { return Math.max(0, ...arr.map((r) => Number(r.id) || 0)) + 1; },
  reset(reload = true) {
    if (this.storage) {
      for (const name of Object.keys(this.tables())) this.storage.removeItem(this.PREFIX + name);
      this.purge(true);
    }
    try { sessionStorage.removeItem("sitegrid.session"); } catch (e) { /* ignore */ }
    if (reload && typeof location !== "undefined") location.reload();
  },
};
