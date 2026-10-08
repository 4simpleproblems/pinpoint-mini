let textbookHTML = "";

const LOCAL_PATHS = [
    "/",
    "/index.html",
    "/home.html",
    "/redirect.html",
    "/redirect",
    "/animation.html",
    "/animation",
    "/db.js",
    "/theme.js",
    "/tab-disguiser.js",
    "/effects.js",
    "/sw.js",
    "/favicon.ico",
    "/bbb.ico",
    "/manifest.json"
];

function isLocalResource(pathname) {
    if (LOCAL_PATHS.includes(pathname)) return true;
    if (pathname.startsWith("/favicons/") ||
        pathname.startsWith("/images/") ||
        pathname.startsWith("/styles/") ||
        pathname.startsWith("/scripts/") ||
        pathname.startsWith("/pages/") ||
        pathname.startsWith("/textbooks/")) {
        return true;
    }
    return false;
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
    if (event.data && (event.data.type === "LOAD_TEXTBOOK" || event.data.type === "LOAD_GAME")) {
        textbookHTML = event.data.html;
    }
});

self.addEventListener("fetch", (event) => {
    const rawUrl = event.request.url;
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
        return;
    }

    const url = new URL(rawUrl);

    if (isLocalResource(url.pathname)) {
        event.respondWith(
            fetch(event.request).catch(async () => {
                const cache = await caches.open("pinpoint-game-cache");
                const matched = (await cache.match(event.request, { ignoreSearch: true })) ||
                                (await cache.match(url.pathname, { ignoreSearch: true })) ||
                                (await cache.match(rawUrl, { ignoreSearch: true })) ||
                                (await cache.match(url.pathname.replace(/\/$/, '/index.html'), { ignoreSearch: true })) ||
                                (await cache.match(url.pathname.endsWith('/index.html') ? url.pathname.replace(/\/index\.html$/, '/') : url.pathname, { ignoreSearch: true }));
                if (matched) return matched;
                throw new Error("Offline asset not found in cache: " + url.pathname);
            })
        );
        return;
    }

    if (url.pathname === "/virtual-textbook" || url.pathname.endsWith("/virtual-textbook") ||
        url.pathname === "/virtual-game" || url.pathname.endsWith("/virtual-game")) {
        event.respondWith(
            new Response(textbookHTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" }
            })
        );
        return;
    }
});
