/** Shared SDK tooling config for Force SDK URL + Local Edit */

const MCP_SETTINGS_KEY = "__mcp_settings__";

const DEFAULT_MCP_SETTINGS = {
  forceSdk: {
    enabled: false,
    url: "",
  },
  localEdit: {
    enabled: false,
    sourceUrl: "",
    fileName: "",
    original: "",
    edited: "",
    updatedAt: null,
  },
};

const SDK_SCRIPT_REGEXES = [
  "^https://cdn\\.evgnet\\.com/.*evergage\\.min\\.js(\\?.*)?$",
  "^https://cdn\\.c360a\\.salesforce\\.com/.*c360a\\.min\\.js(\\?.*)?$",
];

const DNR_RULE_ID_FORCE = 91001;
const DNR_RULE_ID_BLOCK_BASE = 91010;

function isSettingsKey(key) {
  return key === MCP_SETTINGS_KEY || String(key).indexOf("__mcp_") === 0;
}

function mergeSettings(raw) {
  const incoming = raw && typeof raw === "object" ? raw : {};
  return {
    forceSdk: {
      ...DEFAULT_MCP_SETTINGS.forceSdk,
      ...(incoming.forceSdk || {}),
    },
    localEdit: {
      ...DEFAULT_MCP_SETTINGS.localEdit,
      ...(incoming.localEdit || {}),
    },
  };
}

async function readMcpSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([MCP_SETTINGS_KEY], (items) => {
      resolve(mergeSettings(items[MCP_SETTINGS_KEY]));
    });
  });
}

async function writeMcpSettings(next) {
  const settings = mergeSettings(next);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [MCP_SETTINGS_KEY]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(settings);
      }
    });
  });
}

function buildSdkDnrRules(settings) {
  const addRules = [];
  const removeRuleIds = [];
  for (let i = 0; i < SDK_SCRIPT_REGEXES.length; i++) {
    removeRuleIds.push(DNR_RULE_ID_FORCE + i);
    removeRuleIds.push(DNR_RULE_ID_BLOCK_BASE + i);
  }

  const localOn = !!(settings.localEdit && settings.localEdit.enabled && settings.localEdit.edited);
  const forceOn = !!(settings.forceSdk && settings.forceSdk.enabled && settings.forceSdk.url);

  if (localOn) {
    // Block CDN SDK so the locally edited script is the one that runs.
    SDK_SCRIPT_REGEXES.forEach((regexFilter, i) => {
      addRules.push({
        id: DNR_RULE_ID_BLOCK_BASE + i,
        priority: 100,
        action: { type: "block" },
        condition: {
          regexFilter,
          resourceTypes: ["script"],
        },
      });
    });
  } else if (forceOn) {
    let redirectUrl = String(settings.forceSdk.url || "").trim();
    try {
      // Validate absolute URL
      redirectUrl = new URL(redirectUrl).toString();
    } catch (_) {
      return { addRules: [], removeRuleIds };
    }

    SDK_SCRIPT_REGEXES.forEach((regexFilter, i) => {
      const id = DNR_RULE_ID_FORCE + i;
      removeRuleIds.push(id);
      addRules.push({
        id,
        priority: 50,
        action: {
          type: "redirect",
          redirect: { url: redirectUrl },
        },
        condition: {
          regexFilter,
          resourceTypes: ["script"],
        },
      });
    });
  }

  return { addRules, removeRuleIds: [...new Set(removeRuleIds)] };
}

async function syncSdkDnrRules(settings) {
  if (!chrome.declarativeNetRequest) {
    console.warn("declarativeNetRequest API unavailable");
    return;
  }
  const { addRules, removeRuleIds } = buildSdkDnrRules(settings);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds,
      addRules,
    });
  } catch (e) {
    console.error("Failed to update SDK DNR rules", e);
    throw e;
  }
}

// Export for both service worker (importScripts) and window contexts.
if (typeof globalThis !== "undefined") {
  globalThis.MCP_SETTINGS_KEY = MCP_SETTINGS_KEY;
  globalThis.DEFAULT_MCP_SETTINGS = DEFAULT_MCP_SETTINGS;
  globalThis.SDK_SCRIPT_REGEXES = SDK_SCRIPT_REGEXES;
  globalThis.isSettingsKey = isSettingsKey;
  globalThis.mergeSettings = mergeSettings;
  globalThis.readMcpSettings = readMcpSettings;
  globalThis.writeMcpSettings = writeMcpSettings;
  globalThis.buildSdkDnrRules = buildSdkDnrRules;
  globalThis.syncSdkDnrRules = syncSdkDnrRules;
}
