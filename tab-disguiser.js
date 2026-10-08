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
                                        keys.forEach(k => caches.delete(k));
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

    setTitle(customTitle) {
        const titleToUse = customTitle || this.defaultTitle;
        const docs = this.getDocs();
        docs.forEach(d => { d.title = titleToUse; });
        try {
            if (window.top && window.top !== window.self) {
                window.top.postMessage({ type: 'set-title', title: titleToUse }, '*');
            }
        } catch (e) {}
    },

    apply(customTitle) {
        this.setTitle(customTitle);
        const docs = this.getDocs();
        const icon = this.resolveUrl(this.defaultFavicon);
        docs.forEach(d => this.setFavicon(icon, d));
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
            english: { name: 'World History', sec: '', teacher: '', room: '' },
            history: { name: 'World History', sec: '', teacher: '', room: '' },
            music: { name: 'Music Production', sec: '', teacher: '', room: '' },
            navbarClock: true
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
        if (cardTeachers.length >= 1 && historyCfg.teacher !== undefined) {
            cardTeachers[0].textContent = historyCfg.teacher;
        }
        if (cardTeachers.length >= 2 && cfg.music && cfg.music.teacher !== undefined) {
            cardTeachers[1].textContent = cfg.music.teacher;
        }

        const path = window.location.pathname;
        const isHistory = path.includes('history');
        const isEnglish = path.includes('english');
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

        if (isEnglish && cfg.english && cfg.english.name) {
            this.setTitle(cfg.english.name + ' - Classroom');
        } else if (isHistory && cfg.history && cfg.history.name) {
            this.setTitle(cfg.history.name + ' - Classroom');
        } else if (isMusic && cfg.music && cfg.music.name) {
            this.setTitle(cfg.music.name + ' - Classroom');
        } else if (isMediaMarketing) {
            this.setTitle('Media Marketing - Classroom');
        }
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

            const baseNavHtml = '<a aria-current="' + (activePage === 'home' ? 'page' : 'false') + '" aria-label="Home" class="uTwgne TbJ0Pc ' + (activePage === 'home' ? 'selected' : '') + '" href="' + homeUrl + '" role="menuitem" tabindex="0"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M12 3L4 9v12h16V9l-8-6zm6 16h-3v-6H9v6H6v-9l6-4.5 6 4.5v9z"></path></svg></div><div class="Ij01W"><div class="' + (activePage === 'home' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">Home</div></div></a>' +
                '<a aria-current="false" aria-label="Calendar" class="uTwgne TbJ0Pc nav-decorative" href="javascript:void(0)" role="menuitem" style="pointer-events:none;opacity:0.5;cursor:default;" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"></path></svg></div><div class="Ij01W"><div class="GRvzhf YVvGBb">Calendar</div></div></a>' +
                '<a aria-current="' + (activePage === 'ai' ? 'page' : 'false') + '" aria-label="Gemini" class="uTwgne TbJ0Pc ' + (activePage === 'ai' ? 'selected' : '') + '" href="' + aiNavUrl + '" role="menuitem" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg fill="currentColor" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M320-280q17 0 28.5-11.5T360-320q0-17-11.5-28.5T320-360q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160q17 0 28.5-11.5T360-480q0-17-11.5-28.5T320-520q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160q17 0 28.5-11.5T360-640q0-17-11.5-28.5T320-680q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Zm120 320h240v-80H440v80Zm0-160h160v-80H440v80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h320v80H200v560h560v-320h80v320q0 33-23.5 56.5T760-120H200Zm500-360q0-92-64-156t-156-64q92 0 156-64t64-156q0 92 64 156t156 64q-92 0-156 64t-64 156Zm-220 0Z"></path></svg></div><div class="Ij01W"><div class="' + (activePage === 'ai' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">Gemini</div></div></a>' +
                '<li class="aqdrmf-clz4Ic aqdrmf-clz4Ic-OWXEXe-Vkfede s28puc" role="separator"></li>' +
                '<div aria-expanded="true" aria-label="Enrolled" class="ug8OTc" data-nav-menu-group="2" role="menuitem" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="x0wLEd ykp8pd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"></path></svg></div><div class="gfEyof YVvGBb HqpJve">Enrolled</div><div class="fPqOAb"></div><div class="YPT36c ykp8pd XnKFHd"><svg class="NMm5M" focusable="false" height="24" viewBox="0 0 24 24" width="24"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"></path></svg></div></div>' +
                '<div aria-label="Enrolled" role="group">' +
                '<a aria-current="false" aria-label="To-do" class="uTwgne nav-decorative" href="javascript:void(0)" role="menuitem" style="pointer-events:none;opacity:0.5;cursor:default;" tabindex="-1"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="npdi5 ykp8pd"><svg class="NMm5M" enable-background="new 0 0 24 24" focusable="false" height="24" viewBox="0 0 24 24" width="24"><g><rect fill="none" height="24" width="24"></rect></g><g><g><path d="M20,3H4C2.9,3,2,3.9,2,5v14c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V5 C22,3.9,21.1,3,20,3z M20,19H4V5h16V19z" fill-rule="evenodd"></path><polygon fill-rule="evenodd" points="19.41,10.42 17.99,9 14.82,12.17 13.41,10.75 12,12.16 14.82,15"></polygon><rect fill-rule="evenodd" height="2" width="5" x="5" y="7"></rect><rect fill-rule="evenodd" height="2" width="5" x="5" y="15"></rect><rect fill-rule="evenodd" height="2" width="5" x="5" y="15"></rect></g></g></svg></div><div class="Ij01W"><div class="GRvzhf YVvGBb">To-do</div></div></a>' +
                '<a aria-current="' + (activePage === 'history' || activePage === 'english' ? 'page' : 'false') + '" aria-label="' + hisTitle + '" class="uTwgne ' + (activePage === 'history' || activePage === 'english' ? 'selected' : '') + '" data-id="854642477833" href="' + historyNavUrl + '" role="menuitem" tabindex="0"><div class="pzaVke"><span class="dNKuRb NJyEeb"></span><div class="NsMoi"></div></div><div class="kWQ5wd"><div class="CNpREd g2MItd"><div aria-hidden="true" class="JShLh TGnLfc VjRxGc FeltXd uUMf4c">W</div></div></div><div class="Ij01W"><div class="' + (activePage === 'history' || activePage === 'english' ? 'XL4gNd' : 'GRvzhf') + ' YVvGBb">' + hisTitle + '</div></div></a>' +
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

    initPanicKey() {
        if (this._panicBound) return;
        this._panicBound = true;
        window.addEventListener('keydown', (e) => {
            const runnerOverlay = document.getElementById('game-runner-overlay');
            if (runnerOverlay && runnerOverlay.style.display !== 'none') return;
            const enabled = localStorage.getItem('pinpoint_panic_enabled') !== 'false';
            if (!enabled) return;
            const targetKey = localStorage.getItem('pinpoint_panic_key') || '`';
            if (e.key === targetKey) {
                const targetUrl = localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';
                window.location.replace(targetUrl);
            }
        });
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
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                const overlay = document.getElementById('fs-clock-overlay');
                if (overlay && overlay.style.display !== 'none') {
                    overlay.style.display = 'none';
                }
            }
        });
    },

    openFullscreenClock() {
        this.ensureFullscreenClockOverlay();
        const overlay = document.getElementById('fs-clock-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            this.updateBattery();
            try {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                }
            } catch (e) {}
        }
    },

    closeFullscreenClock() {
        const overlay = document.getElementById('fs-clock-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        } catch (e) {}
    },

    initCleanupReminder() {
        try {
            // Avoid showing inside textbook game iframes
            if (window.location.pathname.includes('/textbooks/')) return;
            const cleanupSeen = localStorage.getItem('pinpoint_cleanup_reminder_seen') === 'true';
            const scriptSeen = localStorage.getItem('pinpoint_domain_script_seen') === 'true';

            if (!cleanupSeen) {
                // Show delete data reminder first
                this.showCleanupReminder();
            } else if (!scriptSeen) {
                // If cleanup was already seen, show script link reminder
                this.showDomainScriptReminder();
            }
        } catch (e) {}
    },

    showCleanupReminder(force = false) {
        if (!force) {
            const seen = localStorage.getItem('pinpoint_cleanup_reminder_seen') === 'true';
            if (seen) return;
        }

        // Kick user out of game player immediately to display the important notice
        try {
            const runner = document.getElementById('game-runner-overlay');
            if (runner && runner.style.display !== 'none') {
                runner.style.display = 'none';
                const iframe = document.getElementById('runner-iframe');
                if (iframe) iframe.src = 'about:blank';
                if (typeof this.setTitle === 'function') {
                    this.setTitle();
                }
            }
            if (typeof window.closeRunner === 'function') {
                window.closeRunner();
            }
            if (typeof window.closeGameRunner === 'function') {
                window.closeGameRunner();
            }
        } catch (e) {}

        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => this.showCleanupReminder(force));
            return;
        }

        let existing = document.getElementById('cleanup-reminder-modal');
        if (existing) {
            existing.style.display = 'block';
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

        const modal = document.createElement('div');
        modal.id = 'cleanup-reminder-modal';
        modal.style.cssText = 'position:fixed;bottom:24px;right:24px;width:390px;max-width:calc(100vw - 48px);background:#ffffff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08);padding:20px;z-index:2147483647;font-family:\'Google Sans\',Roboto,Arial,sans-serif;box-sizing:border-box;color:#202124;';
        
        modal.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-outlined notranslate" style="color:#ea4335;font-size:24px;line-height:1;">delete_sweep</span>
                    <span style="font-size:16px;font-weight:700;color:#202124;letter-spacing:-0.01em;">Clean Old Blocked Sites!</span>
                </div>
                <button id="cleanup-modal-close-x" style="background:none;border:none;color:#5f6368;cursor:pointer;padding:4px;border-radius:50%;display:flex;align-items:center;justify-content:center;" title="Close">
                    <span class="material-symbols-outlined" style="font-size:20px;line-height:1;">close</span>
                </button>
            </div>

            <div style="font-size:13px;line-height:1.45;color:#3c4043;margin-bottom:14px;">
                <div style="margin-bottom:10px;">
                    Paste this into a new tab's address bar:
                    <div style="display:flex;align-items:center;gap:6px;margin-top:5px;">
                        <code id="cleanup-url-text" style="background:#e8f0fe;color:#174ea6;padding:5px 8px;border-radius:6px;font-size:11px;word-break:break-all;flex:1;font-family:monospace;user-select:all;border:1px solid #d2e3fc;">chrome://settings/content/all?searchSubpage=agrolujo.cl</code>
                        <button id="cleanup-copy-url-btn" style="background:#1a73e8;border:none;border-radius:6px;padding:6px 10px;font-size:11.5px;font-weight:600;color:#fff;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;font-family:inherit;">
                            <span class="material-symbols-outlined notranslate" style="font-size:14px;line-height:1;">content_copy</span> Copy
                        </button>
                    </div>
                </div>

                <div style="background:#f8f9fa;border:1px solid #e8eaed;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;">
                    <div style="margin-bottom:6px;">
                        🗑️ <strong>Spam the trash icon</strong> on all old blocked links to wipe traces.
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;background:#e6f4ea;border:1px solid #34a853;border-radius:6px;padding:6px 8px;color:#137333;font-size:12px;font-weight:600;">
                        <span class="material-symbols-outlined notranslate" style="font-size:16px;line-height:1;color:#137333;flex-shrink:0;">shield</span>
                        <span>DON'T delete: <span style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #a8dab5;color:#0d652d;font-family:monospace;word-break:break-all;">${currentHost}</span> (keeps your saves!)</span>
                    </div>
                </div>
            </div>

            <div id="cleanup-feedback-msg" style="display:none;font-size:12px;color:#137333;background:#e6f4ea;border:1px solid #34a853;border-radius:6px;padding:6px 10px;margin-bottom:12px;align-items:center;gap:6px;">
                <span class="material-symbols-outlined notranslate" style="font-size:15px;line-height:1;">check_circle</span>
                <span id="cleanup-feedback-text">URL copied! Paste in a new tab.</span>
            </div>

            <button id="cleanup-continue-btn" disabled style="width:100%;background:#dadce0;border:none;border-radius:8px;padding:10px 16px;font-size:13.5px;font-weight:600;color:#5f6368;cursor:not-allowed;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;">
                Continue (<span id="cleanup-countdown">7</span>s)
            </button>
        `;

        document.body.appendChild(modal);

        const targetUrl = 'chrome://settings/content/all?searchSubpage=agrolujo.cl';

        const copyUrl = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(targetUrl).catch(() => {});
            }
            const fb = document.getElementById('cleanup-feedback-msg');
            const fbText = document.getElementById('cleanup-feedback-text');
            if (fb && fbText) {
                fbText.textContent = 'URL copied! Paste in a new tab.';
                fb.style.display = 'flex';
            }
        };

        const copyBtn = document.getElementById('cleanup-copy-url-btn');
        if (copyBtn) copyBtn.onclick = copyUrl;

        let timeLeft = 7;
        const continueBtn = document.getElementById('cleanup-continue-btn');
        const countdownSpan = document.getElementById('cleanup-countdown');

        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                if (countdownSpan) countdownSpan.textContent = String(timeLeft);
            } else {
                clearInterval(timer);
                if (continueBtn) {
                    continueBtn.disabled = false;
                    continueBtn.style.background = '#1a73e8';
                    continueBtn.style.color = '#ffffff';
                    continueBtn.style.cursor = 'pointer';
                    continueBtn.textContent = 'Continue';
                }
            }
        }, 1000);

        const closeModal = () => {
            clearInterval(timer);
            try {
                localStorage.setItem('pinpoint_cleanup_reminder_seen', 'true');
            } catch (e) {}
            modal.remove();
            // Automatically trigger the domain script link reminder after closing
            setTimeout(() => {
                this.showDomainScriptReminder();
            }, 300);
        };

        const closeX = document.getElementById('cleanup-modal-close-x');
        if (closeX) closeX.onclick = closeModal;

        if (continueBtn) {
            continueBtn.onclick = () => {
                if (!continueBtn.disabled) {
                    closeModal();
                }
            };
        }
    },

    showDomainScriptReminder(force = false) {
        if (!force) {
            const seen = localStorage.getItem('pinpoint_domain_script_seen') === 'true';
            if (seen) return;
        }

        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => this.showDomainScriptReminder(force));
            return;
        }

        let existing = document.getElementById('domain-script-reminder-modal');
        if (existing) {
            existing.style.display = 'block';
            return;
        }

        const scriptUrl = 'https://script.google.com/macros/s/AKfycbxOoEViQ2ohkOZK6Lrm3bpCB4EXT0CvAHGALItv9SWW0M13YQOPdX7qcsXivsSDXyAkoQ/exec';

        const modal = document.createElement('div');
        modal.id = 'domain-script-reminder-modal';
        modal.style.cssText = 'position:fixed;bottom:24px;right:24px;width:390px;max-width:calc(100vw - 48px);background:#ffffff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08);padding:20px;z-index:2147483647;font-family:\'Google Sans\',Roboto,Arial,sans-serif;box-sizing:border-box;color:#202124;';
        
        let isCopied = false;

        modal.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-outlined notranslate" style="color:#1a73e8;font-size:24px;line-height:1;">share</span>
                    <span style="font-size:16px;font-weight:700;color:#202124;letter-spacing:-0.01em;">Latest Domain & Share Link</span>
                </div>
                <button id="script-modal-close-x" style="background:none;border:none;color:#5f6368;cursor:not-allowed;opacity:0.4;padding:4px;border-radius:50%;display:flex;align-items:center;justify-content:center;" title="Copy link to close">
                    <span class="material-symbols-outlined" style="font-size:20px;line-height:1;">close</span>
                </button>
            </div>

            <div style="font-size:13px;line-height:1.45;color:#3c4043;margin-bottom:14px;">
                <div style="margin-bottom:10px;">
                    Visit this link anytime to get the newest active game link if this site gets blocked:
                    <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
                        <code id="script-url-code" style="background:#e8f0fe;color:#174ea6;padding:5px 8px;border-radius:6px;font-size:10.5px;word-break:break-all;flex:1;font-family:monospace;user-select:all;border:1px solid #d2e3fc;max-height:38px;overflow:hidden;text-overflow:ellipsis;">${scriptUrl}</code>
                        <button id="script-copy-btn" style="background:#1a73e8;border:none;border-radius:6px;padding:6px 10px;font-size:11.5px;font-weight:600;color:#fff;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;font-family:inherit;">
                            <span class="material-symbols-outlined notranslate" style="font-size:14px;line-height:1;">content_copy</span> Copy Link
                        </button>
                    </div>
                </div>

                <div style="background:#fef7e0;border:1px solid #f9ab00;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#7c4a00;line-height:1.45;">
                    📢 <strong>Share with friends!</strong> Bookmark and share this Google Script link & website with your classmates so everyone always has working games!
                </div>
            </div>

            <div id="script-feedback-msg" style="display:none;font-size:12px;color:#137333;background:#e6f4ea;border:1px solid #34a853;border-radius:6px;padding:6px 10px;margin-bottom:12px;align-items:center;gap:6px;">
                <span class="material-symbols-outlined notranslate" style="font-size:15px;line-height:1;">check_circle</span>
                <span id="script-feedback-text">Link copied to clipboard! You can now continue.</span>
            </div>

            <button id="script-gotit-btn" disabled style="width:100%;background:#dadce0;border:none;border-radius:8px;padding:10px 16px;font-size:13.5px;font-weight:600;color:#5f6368;cursor:not-allowed;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px;">
                Copy Link to Continue
            </button>
        `;

        document.body.appendChild(modal);

        const gotItBtn = document.getElementById('script-gotit-btn');
        const closeX = document.getElementById('script-modal-close-x');
        const copyBtn = document.getElementById('script-copy-btn');

        const copyScriptUrl = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(scriptUrl).catch(() => {});
            }
            isCopied = true;
            const fb = document.getElementById('script-feedback-msg');
            const fbText = document.getElementById('script-feedback-text');
            if (fb && fbText) {
                fb.style.display = 'flex';
                fb.style.color = '#137333';
                fb.style.background = '#e6f4ea';
                fb.style.borderColor = '#34a853';
                fbText.textContent = 'Link copied to clipboard! You can now continue.';
            }
            if (gotItBtn) {
                gotItBtn.disabled = false;
                gotItBtn.style.background = '#1a73e8';
                gotItBtn.style.color = '#ffffff';
                gotItBtn.style.cursor = 'pointer';
                gotItBtn.textContent = 'Continue';
            }
            if (closeX) {
                closeX.style.cursor = 'pointer';
                closeX.style.opacity = '1';
                closeX.title = 'Close';
            }
        };

        if (copyBtn) copyBtn.onclick = copyScriptUrl;

        const showCopyRequiredNotice = () => {
            const fb = document.getElementById('script-feedback-msg');
            const fbText = document.getElementById('script-feedback-text');
            if (fb && fbText) {
                fb.style.display = 'flex';
                fb.style.color = '#b06000';
                fb.style.background = '#fef7e0';
                fb.style.borderColor = '#f9ab00';
                fbText.textContent = 'Please copy the link above first to continue!';
            }
        };

        const closeScriptModal = () => {
            if (!isCopied) {
                showCopyRequiredNotice();
                return;
            }
            try {
                localStorage.setItem('pinpoint_domain_script_seen', 'true');
            } catch (e) {}
            modal.remove();
        };

        if (closeX) closeX.onclick = closeScriptModal;

        if (gotItBtn) {
            gotItBtn.onclick = () => {
                if (!isCopied) {
                    showCopyRequiredNotice();
                    return;
                }
                closeScriptModal();
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

        const popoutTitle = resolvedTitle ? resolvedTitle + ' - Classroom' : (document.title || this.defaultTitle);
        const faviconUrl = currentOrigin ? `${currentOrigin}/favicons/google-classroom.png` : 'favicons/google-classroom.png';
        const isFavorited = (function() {
            try {
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
        <span class="material-symbols-outlined" id="popout-fav-icon" style="${isFavorited ? "font-variation-settings:'FILL' 1;color:#fbbc04;" : ""}">
          ${isFavorited ? 'star' : 'star_border'}
        </span>
        <span id="popout-fav-text">${isFavorited ? 'Favorited' : 'Favorite'}</span>
      </button>
      <button class="action-btn primary" onclick="toggleFullscreen()">
        <span class="material-symbols-outlined" style="font-size:18px;">fullscreen</span>
        <span>Fullscreen</span>
      </button>
    </div>
  </div>
  <iframe id="game-frame" class="game-iframe" src="${gameSrc}" allow="clipboard-write; clipboard-read; fullscreen; gamepad; autoplay" allowfullscreen></iframe>
  <script>
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
        const raw = localStorage.getItem('pinpoint_favorites');
        if (raw) favs = JSON.parse(raw);
        const idx = favs.indexOf(TARGET_FILE);
        const btn = document.getElementById('popout-fav-btn');
        const icon = document.getElementById('popout-fav-icon');
        const text = document.getElementById('popout-fav-text');
        if (idx !== -1) {
          favs.splice(idx, 1);
          btn.className = 'action-btn';
          icon.textContent = 'star_border';
          icon.style.color = '#5f6368';
          icon.style.fontVariationSettings = "'FILL' 0";
          text.textContent = 'Favorite';
        } else {
          favs.push(TARGET_FILE);
          btn.className = 'action-btn starred';
          icon.textContent = 'star';
          icon.style.color = '#fbbc04';
          icon.style.fontVariationSettings = "'FILL' 1";
          text.textContent = 'Favorited';
        }
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

    window.addEventListener('keydown', (e) => {
      const enabled = localStorage.getItem('pinpoint_panic_enabled') !== 'false';
      if (!enabled) return;
      const targetKey = localStorage.getItem('pinpoint_panic_key') || String.fromCharCode(96);
      if (e.key === targetKey) {
        const targetUrl = localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';
        window.location.replace(targetUrl);
      }
    });

    window.addEventListener('message', (e) => {
      if (e.data === 'panic' || e.data?.type === 'panic') {
        const targetUrl = localStorage.getItem('pinpoint_panic_url') || 'https://classroom.google.com/';
        window.location.replace(targetUrl);
      }
    });
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
    window.TabDisguiser = TabDisguiser;
    window.openFullscreenClock = () => TabDisguiser.openFullscreenClock();
    window.closeFullscreenClock = () => TabDisguiser.closeFullscreenClock();
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
