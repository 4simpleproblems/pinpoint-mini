(function () {
    const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRd0r0rbOwxXcYpCVMhmUpp6Yo_ceGeMZtMMMMv1-BlAtEh8MprNQFUgDVGZOjY7kynmmaVDjf-6Z6D/pub?output=csv';
    let isBlocked = false;
    let isCheckingHeartbeat = false;
    let heartbeatRunning = false;

    // Persist current origin if valid
    if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('about:') && !window.location.origin.startsWith('blob:')) {
        try {
            localStorage.setItem('pinpoint_entry_origin', window.location.origin);
        } catch(e) {}
    }

    // Inject Google Classroom Material Styled CSS for Canary Modals
    if (!document.getElementById('tb-canary-style')) {
        const style = document.createElement('style');
        style.id = 'tb-canary-style';
        style.textContent = `
            .tb-canary-overlay {
                display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(32, 33, 36, 0.75);
                z-index: 2147483647; flex-direction: column; justify-content: center; align-items: center;
                font-family: 'Google Sans', Roboto, Arial, sans-serif; color: #3c4043;
                padding: 24px; box-sizing: border-box; backdrop-filter: blur(3px);
            }
            .tb-canary-overlay.active { display: flex; }
            .tb-canary-card {
                background: #ffffff; width: 100%; max-width: 520px; border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35); padding: 24px; box-sizing: border-box;
                position: relative; animation: tbCanaryFade 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            @keyframes tbCanaryFade { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
            .tb-canary-header {
                display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
            }
            .tb-canary-header h2 {
                margin: 0; font-size: 20px; font-weight: 500; color: #d93025; line-height: 1.3;
                display: flex; align-items: center; gap: 8px;
            }
            .tb-canary-close-x {
                background: none; border: none; font-size: 20px; color: #5f6368; cursor: pointer;
                padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                transition: background 0.2s;
            }
            .tb-canary-close-x:hover { background: #f1f3f4; }
            .tb-canary-card p {
                margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #3c4043;
            }
            .tb-canary-alert-box {
                background-color: #fce8e6; border-left: 4px solid #d93025; padding: 12px 14px;
                border-radius: 4px; margin-bottom: 16px; font-size: 13px; color: #c5221f; font-weight: 500;
                line-height: 1.5;
            }
            .tb-canary-input-label {
                display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;
            }
            .tb-canary-input {
                width: 100%; padding: 10px 14px; margin-bottom: 16px; font-size: 14px;
                background: #f8f9fa; border: 1px solid #dadce0; color: #202124;
                border-radius: 6px; box-sizing: border-box; outline: none; font-family: monospace;
            }
            .tb-canary-input:focus { border-color: #1a73e8; background: #fff; }
            .tb-canary-actions {
                display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; margin-top: 8px;
            }
            .tb-canary-btn {
                background: none; border: 1px solid transparent; color: #1a73e8; padding: 8px 16px;
                font-weight: 500; font-size: 14px; border-radius: 6px; cursor: pointer;
                font-family: inherit; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;
            }
            .tb-canary-btn:hover { background: #e8f0fe; }
            .tb-canary-btn.btn-text-grey { color: #5f6368; }
            .tb-canary-btn.btn-text-grey:hover { background: #f1f3f4; }
            .tb-canary-btn.primary { background: #1a73e8; color: #ffffff; }
            .tb-canary-btn.primary:hover { background: #1557b0; }
            .tb-canary-btn.btn-success { background: #188038; color: #ffffff; }
            .tb-canary-btn.btn-success:hover { background: #137333; }
            .tb-canary-btn.disabled { opacity: 0.5; cursor: not-allowed; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    const FILTER_SIGNATURES = {
        securly: [
            'blocked.securly.com',
            'securly.com/blocked',
            'securly :: blocked',
            'blocked by securly',
            'securly block page',
            'access to the page you are trying to visit has been blocked by securly'
        ],
        goguardian: [
            'goguardian.com/blocked',
            'blocked by goguardian',
            'blocked by your administrator',
            'site is blocked by goguardian'
        ],
        lightspeed: [
            'lightspeed systems',
            'lsfilter.com',
            'relay.lightspeedsystems.com',
            'blocked by lightspeed'
        ],
        linewize: [
            'linewize.net/blocked',
            'blocked by linewize',
            'familyzone.com'
        ],
        generic: [
            'cisco umbrella',
            'opendns.com',
            'palo alto networks',
            'category has been blocked',
            'administrative block',
            'content filter',
            'threat detected',
            'malicious site blocked',
            'not allowed on this network'
        ]
    };

    const FORTIGUARD_BLOCKED_CAT_NUMS = [
        0, 9, 28, 29, 30, 31, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44, 46, 47, 49, 50, 51, 52, 53, 63, 75, 76, 77, 78, 79, 80,
        81, 82, 84, 92
    ];

    async function checkPublicInternet() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2500);
            const res = await fetch('https://dns.google/resolve?name=gstatic.com&t=' + Date.now(), {
                signal: controller.signal,
                cache: 'no-cache'
            });
            clearTimeout(timer);
            return res.ok;
        } catch(e) {
            return false;
        }
    }

    async function checkLinewize(domain) {
        try {
            const url = `https://mvgateway.syd-1.linewize.net/get/verdict?deviceid=PHYS-SMIC-US-0000-3190&cev=3.3.0&identity=null&requested_website=${encodeURIComponent(domain)}`;
            let res;
            try {
                res = await fetch(url, { cache: 'no-cache' });
            } catch(e) {
                res = await fetch(`/api/gateway?url=${encodeURIComponent(url)}`, { cache: 'no-cache' });
            }
            if (!res || !res.ok) return null;
            const data = await res.json();
            const cat = data?.signatures?.category || data?.signatures?.subCategory || '';
            const sig = data?.signatures?.signature || '';
            const lower = (cat + ' ' + sig).toLowerCase();
            const blockedKeywords = ['gaming', 'videogames', 'roblox', 'proxies', 'blocklist', 'anime', 'entertainment', 'socialmedia', 'crypto', 'piracy', 'p2p', 'malware', 'mature', 'gambling'];
            return {
                engine: 'Linewize',
                blocked: blockedKeywords.some(k => lower.includes(k)),
                category: data?.signatures?.subCategory || data?.signatures?.category || 'General'
            };
        } catch(e) {
            return null;
        }
    }

    async function checkFortiGuard(domain) {
        try {
            const url = 'https://www.fortiguard.com/learnmore/dns';
            const body = JSON.stringify({ value: domain, version: 9 });
            let res;
            try {
                res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });
            } catch(e) {
                res = await fetch(`/api/gateway?url=${encodeURIComponent(url)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });
            }
            if (!res || !res.ok) return null;
            const data = await res.json();
            if (data && data.dns) {
                const categoryname = data.dns.categoryname || 'Unknown';
                const rating = data.dns.rating !== undefined ? Number.parseInt(data.dns.rating, 10) : -1;
                const lowerCat = categoryname.toLowerCase();
                const blockedCats = ['games', 'proxy avoidance', 'malicious', 'phishing', 'peer-to-peer', 'pornography', 'gambling', 'weapons', 'hate', 'illegal', 'violence', 'dating', 'crypto', 'entertainment'];
                const isBlocked = FORTIGUARD_BLOCKED_CAT_NUMS.includes(rating) || blockedCats.some(c => lowerCat.includes(c));
                return {
                    engine: 'FortiGuard',
                    blocked: isBlocked,
                    category: categoryname
                };
            }
        } catch(e) {
            return null;
        }
        return null;
    }

    async function checkBlocksi(domain) {
        try {
            const url = 'https://api.blocksi.net/url-classifier-llm/predict_url';
            const body = JSON.stringify({ url: domain });
            const headers = {
                'accept': '*/*',
                'authorization': 'Basic QXp6YXo6QmxvY2tzaUthcmlt',
                'content-type': 'application/json'
            };
            let res;
            try {
                res = await fetch(url, { method: 'POST', headers, body });
            } catch(e) {
                res = await fetch(`/api/gateway?url=${encodeURIComponent(url)}`, { method: 'POST', headers, body });
            }
            if (!res || !res.ok) return null;
            const data = await res.json();
            const cat = data?.document?.predicted_specific_category || data?.predicted_specific_category || data?.document?.predicted_major_category || '';
            const blockedCats = ['games', 'streaming', 'social networking', 'adult', 'proxy', 'hacking', 'malware', 'phishing', 'weapons', 'gambling', 'drugs', 'violence'];
            return {
                engine: 'Blocksi AI',
                blocked: blockedCats.some(c => cat.toLowerCase().includes(c)),
                category: cat || 'General'
            };
        } catch(e) {
            return null;
        }
    }

    function getUserFilters() {
        try {
            const raw = localStorage.getItem('tb_canary_filters');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch(e) {}
        return ['securly'];
    }

    function getUserEmail() {
        return (localStorage.getItem('tb_canary_email') || '').trim();
    }

    function getCurrentTargetOrigin() {
        if (typeof window !== 'undefined' && window.location) {
            const loc = window.location;
            if (loc.hostname && loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1' && !loc.href.startsWith('about:') && !loc.href.startsWith('blob:') && loc.origin && loc.origin !== 'null') {
                try {
                    localStorage.setItem('pinpoint_entry_origin', loc.origin);
                } catch(e) {}
                return loc.origin;
            }
        }
        const stored = localStorage.getItem('pinpoint_entry_origin');
        if (stored && stored !== 'null' && !stored.startsWith('about:') && !stored.startsWith('blob:')) {
            return stored;
        }
        if (typeof document !== 'undefined' && document.referrer) {
            try {
                const refUrl = new URL(document.referrer);
                if (refUrl.hostname && !refUrl.hostname.includes('google.com') && !refUrl.hostname.includes('classroom.google.com')) {
                    return refUrl.origin;
                }
            } catch(e) {}
        }
        return '';
    }

    // Exact diagnostic pipeline customized to the user's checked filter engines
    async function evaluateDomain(domain, isCandidateCheck = false, customFilters = null, customEmail = null) {
        domain = domain.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].split(':')[0].trim();
        if (!domain) return { status: 'error', reason: 'Invalid domain specified' };

        // Whitelist official Google / Classroom domains
        const domainLower = domain.toLowerCase();
        if (domainLower === 'classroom.google.com' || domainLower === 'google.com' || domainLower === 'accounts.google.com' || domainLower.endsWith('.google.com')) {
            return {
                status: 'unblocked',
                code: 200,
                reason: 'HTTP 200 OK (Official Google Educational Domain)',
                filters: []
            };
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { status: 'offline', reason: 'Browser is currently offline' };
        }

        const activeFilters = customFilters || getUserFilters();
        const studentEmail = customEmail !== null ? customEmail : getUserEmail();
        const testProxyUrl = `/api/gateway?url=https://${encodeURIComponent(domain)}`;
        const testDirectUrl = `https://${domain}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500);

            // 1. Prepare external filter checks only for enabled filters
            const filterPromises = [];
            if (activeFilters.includes('linewize')) filterPromises.push(checkLinewize(domain));
            if (activeFilters.includes('fortiguard')) filterPromises.push(checkFortiGuard(domain));
            if (activeFilters.includes('blocksi')) filterPromises.push(checkBlocksi(domain));

            const [proxyRes, directRes, ...filterResultsRaw] = await Promise.all([
                fetch(testProxyUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                }).catch(e => ({ error: e })),
                fetch(testDirectUrl, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: { 'Cache-Control': 'no-cache' }
                }).catch(e => ({ error: e })),
                ...filterPromises
            ]);

            clearTimeout(timeoutId);

            const filterResults = filterResultsRaw.filter(Boolean);
            const blockedFilters = filterResults.filter(f => f.blocked);

            // 2. Check if any of user's selected external filter engines blocked the domain
            if (blockedFilters.length > 0) {
                const reasons = blockedFilters.map(f => `${f.engine}: ${f.category}`).join(', ');
                return {
                    status: 'blocked',
                    code: 403,
                    reason: `Blocked by selected school filter (${reasons})`,
                    filters: filterResults
                };
            }

            // Build active block signature list based on checked filters
            const activeSignatures = [];
            for (const filterKey of activeFilters) {
                if (FILTER_SIGNATURES[filterKey]) {
                    activeSignatures.push(...FILTER_SIGNATURES[filterKey]);
                }
            }

            // 3. Inspect proxy response
            if (proxyRes && !proxyRes.error) {
                const proxyStatus = proxyRes.status;
                if (proxyStatus === 403 || proxyStatus === 451 || proxyStatus === 401) {
                    return {
                        status: 'blocked',
                        code: proxyStatus,
                        reason: `HTTP ${proxyStatus} Access Denied / Firewall Block`,
                        filters: filterResults
                    };
                }

                const responseText = await proxyRes.text();
                // Strip scripts and comments before matching signatures
                const cleanText = responseText.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/gi, '').toLowerCase();

                for (let sig of activeSignatures) {
                    if (cleanText.includes(sig)) {
                        return {
                            status: 'blocked',
                            code: proxyStatus,
                            reason: `School filter signature detected ("${sig}")`,
                            filters: filterResults
                        };
                    }
                }

                if (proxyStatus === 200 || proxyStatus === 304) {
                    return {
                        status: 'unblocked',
                        code: proxyStatus,
                        reason: `HTTP ${proxyStatus} OK (Verified unblocked on ${activeFilters.join(', ')}${studentEmail ? ' for ' + studentEmail : ''})`,
                        filters: filterResults
                    };
                }
            }

            // 4. Direct response check
            if (directRes && !directRes.error) {
                const directStatus = directRes.status;
                if (directStatus === 403 || directStatus === 451 || directStatus === 401) {
                    return {
                        status: 'blocked',
                        code: directStatus,
                        reason: `HTTP ${directStatus} Access Denied`,
                        filters: filterResults
                    };
                }

                const responseText = await directRes.text();
                const cleanText = responseText.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/gi, '').toLowerCase();
                for (let sig of activeSignatures) {
                    if (cleanText.includes(sig)) {
                        return {
                            status: 'blocked',
                            code: directStatus,
                            reason: `School filter signature detected ("${sig}")`,
                            filters: filterResults
                        };
                    }
                }

                if (directRes.ok) {
                    return {
                        status: 'unblocked',
                        code: directStatus,
                        reason: `HTTP ${directStatus} OK (Clean direct response)`,
                        filters: filterResults
                    };
                }
            }

            // 5. Direct & proxy both failed — check device internet connectivity
            const isOnline = await checkPublicInternet();
            if (isOnline) {
                return {
                    status: 'blocked',
                    code: 0,
                    reason: `Domain unreachable or sinkholed by school DNS / filter extension`,
                    filters: filterResults
                };
            } else {
                return {
                    status: 'offline',
                    reason: `No internet connection detected on this device`,
                    filters: filterResults
                };
            }

        } catch (err) {
            return {
                status: 'blocked',
                reason: `Diagnostics check encountered error: ${err.message}`,
                filters: []
            };
        }
    }

    function createModals() {
        if (document.getElementById('tbCanaryDebug')) return;
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="tb-canary-overlay" id="tbCanaryDebug">
                <div class="tb-canary-card">
                    <div class="tb-canary-header">
                        <h2 style="color:#202124;"><span style="color:#1a73e8;">🛠️</span> Securly & Filter Diagnostics</h2>
                        <button class="tb-canary-close-x" id="tbCanaryDebugCloseX" title="Close">✕</button>
                    </div>
                    <p>Test school filter rules and domain status in real-time across your selected engines.</p>
                    <label class="tb-canary-input-label">Website Domain / URL to Test:</label>
                    <input type="text" id="tbDebugWebsite" class="tb-canary-input" placeholder="e.g. example.com or classmap.agrolujo.cl" style="font-family:inherit;">
                    <label class="tb-canary-input-label">Student Identifier / Email (Optional):</label>
                    <input type="email" id="tbDebugEmail" class="tb-canary-input" placeholder="student@school.org" style="font-family:inherit;">
                    
                    <div id="tbDebugStatusBox" style="display:none;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:13px;line-height:1.4;"></div>

                    <div class="tb-canary-actions" style="justify-content:flex-end;">
                        <button class="tb-canary-btn btn-text-grey" id="tbDebugCloseBtn">Close</button>
                        <button class="tb-canary-btn primary" id="tbDebugRunBtn">Run Test</button>
                    </div>
                </div>
            </div>
        `;
        (document.body || document.documentElement).appendChild(container);

        const debugModal = document.getElementById('tbCanaryDebug');

        // Debug modal handlers
        document.getElementById('tbCanaryDebugCloseX').addEventListener('click', () => {
            debugModal.classList.remove('active');
        });

        document.getElementById('tbDebugCloseBtn').addEventListener('click', () => {
            debugModal.classList.remove('active');
        });

        document.getElementById('tbDebugSimulateBtn').addEventListener('click', () => {
            debugModal.classList.remove('active');
            triggerBlock('Manual Securly Block Simulation from Debug Modal');
        });

        document.getElementById('tbDebugRunBtn').addEventListener('click', async () => {
            const websiteInput = document.getElementById('tbDebugWebsite');
            const debugEmailInput = document.getElementById('tbDebugEmail');
            const statusBox = document.getElementById('tbDebugStatusBox');
            const runBtn = document.getElementById('tbDebugRunBtn');

            const emailVal = debugEmailInput.value.trim();
            if (emailVal !== '') {
                localStorage.setItem('tb_canary_email', emailVal);
            }

            let raw = websiteInput.value.trim();
            if (!raw) {
                raw = getCurrentTargetOrigin() || window.location.hostname;
                websiteInput.value = raw.replace(/^https?:\/\//i, '').replace(/\/$/, '');
            }

            let domain = raw.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].split(':')[0].trim();
            if (!domain) {
                alert('Please enter a valid website domain or URL.');
                return;
            }

            statusBox.style.display = 'block';
            statusBox.style.backgroundColor = '#f1f3f4';
            statusBox.style.color = '#3c4043';
            statusBox.style.border = '1px solid #dadce0';
            statusBox.innerHTML = `Testing connection and filter response for <strong>${domain}</strong>...`;
            runBtn.disabled = true;

            try {
                const result = await evaluateDomain(domain, false, null, emailVal);
                const emailNote = emailVal ? `<div style="margin-top:6px;font-size:11px;opacity:0.85;">Policy ID / Email: ${emailVal}</div>` : '';

                let filterDetailsHtml = '';
                if (result.filters && result.filters.length > 0) {
                    filterDetailsHtml = '<div style="margin-top:10px;padding-top:8px;border-top:1px dashed rgba(0,0,0,0.15);font-size:12px;"><strong>Filter Engine Breakdown:</strong><ul style="margin:4px 0 0 0;padding-left:18px;line-height:1.6;">' +
                        result.filters.map(f => `<li><strong>${f.engine}:</strong> ${f.blocked ? '<span style="color:#c5221f;font-weight:600;">🚫 Blocked</span>' : '<span style="color:#137333;font-weight:600;">✅ Allowed</span>'} <em>(${f.category})</em></li>`).join('') +
                        '</ul></div>';
                }

                if (result.status === 'blocked') {
                    statusBox.style.backgroundColor = '#fce8e6';
                    statusBox.style.color = '#c5221f';
                    statusBox.style.border = '1px solid #fad2cf';
                    statusBox.innerHTML = `🚫 <strong>BLOCKED:</strong> <code>${domain}</code> is restricted by school filters.<div style="margin-top:4px;font-size:12px;"><strong>Reason:</strong> ${result.reason}</div>${emailNote}${filterDetailsHtml}`;
                } else if (result.status === 'offline') {
                    statusBox.style.backgroundColor = '#fef7e0';
                    statusBox.style.color = '#b06000';
                    statusBox.style.border = '1px solid #feefc3';
                    statusBox.innerHTML = `⚠️ <strong>OFFLINE:</strong> Could not connect to <code>${domain}</code> because this device is currently offline.${emailNote}`;
                } else if (result.status === 'unblocked') {
                    statusBox.style.backgroundColor = '#e6f4ea';
                    statusBox.style.color = '#137333';
                    statusBox.style.border = '1px solid #ceead6';
                    statusBox.innerHTML = `✅ <strong>UNBLOCKED:</strong> <code>${domain}</code> is accessible and clean (${result.reason}).${emailNote}${filterDetailsHtml}`;
                } else {
                    statusBox.style.backgroundColor = '#fef7e0';
                    statusBox.style.color = '#b06000';
                    statusBox.style.border = '1px solid #feefc3';
                    statusBox.innerHTML = `⚠️ <strong>Notice:</strong> ${result.reason}${emailNote}${filterDetailsHtml}`;
                }
            } catch (err) {
                statusBox.style.backgroundColor = '#fce8e6';
                statusBox.style.color = '#c5221f';
                statusBox.style.border = '1px solid #fad2cf';
                statusBox.innerHTML = `🚫 <strong>BLOCKED / ERROR:</strong> Could not reach <code>${domain}</code> (${err.message || 'connection failed'}).`;
            } finally {
                runBtn.disabled = false;
            }
        });
    }

    // Parse up to A1-A10 links from Sheet CSV
    function parseA1toA10(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        const links = [];
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const line = lines[i];
            const firstCol = line.split(',')[0].trim().replace(/^"|"$/g, '').trim();
            if (firstCol && (firstCol.includes('.') || firstCol.startsWith('http'))) {
                let url = firstCol;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                links.push(url);
            }
        }
        return links;
    }

    async function fetchNextUnblockedBackupLink() {
        const backupLinkInput = document.getElementById('tbCanaryBackupLink');
        const copyBtn = document.getElementById('tbCanaryCopyBtn');
        const openBtn = document.getElementById('tbCanaryOpenBtn');
        const alertMsg = document.getElementById('tbCanaryAlertMsg');
        const linkStatus = document.getElementById('tbCanaryLinkStatus');
        if (!backupLinkInput) return;

        backupLinkInput.value = "Scanning A1–A10 backup domains for unblocked links...";
        if (copyBtn) copyBtn.disabled = true;
        if (openBtn) openBtn.style.display = 'none';
        if (linkStatus) {
            linkStatus.style.display = 'block';
            linkStatus.textContent = 'Connecting to backup repository...';
        }

        try {
            const res = await fetch(SHEET_CSV_URL + '&t=' + Date.now(), { cache: 'no-cache' });
            if (!res.ok) throw new Error('Failed to fetch backup sheet: ' + res.status);
            const csvText = await res.text();
            const candidates = parseA1toA10(csvText);

            if (candidates.length === 0) {
                backupLinkInput.value = "(No backup links found)";
                if (alertMsg) alertMsg.innerHTML = "No backup links found in sheet. <strong>DO NOT REFRESH THIS TAB</strong> until a new link is provided.";
                if (linkStatus) linkStatus.textContent = 'Sheet returned 0 candidates.';
                return;
            }

            const currentOrigin = getCurrentTargetOrigin().replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
            const userEmail = getUserEmail();
            const userFilters = getUserFilters();

            let activeLink = null;

            // Check each candidate A1-A10 sequentially
            for (let i = 0; i < candidates.length; i++) {
                const candidate = candidates[i];
                const candDomain = candidate.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();

                // Skip if candidate is the currently blocked domain
                if (currentOrigin && (candDomain === currentOrigin || candDomain.includes(currentOrigin) || currentOrigin.includes(candDomain))) {
                    continue;
                }

                backupLinkInput.value = `Checking backup link (${i + 1}/${candidates.length}): ${candidate}...`;
                if (linkStatus) linkStatus.textContent = `Evaluating filter verdict and Securly policy for ${candidate}...`;

                const result = await evaluateDomain(candidate, true, userFilters, userEmail);
                if (result.status === 'unblocked') {
                    activeLink = candidate;
                    break;
                }
            }

            if (activeLink) {
                backupLinkInput.value = activeLink;
                if (copyBtn) copyBtn.disabled = false;
                if (openBtn) openBtn.style.display = 'inline-flex';
                if (linkStatus) {
                    linkStatus.textContent = `✅ Verified unblocked across ${userFilters.join(', ')}${userEmail ? ' for ' + userEmail : ''}.`;
                    linkStatus.style.color = '#137333';
                }
                if (alertMsg) {
                    alertMsg.innerHTML = `The domain you are using is currently blocked. <strong>DO NOT REFRESH OR CLOSE THIS TAB</strong> — your session is preserved! Below is your next unblocked backup domain:`;
                }
            } else {
                backupLinkInput.value = "(No unblocked links in A1–A10)";
                if (copyBtn) copyBtn.disabled = true;
                if (openBtn) openBtn.style.display = 'none';
                if (linkStatus) {
                    linkStatus.textContent = `❌ All ${candidates.length} candidate domains in sheet are currently blocked.`;
                    linkStatus.style.color = '#c5221f';
                }
                if (alertMsg) {
                    alertMsg.innerHTML = "All A1–A10 backup domains are currently blocked on your filters. <strong>DO NOT REFRESH THIS TAB</strong> until a new unblocked domain is deployed.";
                }
            }
        } catch (e) {
            console.error('Error fetching backup links from sheet:', e);
            backupLinkInput.value = "(No unblocked links)";
            if (copyBtn) copyBtn.disabled = true;
            if (openBtn) openBtn.style.display = 'none';
            if (linkStatus) {
                linkStatus.textContent = 'Failed to load backup candidates: ' + e.message;
                linkStatus.style.color = '#c5221f';
            }
        }
    }

    // Heartbeat & automatic popups disabled by default
    async function checkHeartbeat() {
        // Disabled: do not run automatic background checks or show popups
        return;
    }

    function triggerBlock(reason) {
        // Disabled: do not display automatic blocked modal
        console.log('Pinpoint Canary block check triggered:', reason);
    }

    async function startHeartbeatLoop() {
        return;
    }

    function startHeartbeat() {
        return;
    }

    function initCanary() {
        // Disabled: do not display initial email/welcome popup or start heartbeat loop
        return;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCanary);
    } else {
        initCanary();
    }

    window.openSecurlyDebugModal = function() {
        createModals();
        const debugModal = document.getElementById('tbCanaryDebug');
        if (debugModal) {
            const emailInput = document.getElementById('tbDebugEmail');
            const websiteInput = document.getElementById('tbDebugWebsite');
            const statusBox = document.getElementById('tbDebugStatusBox');
            if (emailInput) {
                emailInput.value = getUserEmail();
            }
            if (websiteInput && !websiteInput.value) {
                const entryOrigin = getCurrentTargetOrigin() || window.location.hostname;
                websiteInput.value = entryOrigin.replace(/^https?:\/\//i, '').replace(/\/$/, '');
            }
            if (statusBox) statusBox.style.display = 'none';
            debugModal.classList.add('active');
        }
    };

    window.isCurrentDomainBlocked = () => isBlocked;
    window.simulateBlock = () => triggerBlock('Manual Securly Block Simulation');
    window.testCanary = () => triggerBlock('Manual Securly Block Simulation');
})();
