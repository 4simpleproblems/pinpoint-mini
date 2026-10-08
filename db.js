const DB_NAME = 'VeliumMusicDB';
const DB_VERSION = 1;
const STORE_NAME = 'library';

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
        }
    };

    request.onsuccess = (event) => {
        resolve(event.target.result);
    };

    request.onerror = (event) => {
        console.error(event.target.error);
        reject(event.target.error);
    };
});

const DB = {
    async getLibrary() {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('main_library');

            request.onsuccess = () => {
                resolve(request.result || { likedSongs: [], playlists: [] });
            };
            request.onerror = () => reject(request.error);
        });
    },

    async saveLibrary(libraryData) {
        const db = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(libraryData, 'main_library');

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

window.VeliumDB = DB;

// IndexedDB + CacheStorage for Offline Games (Supports single-file & multi-part/asset games)
const GAME_DB_NAME = 'PinpointGamesDB';
const GAME_DB_VERSION = 1;
const GAME_STORE_NAME = 'games';
const GAME_CACHE_NAME = 'pinpoint-game-cache';
const RECOMMENDED_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB

const GAME_MANIFESTS = {
    "textbooks/car-soccer/": [
        "/textbooks/car-soccer/",
        "/textbooks/car-soccer/index.html",
        "/textbooks/car-soccer/game.js",
        "/textbooks/car-soccer/interceptor.js",
        "/textbooks/car-soccer/workers.js",
        "/textbooks/car-soccer/assets-core.js",
        "/textbooks/car-soccer/assets-map-dribble.js",
        "/textbooks/car-soccer/assets-map-ice-1.js",
        "/textbooks/car-soccer/assets-map-ice-2.js",
        "/textbooks/car-soccer/images.js"
    ],
    "textbooks/people-playground/index.html": [
        "/textbooks/people-playground/index.html",
        "/textbooks/people-playground/",
        "/textbooks/people-playground/Build/PPG.loader.js",
        "/textbooks/people-playground/Build/PPG.framework.js",
        "/textbooks/people-playground/Build/PPG.data.part1",
        "/textbooks/people-playground/Build/PPG.data.part2",
        "/textbooks/people-playground/Build/PPG.data.part3",
        "/textbooks/people-playground/Build/PPG.data.part4",
        "/textbooks/people-playground/Build/PPG.data.part5",
        "/textbooks/people-playground/Build/PPG.data.part6",
        "/textbooks/people-playground/Build/PPG.wasm.part1",
        "/textbooks/people-playground/Build/PPG.wasm.part2",
        "/textbooks/people-playground/Build/PPG.wasm.part3",
        "/textbooks/people-playground/TemplateData/style.css",
        "/textbooks/people-playground/TemplateData/favicon.ico",
        "/textbooks/people-playground/TemplateData/fullscreen-button.png",
        "/textbooks/people-playground/TemplateData/progress-bar-empty-dark.png",
        "/textbooks/people-playground/TemplateData/progress-bar-full-dark.png",
        "/textbooks/people-playground/TemplateData/unity-logo-dark.png",
        "/textbooks/people-playground/TemplateData/webgl-logo.png"
    ],
    "textbooks/happy-wheels.html": [
        "/textbooks/happy-wheels.html",
        "/textbooks/happy-wheels.swf",
        "/textbooks/ruffle/ruffle.js",
        "/textbooks/ruffle/core.ruffle.e1ab5671fe9d69a41e55.js",
        "/textbooks/ruffle/f9db7455c2c80fac021b.wasm"
    ]
};

const gameDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(GAME_DB_NAME, GAME_DB_VERSION);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(GAME_STORE_NAME)) {
            db.createObjectStore(GAME_STORE_NAME, { keyPath: 'id' });
        }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
});

// Active in-flight downloads for crash/interruption cleanup and cancellation
const activeInFlightDownloads = new Map();
const activeControllers = new Map();

