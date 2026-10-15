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

function fixContentType(response, pathname) {
    const ext = pathname.split('.').pop().toLowerCase().split('?')[0];
    const mimeMap = {
        'wasm': 'application/wasm',
        'js': 'application/javascript; charset=utf-8',
        'json': 'application/json; charset=utf-8',
        'swf': 'application/x-shockwave-flash',
        'html': 'text/html; charset=utf-8',
        'htm': 'text/html; charset=utf-8',
        'css': 'text/css; charset=utf-8',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
        'woff2': 'font/woff2',
        'woff': 'font/woff',
        'ttf': 'font/ttf'
    };

    const targetMime = mimeMap[ext];
    if (!targetMime) return response;

    const currentMime = response.headers.get('content-type') || '';
    if (currentMime.toLowerCase().includes(targetMime.split(';')[0])) {
        return response;
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set('content-type', targetMime);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const rawUrl = event.request.url;
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
        return;
    }

    const url = new URL(rawUrl);

    // 1. Virtual textbook / virtual game routes
    if (url.pathname === "/virtual-textbook" || url.pathname.endsWith("/virtual-textbook") ||
        url.pathname === "/virtual-game" || url.pathname.endsWith("/virtual-game")) {
        event.respondWith(
            new Response(textbookHTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" }
            })
        );
        return;
    }

    // 2. Check if this is a game resource or local resource
    if (isLocalResource(url.pathname)) {
        event.respondWith((async () => {
            // CACHE-FIRST FOR OFFLINE GAME ASSETS
            // If the game was downloaded into CacheStorage, serve it instantly from cache
            try {
                const cache = await caches.open("pinpoint-game-cache");
                const pathname = url.pathname;
                const pathWithoutSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
                const pathWithSlash = pathname.endsWith("/") ? pathname : pathname + "/";
                const pathIndexHtml = pathWithSlash + "index.html";
                const pathNoIndexHtml = pathname.endsWith("/index.html") ? pathname.replace(/\/index\.html$/, "/") : pathname;

                const candidates = [
                    event.request,
                    pathname,
                    rawUrl,
                    url.origin + pathname,
                    pathWithSlash,
                    pathWithoutSlash,
                    pathIndexHtml,
                    pathNoIndexHtml,
                    pathNoIndexHtml.replace(/\/$/, ""),
                    pathname.replace(/^\/+/, ""),
                    decodeURIComponent(pathname),
                    encodeURI(pathname),
                    url.origin + pathWithSlash,
                    url.origin + pathWithoutSlash
                ];

                for (const candidate of candidates) {
                    const match = await cache.match(candidate, { ignoreSearch: true });
                    if (match) {
                        return fixContentType(match, pathname);
                    }
                }
            } catch (cacheErr) {
                console.warn("CacheStorage check error:", cacheErr);
            }

            // Not found in cache: fetch from network
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                const response = await fetch(event.request, { signal: controller.signal });
                clearTimeout(timeoutId);
                return response;
            } catch (networkErr) {
                // Network failed or offline: try last fallback in cache
                try {
                    const cache = await caches.open("pinpoint-game-cache");
                    const fallbackMatch = await cache.match(event.request, { ignoreSearch: true });
                    if (fallbackMatch) return fixContentType(fallbackMatch, url.pathname);
                } catch(e) {}

                return new Response("Offline resource unavailable", {
                    status: 503,
                    statusText: "Offline",
                    headers: { "Content-Type": "text/plain; charset=utf-8" }
                });
            }
        })());
        return;
    }
});
