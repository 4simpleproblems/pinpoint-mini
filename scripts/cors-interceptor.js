/**
 * CORS & Telemetry Interceptor for Pinpoint Edu
 * Intercepts Google Classroom telemetry and cross-origin logging to eliminate CORS errors
 * and suppresses closure module logging errors.
 */
(function () {
    // 1. Force disable reporting in ppConfig if defined or when defined
    if (!window['ppConfig']) {
        window['ppConfig'] = {};
    }
    window['ppConfig'].disableAllReporting = true;
    window['ppConfig'].deleteIsEnforced = false;
    window['ppConfig'].sealIsEnforced = false;

    function isRestrictedUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return url.includes('classroom.google.com/log') ||
               url.includes('play.google.com/log') ||
               url.includes('RotateCookiesPage') ||
               url.includes('google.com/log') ||
               url.includes('csp/proto') ||
               url.includes('google-analytics.com');
    }

    // 2. Intercept XMLHttpRequest
    if (typeof XMLHttpRequest !== 'undefined') {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            this._isIntercepted = isRestrictedUrl(url);
            this._originalTargetUrl = url;
            if (this._isIntercepted) {
                return origOpen.call(this, 'GET', 'data:application/json,{}', true);
            }
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (body) {
            if (this._isIntercepted) {
                return origSend.call(this, null);
            }
            return origSend.apply(this, arguments);
        };
    }

    // 3. Intercept Fetch API
    if (typeof window.fetch !== 'undefined') {
        const origFetch = window.fetch;
        window.fetch = function (input, init) {
            let url = '';
            if (typeof input === 'string') {
                url = input;
            } else if (input && input.url) {
                url = input.url;
            }

            if (isRestrictedUrl(url)) {
                return Promise.resolve(new Response('{}', {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            return origFetch.apply(this, arguments);
        };
    }

    // 4. Intercept Beacon API
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const origBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url, data) {
            if (isRestrictedUrl(url)) {
                return true;
            }
            return origBeacon(url, data);
        };
    }

    // 5. Intercept iframe src setter for RotateCookiesPage
    if (typeof HTMLIFrameElement !== 'undefined') {
        const iframeDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
        if (iframeDesc && iframeDesc.set) {
            Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
                set: function (val) {
                    if (isRestrictedUrl(val)) {
                        return iframeDesc.set.call(this, 'about:blank');
                    }
                    return iframeDesc.set.call(this, val);
                },
                get: function () {
                    return iframeDesc.get.call(this);
                }
            });
        }
    }

    // 6. Suppress uncaught closure errors related to logging / RotateCookies
    window.addEventListener('error', function (e) {
        if (e && e.message && (e.message.includes('pa') || e.message.includes('RotateCookiesPage') || e.message.includes('_ModuleManager'))) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            return true;
        }
    }, true);
})();
