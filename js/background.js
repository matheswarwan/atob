console.log("Background js loaded..");

const CONFIG = {
  RECORD_TIMER: 1.5 * 1000,
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/** Serialize storage writes so concurrent events cannot overwrite each other. */
let storageWriteQueue = Promise.resolve();

/** requestId -> pending event data captured in onBeforeRequest */
const pendingRequests = new Map();

function isEvergageEventRequest(request) {
  return (
    (request.method === "GET" || request.method === "POST") &&
    typeof request.url === "string" &&
    request.url.indexOf("evergage.com/api2/event/") > -1
  );
}

function decodeBase64Utf8(encodedString) {
  const binary = atob(encodedString);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function extractPayload(request) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    // searchParams.get already URL-decodes the value
    const encodedString = url.searchParams.get("event");
    if (!encodedString) {
      throw new Error("Missing event query parameter");
    }
    return JSON.parse(decodeBase64Utf8(encodedString));
  }

  const formEvent = request.requestBody?.formData?.event?.[0];
  if (formEvent) {
    // formData event may be raw JSON or base64 depending on beacon version
    try {
      return JSON.parse(formEvent);
    } catch (_) {
      return JSON.parse(decodeBase64Utf8(formEvent));
    }
  }

  const rawBytes = request.requestBody?.raw?.[0]?.bytes;
  if (rawBytes) {
    const rawText = new TextDecoder().decode(new Uint8Array(rawBytes));
    try {
      return JSON.parse(rawText);
    } catch (_) {
      // application/x-www-form-urlencoded: event=<payload>
      const params = new URLSearchParams(rawText);
      const eventValue = params.get("event");
      if (!eventValue) {
        throw new Error("Missing event field in POST body");
      }
      try {
        return JSON.parse(eventValue);
      } catch (_) {
        return JSON.parse(decodeBase64Utf8(eventValue));
      }
    }
  }

  throw new Error("Unable to extract Evergage event payload from request");
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
  const evergageHost = url.hostname.split(".")[0];
  const pathParts = url.pathname.split("/").filter(Boolean);
  const datasetName = pathParts[pathParts.length - 1] || "unknown";
  return websiteName + " | " + evergageHost + " (ds: " + datasetName + ")";
}

function saveEvent(request, payload, statusCode) {
  const websiteName = getWebsiteName(request);
  const hostName = buildHostKey(request, websiteName);
  const epocheDate = Date.now().toString();

  const isPayload = {};
  isPayload[epocheDate] = {
    url: request.url,
    payload: payload,
    datetime: Date.now(),
    website: websiteName,
    statusCode: statusCode,
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
      console.error("Failed to persist Evergage event", e);
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
    if (!isEvergageEventRequest(request)) {
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
      console.error("Failed to parse Evergage event request", request.url, e);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
  function (request) {
    if (!isEvergageEventRequest(request)) {
      return;
    }
    finalizeRequest(request.requestId, request.statusCode);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  function (request) {
    if (!isEvergageEventRequest(request)) {
      return;
    }
    // Still record the attempt; statusCode null marks transport failure in UI.
    finalizeRequest(request.requestId, null);
  },
  { urls: ["<all_urls>"] }
);
