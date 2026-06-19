// companion.js

const tableBody = document.querySelector("#table tbody");
const logDiv = document.getElementById("log");

function log(msg, obj) {
    const time = new Date().toLocaleTimeString();
    let line = `[${time}] ${msg}`;
    if (obj !== undefined) {
        line += " " + JSON.stringify(obj);
    }
    logDiv.textContent += line + "\n";
}

function render() {
    chrome.storage.local.get("timeSpent", (data) => {
        const timeSpent = data.timeSpent || {};

        tableBody.innerHTML = "";

        const entries = Object.entries(timeSpent).sort((a, b) => b[1] - a[1]);

        for (const [domain, seconds] of entries) {
            const tr = document.createElement("tr");

            const tdDomain = document.createElement("td");
            tdDomain.textContent = domain;


            const tdMinutes = document.createElement("td");
            tdMinutes.textContent = (seconds / 60).toFixed(1);

            const tdHours = document.createElement("td");
            tdHours.textContent = (seconds / 3600).toFixed(2);

            tr.appendChild(tdDomain);
            tr.appendChild(tdMinutes);
            tr.appendChild(tdHours);

            tableBody.appendChild(tr);
        }

        if (entries.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 3;
            td.textContent = "No data yet. Browse some sites and come back.";
            tr.appendChild(td);
            tableBody.appendChild(tr);
        }

        updateArtVisualization(timeSpent);
    });
}

function updateArtVisualization(timeSpent) {
    const canvas = document.getElementById('artCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Get top 5 domains by time
    const topDomains = Object.entries(timeSpent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Draw colored rectangles based on domain time
    topDomains.forEach(([domain, seconds], index) => {
        const hue = hashDomainToHue(domain);  // Consistent color per domain
        const saturation = 70;
        const lightness = 50;

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        const barHeight = (seconds / Math.max(...Object.values(timeSpent))) * height;
        ctx.fillRect(index * (width / topDomains.length), height - barHeight, 
                    width / topDomains.length, barHeight);
    });
}

function hashDomainToHue(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.timeSpent) {
        render();
        updateArtVisualization(changes.timeSpent.newValue);
    }
});

document.getElementById("refresh").addEventListener("click", () => {
    chrome.storage.local.get("timeSpent", (data) => {
        const timeSpent = data.timeSpent || {};
        render();
        updateArtVisualization(timeSpent);
    });
});

document.getElementById("reset").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "reset" }, (res) => {
        render();
    });
});

setInterval(render, 60000);
