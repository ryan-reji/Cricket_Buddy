
(() => {
  if (window.__cbReader) return;
  window.__cbReader = true;

  const ID = Math.random().toString(36).slice(2, 8);
  const KEY = "cbLog_" + ID;                 // one key per tab, so a stalled tab cannot hide a fresh one
  const BALL = /^\d{1,2}\.[1-6]$/;           // "15.2"
  const firstSeen = new Map();               // ball key -> time first seen (0 = already on page at start)
  let situations = [], lastSit = "", firstDone = false, matchKey = "", lastSig = "", lastWrite = 0;

  const keyFromUrl = () => (location.pathname.match(/\/(\d{4,})\//) || [])[1] || location.pathname;

  function parse(lines) {
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      if (!BALL.test(lines[i])) continue;
      const parts = [];
      for (let j = i + 1; j < lines.length && j <= i + 6 && !BALL.test(lines[j]); j++) parts.push(lines[j]);
      let text = parts.join(" ").replace(/\s+/g, " ").trim();
      text = text.replace(/\bOver \d{1,2}\s+\d{1,3}-\d{1,2}.*$/, "").trim();   // over-summary box glued on
      text = text.replace(/^(?:[0-6]|W)\s+(?=[A-Z])/, "");                      // boundary/wicket badge
      text = text.slice(0, 450);
      if (text.length < 20) continue;                                            // skips table numbers
      if (!(/ to /i.test(text) || /\b(out|four|six|run|runs|wide|bye|dot|wicket)\b/i.test(text))) continue;
      items.push({ key: lines[i] + "|" + text.slice(0, 60), over: lines[i], text });
    }
    return items; // page order = newest first
  }

  function situation(lines) {
    const title = document.title.match(/[A-Z]{2,5} vs [A-Z]{2,5}[^|–-]*/);
    const teams = title ? title[0].trim() : "";
    let box = "";
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^Over \d{1,2}$/.test(lines[i]) && /^\d{1,3}-\d{1,2}$/.test(lines[i + 1])) {
        const parts = [];
        for (let j = i; j < lines.length && j < i + 16 && !BALL.test(lines[j]); j++) {
          if (/^(Over Summary|View all overs)/i.test(lines[j]) || lines[j].length > 80) continue;
          parts.push(lines[j]);
        }
        box = parts.join(" | ");
        break;
      }
    }
    return [teams, box].filter(Boolean).join(" | ").slice(0, 300);
  }

  function scan() {
    try {
      const key = keyFromUrl();
      if (key !== matchKey) { matchKey = key; firstSeen.clear(); situations = []; firstDone = false; lastSit = ""; lastSig = ""; }
      const lines = (document.body.innerText || "").split("\n").map((s) => s.trim()).filter(Boolean);
      const items = parse(lines);
      const now = Date.now();

      items.forEach((it) => { if (!firstSeen.has(it.key)) firstSeen.set(it.key, firstDone ? now : 0); });
      if (items.length > 0) firstDone = true;

      const sit = situation(lines);
      if (sit && sit !== lastSit) { situations.push({ t: situations.length ? now : 0, text: sit }); lastSit = sit; }

      const sig = items.length + "|" + (items[0] ? items[0].key : "") + "|" + lastSit;
      if (sig !== lastSig || now - lastWrite > 15000) {   // write on change, plus a heartbeat every 15s
        lastSig = sig; lastWrite = now;
        chrome.storage.local.set({
          [KEY]: {
            id: ID, matchKey, checked: now, parsed: items.length,
            items: items.slice(0, 30).map((it) => ({ over: it.over, text: it.text, t: firstSeen.get(it.key) })),
            situations: situations.slice(-20)
          }
        });
      }
    } catch (e) {
      if (String(e).includes("Extension context invalidated")) { clearInterval(timer); obs.disconnect(); }
      else console.warn("[Cricket Buddy] reader error", e);
    }
  }

  let deb;
  const obs = new MutationObserver(() => { clearTimeout(deb); deb = setTimeout(scan, 600); });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  const timer = setInterval(scan, 3000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scan(); });
  window.addEventListener("pagehide", () => { try { chrome.storage.local.remove(KEY); } catch (e) {} });
  scan();
})();
