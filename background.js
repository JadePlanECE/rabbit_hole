// background.js
// Runs in the background (seperate from pages), must receive message from content

const INTERVAL_SECONDS = 5; // how often we add time
const ALARM_NAME = "trackTime";

console.log("[background] service worker loaded");

// Create the alarm when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log("[background] onInstalled: creating alarm");
    chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: INTERVAL_SECONDS / 60
    });
});

// Alarm handler: runs every INTERVAL_SECONDS
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    console.log("[background] alarm fired");
    trackActiveTab();
});

function trackActiveTab() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) {
            console.log("[background] no active tab");
            return;
        }

        const url = tab.url;
        let domain;

        try {
            const u = new URL(url);
            domain = u.hostname;
        } catch (e) {
            console.log("[background] cannot parse URL:", url);
            return;
        }

        console.log("[background] active domain:", domain);

        chrome.storage.local.get("timeSpent", (data) => {
            const timeSpent = data.timeSpent || {};
            timeSpent[domain] = (timeSpent[domain] || 0) + INTERVAL_SECONDS;
            console.log("[background] updated timeSpent:", timeSpent);
            chrome.storage.local.set({ timeSpent });
        });
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "reset") {
        console.log("[background] resetting timeSpent");
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
