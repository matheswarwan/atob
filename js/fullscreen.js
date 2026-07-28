(function () {
  const state = {
    raw: {},
    sites: [],
    activeSite: null,
    timeRange: "24h",
    sort: "desc",
    search: "",
    customFrom: null,
    customTo: null,
    selectedEventId: null,
    selectedPayload: null,
    eventsBySite: {},
  };

  const els = {
    tabs: document.getElementById("fsSiteTabs"),
    timeline: document.getElementById("fsTimeline"),
    detail: document.getElementById("fsDetailBody"),
    totalStat: document.getElementById("fsTotalStat"),
    filteredStat: document.getElementById("fsFilteredStat"),
    streamSubtitle: document.getElementById("fsStreamSubtitle"),
    search: document.getElementById("fsSearch"),
    customRange: document.getElementById("fsCustomRange"),
    from: document.getElementById("fsFrom"),
    to: document.getElementById("fsTo"),
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function flashButtonLabel(buttonId, label) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => {
      btn.textContent = original;
    }, 1200);
  }

  function getData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => resolve(items || {}));
    });
  }

  function getStatusCode(entry) {
    if (entry.statusCode !== undefined) return entry.statusCode;
    if (entry["statusCode;"] !== undefined) return entry["statusCode;"];
    return null;
  }

  function getActionName(payload) {
    if (!payload || typeof payload !== "object") return "Unknown event";

    // Data Cloud Web SDK batches: { events: [ { eventType, interactionName, pageName } ] }
    if (Array.isArray(payload.events) && payload.events.length) {
      const preferred =
        payload.events.find(
          (e) =>
            e &&
            (e.eventType === "pageView" ||
              e.interactionName ||
              e.pageName)
        ) || payload.events[0];
      return (
        preferred.interactionName ||
        preferred.pageName ||
        preferred.eventType ||
        "Data Cloud Event"
      );
    }

    return (
      payload.action ||
      payload.itemAction ||
      payload.interaction?.name ||
      payload.name ||
      (payload.flags?.pageView ? "Page View" : null) ||
      "Event"
    );
  }

  function getPageUrl(payload, fallbackUrl) {
    if (Array.isArray(payload?.events) && payload.events.length) {
      const withUrl = payload.events.find((e) => e?.pageUrl || e?.sourceUrl);
      if (withUrl) {
        return withUrl.pageUrl || withUrl.sourceUrl;
      }
    }
    return (
      payload?.source?.url ||
      payload?.url ||
      fallbackUrl ||
      ""
    );
  }

  function getPageType(payload) {
    if (Array.isArray(payload?.events) && payload.events.length) {
      const withType = payload.events.find(
        (e) => e?.sourcePageType || e?.eventType
      );
      if (withType) {
        return withType.sourcePageType || withType.eventType || "";
      }
    }
    return payload?.source?.pageType || payload?.pageType || "";
  }

  function getItemAction(payload) {
    if (Array.isArray(payload?.events) && payload.events.length) {
      const types = payload.events
        .map((e) => e?.eventType)
        .filter(Boolean);
      if (types.length) {
        return types.slice(0, 3).join(", ");
      }
    }
    return payload?.itemAction || payload?.interaction?.name || "";
  }

  function normalizeEvents(raw) {
    const bySite = {};
    let total = 0;

    Object.keys(raw).forEach((site) => {
      if (String(site).indexOf("__mcp_") === 0) {
        return;
      }
      const rows = Array.isArray(raw[site]) ? raw[site] : [];
      bySite[site] = [];

      rows.forEach((row, index) => {
        const key = Object.keys(row || {})[0];
        if (!key) return;
        const entry = row[key] || {};
        const ts = Number(entry.datetime || key);
        if (!Number.isFinite(ts)) return;

        const payload = entry.payload || {};
        const statusCode = getStatusCode(entry);
        const id = site + "::" + key + "::" + index;

        bySite[site].push({
          id,
          site,
          ts,
          statusCode,
          payload,
          url: entry.url || "",
          action: getActionName(payload),
          itemAction: getItemAction(payload),
          pageUrl: getPageUrl(payload, entry.url),
          pageType: getPageType(payload),
        });
        total += 1;
      });

      bySite[site].sort((a, b) => b.ts - a.ts);
    });

    return { bySite, total };
  }

  function getRangeBounds() {
    const now = moment();
    switch (state.timeRange) {
      case "15m":
        return { from: now.clone().subtract(15, "minutes"), to: now };
      case "1h":
        return { from: now.clone().subtract(1, "hour"), to: now };
      case "24h":
        return { from: now.clone().subtract(24, "hours"), to: now };
      case "today":
        return { from: now.clone().startOf("day"), to: now.clone().endOf("day") };
      case "7d":
        return { from: now.clone().subtract(7, "days"), to: now };
      case "custom": {
        const from = state.customFrom ? moment(state.customFrom) : null;
        const to = state.customTo ? moment(state.customTo) : null;
        return {
          from: from && from.isValid() ? from : null,
          to: to && to.isValid() ? to : null,
        };
      }
      case "all":
      default:
        return { from: null, to: null };
    }
  }

  function getFilteredEvents() {
    if (!state.activeSite) return [];
    const events = state.eventsBySite[state.activeSite] || [];
    const { from, to } = getRangeBounds();
    const q = state.search.trim().toLowerCase();

    let filtered = events.filter((event) => {
      const m = moment(event.ts);
      if (from && m.isBefore(from)) return false;
      if (to && m.isAfter(to)) return false;
      if (!q) return true;
      const haystack = [
        event.action,
        event.itemAction,
        event.pageUrl,
        event.pageType,
        event.url,
        JSON.stringify(event.payload || {}),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    filtered.sort((a, b) =>
      state.sort === "asc" ? a.ts - b.ts : b.ts - a.ts
    );
    return filtered;
  }

  function renderTabs() {
    if (!state.sites.length) {
      els.tabs.innerHTML =
        '<div class="fs-empty" style="padding:18px 8px"><strong>No sites captured yet</strong>Browse a site with MCP Personalization to start logging.</div>';
      return;
    }

    els.tabs.innerHTML = state.sites
      .map((site) => {
        const count = (state.eventsBySite[site] || []).length;
        const shortLabel = site.split(" | ")[0] || site;
        const active = site === state.activeSite ? "active" : "";
        return `<button class="fs-tab ${active}" type="button" data-site="${escapeHtml(
          site
        )}" title="${escapeHtml(site)}">${escapeHtml(
          shortLabel
        )}<span class="count">${count}</span></button>`;
      })
      .join("");
  }

  function renderTimeline() {
    const events = getFilteredEvents();
    els.filteredStat.textContent =
      "Showing " + events.length + " event" + (events.length === 1 ? "" : "s");
    els.streamSubtitle.textContent = state.activeSite
      ? state.activeSite
      : "Select a site tab to begin";

    if (!state.activeSite) {
      els.timeline.innerHTML =
        '<div class="fs-empty"><strong>Select a site</strong>Each captured site appears as a tab above.</div>';
      return;
    }

    if (!events.length) {
      els.timeline.innerHTML =
        '<div class="fs-empty"><strong>No events in this range</strong>Try widening the time filter or clearing the search.</div>';
      if (
        state.selectedEventId &&
        !events.some((e) => e.id === state.selectedEventId)
      ) {
        state.selectedEventId = null;
        state.selectedPayload = null;
        renderDetail(null);
      }
      return;
    }

    if (
      !state.selectedEventId ||
      !events.some((e) => e.id === state.selectedEventId)
    ) {
      state.selectedEventId = events[0].id;
      state.selectedPayload = events[0].payload;
      renderDetail(events[0]);
    }

    els.timeline.innerHTML = events
      .map((event, index) => {
        const ok =
          event.statusCode == null
            ? false
            : event.statusCode >= 200 && event.statusCode < 400;
        const statusClass =
          event.statusCode == null ? "error" : ok ? "success" : "error";
        const active = event.id === state.selectedEventId ? "active" : "";
        const statusLabel =
          event.statusCode == null ? "ERR" : String(event.statusCode);
        const statusBadgeClass = ok ? "status-ok" : "status-bad";

        return `
          <article class="fs-event ${statusClass} ${active}" data-event-id="${escapeHtml(
            event.id
          )}" style="animation-delay:${Math.min(index, 12) * 30}ms">
            <div class="fs-event-dot" aria-hidden="true"></div>
            <div class="fs-event-card">
              <div class="fs-event-top">
                <div>
                  <h3 class="fs-event-action">${escapeHtml(event.action)}</h3>
                  <div class="fs-event-meta">
                    ${
                      event.itemAction
                        ? `<span class="fs-badge item">${escapeHtml(
                            event.itemAction
                          )}</span>`
                        : ""
                    }
                    ${
                      event.pageType
                        ? `<span class="fs-badge">${escapeHtml(
                            event.pageType
                          )}</span>`
                        : ""
                    }
                    <span class="fs-badge ${statusBadgeClass}">${escapeHtml(
                      statusLabel
                    )}</span>
                  </div>
                </div>
                <div class="fs-event-time">
                  <strong>${escapeHtml(moment(event.ts).format("HH:mm:ss"))}</strong>
                  ${escapeHtml(moment(event.ts).format("MMM D, YYYY"))}<br/>
                  ${escapeHtml(moment(event.ts).fromNow())}
                </div>
              </div>
              ${
                event.pageUrl
                  ? `<div class="fs-event-url">${escapeHtml(
                      event.pageUrl
                    )}</div>`
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderDetail(event) {
    if (!event) {
      els.detail.innerHTML =
        '<div class="fs-empty"><strong>No event selected</strong>Click an event in the stream to inspect its payload.</div>';
      state.selectedPayload = null;
      return;
    }

    state.selectedPayload = event.payload;
    const ok =
      event.statusCode != null &&
      event.statusCode >= 200 &&
      event.statusCode < 400;

    els.detail.innerHTML = `
      <div class="fs-detail-grid">
        <div class="fs-kv"><label>Action</label><div>${escapeHtml(
          event.action
        )}</div></div>
        <div class="fs-kv"><label>Item action</label><div>${escapeHtml(
          event.itemAction || "—"
        )}</div></div>
        <div class="fs-kv"><label>Time</label><div>${escapeHtml(
          moment(event.ts).format("YYYY-MM-DD HH:mm:ss")
        )} (${escapeHtml(moment(event.ts).fromNow())})</div></div>
        <div class="fs-kv"><label>Status</label><div style="color:${
          ok ? "var(--ck-success)" : "var(--ck-danger)"
        }">${escapeHtml(
          event.statusCode == null ? "Transport error" : String(event.statusCode)
        )}</div></div>
        <div class="fs-kv" style="grid-column:1/-1"><label>Page URL</label><div>${escapeHtml(
          event.pageUrl || "—"
        )}</div></div>
        <div class="fs-kv" style="grid-column:1/-1"><label>Request URL</label><div>${escapeHtml(
          event.url || "—"
        )}</div></div>
      </div>
      <div class="fs-json" id="fsJsonMount"></div>
    `;

    const viewer = new JSONViewer();
    const mount = document.getElementById("fsJsonMount");
    mount.appendChild(viewer.getContainer());
    viewer.showJSON(event.payload || {});
  }

  function setActiveSite(site) {
    state.activeSite = site;
    state.selectedEventId = null;
    state.selectedPayload = null;
    renderTabs();
    renderTimeline();
  }

  async function loadAndRender() {
    state.raw = await getData();
    const normalized = normalizeEvents(state.raw);
    state.eventsBySite = normalized.bySite;
    state.sites = Object.keys(normalized.bySite).sort((a, b) =>
      a.localeCompare(b)
    );
    els.totalStat.textContent =
      normalized.total + " event" + (normalized.total === 1 ? "" : "s");

    if (!state.sites.length) {
      state.activeSite = null;
      renderTabs();
      els.timeline.innerHTML =
        '<div class="fs-empty"><strong>No events captured yet</strong>Open a site with Marketing Cloud Personalization to start logging.</div>';
      renderDetail(null);
      els.filteredStat.textContent = "Showing 0 events";
      els.streamSubtitle.textContent = "Waiting for events";
      return;
    }

    if (!state.activeSite || !state.sites.includes(state.activeSite)) {
      state.activeSite = state.sites[0];
    }

    renderTabs();
    renderTimeline();
  }

  function bindEvents() {
    document.getElementById("BtnFsRefresh").addEventListener("click", loadAndRender);
    document.getElementById("BtnFsClear").addEventListener("click", () => {
      chrome.runtime.sendMessage(
        { type: "MCP_CLEAR_EVENTS_KEEP_SETTINGS" },
        () => {
          state.selectedEventId = null;
          state.selectedPayload = null;
          loadAndRender();
        }
      );
    });

    const sdkToolsBtn = document.getElementById("BtnFsSdkTools");
    if (sdkToolsBtn) {
      sdkToolsBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
      });
    }

    document.getElementById("BtnCopyJson").addEventListener("click", async () => {
      if (!state.selectedPayload) return;
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(state.selectedPayload, null, 2)
        );
        const btn = document.getElementById("BtnCopyJson");
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = original;
        }, 1200);
      } catch (e) {
        console.error("Copy failed", e);
      }
    });

    document.getElementById("BtnDownloadJson").addEventListener("click", () => {
      if (!state.selectedPayload) return;
      const selected = (getFilteredEvents() || []).find(
        (e) => e.id === state.selectedEventId
      );
      const stamp = moment(selected?.ts || Date.now()).format("YYYYMMDD-HHmmss");
      const safeAction = String(selected?.action || "event")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      downloadJson(
        state.selectedPayload,
        "mcp-event-" + safeAction + "-" + stamp + ".json"
      );
      flashButtonLabel("BtnDownloadJson", "Downloaded!");
    });

    document
      .getElementById("BtnFsDownloadFiltered")
      .addEventListener("click", () => {
        const events = getFilteredEvents();
        if (!events.length) return;
        const exportPayload = {
          exportedAt: new Date().toISOString(),
          site: state.activeSite,
          timeRange: state.timeRange,
          search: state.search,
          sort: state.sort,
          count: events.length,
          events: events.map((event) => ({
            id: event.id,
            timestamp: event.ts,
            isoTime: new Date(event.ts).toISOString(),
            action: event.action,
            itemAction: event.itemAction,
            pageType: event.pageType,
            pageUrl: event.pageUrl,
            statusCode: event.statusCode,
            requestUrl: event.url,
            payload: event.payload,
          })),
        };
        const stamp = moment().format("YYYYMMDD-HHmmss");
        const sitePart = String(state.activeSite || "all")
          .split("|")[0]
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40);
        downloadJson(
          exportPayload,
          "mcp-events-" + sitePart + "-" + stamp + ".json"
        );
        flashButtonLabel("BtnFsDownloadFiltered", "Downloaded!");
      });

    els.tabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".fs-tab");
      if (!tab) return;
      setActiveSite(tab.getAttribute("data-site"));
    });

    els.timeline.addEventListener("click", (e) => {
      const row = e.target.closest(".fs-event");
      if (!row) return;
      const id = row.getAttribute("data-event-id");
      const events = getFilteredEvents();
      const event = events.find((item) => item.id === id);
      if (!event) return;
      state.selectedEventId = id;
      renderTimeline();
      renderDetail(event);
    });

    document.getElementById("fsTimeChips").addEventListener("click", (e) => {
      const chip = e.target.closest(".fs-chip");
      if (!chip) return;
      state.timeRange = chip.getAttribute("data-range");
      document
        .querySelectorAll("#fsTimeChips .fs-chip")
        .forEach((el) => el.classList.toggle("active", el === chip));
      els.customRange.classList.toggle("visible", state.timeRange === "custom");
      renderTimeline();
    });

    document.querySelector(".fs-sort").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-sort]");
      if (!chip) return;
      state.sort = chip.getAttribute("data-sort");
      document
        .querySelectorAll(".fs-sort .fs-chip")
        .forEach((el) => el.classList.toggle("active", el === chip));
      renderTimeline();
    });

    els.search.addEventListener("input", () => {
      state.search = els.search.value || "";
      renderTimeline();
    });

    els.from.addEventListener("change", () => {
      state.customFrom = els.from.value || null;
      if (state.timeRange === "custom") renderTimeline();
    });
    els.to.addEventListener("change", () => {
      state.customTo = els.to.value || null;
      if (state.timeRange === "custom") renderTimeline();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        loadAndRender();
      }
    });
  }

  bindEvents();
  loadAndRender();
})();
