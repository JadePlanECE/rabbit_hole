// content.js
// Runs when loading

console.log("content.js loaded on", window.location.href);

chrome.runtime.sendMessage({
    url: window.location.href
});
