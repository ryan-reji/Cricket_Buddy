// Cricket Buddy - overlay panel (injected into the streaming page)
(() => {
  if (window.__cricketBuddy) return;
  window.__cricketBuddy = true;

  const state = {
    history: [],        // chat turns sent to the model
    feedContext: "",    // filled automatically in Phase 2 (Cricbuzz reader)
    busy: false,
    opacity: 0.82
  };

  const host = document.createElement("div");
  host.id = "cricket-buddy-host";
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel {
      --a: 0.82;
      position: fixed; top: 80px; right: 24px; width: 340px; max-height: 70vh;
      display: flex; flex-direction: column;
      background: rgba(16, 22, 36, var(--a));
      -webkit-backdrop-filter: blur(14px) saturate(1.2); backdrop-filter: blur(14px) saturate(1.2);
      color: #eef1f6; border-radius: 14px; border: 1px solid rgba(255,255,255,0.10);
      font: 13px/1.45 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    }
    .panel.hidden { display: none; }
    .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 9px; cursor: grab; user-select: none; }
    .head:active { cursor: grabbing; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #d6403b; flex: none; }
    .title { font-weight: 600; font-size: 13px; flex: 1; letter-spacing: 0.01em; }
    .icon { background: none; border: 0; color: #9aa6b8; font-size: 15px; cursor: pointer; padding: 2px 5px; border-radius: 6px; }
    .icon:hover, .icon:focus-visible { color: #fff; background: rgba(255,255,255,0.10); outline: none; }
    .seam { border: 0; border-top: 2px dashed rgba(214,64,59,0.65); margin: 0 12px; }
    .body { display: flex; flex-direction: column; min-height: 0; }
    .panel.min .body { display: none; }
    .log { overflow-y: auto; padding: 10px 12px 4px; display: flex; flex-direction: column; gap: 8px; min-height: 60px; max-height: 32vh; }
    .msg { padding: 7px 10px; border-radius: 10px; white-space: pre-wrap; word-wrap: break-word; }
    .user { align-self: flex-end; background: rgba(214,64,59,0.30); max-width: 88%; }
    .bot { align-self: flex-start; background: rgba(255,255,255,0.09); }
    .note { color: #9aa6b8; font-size: 12px; }
    .err { color: #ffb4ae; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px; }
    .chip { background: rgba(255,255,255,0.08); color: #eef1f6; border: 1px solid rgba(255,255,255,0.14);
      border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 12px; cursor: pointer; }
    .chip:hover, .chip:focus-visible { background: rgba(214,64,59,0.35); outline: none; }
    .ask { display: flex; gap: 6px; padding: 4px 12px 10px; }
    .ask input { flex: 1; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.16); color: #fff;
      border-radius: 8px; padding: 7px 9px; font: inherit; min-width: 0; }
    .ask input::placeholder { color: #8a96a8; }
    .ask input:focus { outline: 2px solid rgba(214,64,59,0.7); outline-offset: 0; }
    .send { background: #d6403b; color: #fff; border: 0; border-radius: 8px; padding: 0 12px; font: inherit; font-weight: 600; cursor: pointer; }
    .send:disabled { opacity: 0.5; cursor: default; }
    details { padding: 0 12px 6px; }
    summary { cursor: pointer; color: #9aa6b8; font-size: 12px; }
    textarea { width: 100%; height: 76px; margin-top: 6px; resize: vertical; background: rgba(0,0,0,0.28); color: #fff;
      border: 1px solid rgba(255,255,255,0.16); border-radius: 8px; padding: 7px 9px; font: inherit; font-size: 12px; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; align-items: center; }
    .small { background: rgba(255,255,255,0.08); color: #eef1f6; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
      padding: 3px 8px; font: inherit; font-size: 11px; cursor: pointer; }
    .feed { color: #9aa6b8; font-size: 11px; margin-left: auto; }
    @media (prefers-reduced-motion: no-preference) { .panel { transition: opacity .15s; } }
  </style>
  <div class="panel" id="panel">
    <div class="head" id="drag">
      <span class="dot"></span>
      <span class="title">Cricket Buddy</span>
      <button class="icon" id="gear" title="Settings" aria-label="Settings">&#9881;</button>
      <button class="icon" id="min" title="Collapse" aria-label="Collapse">&#8211;</button>
      <button class="icon" id="close" title="Hide (click the toolbar icon to bring it back)" aria-label="Hide">&#10005;</button>
    </div>
    <hr class="seam">
    <div class="body">
      <div class="log" id="log">
        <div class="msg bot note">Ask about any term, or tap Why out? after a wicket. Add the score or commentary under Match context so I can answer about this match.</div>
      </div>
      <div class="chips">
        <button class="chip" data-q="The batter just got out. Why was he out? Explain the dismissal and the rule involved.">Why out?</button>
        <button class="chip" data-q="Explain what happened in the last over and what it means for the match.">Last over</button>
        <button class="chip" data-q="Where does the match stand right now and what should I watch for next?">Where are we?</button>
        <button class="chip" id="term">Explain a term</button>
      </div>
      <details>
        <summary>Match context</summary>
        <textarea id="ctx" placeholder="Paste the score and recent commentary here, e.g. 'MI 142/4 after 15.2 overs. 15.2: OUT! Rohit c Dhoni b Chahar, caught behind...'"></textarea>
        <div class="row">
          <button class="small" id="useSel">Add selected text</button>
          <button class="small" id="clr">Clear</button>
          <button class="small" id="showFeed">Show feed</button>
          <span class="feed" id="feed">Feed: not connected</span>
        </div>
      </details>
      <form class="ask" id="form">
        <input id="q" type="text" placeholder="Ask anything about the match" autocomplete="off">
        <button class="send" id="send" type="submit">Ask</button>
      </form>
    </div>
  </div>`;

  const $ = (id) => root.getElementById(id);
  const panel = $("panel"), log = $("log"), input = $("q"), send = $("send"), ctx = $("ctx");

  // ---- mounting, including fullscreen ----
  const mount = () => {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    const parent = fs && fs.tagName !== "VIDEO" ? fs : document.documentElement;
    if (host.parentNode !== parent) parent.appendChild(host);
  };
  mount();
  document.addEventListener("fullscreenchange", mount);
  document.addEventListener("webkitfullscreenchange", mount);

  // ---- keep keystrokes away from the player's shortcuts ----
  ["keydown", "keyup", "keypress"].forEach((t) => panel.addEventListener(t, (e) => e.stopPropagation()));

  // ---- settings + saved position ----
  const applyOpacity = (v) => { state.opacity = v; panel.style.setProperty("--a", String(v)); };
  chrome.storage.local.get({ opacity: 0.82, pos: null, ctx: "" }).then((s) => {
    applyOpacity(s.opacity);
    if (s.pos) { panel.style.left = s.pos.left + "px"; panel.style.top = s.pos.top + "px"; panel.style.right = "auto"; }
    ctx.value = s.ctx || "";
  });
  // ---- live feed from the Cricbuzz reader, with spoiler delay ----
  const feed = { store: {}, delay: 0 };
  const pickFeed = () => Object.values(feed.store).filter(Boolean).sort((a, b) => b.checked - a.checked)[0] || null;
  function computeFeed() {
    const cb = pickFeed(), label = $("feed");
    if (!cb) { state.feedContext = ""; label.textContent = "Feed: not connected (open a Cricbuzz match page)"; return; }
    const age = Math.round((Date.now() - cb.checked) / 1000);
    const stale = age > 90 ? " - may be asleep, keep the Cricbuzz tab visible" : "";
    if (!cb.items || !cb.items.length) { state.feedContext = ""; label.textContent = `Feed: connected, no commentary found, checked ${age}s ago${stale}`; return; }
    const cutoff = Date.now() - feed.delay * 1000;
    const shown = cb.items.filter((i) => i.t <= cutoff);              // page order: newest first
    const held = cb.items.length - shown.length;
    const recent = shown.slice(0, 12).reverse();                        // oldest to newest for the AI
    const sit = (cb.situations || []).filter((s) => s.t <= cutoff).slice(-1)[0];
    state.feedContext = [
      sit ? "Current situation: " + sit.text : "",
      recent.length ? "Recent commentary (oldest to newest):" : "",
      ...recent.map((l) => l.over + " " + l.text)
    ].filter(Boolean).join("\n");
    const latest = recent.length ? recent[recent.length - 1].over : "-";
    label.textContent = `Feed: latest ball ${latest}${feed.delay ? ", " + held + " held back" : ""}, checked ${age}s ago${stale}`;
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.opacity) applyOpacity(changes.opacity.newValue);
    if (changes.delay) { feed.delay = Number(changes.delay.newValue) || 0; computeFeed(); }
    let touched = false;
    for (const k of Object.keys(changes)) {
      if (!k.startsWith("cbLog_")) continue;
      if (changes[k].newValue) feed.store[k] = changes[k].newValue; else delete feed.store[k];
      touched = true;
    }
    if (touched) computeFeed();
  });
  chrome.storage.local.remove("cbLog"); // old format from the first version
  chrome.storage.local.get(null).then((s) => {
    for (const k of Object.keys(s)) if (k.startsWith("cbLog_")) feed.store[k] = s[k];
    feed.delay = Number(s.delay) || 0;
    computeFeed();
  });
  setInterval(computeFeed, 2000);
  $("showFeed").onclick = () => addMsg(state.feedContext || "Nothing in the feed yet. Open a Cricbuzz match page in another tab.", "bot note");

  // ---- dragging ----
  let drag = null;
  $("drag").addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    $("drag").setPointerCapture(e.pointerId);
  });
  $("drag").addEventListener("pointermove", (e) => {
    if (!drag) return;
    const left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.dx));
    const top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy));
    panel.style.left = left + "px"; panel.style.top = top + "px"; panel.style.right = "auto";
  });
  $("drag").addEventListener("pointerup", () => {
    if (!drag) return;
    drag = null;
    const r = panel.getBoundingClientRect();
    chrome.storage.local.set({ pos: { left: Math.round(r.left), top: Math.round(r.top) } });
  });

  // ---- header buttons ----
  $("min").onclick = () => panel.classList.toggle("min");
  $("close").onclick = () => panel.classList.add("hidden");
  $("gear").onclick = () => chrome.runtime.sendMessage({ type: "openOptions" });
  chrome.runtime.onMessage.addListener((m) => {
    if (m.type === "toggle") { mount(); panel.classList.toggle("hidden"); }
  });

  // ---- context box ----
  ctx.addEventListener("input", () => chrome.storage.local.set({ ctx: ctx.value }));
  $("clr").onclick = () => { ctx.value = ""; chrome.storage.local.set({ ctx: "" }); };
  $("useSel").onclick = () => {
    const sel = String(window.getSelection() || "").trim();
    if (!sel) { addMsg("Select some commentary text on the page first, then press Add selected text.", "bot note"); return; }
    ctx.value = (ctx.value ? ctx.value + "\n" : "") + sel;
    chrome.storage.local.set({ ctx: ctx.value });
  };

  // ---- chat ----
  function addMsg(text, cls) {
    const d = document.createElement("div");
    d.className = "msg " + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  async function ask(question) {
    if (state.busy || !question.trim()) return;
    state.busy = true; send.disabled = true;
    addMsg(question, "user");
    state.history.push({ role: "user", content: question });
    const wait = addMsg("Thinking...", "bot note");
    const context = [state.feedContext, ctx.value].filter(Boolean).join("\n");
    let res;
    try {
      res = await Promise.race([
        chrome.runtime.sendMessage({ type: "ask", messages: state.history.slice(-8), context }),
        new Promise((r) => setTimeout(() => r({ ok: false, error: "No reply from the extension after 35s. Reload the extension at chrome://extensions, refresh this page and try again." }), 35000))
      ]);
    } catch (e) {
      res = { ok: false, error: "The extension was reloaded. Refresh this page and try again." };
    }
    if (res && res.ok) {
      wait.className = "msg bot"; wait.textContent = res.text;
      state.history.push({ role: "assistant", content: res.text });
    } else {
      wait.className = "msg bot err"; wait.textContent = (res && res.error) || "Something went wrong.";
      state.history.pop(); // drop the unanswered question so the history stays valid
    }
    log.scrollTop = log.scrollHeight;
    state.busy = false; send.disabled = false;
  }

  $("form").addEventListener("submit", (e) => { e.preventDefault(); const q = input.value; input.value = ""; ask(q); });
  root.querySelectorAll(".chip[data-q]").forEach((b) => (b.onclick = () => ask(b.dataset.q)));
  $("term").onclick = () => { input.focus(); input.placeholder = "Type a term, e.g. powerplay, DLS, yorker"; };
})();
