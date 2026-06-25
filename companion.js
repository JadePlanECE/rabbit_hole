// companion.js

const tableBody = document.querySelector("#table tbody");
const logDiv = document.getElementById("log");
const colorCache = new Map();
let renderTimeout = null;
let currentView = "today"; // today | week | all

function log(msg, obj) {
    const time = new Date().toLocaleTimeString();
    let line = `[${time}] ${msg}`;
    if (obj !== undefined) {
        line += " " + JSON.stringify(obj);
    }
    console.log(line);
    logDiv.textContent += line + "\n";
    // Auto-scroll log
    logDiv.scrollTop = logDiv.scrollHeight;
}

function dateKeyLocal(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastNDayKeys(n) {
    const keys = [];
    for (let i = 0; i < n; i++) {
        keys.push(dateKeyLocal(Date.now() - i * 24 * 60 * 60 * 1000));
    }
    return keys;
}

function sumDailyStats(dailyStats, dayKeys) {
    const result = {};
    for (const key of dayKeys) {
        const dayData = dailyStats[key];
        if (!dayData) continue;
        for (const [domain, seconds] of Object.entries(dayData)) {
            result[domain] = (result[domain] || 0) + seconds;
        }
    }
    return result;
}

function computeStatsForView(view, timeSpent, dailyStats) {
    if (view === "today") {
        return sumDailyStats(dailyStats, [dateKeyLocal(Date.now())]);
    }
    if (view === "week") {
        return sumDailyStats(dailyStats, lastNDayKeys(7));
    }
    // "all": legacy cumulative totals (everything before this update) plus
    // every day ever recorded since.
    const merged = { ...timeSpent };
    const fromDaily = sumDailyStats(dailyStats, Object.keys(dailyStats));
    for (const [domain, seconds] of Object.entries(fromDaily)) {
        merged[domain] = (merged[domain] || 0) + seconds;
    }
    return merged;
}

function render() {
    if (renderTimeout) clearTimeout(renderTimeout);

    renderTimeout = setTimeout(async () => {
        chrome.storage.local.get(["timeSpent", "dailyStats"], async (data) => {
            const timeSpent = data.timeSpent || {};
            const dailyStats = data.dailyStats || {};
            const stats = computeStatsForView(currentView, timeSpent, dailyStats);
            log(`[companion] Rendering view: ${currentView}`, stats);

            // Update table
            updateTable(stats);

            // Update visualization
            await updateArtVisualization(stats);
        });
    }, 100);
}

function updateTable(timeSpent) {
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
}

async function updateArtVisualization(timeSpent) {
    const canvas = document.getElementById('artCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear with gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const topDomains = Object.entries(timeSpent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (topDomains.length === 0) return;

    const maxTime = Math.max(...Object.values(timeSpent));

    // Load all colors concurrently
    const colors = await Promise.all(
        topDomains.map(([domain]) => getDynamicColor(domain))
    );

    // Draw bars
    topDomains.forEach(([domain, seconds], index) => {
        ctx.fillStyle = colors[index];
        const barHeight = (seconds / maxTime) * height;
        const barWidth = width / topDomains.length;
        const x = index * barWidth;

        // Draw bar
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

        // Draw domain label
        ctx.fillStyle = getTextColorFromColorBackground(colors[index]);
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            domain.length > 15 ? domain.substring(0, 12) + '...' : domain,
            x + barWidth / 2,
            height - 5
        );

        // Draw time label
        ctx.font = 'bold 12px sans-serif';
        const hours = (seconds / 3600).toFixed(1);
        ctx.fillText(`${hours}h`, x + barWidth / 2, height - 20);
    });
}

async function getDynamicColor(domain) {
    if (colorCache.has(domain)) {
        return colorCache.get(domain);
    }

    try {
        // Use Google favicon service (CORS-friendly)
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

        // Create image and extract color
        const color = await extractColorFromUrl(faviconUrl, domain);
        colorCache.set(domain, color);
        return color;
    } catch (e) {
        console.warn(`[companion] Color fetch failed for ${domain}:`, e);
    }

    // Fallback: consistent color from domain hash
    const fallbackColor = hashDomainToHue(domain);
    colorCache.set(domain, fallbackColor);
    return fallbackColor;
}

let colorParseCtx = null;
function parseColorToRgb(color) {
    if (!colorParseCtx) {
        colorParseCtx = document.createElement("canvas").getContext("2d");
    }
    colorParseCtx.fillStyle = "#000000"; // reset
    colorParseCtx.fillStyle = color;
    const normalized = colorParseCtx.fillStyle;

    const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    if (hexMatch) {
        const hex = hexMatch[1];
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16)
        };
    }

    // Fallback in case the browser returns rgb()/rgba()
    const numbers = normalized.match(/[\d.]+/g);
    if (numbers && numbers.length >= 3) {
        const [r, g, b] = numbers.map(Number);
        return { r, g, b };
    }

    return { r: 128, g: 128, b: 128 }; // default to gray
}

function getTextColorFromColorBackground(bgColor) {
    const { r, g, b } = parseColorToRgb(bgColor);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? "#000" : "#fff";
}

function extractColorFromUrl(url, domain) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const color = extractDominantColor(img);
            resolve(color);
        };
        img.onerror = () => resolve(hashDomainToHue(domain));
        img.src = url;
    });
}

function extractDominantColor(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colorCount = {};

    for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const key = `${Math.round(r / 10) * 10},${Math.round(g / 10) * 10},${Math.round(b / 10) * 10}`;
        colorCount[key] = (colorCount[key] || 0) + 1;
    }

    const dominant = Object.entries(colorCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "128,128,128";
    return `rgb(${dominant})`;
}

function hashDomainToHue(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
        hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
}

// Event listeners
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.dailyStats || changes.timeSpent) {
        render();
    }
});

document.getElementById("refresh").addEventListener("click", render);
document.getElementById("reset").addEventListener("click", () => {
    log("Sending reset message");
    chrome.runtime.sendMessage({ type: "reset" }, () => {
        render();
    });
});

document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        currentView = btn.dataset.view;
        document.querySelectorAll(".view-btn").forEach((b) => {
            b.classList.toggle("active", b === btn);
        });
        render();
    });
});

// Initial render
render();
