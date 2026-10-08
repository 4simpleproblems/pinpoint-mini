(function(global) {
    const KEY = 0x7E; // XOR key for lightweight reversible string encryption

    function encryptText(str) {
        if (!str || typeof str !== 'string') return str;
        if (str.startsWith('ENC::')) return str;
        try {
            const charCodes = Array.from(str).map(c => c.charCodeAt(0) ^ KEY);
            const b64 = btoa(String.fromCharCode.apply(null, charCodes));
            return 'ENC::' + b64;
        } catch(e) {
            return str;
        }
    }

    function decryptText(encStr) {
        if (!encStr || typeof encStr !== 'string') return encStr;
        if (!encStr.startsWith('ENC::')) return encStr;
        try {
            const rawB64 = encStr.slice(5);
            const decodedChars = atob(rawB64);
            const decrypted = Array.from(decodedChars).map(c => String.fromCharCode(c.charCodeAt(0) ^ KEY)).join('');
            return decrypted;
        } catch(e) {
            return encStr;
        }
    }

    function encryptUrl(url) {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('ENCURL::')) return url;
        try {
            const charCodes = Array.from(url).map(c => c.charCodeAt(0) ^ 0x4B);
            const b64 = btoa(String.fromCharCode.apply(null, charCodes));
            return 'ENCURL::' + b64;
        } catch(e) {
            return url;
        }
    }

    function decryptUrl(encUrl) {
        if (!encUrl || typeof encUrl !== 'string') return encUrl;
        if (!encUrl.startsWith('ENCURL::')) return encUrl;
        try {
            const rawB64 = encUrl.slice(8);
            const decodedChars = atob(rawB64);
            const decrypted = Array.from(decodedChars).map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x4B)).join('');
            return decrypted;
        } catch(e) {
            return encUrl;
        }
    }

    global.PinpointCrypto = {
        encryptText: encryptText,
        decryptText: decryptText,
        encryptUrl: encryptUrl,
        decryptUrl: decryptUrl
    };

})(typeof window !== 'undefined' ? window : globalThis);
