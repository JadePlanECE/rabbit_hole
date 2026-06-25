// background.js

const CHECKPOINT_INTERVAL_SECONDS = 60;
const IDLE_THRESHOLD_SECONDS = 60;
const ALARM_NAME = "trackTime";

// Create the alarm when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECKPOINT_INTERVAL_SECONDS / 60 });
    chrome.idle.setDetectionInterval(CHECKPOINT_INTERVAL_SECONDS);
    refreshTrackingSafe();
});

chrome.alarms.onAlarm.addListener(() => {
    chrome.idle.setDetectionInterval(CHECKPOINT_INTERVAL_SECONDS);
    refreshTrackingSafe();
});

chrome.tabs.onActivated.addListener(() => refreshTrackingSafe());
chrome.tabs.onRemoved.addListener(() => refreshTrackingSafe());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) refreshTrackingSafe(); // navigation changed the domain
});
chrome.windows.onFocusChanged.addListener(() => refreshTrackingSafe());
chrome.idle.onStateChanged.addListener(() => refreshTrackingSafe());
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) refreshTrackingSafe();
});

let trackingLock = Promise.resolve();
function refreshTrackingSafe() {
    trackingLock = trackingLock.then(refreshTracking).catch((e) => {
        console.error("[background] tracking error:", e.message || e);
    });
    return trackingLock;
}

async function refreshTracking() {
    const now = Date.now();
    const prevState = await getTrackingState();

    // Credit the time that just elapsed to whatever was being tracked before.
    if (prevState.domain) {
        await recordElapsed(prevState.domain, prevState.since, now);
    }

    // Figure out what should be tracked from this point forward.
    const newDomain = await getActiveDomain();
    await setTrackingState({ domain: newDomain, since: now });
}

async function getActiveDomain() {
    const idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
    if (idleState !== "active") return null; // paused: user idle or screen locked

    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    const focusedWindow = windows.find((w) => w.focused);
    if (!focusedWindow) return null; // Chrome itself isn't the focused app

    const activeTab = focusedWindow.tabs?.find((t) => t.active);
    if (!activeTab?.url) return null;

    try {
        const url = new URL(activeTab.url);
        // Only track real web pages, not chrome://, file://, extension pages...
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.hostname;
    } catch (e) {
        return null;
    }
}

async function getTrackingState() {
    const { trackingState } = await chrome.storage.session.get("trackingState");
    return trackingState || { domain: null, since: Date.now() };
}

async function setTrackingState(state) {
    await chrome.storage.session.set({ trackingState: state });
}

function dateKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfNextLocalDay(ts) {
    const d = new Date(ts);
    d.setHours(24, 0, 0, 0);
    return d.getTime();
}

async function recordElapsed(domain, sinceTs, nowTs) {
    if (!domain || nowTs <= sinceTs) return;

    // Split the interval at local-midnight boundaries so a session that
    // spans midnight gets credited to the correct day on each side.
    const segments = [];
    let cursor = sinceTs;
    while (cursor < nowTs) {
        const dayEnd = Math.min(startOfNextLocalDay(cursor), nowTs);
        segments.push({ key: dateKey(cursor), seconds: Math.round((dayEnd - cursor) / 1000) });
        cursor = dayEnd;
    }

    const { dailyStats = {} } = await chrome.storage.local.get("dailyStats");
    for (const { key, seconds } of segments) {
        if (seconds <= 0) continue;
        if (!dailyStats[key]) dailyStats[key] = {};
        dailyStats[key][domain] = (dailyStats[key][domain] || 0) + seconds;
    }
    await chrome.storage.local.set({ dailyStats });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "reset") {
        chrome.storage.local.set({ timeSpent: {}, dailyStats: {} }, () => {
            if (chrome.runtime.lastError) {
                console.error("[background] reset failed:", chrome.runtime.lastError);
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            sendResponse({ ok: true });
        });
        return true; // keep sendResponse async
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
        url: chrome.runtime.getURL("companion.html")
    });
});
