/* Stack: accounts and cloud sync (web build only).
   When firebase-config.js holds a real config, this signs people in with Firebase Auth
   (email link or Google) and gives the app the same small db API it already uses
   (doc/collection, get/set/update/delete, onSnapshot, orderBy, limit), scoped to
   users/{uid}/... in Firestore. Without a config it does nothing and local-db.js takes over. */
(function () {
  const cfg = window.STACK_FIREBASE;
  if (!cfg || !cfg.apiKey || !window.firebase) return;
  window.__stackCloud = true;

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const fs = firebase.firestore();
  if (window.STACK_EMULATORS) { auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true }); fs.useEmulator("127.0.0.1", 8080); }
  else fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  const LOCAL_KEY = "stack:data:v1", EMAIL_KEY = "stack:signin-email";
  const COLLS = ["habits", "anchors", "settings", "checkins", "weeks"];
  const KEEP = ["anchor", "slot", "order", "after", "renamed"];
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
  let uid = null;

  /* ---------- Sign-in screen ---------- */
  const css = `
  .gate{position:fixed;inset:0;z-index:60;background:var(--bg,#FBF9F4);display:grid;place-items:center;padding:24px 16px;overflow:auto}
  .gate-in{width:100%;max-width:400px;display:grid;gap:16px}
  .gate-brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:600;color:var(--ink,#1E2421)}
  .gate-brand svg{width:26px;height:26px;fill:var(--accent,#4E6B5C)}
  .gate h1{font-size:clamp(30px,8vw,40px);font-weight:300;letter-spacing:-.02em;line-height:1.1;margin:8px 0 0;color:var(--ink,#1E2421)}
  .gate p{margin:0;color:var(--muted,#6B716C);font-size:16px;line-height:1.5}
  .gate-btn{font:inherit;font-size:16px;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px 18px;border-radius:999px;cursor:pointer;border:1px solid var(--line,#E2DDD4);background:var(--surface,#fff);color:var(--ink,#1E2421)}
  .gate-btn.primary{background:var(--ink,#1E2421);color:var(--bg,#FBF9F4);border-color:var(--ink,#1E2421)}
  .gate-btn:disabled{opacity:.5;cursor:default}
  .gate input{font:inherit;font-size:16px;width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;border:1px solid var(--line,#E2DDD4);background:var(--surface,#fff);color:var(--ink,#1E2421)}
  .gate form{display:grid;gap:10px}
  .gate-or{display:flex;align-items:center;gap:12px;color:var(--faint,#A9ADA6);font-size:13px}
  .gate-or::before,.gate-or::after{content:"";flex:1;height:1px;background:var(--line,#E2DDD4)}
  .gate-msg{min-height:1.4em;font-size:14px!important}
  .gate-msg.err{color:#A3412F!important}
  .gate-small{font-size:13px!important}`;
  const G = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/></svg>';
  let gate = null;
  function el(tag, attrs, ...kids) { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === "html") n.innerHTML = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v); } kids.flat().forEach(c => c != null && n.append(c)); return n; }
  function msg(text, err) { const m = gate && gate.querySelector(".gate-msg"); if (m) { m.textContent = text || ""; m.classList.toggle("err", !!err); } }
  function friendly(e) {
    const c = (e && e.code) || "";
    if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "";
    if (c.includes("invalid-email")) return "That email address doesn't look right.";
    if (c.includes("invalid-action-code") || c.includes("expired-action-code")) return "That sign-in link has expired or was already used. Send a new one.";
    if (c.includes("network")) return "No connection. Check your signal and try again.";
    if (c.includes("unauthorized-domain")) return "This web address isn't allowed to sign in yet (Firebase authorised domains).";
    return "Something went wrong signing in. Please try again.";
  }
  function showGate(mode) {
    if (!document.getElementById("stack-gate-css")) document.head.append(el("style", { id: "stack-gate-css" }, css));
    if (gate) gate.remove();
    const brand = el("div", { class: "gate-brand", html: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="13" width="16" height="4" rx="2"/><rect x="4" y="8" width="12" height="4" rx="2"/><rect x="6" y="3" width="8" height="4" rx="2"/></svg>Stack' });
    let body;
    if (mode === "confirm") {
      body = [el("h1", {}, "Finish signing in"), el("p", {}, "You opened the link on a different device or browser. Enter your email to confirm it's you."),
        el("form", { onsubmit: e => { e.preventDefault(); finishLink(e.target.querySelector("input").value.trim()); } },
          el("input", { type: "email", required: "", autocomplete: "email", placeholder: "you@example.com", "aria-label": "Email" }),
          el("button", { class: "gate-btn primary", type: "submit" }, "Sign in"))];
    } else if (mode === "sent") {
      body = [el("h1", {}, "Check your email"), el("p", {}, `We've sent a sign-in link to ${ls.get(EMAIL_KEY) || "your inbox"}. Open it on this device to carry on. It can take a minute, and may land in spam.`),
        el("button", { class: "gate-btn", onclick: () => showGate() }, "Use a different email")];
    } else {
      body = [el("h1", {}, "Small practices, stacked onto your day."), el("p", {}, "Sign in so your routine and progress are saved and sync across your devices."),
        el("button", { class: "gate-btn", type: "button", onclick: google, html: G + "<span>Continue with Google</span>" }),
        el("div", { class: "gate-or" }, "or"),
        el("form", { onsubmit: e => { e.preventDefault(); sendLink(e.target.querySelector("input").value.trim(), e.target.querySelector("button")); } },
          el("input", { type: "email", required: "", autocomplete: "email", placeholder: "you@example.com", "aria-label": "Email" }),
          el("button", { class: "gate-btn primary", type: "submit" }, "Email me a sign-in link")),
        el("p", { class: "gate-small" }, "No password needed. We only use your email to sign you in.")];
    }
    gate = el("div", { class: "gate", role: "dialog", "aria-modal": "true", "aria-label": "Sign in to Stack" }, el("div", { class: "gate-in" }, brand, ...body, el("p", { class: "gate-msg", role: "status" })));
    document.body.append(gate);
    const f = gate.querySelector("input"); if (f && mode === "confirm") f.focus();
  }
  function hideGate() { if (gate) { gate.remove(); gate = null; } }

  async function google() {
    msg("");
    const p = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(p); }
    catch (e) {
      if ((e.code || "").includes("popup-blocked") || (e.code || "").includes("operation-not-supported")) { try { await auth.signInWithRedirect(p); return; } catch (x) { e = x; } }
      msg(friendly(e), true);
    }
  }
  async function sendLink(email, btn) {
    if (!email) return;
    btn.disabled = true; msg("Sending…");
    try {
      await auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true });
      ls.set(EMAIL_KEY, email); showGate("sent");
    } catch (e) { btn.disabled = false; msg(friendly(e), true); }
  }
  async function finishLink(email) {
    if (!email) return showGate("confirm");
    msg("Signing in…");
    try { await auth.signInWithEmailLink(email, location.href); ls.del(EMAIL_KEY); history.replaceState(null, "", location.pathname + location.hash); }
    catch (e) { showGate(); msg(friendly(e), true); }
  }

  /* ---------- First sign-in: bring over this device's data, or start from the library ---------- */
  async function commitAll(writes) {
    for (let i = 0; i < writes.length; i += 400) { const b = fs.batch(); writes.slice(i, i + 400).forEach(([p, d]) => b.set(fs.doc(`users/${uid}/${p}`), d)); await b.commit(); }
  }
  async function prepare() {
    const metaRef = fs.doc(`users/${uid}`);
    let meta = null;
    try { meta = (await metaRef.get()).data() || null; } catch (e) { meta = null; }
    let seed = null;
    try { seed = await (await fetch("seed.json", { cache: "no-cache" })).json(); } catch (e) {}
    const writes = [];
    if (!meta) {
      let local = null;
      try { local = JSON.parse(ls.get(LOCAL_KEY) || "null"); } catch (e) {}
      const hasLocal = local && local.c && Object.keys(local.c.anchors || {}).length;
      if (hasLocal) for (const coll of COLLS) for (const [id, d] of Object.entries(local.c[coll] || {})) writes.push([`${coll}/${id}`, d]);
      if (seed) {
        const have = new Set(hasLocal ? Object.keys(local.c.habits || {}) : []);
        for (const [id, d] of Object.entries(seed.habits || {})) if (!have.has(id)) writes.push([`habits/${id}`, d]);
        if (!hasLocal) for (const [id, d] of Object.entries(seed.anchors || {})) writes.push([`anchors/${id}`, d]);
      }
      await commitAll(writes);
      await metaRef.set({ seedVersion: seed ? seed.version : 0, created: firebase.firestore.FieldValue.serverTimestamp(), importedFromDevice: !!hasLocal }, { merge: true });
      /* This device's data now belongs to this account; keep a backup but never import it into anyone else's */
      if (hasLocal) { ls.set(LOCAL_KEY + ":imported", ls.get(LOCAL_KEY)); ls.del(LOCAL_KEY); }
    } else if (seed && (meta.seedVersion || 0) < seed.version) {
      /* Library update: refresh habit content, keep where the person has stacked or renamed things */
      const cur = await fs.collection(`users/${uid}/habits`).get();
      const mine = {}; cur.docs.forEach(d => mine[d.id] = d.data());
      for (const [id, d] of Object.entries(seed.habits || {})) {
        const keep = {}; const m = mine[id];
        if (m) { KEEP.forEach(k => { if (k in m) keep[k] = m[k]; }); if (m.renamed && m.short) keep.short = m.short; }
        writes.push([`habits/${id}`, { ...d, ...keep }]);
      }
      await commitAll(writes);
      await metaRef.set({ seedVersion: seed.version }, { merge: true });
    }
  }

  /* ---------- The db the app sees ---------- */
  const scoped = { doc: p => fs.doc(`users/${uid}/${p}`), collection: p => fs.collection(`users/${uid}/${p}`) };
  let readyResolve; const ready = new Promise(r => readyResolve = r);
  let started = false;
  auth.onAuthStateChanged(async u => {
    if (u) {
      if (started && u.uid === uid) return;
      if (started && u.uid !== uid) return location.reload();
      uid = u.uid; started = true; hideGate();
      try { await prepare(); } catch (e) { console.error(e); }
      readyResolve(scoped);
    } else {
      if (started) return location.reload();
      if (auth.isSignInWithEmailLink(location.href)) { const em = ls.get(EMAIL_KEY); em ? finishLink(em) : showGate("confirm"); }
      else showGate();
    }
  });
  auth.getRedirectResult().catch(e => msg(friendly(e), true));

  const user = { can: async () => true, isOwner: () => true, canEdit: () => true, id: async () => uid };
  const api = { use: async name => (name === "db" ? ready : name === "user" ? user : null) };
  try { Object.defineProperty(window, "claude", { value: api, writable: false, configurable: false }); } catch (e) { window.claude = api; }

  /* ---------- Account actions, shown in Setup ---------- */
  window.stackAccount = {
    email: () => (auth.currentUser && (auth.currentUser.email || "your account")) || "",
    signOut: () => auth.signOut(),
    async deleteAll() {
      const u = auth.currentUser; if (!u) return;
      for (const coll of COLLS) {
        const s = await fs.collection(`users/${u.uid}/${coll}`).get();
        for (let i = 0; i < s.docs.length; i += 400) { const b = fs.batch(); s.docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
      }
      await fs.doc(`users/${u.uid}`).delete();
      ls.del(LOCAL_KEY);
      try { await u.delete(); }
      catch (e) { if ((e.code || "").includes("requires-recent-login")) { await auth.signOut(); throw new Error("Your data is deleted. To remove the login itself, sign in again and repeat."); } throw e; }
    }
  };
})();
