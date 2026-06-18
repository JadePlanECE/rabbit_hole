function refresh() {
    chrome.storage.local.get("counters", ({ counters }) => {
        document.getElementById("stats").innerText =
            JSON.stringify(counters, null, 2);
    });
}

document.getElementById("reset").onclick = () => {
    chrome.storage.local.set({ counters: {} }, refresh);
};

refresh();