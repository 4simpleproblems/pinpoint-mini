var ThemeManager = window.ThemeManager || {
    init() {
        this.applyTheme();
        this.startTimer();
    },

    getSetting() {
        try {
            return localStorage.getItem('pinpoint_theme') || 'auto_time';
        } catch (e) {
            return 'auto_time';
        }
    },

    setSetting(mode) {
        try {
            localStorage.setItem('pinpoint_theme', mode);
        } catch (e) {}
        this.applyTheme();
    },

    isDark() {
        const mode = this.getSetting();
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        if (mode === 'system') {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        const hour = new Date().getHours();
        return (hour >= 21 || hour < 7);
    },

    applyTheme() {
        const dark = this.isDark();
        const docs = this.getDocs();

        docs.forEach(doc => {
            const docPath = (doc.location && doc.location.pathname) ? doc.location.pathname.toLowerCase() : '';
            if (docPath.includes('music') || docPath.includes('debug')) {
                const existing = doc.getElementById('pinpoint-theme-styles');
                if (existing) existing.remove();
                return;
            }
            const styleId = 'pinpoint-theme-styles';
            let styleTag = doc.getElementById(styleId);
            if (!styleTag) {
                styleTag = doc.createElement('style');
                styleTag.id = styleId;
                if (doc.head) doc.head.appendChild(styleTag);
            }

            if (dark) {
                styleTag.textContent = `
                    :root {
                        --bg-base: #000000 !important;
                        --bg-elevated: #111111 !important;
                        --bg-highlight: #1a1a1a !important;
                        --bg-hover: #262626 !important;
                        --text-main: #ffffff !important;
                        --text-subdued: #aaaaaa !important;
                        --divider: #444444 !important;
                        --btn-bg: #222222 !important;
                    }
                    body { background-color: #000000 !important; color: #ffffff !important; }
                    #textbook-frame, #game-frame, .browser-tab-frame { background-color: #000000 !important; }
                    #pinpoint-topbar, #textbook-view-bar, #game-view-bar, .top-bar, #browser-nav-bar { background-color: #1a1a1a !important; color: #ffffff !important; border-color: #444444 !important; }
                    #pinpoint-topbar button, #game-view-bar button { background-color: #2a2a2a !important; color: #ffffff !important; border-color: #555555 !important; }
                    #pinpoint-topbar button:hover, #game-view-bar button:hover { background-color: #383838 !important; }
                    #pinpoint-topbar .topbar-title, #game-view-bar .topbar-title { color: #cccccc !important; }
                    #game-viewer { background-color: #000000 !important; }
                    #browser-tabs-bar { background-color: #111111 !important; color: #ffffff !important; border-color: #444444 !important; }
                    #browser-viewport { background-color: #000000 !important; }
                    .tab-btn { background-color: #222222 !important; color: #ffffff !important; border-color: #555555 !important; }
                    .tab-btn.active { background-color: #333333 !important; color: #66aaff !important; border-color: #66aaff !important; }
                    .tab-btn:hover { background-color: #2a2a2a !important; }
                    .tab-close { color: #aaaaaa !important; }
                    .tab-close:hover { color: #ff6666 !important; }
                    .textbook-item { background-color: #141414 !important; color: #ffffff !important; border: 1px solid #333333 !important; }
                    .textbook-item:hover { background-color: #222222 !important; border-color: #555555 !important; }
                    .textbook-title { color: #ffffff !important; text-decoration: none !important; }
                    .textbook-title:hover { text-decoration: none !important; }
                    .textbook-desc { color: #aaaaaa !important; }
                    .settings-category, .version-box, #drop-zone, .card { background-color: #121212 !important; color: #ffffff !important; border-color: #333333 !important; }
                    ul.result-list { background-color: #121212 !important; border-color: #333333 !important; }
                    ul.result-list li { border-bottom-color: #262626 !important; color: #ffffff !important; }
                    .badge-success { background-color: #0f381e !important; color: #4ade80 !important; border-color: #1e5a32 !important; }
                    .badge-error { background-color: #3e1312 !important; color: #f87171 !important; border-color: #632220 !important; }
                    .badge-warning { background-color: #3b2a09 !important; color: #fbbf24 !important; border-color: #614611 !important; }
                    button.btn-primary { background-color: #ffffff !important; color: #000000 !important; }
                    button.btn-primary:hover { background-color: #dddddd !important; }
                    label, legend, span, small, p, h1, h2, h3, summary, .textbook-subject { color: #ffffff !important; }
                    .textbook-link, .version-title, .quick-links a { color: #66aaff !important; text-decoration: none !important; }
                    .textbook-link:hover { text-decoration: none !important; }
                    input[type="text"], input[type="url"], input[type="email"], input[type="search"], textarea, select { background-color: #1a1a1a !important; color: #ffffff !important; border-color: #555555 !important; }
                    button, button.btn { background-color: #222222 !important; color: #ffffff !important; border-color: #555555 !important; }
                    button:hover, button.btn:hover { background-color: #333333 !important; }
                    #fsPlayer button, #fsPlayer .ctrl-btn, .fullscreen-overlay button, .fullscreen-overlay .ctrl-btn { background: transparent !important; background-color: transparent !important; border: none !important; box-shadow: none !important; outline: none !important; }
                    ul#allowed-list, ul#blocked-list, ul#error-list { background-color: #111111 !important; border-color: #444444 !important; }
                    .custom-range { background: #444444 !important; }
                    .custom-range::-webkit-slider-thumb { background: #ffffff !important; border-color: #000000 !important; }
                    .custom-range::-moz-range-thumb { background: #ffffff !important; border-color: #000000 !important; }
                    .custom-range::-moz-range-track { background: #444444 !important; }
                    .system-status { background-color: #1a1a1a !important; color: #ffffff !important; border-color: #555555 !important; }
                    #fullscreen-clock-view { background-color: #000000 !important; color: #ffffff !important; }
                    .fullscreen-clock-close { color: #ffffff !important; }
                    .square-close-btn { background-color: #222222 !important; color: #ffffff !important; border-color: #555555 !important; }
                    .module-notice-box { background-color: #1a1a1a !important; color: #888888 !important; border: 1px dashed #444444 !important; }
                    .module-notice-popup { background-color: #1a1a1a !important; color: #ffffff !important; border-color: #444444 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important; }
                `;
            } else {
                styleTag.textContent = `
                    :root {
                        --bg-base: #ffffff !important;
                        --bg-elevated: #fafafa !important;
                        --bg-highlight: #f0f0f0 !important;
                        --bg-hover: #e8e8e8 !important;
                        --text-main: #000000 !important;
                        --text-subdued: #555555 !important;
                        --divider: #000000 !important;
                        --btn-bg: #f0f0f0 !important;
                        --toast-bg: rgba(255, 255, 255, 0.95) !important;
                        --toast-text: #000000 !important;
                    }
                    body { background-color: #ffffff !important; color: #000000 !important; }
                    .sidebar { background-color: #ffffff !important; border-right: 1px solid #000000 !important; }
                    .main-view { background-color: #fafafa !important; }
                    .playbar { background-color: #f0f0f0 !important; border-top: 1px solid #000000 !important; }
                    .track-card { background-color: #ffffff !important; border: 1px solid #000000 !important; border-radius: 4px !important; }
                    .track-card:hover { background-color: #f6f6f6 !important; }
                    .category-card { border: 1px solid #000000 !important; }
                    .search-box { background-color: #ffffff !important; border: 1px solid #000000 !important; }
                    .search-input { color: #000000 !important; }
                    .search-input::placeholder { color: #666666 !important; }
                    .nav-item { color: #555555 !important; }
                    .nav-item:hover, .nav-item.active { color: #000000 !important; background-color: #f0f0f0 !important; }
                    .nav-item.active { border-left-color: #000000 !important; }
                    .sidebar-divider { border-top-color: #000000 !important; }
                    .hero-header { background: linear-gradient(to bottom, #eeeeee 0%, #fafafa 100%) !important; }
                    .btn-play-large { background-color: #000000 !important; color: #ffffff !important; }
                    .btn-follow { border-color: #000000 !important; color: #000000 !important; }
                    .track-row { border-bottom: 1px solid #eeeeee !important; }
                    .track-row:hover { background-color: #f0f0f0 !important; border-color: #000000 !important; }
                    .right-panel { background-color: #ffffff !important; border-left: 1px solid #000000 !important; }
                    .panel-header { border-bottom: 1px solid #000000 !important; }
                    .modal-content { background-color: #ffffff !important; border: 1px solid #000000 !important; color: #000000 !important; }
                    .modal-input { background-color: #f0f0f0 !important; color: #000000 !important; border: 1px solid #000000 !important; }
                    #textbook-frame, #game-frame, .browser-tab-frame { background-color: #ffffff !important; }
                    #pinpoint-topbar, #textbook-view-bar, #game-view-bar, .top-bar, #browser-nav-bar { background-color: #eeeeee !important; color: #000000 !important; border-color: #000000 !important; }
                    #pinpoint-topbar button, #game-view-bar button { background-color: #ffffff !important; color: #000000 !important; border-color: #000000 !important; }
                    #pinpoint-topbar button:hover, #game-view-bar button:hover { background-color: #e0e0e0 !important; }
                    #pinpoint-topbar .topbar-title, #game-view-bar .topbar-title { color: #333333 !important; }
                    #game-viewer { background-color: #ffffff !important; }
                    #browser-tabs-bar { background-color: #e0e0e0 !important; color: #000000 !important; border-color: #000000 !important; }
                    #browser-viewport { background-color: #ffffff !important; }
                    .tab-btn { background-color: #f0f0f0 !important; color: #000000 !important; border-color: #000000 !important; }
                    .tab-btn.active { background-color: #ffffff !important; color: #000000 !important; border-color: #000000 !important; font-weight: bold !important; }
                    .tab-btn:hover { background-color: #e8e8e8 !important; }
                    .tab-close { color: #666666 !important; }
                    .tab-close:hover { color: #cc0000 !important; }
                    .textbook-item { background-color: #ffffff !important; color: #000000 !important; border: 1px solid #e0e0e0 !important; }
                    .textbook-item:hover { background-color: #f6f6f6 !important; border-color: #999999 !important; }
                    .textbook-title { color: #000000 !important; text-decoration: none !important; }
                    .textbook-title:hover { text-decoration: none !important; }
                    .textbook-desc { color: #555555 !important; }
                    .settings-category, .version-box, #drop-zone, .card { background-color: #fafafa !important; color: #000000 !important; border-color: #000000 !important; }
                    ul.result-list { background-color: #ffffff !important; border-color: #000000 !important; }
                    ul.result-list li { border-bottom-color: #eeeeee !important; color: #000000 !important; }
                    .badge-success { background-color: #e6f4ea !important; color: #137333 !important; border-color: #ceead6 !important; }
                    .badge-error { background-color: #fce8e6 !important; color: #c5221f !important; border-color: #fad2cf !important; }
                    .badge-warning { background-color: #fef7e0 !important; color: #b06000 !important; border-color: #feefc3 !important; }
                    button.btn-primary { background-color: #000000 !important; color: #ffffff !important; }
                    button.btn-primary:hover { background-color: #333333 !important; }
                    label, legend, span, small, p, h1, h2, h3, summary, .textbook-subject { color: #000000 !important; }
                    .textbook-link, .version-title, .quick-links a { color: blue !important; text-decoration: none !important; }
                    .textbook-link:hover { text-decoration: none !important; }
                    input[type="text"], input[type="url"], input[type="email"], input[type="search"], textarea, select { background-color: #ffffff !important; color: #000000 !important; border-color: #000000 !important; }
                    button, button.btn { background-color: #f0f0f0 !important; color: #000000 !important; border-color: #000000 !important; }
                    button:hover, button.btn:hover { background-color: #e0e0e0 !important; }
                    #fsPlayer button, #fsPlayer .ctrl-btn, .fullscreen-overlay button, .fullscreen-overlay .ctrl-btn { background: transparent !important; background-color: transparent !important; border: none !important; box-shadow: none !important; outline: none !important; }
                    ul#allowed-list, ul#blocked-list, ul#error-list { background-color: #f9f9f9 !important; border-color: #000000 !important; }
                    .custom-range { background: #cccccc !important; }
                    .custom-range::-webkit-slider-thumb { background: #000000 !important; border-color: #ffffff !important; }
                    .custom-range::-moz-range-thumb { background: #000000 !important; border-color: #ffffff !important; }
                    .custom-range::-moz-range-track { background: #cccccc !important; }
                    .system-status { background-color: #e8e8e8 !important; color: #000000 !important; border-color: #000000 !important; }
                    #fullscreen-clock-view { background-color: #ffffff !important; color: #000000 !important; }
                    .fullscreen-clock-close { color: #000000 !important; }
                    .square-close-btn { background-color: #f0f0f0 !important; color: #000000 !important; border-color: #000000 !important; }
                    .module-notice-box { background-color: #f9f9f9 !important; color: #777777 !important; border: 1px dashed #888888 !important; }
                    .module-notice-popup { background-color: #ffffff !important; color: #000000 !important; border-color: #000000 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important; }
                `;
            }
        });
    },

    getDocs() {
        const docs = [document];
        try {
            if (window.top && window.top.document && !docs.includes(window.top.document)) {
                docs.push(window.top.document);
            }
        } catch (e) {}
        try {
            if (window.parent && window.parent.document && !docs.includes(window.parent.document)) {
                docs.push(window.parent.document);
            }
        } catch (e) {}
        return docs;
    },

    startTimer() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            const mode = this.getSetting();
            if (mode === 'auto_time') {
                this.applyTheme();
            }
        }, 1000);

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.getSetting() === 'system') {
                    this.applyTheme();
                }
            });
        }

        window.addEventListener('storage', (e) => {
            if (e.key === 'pinpoint_theme') {
                this.applyTheme();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.applyTheme();
            }
        });
    }
};

if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
    });
}
