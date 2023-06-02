console.log("Background js loaded..");
let CONFIG = {};
CONFIG.RECORD_TIMER = 1.5 * 1000;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

chrome.webRequest.onBeforeRequest.addListener(
  function (request) {
    // https://cdn.evgnet.com/beacon/adpinc/prod/scripts/evergage.min.js
    if (
      request.method == "GET" &&
      request.url.indexOf("evergage.com/api2/event/") > -1
    ) {
      console.log("GET Request ", request);
      var url = new URL(decodeURIComponent(request.url));
      var encodedString = url.search.replace("?event=", "");
      var decodedString = atob(encodedString);
      var decodedJson = JSON.parse(decodedString);
      var epocheDate = Date.now().toString();
      var payload = decodedJson;
      var hostName = url.hostname;
      hostName = hostName.split(".")[0];
      var datasetName =
        url.pathname.split("/")[url.pathname.split("/").length - 1];
      var initiator = request?.initiator;
      var websiteName = new URL(initiator).hostname;
      console.log("WEbsiteName ", websiteName);

      hostName = websiteName + " | " + hostName + " (ds: " + datasetName + ")";

      var isPayload = {};
      isPayload[epocheDate] = {};
      isPayload[epocheDate]["url"] = request.url;
      isPayload[epocheDate]["payload"] = payload;
      isPayload[epocheDate]["datetime"] = Date.now();
      isPayload[epocheDate]["website"] = websiteName;

      chrome.storage.local.get(null, function (originalPayload) {
        if (Object.keys(originalPayload).includes(hostName)) {
          originalPayload[hostName].push(isPayload);
        } else {
          originalPayload[hostName] = [];
          originalPayload[hostName].push(isPayload);
        }
        chrome.storage.local.set(originalPayload, async function () {
          //Update icon to show something is saved
          chrome.action.setIcon({ path: "../images/activeImg/cloud-48.png" });
          await delay(CONFIG.RECORD_TIMER);
          chrome.action.setIcon({ path: "../images/cloud/cloud-48.png" });
        });
      });
    } else if (
      request.method == "POST" &&
      request.url.indexOf("evergage.com/api2/event/") > -1
    ) {
      console.log("POST Request ", request);
      var url = new URL(decodeURIComponent(request.url));
      console.log(
        "Post method - get payload ",
        JSON.parse(request?.requestBody?.formData?.event?.[0])
      );
      var decodedJson = JSON.parse(request?.requestBody?.formData?.event?.[0]);
      var epocheDate = Date.now().toString();
      var payload = decodedJson;
      var hostName = url.hostname;
      hostName = hostName.split(".")[0];
      var datasetName =
        url.pathname.split("/")[url.pathname.split("/").length - 1];
      var initiator = request?.initiator;
      var websiteName = new URL(initiator).hostname;
      console.log("WEbsiteName ", websiteName);

      hostName = websiteName + " | " + hostName + " (ds: " + datasetName + ")";

      var isPayload = {};
      isPayload[epocheDate] = {};
      isPayload[epocheDate]["url"] = request.url;
      isPayload[epocheDate]["payload"] = payload;
      isPayload[epocheDate]["datetime"] = Date.now();
      isPayload[epocheDate]["website"] = websiteName;

      chrome.storage.local.get(null, function (originalPayload) {
        if (Object.keys(originalPayload).includes(hostName)) {
          originalPayload[hostName].push(isPayload);
        } else {
          originalPayload[hostName] = [];
          originalPayload[hostName].push(isPayload);
        }
        chrome.storage.local.set(originalPayload, async function () {
          //Update icon to show something is saved
          chrome.action.setIcon({ path: "../images/activeImg/cloud-48.png" });
          await delay(CONFIG.RECORD_TIMER);
          chrome.action.setIcon({ path: "../images/cloud/cloud-48.png" });
        });
      });
    } //if ends here
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// // Enable if switched on

// const HEADERS_TO_STRIP_LOWERCASE = [
//   "content-security-policy",
//   "x-frame-options",
// ];

// chrome.webRequest.onBeforeRequest.addListener(
//   (details) => {
//     console.log("Removing headers for ", details);
//     ({
//       responseHeaders: details.responseHeaders.filter(
//         (header) =>
//           !HEADERS_TO_STRIP_LOWERCASE.includes(header.name.toLowerCase())
//       ),
//     });
//   },
//   {
//     urls: ["<all_urls>"],
//   },
//   ["blocking", "responseHeaders", "extraHeaders"]
// );
