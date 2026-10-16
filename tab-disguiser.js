var TabDisguiser = window.TabDisguiser || {
    currentVersion: '2026.09.23.10',
    defaultTitle: 'Home - Classroom',
    defaultFavicon: 'favicons/google-classroom.png',

    init() {
        const rawPath = window.__CURRENT_PAGE__ || window.location.pathname;
        const path = rawPath.toLowerCase();
        const isMusic = path.includes('music');
        const isClassworkHistory = !isMusic && path.includes('classwork') && (path.includes('history') || path.includes('english'));
        const isHistory = !isMusic && !path.includes('classwork') && (path.includes('history') || path.includes('english'));
        const isAI = !isMusic && path.includes('ai');
        const isSettings = !isMusic && path.includes('settings');
        const isMediaMarketing = path.includes('media-marketing');

        const isHome = !isMusic && !isMediaMarketing && !isClassworkHistory && !isHistory && !isAI && !isSettings && (
            path === '' || path === '/' || path.includes('home') ||
            path.endsWith('/home.html') || path.endsWith('/index.html') || path === 'index.html' || path === 'home.html' ||
            path.endsWith('/pinpoint-edu') || path.endsWith('/pinpoint-edu/')
        );

        const seen = localStorage.getItem('pinpoint_walkthrough_v3') === 'true';
        const active = sessionStorage.getItem('pinpoint_walkthrough_active') === 'true';
        const step = sessionStorage.getItem('pinpoint_walkthrough_step');

        // Walkthrough is opt-in, not a gate — never force-redirect to home

        this.initTitleProtection();
        this.apply();
        this.injectNavigation();
        this.applyClassConfig();
        this.initStaticClock();
        this.initFullscreenClock();
        this.initPanicKey();
        this.applyPresetCloak();
        this.initAutoRefresh();
        this.interceptLinks();
        this.initCleanupReminder();
    },

    interceptLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

            const isAboutBlank = window.location.protocol === 'about:' || window.location.href.startsWith('about:');

            if (isAboutBlank) {
                const isExternal = href.startsWith('http://') || href.startsWith('https://');
                const isClassroom = href.includes('classroom.google.com');
                const entryOrigin = localStorage.getItem('pinpoint_entry_origin') || '';
                const isInternal = !isExternal || (entryOrigin && href.includes(entryOrigin));

                // Only intercept local site navigation and Google Classroom links
                if (isInternal || isClassroom) {
                    e.preventDefault();
                    e.stopPropagation();

                    let targetUrl = href;

                    // Route clicks meant for the real Google Classroom back to your home clone
                    if (isClassroom) {
                        targetUrl = 'home.html';
                    }

                    if (typeof window.navigateToAboutBlankPage === 'function') {
                        window.navigateToAboutBlankPage(targetUrl);
                    } else {
                        window.location.hash = targetUrl;
                    }
                } else if (isExternal) {
                    // Load external sites inside the popout iframe so about:blank stays intact
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.TabDisguiser && typeof window.TabDisguiser.openPopout === 'function') {
                        window.TabDisguiser.openPopout(href, 'External Site');
                    }
                }
            }
        }, true); // capture phase so it fires before any other handler
    },

    initAutoRefresh() {
        const check = () => {
            try {
                const isSub = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/textbooks/') || window.location.pathname.includes('media-marketing');
                const prefix = isSub ? '../' : './';
                const url = (window.location.origin && window.location.origin !== 'null') 
                    ? window.location.origin + '/version.json?t=' + Date.now() 
                    : prefix + 'version.json?t=' + Date.now();
                fetch(url, { cache: 'no-store' })
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                        if (data && data.version && data.version !== this.currentVersion) {
                            const lastVersionReloaded = localStorage.getItem('pinpoint_version_reloaded');
                            if (lastVersionReloaded === data.version) {
                                return;
                            }
                            const runnerOverlay = document.getElementById('game-runner-overlay');
                            if (runnerOverlay && runnerOverlay.style.display !== 'none') {
                                return;
                            }
                            const lastReload = parseInt(sessionStorage.getItem('pinpoint_last_reload') || '0', 10);
                            if (Date.now() - lastReload > 8000) {
                                sessionStorage.setItem('pinpoint_last_reload', String(Date.now()));
                                localStorage.setItem('pinpoint_version_reloaded', data.version);
                                if (window.caches) {
                                    caches.keys().then(keys => {
                                        keys.forEach(k => {
                                            if (k !== 'pinpoint-game-cache' && !k.includes('game-cache')) {
                                                caches.delete(k);
                                            }
                                        });
                                    }).catch(() => {});
                                }
                                window.location.reload(true);
                            }
                        }
                    })
                    .catch(() => {});
            } catch (e) {}
        };

        setTimeout(check, 2500);
        setInterval(check, 120000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                check();
            }
        });

        window.addEventListener('focus', () => {
            check();
        });
    },

    getDocs() {
        const docs = [document];
        try {
            if (window.top && window.top.document && window.top.document !== document) {
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

    resolveUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        const path = window.location.pathname.toLowerCase();
        const isRoot = !path.includes('/pages/') && !path.includes('/textbooks/') && !path.includes('/media-marketing/');
        const rootPrefix = isRoot ? '.' : '..';
        const cleanPath = url.replace(/^\.?\//, '');
        return `${rootPrefix}/${cleanPath}`;
    },

    getCanonicalPageTitle() {
        const rawPath = window.__CURRENT_PAGE__ || window.location.pathname || '';
        const path = rawPath.toLowerCase();
        const cfg = this.getClassConfig();
        const historyCfg = cfg.history || cfg.english || {};
        const className = (historyCfg.name || 'World History').trim();

        const isMusic = path.includes('music');
        const isClasswork = path.includes('classwork');
        const isHistoryOrEnglish = (path.includes('history') || path.includes('english'));
        const isAI = path.includes('ai');
        const isSettings = path.includes('settings');
        const isMediaMarketing = path.includes('media-marketing');

        if (isClasswork) {
            if (isMusic && cfg.music && cfg.music.name) {
                return `Classwork for ${cfg.music.name} - Classroom`;
            }
            return `Classwork for ${className} - Classroom`;
        }

        if (isHistoryOrEnglish) {
            return `${className} - Classroom`;
        }

        if (isMusic) {
            const musicName = (cfg.music && cfg.music.name) || 'Music Production';
            return `${musicName} - Classroom`;
        }

        if (isMediaMarketing) {
            return 'Media Marketing - Classroom';
        }

        if (isAI) {
            return 'Gemini - Classroom';
        }

        if (isSettings) {
            return 'Settings - Classroom';
        }

        return this.defaultTitle || 'Home - Classroom';
    },

    _authorizedTitle: '',
    _isSettingAuthorizedTitle: false,

    _setActualTitle(titleToUse) {
        this._authorizedTitle = titleToUse;
        const docs = this.getDocs();
        this._isSettingAuthorizedTitle = true;
        try {
            docs.forEach(d => {
                if (d) {
                    try { d.title = titleToUse; } catch(e) {}
                    try {
                        const tEl = d.querySelector && d.querySelector('title');
                        if (tEl && tEl.textContent !== titleToUse) {
                            tEl.textContent = titleToUse;
                        }
                    } catch(e) {}
                }
            });
            try {
                if (window.top && window.top !== window.self) {
                    window.top.postMessage({ type: 'set-title', title: titleToUse }, '*');
                }
            } catch (e) {}
        } finally {
            this._isSettingAuthorizedTitle = false;
        }
    },

    setTitle(customTitle) {
        const canonical = this.getCanonicalPageTitle();
        let titleToUse = customTitle || canonical || this.defaultTitle;

        // Never allow game titles or non-disguise titles (unless it's the live clock)
        if (!titleToUse.includes('Classroom') && !this._isFullscreenClockActive) {
            titleToUse = canonical;
        }
        this._authorizedTitle = titleToUse;

        if (this._isFullscreenClockActive) {
            this._savedTitleBeforeClock = titleToUse;
            return;
        }
        this._setActualTitle(titleToUse);
    },

    apply(customTitle) {
        const titleToUse = customTitle || this.getCanonicalPageTitle();
        this.setTitle(titleToUse);
        const docs = this.getDocs();
        const icon = this.resolveUrl(this.defaultFavicon);
        docs.forEach(d => this.setFavicon(icon, d));
    },

    protectDoc(doc) {
        if (!doc || doc.__titleLockInstalled) return;
        doc.__titleLockInstalled = true;

        const proto = Object.getPrototypeOf(doc);
        const nativeDesc = Object.getOwnPropertyDescriptor(proto, 'title') ||
                           Object.getOwnPropertyDescriptor(Document.prototype, 'title');

        try {
            Object.defineProperty(doc, 'title', {
                configurable: true,
                enumerable: true,
                get: () => {
                    if (nativeDesc && nativeDesc.get) {
                        return nativeDesc.get.call(doc);
                    }
                    return this._authorizedTitle || this.getCanonicalPageTitle();
                },
                set: (newVal) => {
                    if (this._isSettingAuthorizedTitle) {
                        if (nativeDesc && nativeDesc.set) {
                            nativeDesc.set.call(doc, newVal);
                        }
                        return;
                    }
                    // Unauthorized change attempt (e.g. game engine) - silently block and keep authorized disguise title
                    const auth = this._authorizedTitle || this.getCanonicalPageTitle();
                    if (nativeDesc && nativeDesc.set) {
                        nativeDesc.set.call(doc, auth);
                    }
                }
            });
        } catch(e) {}

        const enforceTag = () => {
            if (this._isSettingAuthorizedTitle) return;
            const auth = this._authorizedTitle || this.getCanonicalPageTitle();
            const titleEl = doc.querySelector && doc.querySelector('title');
            if (titleEl && titleEl.textContent !== auth) {
                this._isSettingAuthorizedTitle = true;
                try {
                    titleEl.textContent = auth;
                    if (nativeDesc && nativeDesc.set) {
                        nativeDesc.set.call(doc, auth);
                    }
                } finally {
                    this._isSettingAuthorizedTitle = false;
                }
            }
        };

        const existingTitle = doc.querySelector && doc.querySelector('title');
        if (existingTitle) {
            try {
                const obs = new MutationObserver(enforceTag);
                obs.observe(existingTitle, { childList: true, characterData: true, subtree: true });
            } catch(e) {}
        }
        if (doc.head) {
            try {
                const headObs = new MutationObserver(enforceTag);
                headObs.observe(doc.head, { childList: true });
            } catch(e) {}
        }
    },

    initTitleProtection() {
        this.protectDoc(document);
        try {
            if (window.top && window.top.document && window.top.document !== document) {
                this.protectDoc(window.top.document);
            }
        } catch(e) {}

        // Listen for storage events so that when the class name is renamed, all open tabs update immediately
        window.addEventListener('storage', (e) => {
            if (e.key === 'pinpoint_classroom_config') {
                this.applyClassConfig();
            }
        });

        // Fast watchdog (every 150ms) to ensure title instantly reverts back to page name
        setInterval(() => {
            if (this._isFullscreenClockActive) return;
            const auth = this._authorizedTitle || this.getCanonicalPageTitle();
            if (document.title !== auth) {
                this._setActualTitle(auth);
            }
        }, 150);

        document.addEventListener('visibilitychange', () => {
            if (this._isFullscreenClockActive) return;
            const auth = this._authorizedTitle || this.getCanonicalPageTitle();
            if (document.title !== auth) {
                this._setActualTitle(auth);
            }
        });

        window.addEventListener('focus', () => {
            if (this._isFullscreenClockActive) return;
            const auth = this._authorizedTitle || this.getCanonicalPageTitle();
            if (document.title !== auth) {
                this._setActualTitle(auth);
            }
        });
    },

    setFavicon(iconUrl, doc = document) {
        if (!iconUrl) return;
        const resolved = this.resolveUrl(iconUrl);
        try {
            if (window.top && window.top !== window.self) {
                window.top.postMessage({ type: 'set-favicon', favicon: resolved }, '*');
            }
        } catch (e) {}

        let links = Array.from(doc.querySelectorAll("link[rel*='icon']"));
        if (links.length === 0) {
            const link1 = doc.createElement('link');
            link1.rel = 'icon';
            doc.head.appendChild(link1);
            const link2 = doc.createElement('link');
            link2.rel = 'shortcut icon';
            doc.head.appendChild(link2);
            links = [link1, link2];
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width || 32;
                canvas.height = img.height || 32;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                links.forEach(l => {
                    l.removeAttribute('type');
                    l.href = dataUrl;
                });
            } catch (err) {
                links.forEach(l => {
                    l.href = resolved;
                });
            }
        };
        img.onerror = () => {
            links.forEach(l => {
                l.href = resolved;
            });
        };
        img.src = resolved;
    },

    getClassConfig() {
        try {
            const raw = localStorage.getItem('pinpoint_classroom_config');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.english) {
                    if (parsed.english.name === 'English I_Third' || parsed.english.name === 'English 1' || parsed.english.name === 'English') parsed.english.name = 'World History';
                    if (parsed.english.sec === 'Third' || parsed.english.sec === 'Period 3') parsed.english.sec = '';
                    if (parsed.english.teacher && (parsed.english.teacher.includes('Wukotich') || parsed.english.teacher.includes('Allison'))) parsed.english.teacher = '';
                }
                if (parsed.history) {
                    if (parsed.history.name === '4th Period World History' || parsed.history.name === 'World History_Fourth') parsed.history.name = 'World History';
                    if (parsed.history.sec === '4th Period' || parsed.history.sec === 'Period 4') parsed.history.sec = '';
                    if (parsed.history.teacher && (parsed.history.teacher.includes('Jenkins') || parsed.history.teacher.includes('Jim'))) parsed.history.teacher = '';
                }
                if (parsed.music) {
                    if (parsed.music.teacher) parsed.music.teacher = '';
                }
                return parsed;
            }
        } catch (e) {}
        return {
            english: { name: 'World History', sec: '', teacher: '', room: '', banner: 'WorldHistory.jpg' },
            history: { name: 'World History', sec: '', teacher: '', room: '', banner: 'WorldHistory.jpg' },
            music: { name: 'Music Production', sec: '', teacher: '', room: '' },
            navbarClock: true
        };
    },

    getBannerColor(bannerFileName) {
        if (window.getBannerColor) return window.getBannerColor(bannerFileName);
        const map = window.BANNER_COLOR_MAP || {};
        const key = (bannerFileName || 'WorldHistory.jpg').replace(/^(\.\.\/|\.\/)?images\//, '');
        return map[key] || {
            dominant: '#e06050',
            sidebarBg: '#f5ecea',
            sidebarHover: '#f0d9d6',
            circleBg: '#f0d5d1',
            circleText: '#792115'
        };
    },

    getClassThemeColor(name, bannerFileName) {
        const bColors = this.getBannerColor(bannerFileName);
        return {
            bg: bColors.circleBg,
            text: bColors.circleText,
            sidebarBg: bColors.sidebarBg,
            sidebarHover: bColors.sidebarHover,
            dominant: bColors.dominant
        };
    },

    applyClassConfig() {
        const cfg = this.getClassConfig();
        const historyCfg = cfg.history || cfg.english || {};
        const cardTitles = document.querySelectorAll('.ScpeUc.Vu2fZd.XwD7Ke');
        if (cardTitles.length >= 1 && historyCfg.name) {
            cardTitles[0].textContent = historyCfg.name;
        }
        if (cardTitles.length >= 2 && cfg.music && cfg.music.name) {
            cardTitles[1].textContent = cfg.music.name;
        }

        const cardTeachers = document.querySelectorAll('.z07MGc.Vu2fZd.jJIbcc.T30lh');
        if (cardTeachers.length >= 1) {
            cardTeachers[0].textContent = historyCfg.teacher || '';
        }
        if (cardTeachers.length >= 2 && cfg.music && cfg.music.teacher !== undefined) {
            cardTeachers[1].textContent = cfg.music.teacher;
        }

        const rawPath = window.__CURRENT_PAGE__ || window.location.pathname || '';
        const path = rawPath.toLowerCase();
        const isClasswork = path.includes('classwork');
        const isHistory = !isClasswork && (path.includes('history') || path.includes('english'));
        const isEnglish = !isClasswork && path.includes('english');
        const isMusic = path.includes('music');
        const isMediaMarketing = path.includes('media-marketing');

        const pageHeader = document.querySelector('h1.tNGpbb');
        if (pageHeader) {
            if (isEnglish && cfg.english && cfg.english.name) pageHeader.textContent = cfg.english.name;
            if (isHistory && cfg.history && cfg.history.name) pageHeader.textContent = cfg.history.name;
            if (isMusic && cfg.music && cfg.music.name) pageHeader.textContent = cfg.music.name;
        }

        const classworkSpan = document.getElementById('UGb2Qe');
        if (classworkSpan) {
            if (isEnglish && cfg.english && cfg.english.name) classworkSpan.textContent = cfg.english.name;
            if (isHistory && cfg.history && cfg.history.name) classworkSpan.textContent = cfg.history.name;
            if (isMusic && cfg.music && cfg.music.name) classworkSpan.textContent = cfg.music.name;
        }

        const secEl = document.querySelector('.FWGURc.Vu2fZd');
        if (secEl) {
            if (isEnglish && cfg.english && cfg.english.sec) secEl.textContent = cfg.english.sec;
            if (isHistory && cfg.history && cfg.history.sec) secEl.textContent = cfg.history.sec;
            if (isMusic && cfg.music && cfg.music.sec) secEl.textContent = cfg.music.sec;
        }

        document.querySelectorAll('.GRvzhf.YVvGBb, .XL4gNd.YVvGBb').forEach(el => {
            const txt = el.textContent.trim();
            if (txt.includes('English') || txt === 'English 1') {
                if (cfg.english && cfg.english.name) el.textContent = cfg.english.name;
            } else if (txt.includes('History') || txt === 'World History') {
                if (cfg.history && cfg.history.name) el.textContent = cfg.history.name;
            } else if (txt.includes('Music') || txt === 'Music Production') {
                if (cfg.music && cfg.music.name) el.textContent = cfg.music.name;
            }
        });

        this.setTitle(this.getCanonicalPageTitle());

        const bannerFile = (historyCfg.banner || 'WorldHistory.jpg').replace(/^(\.\.\/|\.\/)?images\//, '');
        const isPagesPath = path.includes('/pages/') || path.includes('\\pages\\');
        const bannerUrl = (isPagesPath ? '../images/' : './images/') + bannerFile;
        document.querySelectorAll('.PFLqgc.KFl4Z, .OjOEXb').forEach(b => {
            b.style.backgroundImage = 'url("' + bannerUrl + '")';
        });

        // Remove tint overlay on home card
        document.querySelectorAll('.Tc9hUd .ZizeYd, .Tc9hUd .ZizeYd.ml1ZL, .Tc9hUd .lmPo4').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('opacity', '0', 'important');
        });

        const activeTitle = (historyCfg.name || 'World History').trim();
        const letter = (activeTitle[0] || 'W').toUpperCase();
        const themeColor = this.getClassThemeColor(activeTitle, bannerFile);

        document.querySelectorAll('nav.STek2d a[data-id="854642477833"] .JShLh, nav.STek2d .CNpREd .JShLh, .sidebar .JShLh, .kWQ5wd .JShLh').forEach(c => {
            c.textContent = letter;
            c.style.setProperty('background-color', themeColor.bg, 'important');
            c.style.setProperty('color', themeColor.text, 'important');
        });

        document.querySelectorAll('#stream-announcement-avatar, .JZicYb .Cxyznd.MwOlIe').forEach(c => {
            c.style.setProperty('background-color', themeColor.bg, 'important');
            const ico = c.querySelector('.material-symbols-outlined') || c.querySelector('#stream-announcement-icon');
            if (ico) {
                ico.style.setProperty('color', themeColor.text, 'important');
                ico.style.setProperty('fill', themeColor.text, 'important');
            }
        });
        document.querySelectorAll('#stream-announcement-icon').forEach(ico => {
            ico.style.setProperty('color', themeColor.text, 'important');
            ico.style.setProperty('fill', themeColor.text, 'important');
        });
    },

    injectNavigation() {
        const path = (window.__CURRENT_PAGE__ || window.location.pathname || '').toLowerCase();
        const isPages = path.includes('/pages/') || path.includes('\\pages\\') || path.startsWith('pages/');
        const isMediaMarketing = path.includes('media-marketing');
        const isRoot = !isPages && !isMediaMarketing;
        const isFile = window.location.protocol === 'file:';

        const isAboutBlank = (window.location.protocol === 'about:' || window.location.href === 'about:blank' || window.location.href.startsWith('about:'));

        const rootPrefix = isFile ? (isRoot ? '.' : '..') : '';
        let pagesPrefix = isFile ? (isPages ? '.' : (isRoot ? './pages' : '../pages')) : '/pages';
        let homeUrl = isFile ? rootPrefix + '/home.html' : '/home.html';
        let musicUrl = isFile ? rootPrefix + '/music.html' : '/music.html';
        let mediaMarketingUrl = isFile ? (isMediaMarketing ? './index.html' : (isPages ? '../media-marketing/index.html' : './media-marketing/index.html')) : '/media-marketing/index.html';

        if (isAboutBlank) {
            homeUrl = '#home.html';
            pagesPrefix = '#pages';
            musicUrl = '#music.html';
            mediaMarketingUrl = '#media-marketing/index.html';
        }

        let activePage = 'home';
        let subpageTitle = '';
        let subpageUrl = '';

        if (path.includes('classwork-history') || path.includes('classwork-english') || path.includes('classwork')) {
            activePage = 'history';
            subpageTitle = 'World History';
            subpageUrl = isAboutBlank ? '#pages/classwork-history.html' : pagesPrefix + '/classwork-history.html';
        } else if (path.includes('history') || path.includes('english')) {
            activePage = 'history';
            subpageTitle = 'World History';
            subpageUrl = isAboutBlank ? '#pages/history.html' : pagesPrefix + '/history.html';
        } else if (path.includes('music-test')) {
            activePage = 'music';
            subpageTitle = 'Music Production';
            subpageUrl = isAboutBlank ? '#music-test.html' : (isFile ? rootPrefix + '/music-test.html' : '/music-test.html');
        } else if (path.includes('music')) {
            activePage = 'music';
            subpageTitle = 'Music Production';
            subpageUrl = isAboutBlank ? '#music.html' : musicUrl;
        } else if (path.includes('media-marketing')) {
            activePage = 'media-marketing';
            subpageTitle = 'Media Marketing';
            subpageUrl = isAboutBlank ? '#media-marketing/index.html' : mediaMarketingUrl;
        } else if (path.includes('ai')) {
            activePage = 'ai';
            subpageTitle = 'Gemini';
            subpageUrl = isAboutBlank ? '#pages/ai.html' : pagesPrefix + '/ai.html';
        } else if (path.includes('settings')) {
            activePage = 'settings';
            subpageTitle = 'Settings';
            subpageUrl = isAboutBlank ? '#pages/settings.html' : pagesPrefix + '/settings.html';
        }

        const cfg = this.getClassConfig();
        const engTitle = (cfg.english && cfg.english.name) || 'World History';
        const hisTitle = (cfg.history && cfg.history.name) || 'World History';
        const musicTitle = (cfg.music && cfg.music.name) || 'Music Production';
        if (activePage === 'english') subpageTitle = engTitle;
        if (activePage === 'history') subpageTitle = hisTitle;
        if (activePage === 'music') subpageTitle = musicTitle;

        let breadcrumbHtml = '';
        if (subpageTitle) {
            breadcrumbHtml = '<span aria-hidden="true" class="notranslate ykp8pd cGvavf gmNu1d fcsk5 RN7s4b"><svg class="NMm5M hhikbc" focusable="false" height="18" viewBox="0 0 24 24" width="18"><path d="M7.59 18.59L9 20l8-8-8-8-1.41 1.41L14.17 12"></path></svg></span><a class="LNBrBd CYP1kd cGvavf gmNu1d eCXkGb fcsk5 sXIFDb" href="' + subpageUrl + '" target="_self"><span class="Vu2fZd LNBrBd gycFA" id="UGb2Qe">' + subpageTitle + '</span></a>';
        }

        const headerNav = document.querySelector('nav.joJglb');
        if (headerNav) {
            headerNav.innerHTML = '<div class="gmNu1d"><div class="FXKA9c"><div class="XIpEib gmNu1d"><div class="k43Owe mmOZjd" data-focus-id="JUeBdc"><div id="ow21"><span data-is-tooltip-wrapper="true"><button id="pinpoint-hamburger-btn" aria-controls="-uQIZnf" aria-expanded="true" aria-label="Main Menu" class="pYTkkf-Bz112c-LgbsSe pYTkkf-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc ykp8pd oxacD" style="cursor:pointer;" type="button"><span class="XjoK4b pYTkkf-Bz112c-UHGRz"></span><span class="UTNHae"></span><span aria-hidden="true" class="pYTkkf-Bz112c-kBDsod-Rtc0Jf"><span aria-hidden="true" class="notranslate VfPpkd-kBDsod"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path></svg></span></span><div class="pYTkkf-Bz112c-RLmnJb"></div></button></span></div></div><h1 class="Hwv4mb rIyhE" data-impressions-entry-point="17"><a class="CbuVcc CYP1kd cGvavf gmNu1d y183Ub fcsk5" data-focus-id="titlebar-home" href="' + homeUrl + '" target="_self"><img alt="Google Classroom" class="UAJaRc" src="' + (isFile ? (rootPrefix + '/images/logo_square_rounded.svg') : '/images/logo_square_rounded.svg') + '"/><span class="dR850e FkiMUb">Classroom</span></a>' + breadcrumbHtml + '</h1></div></div><div class="R2tE8e VHRSDf gmNu1d"></div><div class="Mtd4hb gmNu1d" style="display:flex;align-items:center;gap:16px;padding-right:24px;"><div id="nav-clock-display" class="static-clock-display" style="font-size:14px;font-weight:500;color:#5f6368;font-variant-numeric:tabular-nums;font-family:\'Google Sans\',Roboto,sans-serif;display:inline-flex;align-items:center;cursor:pointer;user-select:none;" title="Fullscreen Clock"></div><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24" style="color:#5f6368;fill:#5f6368;cursor:pointer;"><path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z"></path></svg><img src="https://lh3.googleusercontent.com/a/default-user=s40-c" alt="Avatar" style="width:32px;height:32px;border-radius:50%;cursor:pointer;"></div></div>';
            const navClock = document.getElementById('nav-clock-display');
            if (navClock) {
                navClock.onclick = (e) => {
                    e.preventDefault();
                    this.openFullscreenClock();
                };
            }
        }

        const sidebarNav = document.querySelector('nav.STek2d');
        if (sidebarNav) {
            const aiNavUrl = isAboutBlank ? '#pages/ai.html' : (pagesPrefix + '/ai.html');
            const historyNavUrl = isAboutBlank ? '#pages/history.html' : (pagesPrefix + '/history.html');
            const settingsNavUrl = isAboutBlank ? '#pages/settings.html' : (pagesPrefix + '/settings.html');

                const circleLetter = (hisTitle.trim()[0] || 'W').toUpperCase();
                const hisBanner = (cfg.history && cfg.history.banner) || 'WorldHistory.jpg';
                const circleTheme = this.getClassThemeColor(hisTitle, hisBanner);
                const classItemHtml = '<a aria-current="' + (activePage === 'history' || activePage === 'english' ? 'page' : 'false') + '" aria-label="' + hisTitle + '" class="uTwgne ' + (activePage === 'history' || activePage === 'english' ? 'selected' : '') + '" data-id="854642477833" href="' + historyNavUrl + '" role="menuitem" tabindex="0"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="kWQ5wd"><div class="CNpREd"><div aria-hidden="true" class="JShLh TGnLfc VjRxGc FeltXd uUMf4c" style="background-color:' + circleTheme.bg + ' !important; color:' + circleTheme.text + ' !important;">' + circleLetter + '</div></div></div><div class="Ij01W"><div class="' + (activePage === 'history' || activePage === 'english' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">' + hisTitle + '</div></div></a>';

            const baseNavHtml = '<a aria-current="' + (activePage === 'home' ? 'page' : 'false') + '" aria-label="Home" class="uTwgne TbJ0Pc ' + (activePage === 'home' ? 'selected' : '') + '" href="' + homeUrl + '" role="menuitem" tabindex="0"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M12 3L4 9v12h16V9l-8-6zm6 16h-3v-6H9v6H6v-9l6-4.5 6 4.5v9z"></path></svg></div><div class="Ij01W"><div class="' + (activePage === 'home' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">Home</div></div></a>' +
                '<a aria-current="false" aria-label="Calendar" class="uTwgne TbJ0Pc nav-decorative" href="javascript:void(0)" role="menuitem" style="pointer-events:none;opacity:0.5;cursor:default;" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"></path></svg></div><div class="Ij01W"><div class="GRvzhf YVvGBb">Calendar</div></div></a>' +
                '<a aria-current="' + (activePage === 'ai' ? 'page' : 'false') + '" aria-label="Gemini" class="uTwgne TbJ0Pc ' + (activePage === 'ai' ? 'selected' : '') + '" href="' + aiNavUrl + '" role="menuitem" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg fill="currentColor" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M320-280q17 0 28.5-11.5T360-320q0-17-11.5-28.5T320-360q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160q17 0 28.5-11.5T360-480q0-17-11.5-28.5T320-520q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160q17 0 28.5-11.5T360-640q0-17-11.5-28.5T320-680q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Zm120 320h240v-80H440v80Zm0-160h160v-80H440v80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h320v80H200v560h560v-320h80v320q0 33-23.5 56.5T760-120H200Zm500-360q0-92-64-156t-156-64q92 0 156-64t64-156q0 92 64 156t156 64q-92 0-156 64t-64 156Zm-220 0Z"></path></svg></div><div class="Ij01W"><div class="' + (activePage === 'ai' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">Gemini</div></div></a>' +
                '<li class="aqdrmf-clz4Ic aqdrmf-clz4Ic-OWXEXe-Vkfede s28puc" role="separator"></li>' +
                '<div aria-expanded="true" aria-label="Enrolled" class="ug8OTc" data-nav-menu-group="2" role="menuitem" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="x0wLEd ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"></path></svg></div><div class="gfEyof YVvGBb HqpJve">Enrolled</div><div class="fPqOAb"></div><div class="YPT36c ykp8pd XnKFHd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"></path></svg></div></div>' +
                '<div aria-label="Enrolled" role="group">' +
                '<a aria-current="false" aria-label="To-do" class="uTwgne nav-decorative" href="javascript:void(0)" role="menuitem" style="pointer-events:none;opacity:0.5;cursor:default;" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" enable-background="new 0 0 24 24" focusable="false" height="24" viewBox="0 0 24 24" width="24"><g><rect fill="none" height="24" width="24"></rect></g><g><g><path d="M20,3H4C2.9,3,2,3.9,2,5v14c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V5 C22,3.9,21.1,3,20,3z M20,19H4V5h16V19z" fill-rule="evenodd"></path><polygon fill-rule="evenodd" points="19.41,10.42 17.99,9 14.82,12.17 13.41,10.75 12,12.16 14.82,15"></polygon><rect fill-rule="evenodd" height="2" width="5" x="5" y="7"></rect><rect fill-rule="evenodd" height="2" width="5" x="5" y="15"></rect><rect fill-rule="evenodd" height="2" width="5" x="5" y="15"></rect></g></g></svg></div><div class="Ij01W"><div class="GRvzhf YVvGBb">To-do</div></div></a>' +
                classItemHtml +
                '</div>' +
                '<li class="aqdrmf-clz4Ic aqdrmf-clz4Ic-OWXEXe-Vkfede s28puc" role="separator"></li>' +
                '<a aria-current="false" aria-label="Archived classes" class="uTwgne TbJ0Pc nav-decorative" href="javascript:void(0)" role="menuitem" style="pointer-events:none;opacity:0.5;cursor:default;" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1zM5 19V8h14v11H5zm11-5.5l-4 4-4-4 1.41-1.41L11 13.67V10h2v3.67l1.59-1.59L16 13.5z"></path></svg></div><div class="Ij01W"><div class="GRvzhf YVvGBb">Archived classes</div></div></a>' +
                '<a aria-current="' + (activePage === 'settings' ? 'page' : 'false') + '" aria-label="Settings" class="uTwgne TbJ0Pc ' + (activePage === 'settings' ? 'selected' : '') + '" href="' + settingsNavUrl + '" role="menuitem" tabindex="0"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M13.85 22.25h-3.7c-.74 0-1.36-.54-1.45-1.27l-.27-1.89c-.27-.14-.53-.29-.79-.46l-1.8.72c-.7.26-1.47-.03-1.81-.65L2.2 15.53c-.35-.66-.2-1.44.36-1.88l1.53-1.19c-.01-.15-.02-.3-.02-.46 0-.15.01-.31.02-.46l-1.52-1.19c-.59-.45-.74-1.26-.37-1.88l1.85-3.19c.34-.62 1.11-.9 1.79-.63l1.81.73c.26-.17.52-.32.78-.46l.27-1.91c.09-.7.71-1.25 1.44-1.25h3.7c.74 0 1.36.54 1.45 1.27l.27 1.89c.27.14.53.29.79.46l1.8-.72c.71-.26 1.48.03 1.82.65l1.84 3.18c.36.66.2 1.44-.36 1.88l-1.52 1.19c.01.15.02.3.02.46s-.01.31-.02.46l1.52 1.19c.56.45.72 1.23.37 1.86l-1.86 3.22c-.34.62-1.11.9-1.8.63l-1.8-.72c-.26.17-.52.32-.78.46l-.27 1.91c-.1.68-.72 1.22-1.46 1.22zm-3.23-2h2.76l.37-2.55.53-.22c.44-.18.88-.44 1.34-.78l.45-.34 2.38.96 1.38-2.4-2.03-1.58.07-.56c.03-.26.06-.51.06-.78s-.03-.53-.06-.78l-.07-.56 2.03-1.58-1.39-2.4-2.39.96-.45-.35c-.42-.32-.87-.58-1.33-.77l-.52-.22-.37-2.55h-2.76l-.37 2.55-.53.21c-.44.19-.88.44-1.34.79l-.45.33-2.38-.95-1.39 2.39 2.03 1.58-.07.56a7 7 0 0 0-.06.79c0 .26.02.53.06.78l.07.56-2.03 1.58 1.38 2.4 2.39-.96.45.35c.43.33.86.58 1.33.77l.53.22.38 2.55z"></path><circle cx="12" cy="12" r="3.5"></circle></svg></div><div class="' + (activePage === 'settings' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">Settings</div></div></a>';

            sidebarNav.innerHTML = '<div class="J6rR1b mhCMAe"></div><div class="tCcYY yWU57c" data-course-states="1" data-is-persistent="true" id="-uQIZnf" role="menu"><div class="rknsod" data-impressions-entry-point="14">' + baseNavHtml + '</div></div>';

            this.injectNavFitStyles();
            this.fitSidebarButtons();
            window.addEventListener('resize', () => this.fitSidebarButtons());
            if (window.ResizeObserver) {
                new ResizeObserver(() => this.fitSidebarButtons()).observe(sidebarNav);
            }
        }

        const hamburgerBtn = document.getElementById('pinpoint-hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.onclick = (e) => {
                e.preventDefault();
                const html = document.documentElement;
                if (html.classList.contains('F4Ol1b')) {
                    html.classList.remove('F4Ol1b');
                    html.classList.add('pJAEVb');
                } else {
                    html.classList.remove('pJAEVb');
                    html.classList.add('F4Ol1b');
                }
            };
        }
        setTimeout(() => this.fitSidebarButtons(), 100);
        setTimeout(() => this.fitSidebarButtons(), 500);
    },

    injectNavFitStyles() {
        if (document.getElementById('pinpoint-nav-fit-style')) return;
        const fitStyle = document.createElement('style');
        fitStyle.id = 'pinpoint-nav-fit-style';
        fitStyle.textContent = `
            .sidebar-hide-decorative {
                display: none !important;
            }
            @media (max-height: 850px) {
                .nav-decorative,
                nav.STek2d a[aria-label="Calendar"],
                nav.STek2d a[aria-label="To-do"],
                nav.STek2d a[aria-label="Archived classes"] {
                    display: none !important;
                }
            }
            .sidebar .CNpREd.WFUiUb, nav.STek2d .CNpREd.WFUiUb {
                background: transparent !important;
            }
            .sidebar .CNpREd.WFUiUb .JShLh, nav.STek2d .CNpREd.WFUiUb .JShLh {
                background-color: #ceead6 !important;
                color: #137333 !important;
                fill: #137333 !important;
                border-radius: 50% !important;
            }
            .sidebar .CNpREd.ee1HBc, nav.STek2d .CNpREd.ee1HBc {
                background: transparent !important;
            }
            .sidebar .CNpREd.ee1HBc .JShLh, nav.STek2d .CNpREd.ee1HBc .JShLh {
                background-color: #c2e7ff !important;
                color: #1157ce !important;
                fill: #1157ce !important;
                border-radius: 50% !important;
            }
        `;
        document.head.appendChild(fitStyle);
    },

    fitSidebarButtons() {
        const nav = document.querySelector('nav.STek2d');
        if (!nav) return;
        const decoratives = nav.querySelectorAll('.nav-decorative, a[aria-label="Calendar"], a[aria-label="To-do"], a[aria-label="Archived classes"]');
        if (!decoratives || decoratives.length === 0) return;

        decoratives.forEach(d => d.classList.remove('sidebar-hide-decorative'));

        const content = nav.querySelector('.rknsod') || nav.querySelector('.tCcYY') || nav;
        const availableHeight = nav.clientHeight || (window.innerHeight - 64);
        if (content.scrollHeight > availableHeight + 2) {
            decoratives.forEach(d => d.classList.add('sidebar-hide-decorative'));
        }
    },

    initStaticClock() {
        const homeClock = document.getElementById('home-clock');
        if (homeClock) homeClock.remove();
        const floating = document.getElementById('pinpoint-bottom-clock');
        if (floating) floating.remove();

        function update() {
            const enabled = localStorage.getItem('pinpoint_navbar_time') !== 'false' && localStorage.getItem('pinpoint_navbar_clock') !== 'false';
            const is24 = localStorage.getItem('pinpoint_clock_format') === '24';
            const showSec = localStorage.getItem('pinpoint_clock_seconds') !== 'false';
            const showAmPm = localStorage.getItem('pinpoint_clock_ampm') !== 'false';

            const now = new Date();
            const options = {
                hour: 'numeric',
                minute: '2-digit',
                hour12: !is24
            };
            if (showSec) options.second = '2-digit';
            
            let timeStr = now.toLocaleTimeString([], options);
            if (!is24 && !showAmPm) {
                timeStr = timeStr.replace(/\s*(AM|PM)/i, '').trim();
            }

            const staticClocks = document.querySelectorAll('#runner-clock, #game-clock-display, #nav-clock-display, #popout-time, #fs-time, .static-clock-display');
            staticClocks.forEach(c => {
                c.textContent = timeStr;
                if (c.id !== 'fs-time') {
                    c.style.display = enabled ? 'inline-flex' : 'none';
                }
            });
        }
        setInterval(update, 1000);
        update();
    },

    triggerPanicRedirect(targetUrl) {
        window.__IS_PANIC_TRIGGERED__ = true;
        try { if (window.top) window.top.__IS_PANIC_TRIGGERED__ = true; } catch(e) {}
        try { if (window.parent) window.parent.__IS_PANIC_TRIGGERED__ = true; } catch(e) {}

        targetUrl = targetUrl || localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';

        // 1. Post message to all ancestors & opener so top about:blank window exits
        const msg = { type: 'panic', url: targetUrl };
        try {
            if (window.top && window.top !== window) {
                window.top.postMessage(msg, '*');
            }
        } catch(e) {}
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(msg, '*');
            }
        } catch(e) {}
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage(msg, '*');
            }
        } catch(e) {}

        // 2. Identify topmost window
        let topWin = window;
        try {
            if (window.top && window.top.location) {
                topWin = window.top;
            }
        } catch(e) {}

        // 3. Bypass any about-blank-nav.js wrappers if available
        try {
            if (topWin.__originalLocationReplace) {
                topWin.__originalLocationReplace.call(topWin.location, targetUrl);
                return;
            }
        } catch(e) {}
        try {
            if (topWin.__origLocationHrefSet) {
                topWin.__origLocationHrefSet.call(topWin.location, targetUrl);
                return;
            }
        } catch(e) {}

        // 4. Directly redirect top window out of about:blank
        try {
            topWin.location.href = targetUrl;
            return;
        } catch(e) {}
        try {
            topWin.location.replace(targetUrl);
            return;
        } catch(e) {}

        // 5. Fallback on current window
        try {
            window.location.href = targetUrl;
            return;
        } catch(e) {}
        try {
            window.location.replace(targetUrl);
            return;
        } catch(e) {}
    },

    initPanicKey() {
        if (this._panicBound) return;
        this._panicBound = true;
        window.triggerPanicRedirect = this.triggerPanicRedirect.bind(this);

        const handleKey = (e) => {
            // If game runner overlay is active, reload only the game iframe instead of resetting page
            if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
                const runnerOverlay = document.getElementById('game-runner-overlay');
                if (runnerOverlay && runnerOverlay.style.display !== 'none') {
                    e.preventDefault();
                    e.stopPropagation();
                    const iframe = document.getElementById('runner-iframe');
                    if (iframe) {
                        try {
                            if (iframe.contentWindow) {
                                iframe.contentWindow.location.reload();
                                return;
                            }
                        } catch(err) {}
                        iframe.src = iframe.src;
                    }
                    return;
                }
            }

            const enabled = localStorage.getItem('pinpoint_panic_enabled') !== 'false';
            if (!enabled) return;
            const targetKey = localStorage.getItem('pinpoint_panic_key') || '`';
            if (e.key === targetKey) {
                const targetUrl = localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';
                this.triggerPanicRedirect(targetUrl);
            }
        };

        window.addEventListener('keydown', handleKey);

        window.addEventListener('message', (e) => {
            if (e.data === 'panic' || (e.data && e.data.type === 'panic')) {
                const targetUrl = (e.data && e.data.url) || localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';
                this.triggerPanicRedirect(targetUrl);
            }
        });

        // Watch for any iframes on page (e.g. game runner overlay) to capture panic hotkey
        const attachIframeKeys = () => {
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    if (iframe.contentWindow && !iframe.__panicAttached) {
                        iframe.__panicAttached = true;
                        iframe.contentWindow.addEventListener('keydown', handleKey);
                    }
                } catch(err) {}
            });
        };
        attachIframeKeys();
        setInterval(attachIframeKeys, 1000);
    },

    applyPresetCloak() {
        const preset = localStorage.getItem('pinpoint_tab_cloak') || 'classroom';
        const presets = {
            classroom: { title: 'Home - Classroom', icon: 'favicons/google-classroom.png' },
            drive: { title: 'My Drive - Google Drive', icon: 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png' },
            docs: { title: 'Untitled document - Google Docs', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
            canvas: { title: 'Dashboard - Canvas', icon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico' },
            desmos: { title: 'Desmos | Graphing Calculator', icon: 'https://www.desmos.com/favicon.ico' },
            khan: { title: 'Dashboard | Khan Academy', icon: 'https://www.khanacademy.org/favicon.ico' }
        };
        if (preset !== 'classroom' && presets[preset]) {
            const current = presets[preset];
            this.setTitle(current.title);
            this.setFavicon(current.icon);
        }
    },

    ensureFullscreenClockOverlay() {
        let overlay = document.getElementById('fs-clock-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'fs-clock-overlay';
            overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:#ffffff;z-index:999999;color:#202124;font-family:\'Google Sans\',Roboto,Arial,sans-serif;flex-direction:row;justify-content:center;align-items:center;gap:6vw;box-sizing:border-box;user-select:none;';
            overlay.innerHTML = '<div style="font-size:10vw;font-weight:400;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;color:#202124;" id="fs-time"></div><div style="width:2px;height:12vw;background:#dadce0;border-radius:2px;"></div><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;"><span class="material-symbols-outlined" id="fs-battery-icon" style="font-size:8vw;color:#5f6368;line-height:1;">battery_full</span><span id="fs-battery-text" style="font-size:3vw;font-weight:500;color:#5f6368;line-height:1;">--%</span></div><button id="fs-clock-close-btn" style="position:absolute;top:24px;right:24px;background:none;border:none;color:#5f6368;cursor:pointer;padding:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background-color 0.2s;" onmouseover="this.style.backgroundColor=\'#f1f3f4\'" onmouseout="this.style.backgroundColor=\'transparent\'"><span class="material-symbols-outlined" style="font-size:32px;">close</span></button>';
            document.body.appendChild(overlay);
        }
        const closeBtn = document.getElementById('fs-clock-close-btn');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeFullscreenClock();
            };
        }
    },

    updateBattery() {
        if (typeof navigator !== 'undefined' && navigator.getBattery) {
            navigator.getBattery().then(battery => {
                const update = () => {
                    const level = Math.round(battery.level * 100);
                    const textEl = document.getElementById('fs-battery-text');
                    const iconEl = document.getElementById('fs-battery-icon');
                    if (textEl) textEl.textContent = level + '%';
                    if (iconEl) {
                        let icon = 'battery_full';
                        if (battery.charging) {
                            icon = 'battery_charging_full';
                        } else if (level <= 20) {
                            icon = 'battery_alert';
                        }
                        iconEl.textContent = icon;
                    }
                };
                update();
                battery.addEventListener('chargingchange', update);
                battery.addEventListener('levelchange', update);
            }).catch(() => {});
        }
    },

    getClockTitleTime() {
        const is24 = localStorage.getItem('pinpoint_clock_format') === '24';
        const showAmPm = localStorage.getItem('pinpoint_clock_ampm') !== 'false';
        const now = new Date();
        const options = {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: !is24
        };
        let timeStr = now.toLocaleTimeString([], options);
        if (!is24 && !showAmPm) {
            timeStr = timeStr.replace(/\s*(AM|PM)/i, '').trim();
        }
        return timeStr;
    },

    initFullscreenClock() {
        if (this._fsClockBound) return;
        this._fsClockBound = true;
        this.ensureFullscreenClockOverlay();
        this.updateBattery();
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const overlay = document.getElementById('fs-clock-overlay');
                if (overlay && overlay.style.display !== 'none') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeFullscreenClock();
                }
            }
        }, true);
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'close-fullscreen-clock') {
                this.closeFullscreenClock();
            }
        });
        document.addEventListener('click', (e) => {
            const runnerClock = e.target.closest('#runner-clock');
            if (runnerClock) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof closeRunner === 'function') {
                    closeRunner();
                } else if (typeof closeGameRunner === 'function') {
                    closeGameRunner();
                } else {
                    const runner = document.getElementById('game-runner-overlay');
                    if (runner) runner.style.display = 'none';
                    const iframe = document.getElementById('runner-iframe');
                    if (iframe) iframe.src = 'about:blank';
                }
                this.openFullscreenClock();
            }
        });
    },

    openFullscreenClock() {
        if (typeof closeRunner === 'function') {
            closeRunner();
        } else if (typeof closeGameRunner === 'function') {
            closeGameRunner();
        } else {
            const runner = document.getElementById('game-runner-overlay');
            if (runner && runner.style.display !== 'none') {
                runner.style.display = 'none';
                const iframe = document.getElementById('runner-iframe');
                if (iframe) iframe.src = 'about:blank';
            }
        }
        this.ensureFullscreenClockOverlay();
        const overlay = document.getElementById('fs-clock-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            this.updateBattery();
            const fsTime = document.getElementById('fs-time');
            if (fsTime) {
                fsTime.textContent = this.getClockTitleTime();
            }
        }

        this._isFullscreenClockActive = true;
        let saved = '';
        try {
            if (window.top && window.top.document && window.top.document.title) {
                saved = window.top.document.title;
            }
        } catch (e) {}
        if (!saved) saved = document.title || this.defaultTitle;
        this._savedTitleBeforeClock = saved;

        if (this._clockTitleInterval) {
            clearInterval(this._clockTitleInterval);
        }
        const updateTitle = () => {
            if (!this._isFullscreenClockActive) return;
            const timeStr = this.getClockTitleTime();
            this._setActualTitle(timeStr);
            const fsTime = document.getElementById('fs-time');
            if (fsTime) {
                fsTime.textContent = timeStr;
            }
        };
        updateTitle();
        this._clockTitleInterval = setInterval(updateTitle, 1000);
    },

    closeFullscreenClock() {
        const overlay = document.getElementById('fs-clock-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        this._isFullscreenClockActive = false;
        if (this._clockTitleInterval) {
            clearInterval(this._clockTitleInterval);
            this._clockTitleInterval = null;
        }

        const restoreTitle = this._savedTitleBeforeClock || this.getCanonicalPageTitle() || this.defaultTitle || 'Classes';
        this.setTitle(restoreTitle);
    },

    initCleanupReminder() {
        // Global capture listener for dismiss button
        document.addEventListener('click', (e) => {
            const dismiss = e.target.closest('#pinpoint-info-dismiss-btn');
            if (dismiss) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                this.closeInfoWidget(e);
            }
        }, true);

        // Escape key to dismiss highlights
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const widget = document.getElementById('pinpoint-info-widget');
                if (widget && widget.style.display !== 'none' && !widget.classList.contains('pinpoint-dismissed')) {
                    this.closeInfoWidget(e);
                }
            }
        });

        try {
            // Avoid showing inside textbook game iframes
            if (window.location.pathname.includes('/textbooks/')) return;
            const widgetDismissed = localStorage.getItem('pinpoint_info_widget_dismissed_v3') === 'true';
            if (!widgetDismissed) {
                this.showInfoWidget();
            }
        } catch (e) {}
    },

    closeInfoWidget(e) {
        if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }
        try {
            localStorage.setItem('pinpoint_info_widget_dismissed_v3', 'true');
            sessionStorage.setItem('pinpoint_info_widget_dismissed_v3', 'true');
        } catch (err) {}
        const widget = document.getElementById('pinpoint-info-widget');
        if (widget) {
            widget.classList.add('pinpoint-dismissed');
            widget.style.setProperty('display', 'none', 'important');
            widget.remove();
        }
    },

    showInfoWidget(force = false) {
        if (!force) {
            const dismissed = localStorage.getItem('pinpoint_info_widget_dismissed_v3') === 'true';
            if (dismissed) return;
        }

        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => this.showInfoWidget(force));
            return;
        }

        let existing = document.getElementById('pinpoint-info-widget');
        if (existing) {
            if (!force && localStorage.getItem('pinpoint_info_widget_dismissed_v3') === 'true') {
                existing.remove();
                return;
            }
            existing.classList.remove('pinpoint-dismissed');
            existing.style.setProperty('display', 'flex', 'important');
            return;
        }

        let currentHost = window.location.hostname || window.location.host || '';
        if (!currentHost || currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === 'about:blank' || currentHost.startsWith('about:')) {
            const entry = localStorage.getItem('pinpoint_entry_origin');
            if (entry) {
                try {
                    currentHost = new URL(entry).hostname || entry;
                } catch (e) {
                    currentHost = entry;
                }
            }
        }
        if (!currentHost || currentHost === 'about:blank') {
            currentHost = 'Current Site';
        }

        const scriptUrl = 'https://script.google.com/macros/s/AKfycbxOoEViQ2ohkOZK6Lrm3bpCB4EXT0CvAHGALItv9SWW0M13YQOPdX7qcsXivsSDXyAkoQ/exec';

        // Add or update style for simple closable list card
        let style = document.getElementById('pinpoint-info-widget-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'pinpoint-info-widget-style';
            document.head.appendChild(style);
        }
        style.textContent = `
            .pinpoint-info-card, .pinpoint-info-hub {
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                left: auto !important;
                width: 380px !important;
                max-width: calc(100vw - 32px) !important;
                max-height: 85vh !important;
                z-index: 2147483647 !important;
                font-family: 'Google Sans', Roboto, Arial, sans-serif !important;
                box-sizing: border-box !important;
                background: #ffffff !important;
                border: 1px solid #dadce0 !important;
                border-radius: 16px !important;
                box-shadow: 0 10px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06) !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
            }
            .pinpoint-card-header, .pinpoint-info-header {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                width: 100% !important;
                box-sizing: border-box !important;
                padding: 10px 14px !important;
                background: #f8fafd !important;
                border-bottom: 1px solid #e8eaed !important;
                color: #202124 !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                user-select: none !important;
            }
            .pinpoint-card-list {
                display: flex !important;
                flex-direction: column !important;
                gap: 6px !important;
                padding: 10px !important;
                overflow-y: auto !important;
                max-height: calc(85vh - 50px) !important;
                box-sizing: border-box !important;
            }
            .pinpoint-list-item {
                background: #f8fafd !important;
                border: 1px solid #e8eaed !important;
                border-radius: 8px !important;
                padding: 7px 10px !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 2px !important;
                transition: background-color 0.15s ease, border-color 0.15s ease !important;
            }
            .pinpoint-list-item:hover {
                background: #f1f5f9 !important;
                border-color: #d2e3fc !important;
            }
            .pinpoint-item-head {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 6px !important;
            }
            .pinpoint-item-title {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                color: #202124 !important;
            }
            .pinpoint-item-desc {
                font-size: 11px !important;
                line-height: 1.35 !important;
                color: #5f6368 !important;
            }
            .pinpoint-badge {
                font-size: 9.5px !important;
                font-weight: 700 !important;
                padding: 1px 6px !important;
                border-radius: 99px !important;
                text-transform: uppercase !important;
                letter-spacing: 0.3px !important;
                flex-shrink: 0 !important;
            }
            .pinpoint-badge-addition {
                background: #e6f4ea !important;
                color: #137333 !important;
                border: 1px solid #ceead6 !important;
            }
            .pinpoint-badge-fix {
                background: #fce8e6 !important;
                color: #c5221f !important;
                border: 1px solid #fad2cf !important;
            }
            .pinpoint-badge-removal {
                background: #f1f3f4 !important;
                color: #5f6368 !important;
                border: 1px solid #dadce0 !important;
            }
            .pinpoint-badge-updated {
                background: #e8f0fe !important;
                color: #1a73e8 !important;
                border: 1px solid #d2e3fc !important;
            }
            .pinpoint-info-card.pinpoint-dismissed {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                opacity: 0 !important;
            }
            #pinpoint-info-dismiss-btn {
                background: none !important;
                border: none !important;
                color: #5f6368 !important;
                cursor: pointer !important;
                padding: 4px !important;
                margin: 0 0 0 auto !important;
                border-radius: 50% !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 26px !important;
                height: 26px !important;
                min-width: 26px !important;
                flex-shrink: 0 !important;
                pointer-events: auto !important;
                transition: background-color 0.15s ease, transform 0.1s ease !important;
            }
            #pinpoint-info-dismiss-btn:hover {
                background-color: #e8eaed !important;
                color: #202124 !important;
            }
            #pinpoint-info-dismiss-btn:active {
                background-color: #dadce0 !important;
                transform: scale(0.94) !important;
            }
        `;

        const container = document.createElement('div');
        container.id = 'pinpoint-info-widget';
        container.className = 'pinpoint-info-card';
        container.style.cssText = 'position:fixed !important; bottom:20px !important; right:20px !important; left:auto !important; width:380px !important; max-width:calc(100vw - 32px) !important; max-height:85vh !important; z-index:2147483647 !important; font-family:\'Google Sans\',Roboto,Arial,sans-serif !important; box-sizing:border-box !important; background:#ffffff !important; border:1px solid #dadce0 !important; border-radius:16px !important; box-shadow:0 10px 32px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.06) !important; overflow:hidden !important; display:flex !important; flex-direction:column !important;';

        container.innerHTML = `
            <div class="pinpoint-card-header">
                <div style="display:flex !important; align-items:center !important; gap:6px !important; flex:1 !important; min-width:0 !important;">
                    <span class="material-symbols-outlined notranslate" style="font-size:18px !important; color:#1a73e8 !important; line-height:1 !important; flex-shrink:0 !important;">campaign</span>
                    <span style="font-size:13px !important; font-weight:600 !important; color:#202124 !important; white-space:nowrap !important;">Classroom Highlights</span>
                </div>
                <button id="pinpoint-info-dismiss-btn" type="button" onclick="TabDisguiser.closeInfoWidget(event)" title="Dismiss">
                    <span class="material-symbols-outlined notranslate" style="font-size:18px !important; line-height:1 !important; color:#5f6368 !important; pointer-events:none !important;">close</span>
                </button>
            </div>

            <div class="pinpoint-card-list">
                <!-- Top Share Link (Not in regular container, no full URL displayed) -->
                <div style="background:#f1f3f4;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;margin-bottom:2px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                        <span style="font-size:12px;font-weight:600;color:#202124;display:flex;align-items:center;gap:5px;">
                            <span class="material-symbols-outlined notranslate" style="font-size:15px;color:#1a73e8;">share</span>
                            <span>Share Active Mirror</span>
                        </span>
                        <button id="info-copy-script-btn" type="button" style="background:#1a73e8;border:none;border-radius:6px;padding:4px 9px;font-size:11px;font-weight:600;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit;">
                            <span class="material-symbols-outlined notranslate" style="font-size:13px;line-height:1;">content_copy</span> Copy Script Link
                        </button>
                    </div>
                    <div style="font-size:10.5px;color:#5f6368;line-height:1.3;">
                        Share this link to always get an unblocked mirror.
                    </div>
                    <div id="info-script-toast" style="display:none;font-size:10.5px;color:#137333;font-weight:500;">✓ Script link copied to clipboard!</div>
                </div>

                <!-- 1. Bit Planes -->
                <div class="pinpoint-list-item">
                    <div class="pinpoint-item-head">
                        <div class="pinpoint-item-title">
                            <span class="material-symbols-outlined notranslate" style="font-size:16px;color:#1a73e8;line-height:1;">flight</span>
                            <span>Bit Planes (2PM)</span>
                        </div>
                        <span class="pinpoint-badge pinpoint-badge-updated">Updated</span>
                    </div>
                    <div class="pinpoint-item-desc">
                        Brand new 1v1 local split-screen mode featuring dual independent cameras, customizable WASD & Arrow controls, live scores, homing missiles, and classic dogfighting!
                    </div>
                </div>

                <!-- 2. Library -->
                <div class="pinpoint-list-item">
                    <div class="pinpoint-item-head">
                        <div class="pinpoint-item-title">
                            <span class="material-symbols-outlined notranslate" style="font-size:16px;color:#188038;line-height:1;">bookmark</span>
                            <span>Unified Library</span>
                        </div>
                        <span class="pinpoint-badge pinpoint-badge-addition">Addition</span>
                    </div>
                    <div class="pinpoint-item-desc">
                        A seamless upgrade replacing downloads and favorites—bookmark any game to instantly play offline with zero lag.
                    </div>
                </div>

                <!-- 3. Bug Fix -->
                <div class="pinpoint-list-item">
                    <div class="pinpoint-item-head">
                        <div class="pinpoint-item-title">
                            <span class="material-symbols-outlined notranslate" style="font-size:16px;color:#c5221f;line-height:1;">build</span>
                            <span>JSDelivr CDN & Engines</span>
                        </div>
                        <span class="pinpoint-badge pinpoint-badge-fix">Bug Fix</span>
                    </div>
                    <div class="pinpoint-item-desc">
                        Fixed 503 byte timeouts on jsDelivr mirrors, multi-file games, and Ruffle Flash WASM loading.
                    </div>
                </div>

                <!-- 4. Retro Bowl Saves -->
                <div class="pinpoint-list-item">
                    <div class="pinpoint-item-head">
                        <div class="pinpoint-item-title">
                            <span class="material-symbols-outlined notranslate" style="font-size:16px;color:#137333;line-height:1;">sports_football</span>
                            <span>Retro Bowl Dynasty Saves</span>
                        </div>
                        <span class="pinpoint-badge pinpoint-badge-addition">Addition</span>
                    </div>
                    <div class="pinpoint-item-desc">
                        Export and import season save files for Retro Bowl & Retro Bowl College right from the runner topbar.
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Copy actions
        const copyScriptBtn = document.getElementById('info-copy-script-btn');
        if (copyScriptBtn) {
            copyScriptBtn.onclick = (e) => {
                e.stopPropagation();
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(scriptUrl).catch(() => {});
                }
                const toast = document.getElementById('info-script-toast');
                if (toast) {
                    toast.style.display = 'block';
                    setTimeout(() => { toast.style.display = 'none'; }, 3000);
                }
            };
        }

        // Dismiss action
        const dismissBtn = container.querySelector('#pinpoint-info-dismiss-btn') || document.getElementById('pinpoint-info-dismiss-btn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', (e) => {
                this.closeInfoWidget(e);
            });
            dismissBtn.onclick = (e) => {
                this.closeInfoWidget(e);
            };
        }
    },

    openPopout(file, title) {
        if (!file) return null;
        const resolvedTitle = title || 'Textbook';
        const currentOrigin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';
        const currentUrl = (window.location.href && !window.location.href.startsWith('about:')) ? window.location.href : (currentOrigin + '/pages/classwork-history.html');
        const currentHost = window.location.host || window.location.hostname || 'pinpoint-edu';

        try {
            if (currentUrl) localStorage.setItem('pinpoint_return_url', currentUrl);
            if (currentOrigin) localStorage.setItem('pinpoint_return_origin', currentOrigin);
            if (currentHost) localStorage.setItem('pinpoint_return_host', currentHost);
        } catch (e) {}

        let gameSrc = file;
        if (!file.startsWith('http://') && !file.startsWith('https://')) {
            if (file.startsWith('../')) {
                gameSrc = currentOrigin + '/' + file.replace(/^\.\.\//, '');
            } else if (file.startsWith('./')) {
                gameSrc = currentOrigin + '/' + file.replace(/^\.\//, '');
            } else if (!file.startsWith('/')) {
                gameSrc = currentOrigin + '/' + file;
            } else {
                gameSrc = currentOrigin + file;
            }
        }

        const win = window.open('about:blank', '_blank');
        if (!win) {
            if (typeof showPinpointToast === 'function') {
                showPinpointToast('Please allow popups in your browser to open this tab.', 'warning');
            } else {
                alert('Please allow popups to open about:blank window.');
            }
            return null;
        }

        const popoutTitle = (this.getCanonicalPageTitle && this.getCanonicalPageTitle()) || 'Classwork for World History - Classroom';
        const faviconUrl = currentOrigin ? `${currentOrigin}/favicons/google-classroom.png` : 'favicons/google-classroom.png';
        const isFavorited = (function() {
            try {
                const lib = localStorage.getItem('pinpoint_library');
                if (lib && JSON.parse(lib).includes(file)) return true;
                const raw = localStorage.getItem('pinpoint_favorites');
                if (raw) return JSON.parse(raw).includes(file);
            } catch(e) {}
            return false;
        })();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${popoutTitle}</title>
  <link rel="icon" type="image/png" href="${faviconUrl}">
  <link rel="shortcut icon" type="image/png" href="${faviconUrl}">
  <script defer src="https://cloud.umami.is/script.js" data-website-id="aa9f6a9e-fe62-4b22-a716-f161605dadfc"><\/script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0..200" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #ffffff; font-family: 'Google Sans', Roboto, Arial, sans-serif; display: flex; flex-direction: column; }
    .topbar { height: 56px; min-height: 56px; border-bottom: 1px solid #dadce0; background: #ffffff; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; user-select: none; z-index: 100; position: relative; }
    .topbar-left { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; }
    .topbar-center { display: flex; align-items: center; justify-content: center; flex: 1; min-width: 0; }
    .topbar-right { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex: 1; min-width: 0; }
    .share-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px; background: #f1f3f4; border: 1px solid #dadce0; border-radius: 16px; font-size: 13px; font-weight: 500; color: #3c4043; user-select: none; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .back-btn { background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #5f6368; transition: background-color 0.2s; }
    .back-btn:hover { background-color: #f1f3f4; color: #202124; }
    .topbar-title { font-size: 18px; font-weight: 500; color: #202124; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 30vw; font-family: inherit; }
    .time-badge { font-size: 14px; font-weight: 500; color: #5f6368; font-variant-numeric: tabular-nums; margin-left: 8px; padding-left: 8px; border-left: 1px solid #dadce0; font-family: inherit; }
    .action-btn { height: 36px; padding: 0 14px; font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 4px; border: 1px solid #dadce0; background: #ffffff; color: #5f6368; font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; transition: background-color 0.2s; }
    .action-btn:hover { background-color: #f1f3f4; }
    .action-btn.primary { color: #1a73e8; }
    .action-btn.starred { color: #b06000; background: #fef7e0; border-color: #f9ab00; }
    .game-iframe { width: 100%; flex: 1; border: none; background: #ffffff; }
    span.material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; font-size: 20px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-left">
      <button class="back-btn" onclick="returnToWebsite()" title="Return to Website">
        <span class="material-symbols-outlined" style="font-size:24px;">arrow_back</span>
      </button>
      <span class="topbar-title">${resolvedTitle}</span>
      <span id="popout-time" class="time-badge"></span>
    </div>
    <div class="topbar-center">
      <div class="share-pill">
        <span class="material-symbols-outlined" style="font-size:16px;color:#ea4335;">description</span>
        <span>pls fill this out gng😭: <a href="https://forms.gle/EnzAhDYTACGkM2oYA" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;font-weight:600;">https://forms.gle/EnzAhDYTACGkM2oYA</a></span>
      </div>
    </div>
    <div class="topbar-right">
      <button id="popout-fav-btn" class="action-btn ${isFavorited ? 'starred' : ''}" onclick="togglePopoutFav()">
        <span class="material-symbols-outlined" id="popout-fav-icon" style="${isFavorited ? "font-variation-settings:'FILL' 1;color:#1a73e8;" : ""}">
          ${isFavorited ? 'bookmark' : 'bookmark_border'}
        </span>
        <span id="popout-fav-text">${isFavorited ? 'In Library' : 'Library'}</span>
      </button>
      <button class="action-btn primary" onclick="toggleFullscreen()">
        <span class="material-symbols-outlined" style="font-size:18px;">fullscreen</span>
        <span>Fullscreen</span>
      </button>
    </div>
  </div>
  <iframe id="game-frame" class="game-iframe" src="${gameSrc}" allow="clipboard-write; clipboard-read; fullscreen; gamepad; autoplay" allowfullscreen></iframe>
  <script>
    const LOCKED_POPOUT_TITLE = ${JSON.stringify(popoutTitle)};
    try {
      const pNativeDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
      Object.defineProperty(document, 'title', {
        configurable: true,
        enumerable: true,
        get: () => LOCKED_POPOUT_TITLE,
        set: (v) => { if (pNativeDesc && pNativeDesc.set) pNativeDesc.set.call(document, LOCKED_POPOUT_TITLE); }
      });
    } catch(e) {}
    const pTitleTag = document.querySelector('title');
    if (pTitleTag) {
      new MutationObserver(() => {
        if (pTitleTag.textContent !== LOCKED_POPOUT_TITLE) pTitleTag.textContent = LOCKED_POPOUT_TITLE;
      }).observe(pTitleTag, { childList: true, characterData: true, subtree: true });
    }
    setInterval(() => {
      if (document.title !== LOCKED_POPOUT_TITLE) document.title = LOCKED_POPOUT_TITLE;
    }, 150);

    const gameFrame = document.getElementById('game-frame');
    if (gameFrame) {
      gameFrame.addEventListener('load', () => {
        try {
          if (gameFrame.contentWindow && gameFrame.contentWindow.document) {
            const gDoc = gameFrame.contentWindow.document;
            Object.defineProperty(gDoc, 'title', {
              configurable: true,
              get: () => LOCKED_POPOUT_TITLE,
              set: () => {}
            });
            const gt = gDoc.querySelector('title');
            if (gt) {
              gt.textContent = LOCKED_POPOUT_TITLE;
              new MutationObserver(() => {
                if (gt.textContent !== LOCKED_POPOUT_TITLE) gt.textContent = LOCKED_POPOUT_TITLE;
              }).observe(gt, { childList: true, characterData: true, subtree: true });
            }
          }
        } catch(e) {}
      });
    }

    const TARGET_FILE = ${JSON.stringify(file)};
    let returnUrl = ${JSON.stringify(currentUrl)};

    function returnToWebsite() {
      try {
        const stored = localStorage.getItem('pinpoint_return_url');
        if (stored && !stored.startsWith('about:')) returnUrl = stored;
      } catch (e) {}
      if (!returnUrl || returnUrl.startsWith('about:')) {
        returnUrl = (window.location.origin && window.location.origin !== 'null') ? (window.location.origin + '/pages/classwork-history.html') : './index.html';
      }
      try {
        window.open(returnUrl, '_blank');
      } catch (e) {
        window.location.href = returnUrl;
      }
      try {
        window.close();
      } catch (e) {}
    }

    function updateClocks() {
      const now = new Date();
      let format = '12';
      let showSeconds = true;
      let showAmPm = true;
      try {
        format = localStorage.getItem('pinpoint_clock_format') || '12';
        showSeconds = localStorage.getItem('pinpoint_clock_seconds') !== 'false';
        showAmPm = localStorage.getItem('pinpoint_clock_ampm') !== 'false';
      } catch (e) {}
      let h = now.getHours();
      let m = now.getMinutes();
      let s = now.getSeconds();
      let ampm = '';
      if (format === '12') {
        if (showAmPm) ampm = h >= 12 ? ' PM' : ' AM';
        h = h % 12;
        h = h ? h : 12;
      } else {
        h = h < 10 ? '0' + h : h;
      }
      m = m < 10 ? '0' + m : m;
      s = s < 10 ? '0' + s : s;
      let timeStr = h + ':' + m;
      if (showSeconds) timeStr += ':' + s;
      timeStr += ampm;
      const el = document.getElementById('popout-time');
      if (el) el.textContent = timeStr;
    }
    setInterval(updateClocks, 1000);
    updateClocks();

    function togglePopoutFav() {
      try {
        let favs = [];
        const raw = localStorage.getItem('pinpoint_library') || localStorage.getItem('pinpoint_favorites');
        if (raw) favs = JSON.parse(raw);
        const idx = favs.indexOf(TARGET_FILE);
        const btn = document.getElementById('popout-fav-btn');
        const icon = document.getElementById('popout-fav-icon');
        const text = document.getElementById('popout-fav-text');
        if (idx !== -1) {
          favs.splice(idx, 1);
          btn.className = 'action-btn';
          icon.textContent = 'bookmark_border';
          icon.style.color = '#5f6368';
          icon.style.fontVariationSettings = "'FILL' 0";
          text.textContent = 'Library';
        } else {
          favs.push(TARGET_FILE);
          btn.className = 'action-btn starred';
          icon.textContent = 'bookmark';
          icon.style.color = '#1a73e8';
          icon.style.fontVariationSettings = "'FILL' 1";
          text.textContent = 'In Library';
        }
        localStorage.setItem('pinpoint_library', JSON.stringify(favs));
        localStorage.setItem('pinpoint_favorites', JSON.stringify(favs));
      } catch (e) {}
    }

    function toggleFullscreen() {
      const iframe = document.getElementById('game-frame');
      if (!document.fullscreenElement) {
        if (iframe.requestFullscreen) iframe.requestFullscreen();
        else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    }

    function triggerPopoutPanic(url) {
      const targetUrl = url || localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';
      try { window.location.href = targetUrl; return; } catch(err) {}
      try { window.location.replace(targetUrl); return; } catch(err) {}
    }

    function reloadPopoutGame() {
      const gf = document.getElementById('game-frame');
      if (gf) {
        try {
          if (gf.contentWindow) {
            gf.contentWindow.location.reload();
            return;
          }
        } catch(err) {}
        gf.src = gf.src;
      }
    }

    function handlePopoutKey(e) {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        e.stopPropagation();
        reloadPopoutGame();
        return;
      }
      const enabled = localStorage.getItem('pinpoint_panic_enabled') !== 'false';
      if (!enabled) return;
      const targetKey = localStorage.getItem('pinpoint_panic_key') || String.fromCharCode(96);
      if (e.key === targetKey) {
        triggerPopoutPanic();
      }
    }

    window.addEventListener('keydown', handlePopoutKey, true);

    window.addEventListener('beforeunload', function(e) {
      if (!window.__IS_PANIC_TRIGGERED__) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    window.addEventListener('message', (e) => {
      if (e.data === 'panic' || e.data?.type === 'panic') {
        triggerPopoutPanic(e.data?.url);
      }
    });

    function attachPopoutGameKey() {
      const gf = document.getElementById('game-frame');
      if (gf && gf.contentWindow && !gf.__panicAttached) {
        try {
          gf.__panicAttached = true;
          gf.contentWindow.addEventListener('keydown', handlePopoutKey, true);
        } catch(err) {}
      }
    }
    const gf = document.getElementById('game-frame');
    if (gf) gf.addEventListener('load', attachPopoutGameKey);
    setInterval(attachPopoutGameKey, 1000);
  <\/script>
</body>
</html>`;

        win.document.open();
        win.document.write(html);
        win.document.close();
        return win;
    }
};

