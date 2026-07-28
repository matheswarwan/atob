// Runs at document_start. Requests local-edit SDK injection when enabled.
(function () {
  try {
    chrome.runtime.sendMessage({ type: "MCP_INJECT_LOCAL_SDK" }, function () {
      void chrome.runtime.lastError;
    });
  } catch (_) {
    // Extension context may be unavailable during navigation edge cases.
  }
})();
