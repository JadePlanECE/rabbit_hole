// background.js

const INTERVAL = 60;
const ALARM_NAME = "trackTime";
let pendingUpdates = {};
let lastStorageUpdate = 0;

// Create the alarm when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: INTERVAL / 60
    });
});

// Alarm handler: runs every INTERVAL
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    trackActiveTab();
});

function trackActiveTab() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.url) return;

        try {
            const domain = new URL(tab.url).hostname;
            pendingUpdates[domain] = (pendingUpdates[domain] || 0) + INTERVAL;

            // Batch update every 30 seconds or when we have 10+ updates
            if (Object.keys(pendingUpdates).length >= 10 ||
                Date.now() - lastStorageUpdate > 30000) {
                flushStorage();
            }
        } catch (e) {
            console.error("[background] URL parse error:", e);
        }
    });
}

function flushStorage() {
    chrome.storage.local.get("timeSpent", (data) => {
        const timeSpent = data.timeSpent || {};
        for (const [domain, seconds] of Object.entries(pendingUpdates)) {
            timeSpent[domain] = (timeSpent[domain] || 0) + seconds;
        }
        chrome.storage.local.set({ timeSpent });
        pendingUpdates = {};
        lastStorageUpdate = Date.now();
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "reset") {
        chrome.storage.local.set({ timeSpent: {} }, () => {
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
