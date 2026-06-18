// background.js
// Runs in the background (seperate from pages), must receive message from content

chrome.runtime.onMessage.addListener((msg) => {
    console.log("Background received:", msg.url);

    chrome.storage.local.get("visited", (data) => {
        const visited = data.visited || [];
        visited.push(msg.url);
        chrome.storage.local.set({ visited });
    });
});
