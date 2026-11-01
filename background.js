// Cricket Buddy - background service worker
// Holds the API call so the key never touches the streaming page.

const DEFAULTS = {
  provider: "gemini",
  geminiKey: "",
  geminiModel: "gemini-3.8-flash",
  delay: 0,
  opacity: 0.82
};

// Optional local key file (gitignored). Safe to be missing.
try { importScripts("config.local.js"); } catch (e) { /* no local config, use Options page */ }
const LOCAL = self.LOCAL_CONFIG || {};

const SYSTEM_PROMPT = `You are Cricket Buddy, a live second-screen assistant for a fan watching a cricket match. The fan may be new to cricket.

Rules:
- Answer in plain English in 2 to 4 short sentences. No headings, no bullet lists.
- Explain any jargon you use.
- Use the MATCH CONTEXT below for anything about the current match. If it lacks what is needed (for example why a batter got out), say what is missing, then give the general explanation instead.
- Never invent scores, players or events.
- For a dismissal, name the type (bowled, caught, LBW, run out, stumped, hit wicket) and explain the rule in one line.
- For a term, give a simple definition, then why it matters right now if the context allows.
- The fan's stream may be delayed, so do not reveal events beyond the context.`;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (e) {
    console.warn("Cricket Buddy: cannot inject on this page", e);
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "toggle" });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "ask") {
    ask(msg).then(sendResponse);
    return true; // async response
  }
  if (msg.type === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
});

async function ask({ messages, context }) {
  const cfg = await chrome.storage.local.get(DEFAULTS);
  cfg.geminiKey = cfg.geminiKey || LOCAL.geminiKey || "";
  if (cfg.geminiKey === "PASTE_YOUR_GEMINI_KEY_HERE") cfg.geminiKey = "";
  const system = `${SYSTEM_PROMPT}\n\nMATCH CONTEXT:\n${context && context.trim() ? context.trim() : "(none provided)"}`;
  try {
    return cfg.provider === "claude" ? await askClaude(cfg, system, messages) : await askGemini(cfg, system, messages);
  } catch (e) {
    console.error("[Cricket Buddy] request error", e);
    if (e && e.name === "AbortError") return { ok: false, error: "The AI took too long (25s). Check your key and model name in Options, then try again." };
    return { ok: false, error: "Could not reach the AI service: " + (e && e.message ? e.message : "network error") };
  }
}

async function fetchT(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function askGemini(cfg, system, messages) {
  if (!cfg.geminiKey) return { ok: false, error: "No Gemini key yet. Open settings (gear icon) and paste a free key from Google AI Studio." };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`;
  console.log('[Cricket Buddy] Gemini request ->', cfg.geminiModel);
  const res = await fetchT(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 1024, temperature: 0.4 }
    })
  });
  const raw = await res.text();
  console.log('[Cricket Buddy] Gemini response', res.status, raw.slice(0, 500));
  let data; try { data = JSON.parse(raw); } catch (e) { return { ok: false, error: `Unexpected reply from Gemini (HTTP ${res.status}).` }; }
  if (!res.ok) return { ok: false, error: `The AI request failed: ${(data.error && data.error.message) || "HTTP " + res.status}` };
  if (data.promptFeedback && data.promptFeedback.blockReason) return { ok: false, error: "That question was blocked by the AI filter. Try rewording it." };
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  return { ok: true, text: text || "I got an empty answer. Try asking again." };
}