if (typeof window !== 'undefined') {
    if (typeof window.showPinpointToast !== 'function') {
        window.showPinpointToast = function(message, type = 'info', duration = 3500) {
            let container = document.getElementById('pinpoint-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'pinpoint-toast-container';
                container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;font-family:\'Google Sans\',Roboto,Arial,sans-serif;';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.style.cssText = 'pointer-events:auto;min-width:280px;max-width:440px;background:#ffffff;color:#202124;padding:6px 12px 6px 8px;border-radius:28px;border:1px solid #dadce0;font-size:13.5px;font-weight:500;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 4px 18px rgba(0,0,0,0.14),0 1px 4px rgba(0,0,0,0.08);transition:opacity 0.22s ease,transform 0.22s ease;box-sizing:border-box;';

            let badgeBg = '#e8f0fe';
            let badgeColor = '#1a73e8';
            let iconName = 'info';
            if (type === 'success') {
                badgeBg = '#e6f4ea';
                badgeColor = '#137333';
                iconName = 'check_circle';
            } else if (type === 'error') {
                badgeBg = '#fce8e6';
                badgeColor = '#c5221f';
                iconName = 'error';
            } else if (type === 'warning') {
                badgeBg = '#fef7e0';
                badgeColor = '#b06000';
                iconName = 'warning';
            }

            toast.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                    <div style="width:32px;height:32px;border-radius:50%;background:${badgeBg};color:${badgeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <span class="material-symbols-outlined notranslate" style="font-size:18px;line-height:1;">${iconName}</span>
                    </div>
                    <span style="line-height:1.4;word-break:break-word;color:#202124;">${message}</span>
                </div>
                <button style="background:none;border:none;color:#5f6368;cursor:pointer;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;padding:0;" title="Dismiss">
                    <span class="material-symbols-outlined notranslate" style="font-size:18px;line-height:1;">close</span>
                </button>
            `;

            let dismissed = false;
            const remove = () => {
                if (dismissed) return;
                dismissed = true;
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(16px) scale(0.92)';
                setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
            };
            toast.querySelector('button').onclick = remove;
            container.appendChild(toast);
            if (duration > 0) setTimeout(remove, duration);
        };
    }

    window.TabDisguiser = TabDisguiser;
    window.openFullscreenClock = () => TabDisguiser.openFullscreenClock();
    window.closeFullscreenClock = () => TabDisguiser.closeFullscreenClock();
    window.closeInfoWidget = (e) => TabDisguiser.closeInfoWidget(e);
    window.showInfoWidget = (force) => TabDisguiser.showInfoWidget(force);
    window.showCleanupReminder = (force) => TabDisguiser.showCleanupReminder(force);
    window.showWednesdayCleanupReminder = (force) => TabDisguiser.showCleanupReminder(force);
    window.showDomainScriptReminder = (force) => TabDisguiser.showDomainScriptReminder(force);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            TabDisguiser.init();
        });
    } else {
        TabDisguiser.init();
    }
}
