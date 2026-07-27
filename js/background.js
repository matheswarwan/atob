console.log("Background js loaded..");

const CONFIG = {
  RECORD_TIMER: 1.5 * 1000,
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/** Serialize storage writes so concurrent events cannot overwrite each other. */
let storageWriteQueue = Promise.resolve();

/** requestId -> pending event data captured in onBeforeRequest */
const pendingRequests = new Map();

function isEvergageEventRequest(url) {
  return url.indexOf("evergage.com/api2/event/") > -1;
}

function isDataCloudEventRequest(url) {
  return (
    url.indexOf("c360a.salesforce.com/web/events/") > -1 ||
    url.indexOf(".c360a.salesforce.com/web/events/") > -1
  );
}

function isTrackedEventRequest(request) {
  return (
    (request.method === "GET" || request.method === "POST") &&
    typeof request.url === "string" &&
    (isEvergageEventRequest(request.url) ||
      isDataCloudEventRequest(request.url))
  );
}

function decodeBase64Utf8(encodedString) {
  const binary = atob(encodedString);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseEventValue(eventValue) {
  if (eventValue == null) {
    throw new Error("Missing event value");
  }
  // Raw JSON
  try {
    return JSON.parse(eventValue);
  } catch (_) {
    // fall through
  }
  // Base64 JSON (Data Cloud / some Evergage POST bodies)
  try {
    return JSON.parse(decodeBase64Utf8(eventValue));
  } catch (_) {
    // fall through
  }
  // URL-encoded base64
  try {
    return JSON.parse(decodeBase64Utf8(decodeURIComponent(eventValue)));
  } catch (_) {
    throw new Error("Unable to parse event payload value");
  }
}

function extractPayload(request) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    // searchParams.get already URL-decodes the value
    const encodedString = url.searchParams.get("event");
    if (!encodedString) {
      throw new Error("Missing event query parameter");
    }
    return parseEventValue(encodedString);
  }

  const formEvent = request.requestBody?.formData?.event?.[0];
  if (formEvent) {
    return parseEventValue(formEvent);
  }

  const rawBytes = request.requestBody?.raw?.[0]?.bytes;
  if (rawBytes) {
    const rawText = new TextDecoder().decode(new Uint8Array(rawBytes));
    try {
      return JSON.parse(rawText);
    } catch (_) {
      const params = new URLSearchParams(rawText);
      const eventValue = params.get("event");
      if (!eventValue) {
        throw new Error("Missing event field in POST body");
      }
      return parseEventValue(eventValue);
    }
  }

  throw new Error("Unable to extract event payload from request");
}

function getWebsiteName(request) {
  if (request.initiator) {
    try {
      return new URL(request.initiator).hostname;
    } catch (_) {
      // fall through
    }
  }
  if (request.documentUrl) {
    try {
      return new URL(request.documentUrl).hostname;
    } catch (_) {
      // fall through
    }
  }
  return "unknown";
}

function buildHostKey(request, websiteName) {
  const url = new URL(request.url);

  if (isDataCloudEventRequest(request.url)) {
    const pathParts = url.pathname.split("/").filter(Boolean);
    // /web/events/<app-id>
    const appId = pathParts[pathParts.length - 1] || "unknown";
    const shortId = appId.length > 12 ? appId.slice(0, 8) : appId;
    return websiteName + " | Data Cloud (app: " + shortId + ")";
  }

  const evergageHost = url.hostname.split(".")[0];
  const pathParts = url.pathname.split("/").filter(Boolean);
  const datasetName = pathParts[pathParts.length - 1] || "unknown";
  return websiteName + " | " + evergageHost + " (ds: " + datasetName + ")";
}

function extractEventTime(payload) {
  if (!payload || typeof payload !== "object") return null;

  const normalizeEpoch = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    // Seconds vs milliseconds heuristic
    if (value > 0 && value < 1e11) return value * 1000;
    return value;
  };

  if (Array.isArray(payload.events) && payload.events.length) {
    const times = payload.events
      .map((e) => {
        if (!e) return null;
        if (typeof e.dateTime === "string") {
          const parsed = Date.parse(e.dateTime);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return normalizeEpoch(e.dateTime) || normalizeEpoch(e.time);
      })
      .filter((t) => Number.isFinite(t));
    if (times.length) return Math.max.apply(null, times);
  }

  const sourceTime = normalizeEpoch(payload.source && payload.source.time);
  if (sourceTime != null) return sourceTime;

  const topTime = normalizeEpoch(payload.time);
  if (topTime != null) return topTime;

  if (typeof payload.dateTime === "string") {
    const parsed = Date.parse(payload.dateTime);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function saveEvent(request, payload, statusCode) {
  const websiteName = getWebsiteName(request);
  const hostName = buildHostKey(request, websiteName);
  const capturedAt = Date.now();
  const eventTime = extractEventTime(payload) || capturedAt;
  const epocheDate = String(eventTime) + "-" + String(capturedAt);

  const isPayload = {};
  isPayload[epocheDate] = {
    url: request.url,
    payload: payload,
    datetime: capturedAt,
    eventTime: eventTime,
    website: websiteName,
    statusCode: statusCode,
    sdk: isDataCloudEventRequest(request.url) ? "data-cloud" : "evergage",
  };

  storageWriteQueue = storageWriteQueue
    .then(
      () =>
        new Promise((resolve) => {
          chrome.storage.local.get(null, function (originalPayload) {
            if (Object.keys(originalPayload).includes(hostName)) {
              originalPayload[hostName].push(isPayload);
            } else {
              originalPayload[hostName] = [isPayload];
            }
            chrome.storage.local.set(originalPayload, async function () {
              try {
                chrome.action.setIcon({
                  path: "../images/activeImg/cloud-48.png",
                });
                await delay(CONFIG.RECORD_TIMER);
                chrome.action.setIcon({ path: "../images/cloud/cloud-48.png" });
              } catch (e) {
                console.warn("Failed to update action icon", e);
              }
              resolve();
            });
          });
        })
    )
    .catch((e) => {
      console.error("Failed to persist event", e);
    });
}

function finalizeRequest(requestId, statusCode) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }
  pendingRequests.delete(requestId);
  saveEvent(pending.request, pending.payload, statusCode);
}

chrome.webRequest.onBeforeRequest.addListener(
  function (request) {
    if (!isTrackedEventRequest(request)) {
      return;
    }
    try {
      const payload = extractPayload(request);
      pendingRequests.set(request.requestId, {
        request: {
          url: request.url,
          method: request.method,
          initiator: request.initiator,
          documentUrl: request.documentUrl,
        },
        payload: payload,
      });
    } catch (e) {
      console.error("Failed to parse tracked event request", request.url, e);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
  function (request) {
    if (!isTrackedEventRequest(request)) {
      return;
    }
    finalizeRequest(request.requestId, request.statusCode);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  function (request) {
    if (!isTrackedEventRequest(request)) {
      return;
    }
    // Still record the attempt; statusCode null marks transport failure in UI.
    finalizeRequest(request.requestId, null);
  },
  { urls: ["<all_urls>"] }
);
