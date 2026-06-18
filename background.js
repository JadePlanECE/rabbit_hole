let counters = {};

chrome.runtime.onInstalled.addListener(() => {
    counters = {};
    chrome.storage.local.set({ counters });
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.site) {
        chrome.storage.local.get("counters", (data) => {
            counters = data.counters || {};
            counters[msg.site] = (counters[msg.site] || 0) + 1;
            chrome.storage.local.set({ counters });
        });
    }
});