// Automatic cleanup if page refreshes or unloads during download
if (typeof window !== 'undefined') {
    const cleanInterrupted = () => {
        for (const [id, fileUrl] of activeInFlightDownloads.entries()) {
            try {
                // Record in session to purge on next startup if interrupted
                const current = JSON.parse(sessionStorage.getItem('pinpoint_pending_purges') || '[]');
                if (!current.some(item => item.id === id)) {
                    current.push({ id, fileUrl });
                    sessionStorage.setItem('pinpoint_pending_purges', JSON.stringify(current));
                }
            } catch(e) {}
        }
    };
    window.addEventListener('beforeunload', cleanInterrupted);
    window.addEventListener('pagehide', cleanInterrupted);

    // Run startup purge of any interrupted downloads
    setTimeout(async () => {
        try {
            const raw = sessionStorage.getItem('pinpoint_pending_purges');
            if (raw) {
                const purges = JSON.parse(raw);
                sessionStorage.removeItem('pinpoint_pending_purges');
                for (const item of purges) {
                    await PinpointGameStorage.deleteGame(item.id, item.fileUrl);
                }
            }
        } catch(e) {}
    }, 1000);
}

const PinpointGameStorage = {
    RECOMMENDED_LIMIT_BYTES,

    getManifest(fileUrl) {
        const norm = fileUrl.replace(/^\/+/, '');
        if (GAME_MANIFESTS[norm]) return GAME_MANIFESTS[norm];
        if (norm.endsWith('/index.html') && GAME_MANIFESTS[norm.replace('/index.html', '/')]) {
            return GAME_MANIFESTS[norm.replace('/index.html', '/')];
        }
        if (norm.endsWith('/') && GAME_MANIFESTS[norm + 'index.html']) {
            return GAME_MANIFESTS[norm + 'index.html'];
        }
        if (!norm.endsWith('/') && !norm.endsWith('.html') && GAME_MANIFESTS[norm + '/index.html']) {
            return GAME_MANIFESTS[norm + '/index.html'];
        }
        return ['/' + norm];
    },

    async isDownloaded(id) {
        try {
            const db = await gameDbPromise;
            return new Promise((resolve) => {
                const tx = db.transaction([GAME_STORE_NAME], 'readonly');
                const store = tx.objectStore(GAME_STORE_NAME);
                const req = store.get(id);
                req.onsuccess = () => resolve(!!req.result);
                req.onerror = () => resolve(false);
            });
        } catch(e) { return false; }
    },

    isDownloading(id) {
        return activeControllers.has(id);
    },

    cancelDownload(id) {
        if (activeControllers.has(id)) {
            const ctrl = activeControllers.get(id);
            ctrl.abort();
            activeControllers.delete(id);
            return true;
        }
        return false;
    },

    async getGame(id) {
        const db = await gameDbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction([GAME_STORE_NAME], 'readonly');
            const store = tx.objectStore(GAME_STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async getAllGames() {
        try {
            const db = await gameDbPromise;
            return new Promise((resolve, reject) => {
                const tx = db.transaction([GAME_STORE_NAME], 'readonly');
                const store = tx.objectStore(GAME_STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
        } catch(e) { return []; }
    },

    async downloadGame(id, title, fileUrl, onProgress) {
        if (activeControllers.has(id)) {
            throw new Error('Download already in progress');
        }

        const controller = new AbortController();
        activeControllers.set(id, controller);
        activeInFlightDownloads.set(id, fileUrl);

        const assets = this.getManifest(fileUrl);
        let cache = null;
        if (typeof caches !== 'undefined') {
            try {
                cache = await caches.open(GAME_CACHE_NAME);
            } catch(e) {
                console.warn('CacheStorage not accessible:', e);
            }
        }

        let totalBytes = 0;
        let mainContent = '';
        let completedAssets = 0;

        try {
            for (let i = 0; i < assets.length; i++) {
                const assetUrl = assets[i];
                if (controller.signal.aborted) {
                    const err = new Error('Download cancelled');
                    err.name = 'AbortError';
                    throw err;
                }

                const res = await fetch(assetUrl, { signal: controller.signal });
                if (!res.ok) {
                    throw new Error(`Failed to fetch asset: ${assetUrl} (${res.status})`);
                }

                const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
                let assetBlob;

                if (res.body && typeof res.body.getReader === 'function' && contentLength > 0) {
                    const reader = res.body.getReader();
                    const chunks = [];
                    let receivedBytes = 0;

                    while (true) {
                        if (controller.signal.aborted) {
                            reader.cancel().catch(() => {});
                            const err = new Error('Download cancelled');
                            err.name = 'AbortError';
                            throw err;
                        }
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        receivedBytes += value.length;

                        const assetFraction = assets.length > 0 ? (i / assets.length) : 0;
                        const thisAssetProgress = (receivedBytes / contentLength) * (1 / assets.length);
                        const overallPercent = Math.min(99, Math.round((assetFraction + thisAssetProgress) * 100));

                        if (typeof onProgress === 'function') {
                            onProgress({
                                completed: i,
                                total: assets.length,
                                percent: overallPercent,
                                bytes: totalBytes + receivedBytes
                            });
                        }
                    }
                    assetBlob = new Blob(chunks);
                } else {
                    assetBlob = await res.blob();
                }

                totalBytes += assetBlob.size;

                if (cache) {
                    try {
                        const cacheRes = new Response(assetBlob, {
                            headers: res.headers,
                            status: res.status,
                            statusText: res.statusText
                        });
                        await cache.put(assetUrl, cacheRes.clone());
                        await cache.put(new URL(assetUrl, window.location.href).href, cacheRes.clone());
                        if (assetUrl.endsWith('/index.html')) {
                            const dirPath = assetUrl.replace(/index\.html$/, '');
                            await cache.put(dirPath, cacheRes.clone());
                            await cache.put(new URL(dirPath, window.location.href).href, cacheRes.clone());
                        }
                    } catch(err) {
                        console.warn('Could not cache asset in CacheStorage:', assetUrl, err);
                    }
                }

                if (assetUrl === fileUrl || assetUrl.endsWith('.html') || assetUrl.endsWith('/')) {
                    if (!mainContent) {
                        try {
                            mainContent = await assetBlob.text();
                        } catch(e) {}
                    }
                }

                completedAssets++;
                const overallPercent = Math.round((completedAssets / assets.length) * 100);
                if (typeof onProgress === 'function') {
                    onProgress({ completed: completedAssets, total: assets.length, percent: overallPercent, bytes: totalBytes });
                }
            }

            const db = await gameDbPromise;
            const record = await new Promise((resolve, reject) => {
                const tx = db.transaction([GAME_STORE_NAME], 'readwrite');
                const store = tx.objectStore(GAME_STORE_NAME);
                const gameRecord = {
                    id: id,
                    title: title,
                    fileUrl: fileUrl,
                    content: mainContent,
                    assets: assets,
                    sizeBytes: totalBytes,
                    downloadedAt: new Date().toISOString()
                };
                const req = store.put(gameRecord);
                req.onsuccess = () => resolve(gameRecord);
                req.onerror = () => reject(req.error);
            });

            activeControllers.delete(id);
            activeInFlightDownloads.delete(id);
            return record;

        } catch (downloadErr) {
            activeControllers.delete(id);
            activeInFlightDownloads.delete(id);
            try {
                await this.deleteGame(id, fileUrl);
            } catch (cleanupErr) {
                console.warn('Cleanup error after failed download:', cleanupErr);
            }
            throw downloadErr;
        }
    },

    async deleteGame(id, fileUrl) {
        // 1. Delete from CacheStorage
        if (typeof caches !== 'undefined') {
            try {
                const cache = await caches.open(GAME_CACHE_NAME);
                const assets = fileUrl ? this.getManifest(fileUrl) : [];
                for (const assetUrl of assets) {
                    await cache.delete(assetUrl);
                    await cache.delete(new URL(assetUrl, window.location.href).href);
                }
            } catch(e) {
                console.warn('Error clearing CacheStorage:', e);
            }
        }

        // 2. Delete from IndexedDB
        const db = await gameDbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction([GAME_STORE_NAME], 'readwrite');
            const store = tx.objectStore(GAME_STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async clearAllDownloads() {
        // 1. Clear entire game cache in CacheStorage
        if (typeof caches !== 'undefined') {
            try {
                await caches.delete(GAME_CACHE_NAME);
            } catch(e) {
                console.warn('Error deleting CacheStorage cache:', e);
            }
        }

        // 2. Clear entire object store in IndexedDB
        const db = await gameDbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction([GAME_STORE_NAME], 'readwrite');
            const store = tx.objectStore(GAME_STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};

window.PinpointGameStorage = PinpointGameStorage;

// Automatically register Service Worker for offline game caching
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    if (document.readyState === 'complete') {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => console.warn('SW register:', e));
    } else {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => console.warn('SW register:', e));
        });
    }
}
