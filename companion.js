// companion.js
// Runs only when companion.html is open

chrome.storage.local.get("visited", ({ visited }) => {
    document.getElementById("out").innerText =
        JSON.stringify(visited, null, 2);
});
