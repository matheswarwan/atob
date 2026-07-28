(function () {
  const els = {
    forceEnabled: document.getElementById("forceEnabled"),
    forceUrl: document.getElementById("forceUrl"),
    localEnabled: document.getElementById("localEnabled"),
    sdkSourceUrl: document.getElementById("sdkSourceUrl"),
    sdkEditor: document.getElementById("sdkEditor"),
    statusLine: document.getElementById("statusLine"),
    metaFile: document.getElementById("metaFile"),
    metaChars: document.getElementById("metaChars"),
    metaUpdated: document.getElementById("metaUpdated"),
    diffPanel: document.getElementById("diffPanel"),
    diffBody: document.getElementById("diffBody"),
    diffStats: document.getElementById("diffStats"),
    fileInput: document.getElementById("fileInput"),
  };

  let originalText = "";
  let loadedFileName = "";
  let loadedSourceUrl = "";
  let updatedAt = null;

  function setStatus(message, kind) {
    els.statusLine.textContent = message || "";
    els.statusLine.className = "st-status" + (kind ? " " + kind : "");
  }

  function updateMeta() {
    els.metaFile.textContent = loadedFileName
      ? "File: " + loadedFileName
      : "No file loaded";
    const len = els.sdkEditor.value.length;
    els.metaChars.textContent = len ? len.toLocaleString() + " chars" : "";
    els.metaUpdated.textContent = updatedAt
      ? "Updated: " + new Date(updatedAt).toLocaleString()
      : "";
  }

  function sendMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || {});
      });
    });
  }

  function collectSettings() {
    return {
      forceSdk: {
        enabled: !!els.forceEnabled.checked,
        url: els.forceUrl.value.trim(),
      },
      localEdit: {
        enabled: !!els.localEnabled.checked,
        sourceUrl: loadedSourceUrl || els.sdkSourceUrl.value.trim(),
        fileName: loadedFileName || "",
        original: originalText || "",
        edited: els.sdkEditor.value || "",
        updatedAt: updatedAt,
      },
    };
  }

  function applySettings(settings) {
    const s = mergeSettings(settings);
    els.forceEnabled.checked = !!s.forceSdk.enabled;
    els.forceUrl.value = s.forceSdk.url || "";
    els.localEnabled.checked = !!s.localEdit.enabled;
    els.sdkSourceUrl.value = s.localEdit.sourceUrl || "";
    originalText = s.localEdit.original || "";
    els.sdkEditor.value = s.localEdit.edited || s.localEdit.original || "";
    loadedFileName = s.localEdit.fileName || "";
    loadedSourceUrl = s.localEdit.sourceUrl || "";
    updatedAt = s.localEdit.updatedAt || null;
    updateMeta();
  }

  async function saveSettings() {
    const settings = collectSettings();
    if (settings.forceSdk.enabled && !settings.forceSdk.url) {
      setStatus("Force SDK URL is enabled but URL is empty.", "err");
      return;
    }
    if (settings.localEdit.enabled && !settings.localEdit.edited) {
      setStatus("Local Edit is enabled but no script is loaded/edited.", "err");
      return;
    }
    if (settings.forceSdk.enabled && settings.localEdit.enabled) {
      setStatus(
        "Local Edit is active and will block CDN SDKs (takes priority over Force SDK URL).",
        "ok"
      );
    }
    updatedAt = Date.now();
    settings.localEdit.updatedAt = updatedAt;
    const res = await sendMessage({ type: "MCP_SAVE_SETTINGS", settings });
    if (!res.ok) {
      setStatus(res.error || "Failed to save settings", "err");
      return;
    }
    applySettings(res.settings);
    setStatus("Settings saved. Reload the target site to apply SDK changes.", "ok");
  }

  async function loadFromUrl() {
    const url = els.sdkSourceUrl.value.trim();
    if (!url) {
      setStatus("Enter an SDK URL to load.", "err");
      return;
    }
    setStatus("Loading SDK…");
    const res = await sendMessage({ type: "MCP_FETCH_SDK", url });
    if (!res.ok) {
      setStatus(res.error || "Failed to fetch SDK", "err");
      return;
    }
    originalText = res.text || "";
    els.sdkEditor.value = originalText;
    loadedFileName = res.fileName || "sdk.js";
    loadedSourceUrl = url;
    updatedAt = Date.now();
    els.diffPanel.classList.remove("visible");
    updateMeta();
    setStatus("Loaded " + loadedFileName + ". Review/edit, then Save settings.", "ok");
  }

  function loadFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      originalText = String(reader.result || "");
      els.sdkEditor.value = originalText;
      loadedFileName = file.name || "sdk.js";
      loadedSourceUrl = "";
      updatedAt = Date.now();
      els.diffPanel.classList.remove("visible");
      updateMeta();
      setStatus("Loaded local file " + loadedFileName, "ok");
    };
    reader.onerror = () => setStatus("Failed to read file", "err");
    reader.readAsText(file);
  }

  function downloadEdited() {
    const text = els.sdkEditor.value;
    if (!text) {
      setStatus("Nothing to download.", "err");
      return;
    }
    const name =
      (loadedFileName || "sdk").replace(/\.js$/i, "") + "-local-edit.js";
    const blob = new Blob([text], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Downloaded " + name, "ok");
  }

  /** Simple line-based LCS diff for original vs edited. */
  function buildLineDiff(aText, bText) {
    const a = aText.split("\n");
    const b = bText.split("\n");
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const lines = [];
    let i = 0;
    let j = 0;
    let adds = 0;
    let dels = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        lines.push({ type: "same", text: a[i], line: j + 1 });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        lines.push({ type: "del", text: a[i], line: i + 1 });
        dels++;
        i++;
      } else {
        lines.push({ type: "add", text: b[j], line: j + 1 });
        adds++;
        j++;
      }
    }
    while (i < n) {
      lines.push({ type: "del", text: a[i], line: i + 1 });
      dels++;
      i++;
    }
    while (j < m) {
      lines.push({ type: "add", text: b[j], line: j + 1 });
      adds++;
      j++;
    }
    return { lines, adds, dels };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function compareWithOriginal() {
    if (!originalText) {
      setStatus("Load an original SDK first to compare.", "err");
      return;
    }
    const edited = els.sdkEditor.value;
    if (edited === originalText) {
      els.diffPanel.classList.add("visible");
      els.diffBody.innerHTML =
        '<div class="st-diff-line same"><span class="ln"></span><span>No differences.</span></div>';
      els.diffStats.textContent = "0 added, 0 removed";
      setStatus("Edited script matches the original.", "ok");
      return;
    }

    // Guard very large files: sample warning but still attempt
    const { lines, adds, dels } = buildLineDiff(originalText, edited);
    els.diffBody.innerHTML = lines
      .map((row) => {
        const prefix =
          row.type === "add" ? "+" : row.type === "del" ? "-" : " ";
        return `<div class="st-diff-line ${row.type}"><span class="ln">${
          row.line || ""
        }</span><span>${prefix} ${escapeHtml(row.text)}</span></div>`;
      })
      .join("");
    els.diffStats.textContent = adds + " added, " + dels + " removed";
    els.diffPanel.classList.add("visible");
    setStatus("Comparison ready.", "ok");
  }

  async function injectActiveTab() {
    if (!els.sdkEditor.value) {
      setStatus("Load/edit a script before injecting.", "err");
      return;
    }
    // Persist current editor contents first so background injects latest.
    updatedAt = Date.now();
    const settings = collectSettings();
    settings.localEdit.enabled = true;
    settings.localEdit.updatedAt = updatedAt;
    els.localEnabled.checked = true;
    const saved = await sendMessage({ type: "MCP_SAVE_SETTINGS", settings });
    if (!saved.ok) {
      setStatus(saved.error || "Failed to save before inject", "err");
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      setStatus("No active tab found.", "err");
      return;
    }
    if (!/^https?:/i.test(tab.url || "")) {
      setStatus("Active tab must be an http(s) page.", "err");
      return;
    }

    const res = await sendMessage({
      type: "MCP_INJECT_LOCAL_SDK",
      tabId: tab.id,
    });
    if (!res.ok) {
      setStatus(res.error || "Injection failed", "err");
      return;
    }
    setStatus(
      res.injected
        ? "Injected edited SDK into active tab. Hard-refresh if the page already booted another beacon."
        : "Injection skipped (" + (res.reason || "unknown") + ")",
      res.injected ? "ok" : "err"
    );
  }

  async function init() {
    document.getElementById("BtnSaveAll").addEventListener("click", () => {
      saveSettings().catch((e) => setStatus(String(e.message || e), "err"));
    });
    document.getElementById("BtnLoadSdk").addEventListener("click", () => {
      loadFromUrl().catch((e) => setStatus(String(e.message || e), "err"));
    });
    document.getElementById("BtnLoadFile").addEventListener("click", () => {
      els.fileInput.click();
    });
    els.fileInput.addEventListener("change", () => {
      const file = els.fileInput.files && els.fileInput.files[0];
      loadFromFile(file);
      els.fileInput.value = "";
    });
    document.getElementById("BtnResetEdited").addEventListener("click", () => {
      if (!originalText) {
        setStatus("No original loaded.", "err");
        return;
      }
      els.sdkEditor.value = originalText;
      updatedAt = Date.now();
      updateMeta();
      setStatus("Editor reset to original.", "ok");
    });
    document
      .getElementById("BtnDownloadEdited")
      .addEventListener("click", downloadEdited);
    document
      .getElementById("BtnCompare")
      .addEventListener("click", compareWithOriginal);
    document.getElementById("BtnInjectTab").addEventListener("click", () => {
      injectActiveTab().catch((e) => setStatus(String(e.message || e), "err"));
    });
    document.getElementById("BtnOpenExplorer").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("fullscreen.html") });
    });

    els.sdkEditor.addEventListener("input", updateMeta);

    try {
      const res = await sendMessage({ type: "MCP_GET_SETTINGS" });
      if (res.ok) applySettings(res.settings);
      setStatus("Ready.", "ok");
    } catch (e) {
      setStatus(String(e.message || e), "err");
    }
  }

  init();
})();
