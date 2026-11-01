const DEFAULTS = {
  provider: "gemini", geminiKey: "", geminiModel: "gemini-3.8-flash",
  claudeKey: "", claudeModel: "claude-sonnet-5-5", delay: 0, opacity: 0.82
};
const $ = (id) => document.getElementById(id);
const FIELDS = ["provider", "geminiKey", "geminiModel", "claudeKey", "claudeModel"];

const showProvider = () => {
  $("gemini").style.display = $("provider").value === "gemini" ? "block" : "none";
  $("claude").style.display = $("provider").value === "claude" ? "block" : "none";
};

chrome.storage.local.get(DEFAULTS).then((s) => {
  FIELDS.forEach((f) => ($(f).value = s[f]));
  $("delay").value = s.delay;
  $("opacity").value = s.opacity;
  $("opv").textContent = Math.round(s.opacity * 100) + "%";
  showProvider();
});

$("provider").addEventListener("change", showProvider);
$("opacity").addEventListener("input", (e) => {
  $("opv").textContent = Math.round(e.target.value * 100) + "%";
  chrome.storage.local.set({ opacity: Number(e.target.value) });
});

$("save").addEventListener("click", async () => {
  const out = {
    delay: Math.max(0, Number($("delay").value) || 0),
    opacity: Number($("opacity").value)
  };
  FIELDS.forEach((f) => (out[f] = $(f).value.trim() || DEFAULTS[f]));
  await chrome.storage.local.set(out);
  $("saved").textContent = "Saved";
  setTimeout(() => ($("saved").textContent = ""), 1800);
});

$("test").addEventListener("click", async () => {
  const out = $("models");
  const key = $("geminiKey").value.trim();
  if (!key) { out.textContent = "Paste your Gemini key above first."; return; }
  out.textContent = "Checking...";
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": key }
    });
    const data = await res.json();
    if (!res.ok) { out.textContent = "Key check failed: " + ((data.error && data.error.message) || "HTTP " + res.status); return; }
    const names = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace("models/", ""))
      .filter((n) => n.startsWith("gemini"))
      .sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || a.localeCompare(b));
    out.textContent = "Key works. Click a model to use it (Flash models are fastest):";
    out.appendChild(document.createElement("br"));
    names.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = n;
      b.style.cssText = "margin:4px 6px 0 0;padding:4px 8px;background:#e8ecf4;color:#1c2230;font-size:12px;border-radius:6px;font-weight:400";
      b.onclick = () => { $("geminiModel").value = n; out.firstChild.textContent = "Selected " + n + ". Now press Save."; };
      out.appendChild(b);
    });
  } catch (e) {
    out.textContent = "Could not reach Google: " + e.message;
  }
});
