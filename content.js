const sites = {
    "youtube.com": "youtube",
    "twitch.tv": "twitch",
    "instagram.com": "instagram",
    "wikipedia.org": "wikipedia",
    "wattpad.com": "wattpad",
    "github.com": "github",
    "linkedin.com": "linkedin",
    "docs.google.com": "docs",
    "mail.google.com": "email"
};

function detectSite() {
    const url = window.location.href;

    for (const domain in sites) {
        if (url.includes(domain)) {
            return sites[domain];
        }
    }
    return null;
}

chrome.runtime.sendMessage({ site: detectSite() });