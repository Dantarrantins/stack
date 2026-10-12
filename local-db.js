/* Stack: on-device data store.
   Implements the small slice of the claude.ai artifact `db` API that the app uses
   (doc/collection, get/set/update/delete, onSnapshot, orderBy, limit), backed by
   localStorage and seeded from seed.json. Only defined when window.claude is absent,
   so the same index.html still runs inside the Claude artifact. */
(function () {
  if (window.claude && window.claude.use) return;
  const KEY = "stack:data:v1";
  let store = { seedVersion: 0, c: {} };
  try { const raw = localStorage.getItem(KEY); if (raw) store = JSON.parse(raw); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  const USER_FIELDS = ["anchor", "slot", "order"];

  const ready = fetch("seed.json", { cache: "no-cache" }).then(r => r.json()).then(seed => {
    if ((store.seedVersion || 0) >= seed.version) return;
    for (const coll of ["habits", "anchors"]) {
      const cur = store.c[coll] || (store.c[coll] = {});
      for (const [id, data] of Object.entries(seed[coll] || {})) {
        if (!cur[id]) { cur[id] = { ...data }; continue; }
        const keep = {};
        if (coll === "habits") USER_FIELDS.forEach(k => { if (k in cur[id]) keep[k] = cur[id][k]; });
        if (coll === "anchors" && cur[id].name) keep.name = cur[id].name;
        cur[id] = { ...data, ...keep };
      }
    }
    store.seedVersion = seed.version; save();
  }).catch(() => {});

  const listeners = new Set();
  const notify = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const split = p => { const s = p.split("/"); return { coll: s.slice(0, -1).join("/"), id: s[s.length - 1] }; };
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = (id, data) => ({ id, exists: !!data, data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined), metadata: meta });

  function docRef(path) {
    const { coll, id } = split(path);
    const read = () => (store.c[coll] || {})[id];
    return {
      id, path,
      async get() { await ready; return snapDoc(id, read()); },
      async set(data) { await ready; (store.c[coll] || (store.c[coll] = {}))[id] = JSON.parse(JSON.stringify(data)); save(); notify(); },
      async update(data) { await ready; const cur = read(); if (!cur) throw { code: "invalid_argument", message: "No such document" }; Object.assign(cur, JSON.parse(JSON.stringify(data))); save(); notify(); },
      async delete() { await ready; if (store.c[coll]) delete store.c[coll][id]; save(); notify(); },
      onSnapshot(next) { const fn = () => next(snapDoc(id, read())); listeners.add(fn); ready.then(fn); return () => listeners.delete(fn); },
      collection(sub) { return collRef(path + "/" + sub); }
    };
  }
  function collRef(path, q = {}) {
    const run = () => {
      let docs = Object.entries(store.c[path] || {}).map(([id, d]) => snapDoc(id, d));
      if (q.order) { const { f, dir } = q.order; docs.sort((a, b) => { const x = a.data()[f], y = b.data()[f]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === "desc" ? -1 : 1); }); }
      else docs.sort((a, b) => a.id.localeCompare(b.id));
      if (q.limit) docs = docs.slice(0, q.limit);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
    };
    return {
      path,
      doc(id) { return docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))); },
      async add(data) { const r = this.doc(); await r.set(data); return r; },
      where() { return this; },
      orderBy(f, dir) { return collRef(path, { ...q, order: { f, dir } }); },
      limit(n) { return collRef(path, { ...q, limit: n }); },
      async get() { await ready; return run(); },
      onSnapshot(next) { const fn = () => next(run()); listeners.add(fn); ready.then(fn); return () => listeners.delete(fn); }
    };
  }
  const db = { doc: docRef, collection: collRef };
  const user = { can: async () => true, isOwner: () => true, canEdit: () => true, id: async () => "local" };
  window.claude = { use: async name => (name === "db" ? db : name === "user" ? user : null) };
  window.addEventListener("storage", e => { if (e.key === KEY) { try { store = JSON.parse(e.newValue); notify(); } catch (x) {} } });
})();
