// background.js

const INTERVAL = 60;
const ALARM_NAME = "trackTime";

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

        let domain;
        try {
            domain = new URL(tab.url).hostname;
        } catch (e) {
            console.error("[background] URL parse error:", e);
            return;
        }

        // Write direclty to storage every tick
        chrome.storage.local.get("timeSpent", (data) => {
            if (chrome.runtime.lastError) {
                console.error("[background] storage.get failed:", chrome.runtime.lastError);
                return;
            }

            const timeSpent = data.timeSpent || {};
            timeSpent[domain] = (timeSpent[domain] || 0) + INTERVAL;

            chrome.storage.local.set({ timeSpent }, () => {
                if (chrome.runtime.lastError) {
                    console.error("[background] storage.set failed:", chrome.runtime.lastError);
                }
            });
        });
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "reset") {
        chrome.storage.local.set({ timeSpent: {} }, () => {
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
