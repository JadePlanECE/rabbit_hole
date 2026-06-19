// companion.js
// Runs only when companion.html is open

console.log("[companion] loaded");

const tableBody = document.querySelector("#table tbody");
const logDiv = document.getElementById("log");

function log(msg, obj) {
    const time = new Date().toLocaleTimeString();
    let line = `[${time}] ${msg}`;
    if (obj !== undefined) {
        line += " " + JSON.stringify(obj);
    }
    console.log(line);
    logDiv.textContent += line + "\n";
}

function render() {
    chrome.storage.local.get("timeSpent", (data) => {
        const timeSpent = data.timeSpent || {};
        log("Loaded timeSpent", timeSpent);

        tableBody.innerHTML = "";

        const entries = Object.entries(timeSpent).sort((a, b) => b[1] - a[1]);

        for (const [domain, seconds] of entries) {
            const tr = document.createElement("tr");

            const tdDomain = document.createElement("td");
            tdDomain.textContent = domain;

            const tdSeconds = document.createElement("td");
            tdSeconds.textContent = seconds;

            const tdMinutes = document.createElement("td");
            tdMinutes.textContent = (seconds / 60).toFixed(1);

            const tdHours = document.createElement("td");
            tdHours.textContent = (seconds / 3600).toFixed(2);

            tr.appendChild(tdDomain);
            tr.appendChild(tdSeconds);
            tr.appendChild(tdMinutes);
            tr.appendChild(tdHours);

            tableBody.appendChild(tr);
        }

        if (entries.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 4;
            td.textContent = "No data yet. Browse some sites and come back.";
            tr.appendChild(td);
            tableBody.appendChild(tr);
        }
    });
}

document.getElementById("refresh").addEventListener("click", () => {
    log("Manual refresh");
    render();
});

document.getElementById("reset").addEventListener("click", () => {
    log("Sending reset message");
    chrome.runtime.sendMessage({ type: "reset" }, (res) => {
        log("Reset response", res);
        render();
    });
});

// Initial render
render();
