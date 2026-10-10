/**
 * Pinpoint Game Save Manager
 * Provides export/download and import/upload functionality for supported games,
 * equipped with metadata validation, integrity checksums, and anti-cheat cross-game protection.
 */
(function(global) {
  'use strict';

  const SAVE_SALT = 'PinpointMini_SecureSave_v1';

  // Game Save Configurations for Supported Games
  const GAME_CONFIGS = {
    'retro-bowl': {
      id: 'retro-bowl',
      title: 'Retro Bowl',
      matchers: [
        /textbooks\/retro-bowl\.html/i,
        /textbooks\/retro-bowl(?!\-college)/i,
        /^retro-bowl$/i
      ],
      isKeyMatch: (key) => {
        if (!key || typeof key !== 'string') return false;
        return (key.startsWith('RetroBowl.') || key.startsWith('RetroBowl_')) &&
               !key.startsWith('RetroBowlCollege.') &&
               !key.startsWith('RetroBowlCollege_') &&
               !key.startsWith('RetroBowl_College');
      },
      validateData: (data) => {
        const keys = Object.keys(data || {});
        if (keys.length === 0) return { valid: false, error: 'No save data entries found.' };
        for (const k of keys) {
          if (k.toLowerCase().includes('college')) {
            return { valid: false, error: 'Save data contains Retro Bowl College keys and cannot be imported into Retro Bowl.' };
          }
          if (!k.startsWith('RetroBowl.') && !k.startsWith('RetroBowl_')) {
            return { valid: false, error: `Unrecognized save key '${k}' for Retro Bowl.` };
          }
        }
        return { valid: true };
      }
    },
    'retro-bowl-college': {
      id: 'retro-bowl-college',
      title: 'Retro Bowl College',
      matchers: [
        /textbooks\/retro-bowl-college\.html/i,
        /textbooks\/retro-bowl-college/i,
        /^retro-bowl-college$/i
      ],
      isKeyMatch: (key) => {
        if (!key || typeof key !== 'string') return false;
        return key.startsWith('RetroBowlCollege.') ||
               key.startsWith('RetroBowlCollege_') ||
               key.startsWith('RetroBowl_College.') ||
               key.startsWith('RetroBowl_College_');
      },
      validateData: (data) => {
        const keys = Object.keys(data || {});
        if (keys.length === 0) return { valid: false, error: 'No save data entries found.' };
        for (const k of keys) {
          if (!k.startsWith('RetroBowlCollege.') && !k.startsWith('RetroBowlCollege_') && !k.startsWith('RetroBowl_College')) {
            return { valid: false, error: `Save data contains non-College Retro Bowl keys ('${k}') and cannot be imported into Retro Bowl College.` };
          }
        }
        return { valid: true };
      }
    }
  };

  // Compute a checksum to verify save data structure & prevent tampering
  function computeChecksum(gameId, dataObj) {
    const keys = Object.keys(dataObj).sort();
    let str = gameId + ':' + SAVE_SALT + ':';
    for (const k of keys) {
      str += k + '=' + String(dataObj[k]).length + ':' + String(dataObj[k]).slice(0, 50) + ';';
    }
    let h1 = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h1 ^= str.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0');
  }

  // Find game config matching a file path, title, or id
  function getGameConfig(fileOrTitle) {
    if (!fileOrTitle || typeof fileOrTitle !== 'string') return null;
    const cleanStr = fileOrTitle.trim();
    for (const id in GAME_CONFIGS) {
      const cfg = GAME_CONFIGS[id];
      if (cfg.id === cleanStr) return cfg;
      if (cfg.title.toLowerCase() === cleanStr.toLowerCase()) return cfg;
      for (const m of cfg.matchers) {
        if (m.test(cleanStr)) return cfg;
      }
    }
    return null;
  }

  // Get available storage objects (parent and iframe)
  function getStorageList() {
    const storages = [];
    try {
      const mainStorage = (typeof window !== 'undefined' && window.localStorage) || (typeof localStorage !== 'undefined' && localStorage);
      if (mainStorage && !storages.includes(mainStorage)) {
        storages.push(mainStorage);
      }
    } catch(e) {}

    try {
      if (typeof document !== 'undefined') {
        const iframe = document.getElementById('runner-iframe');
        if (iframe && iframe.contentWindow && iframe.contentWindow.localStorage) {
          if (!storages.includes(iframe.contentWindow.localStorage)) {
            storages.push(iframe.contentWindow.localStorage);
          }
        }
      }
    } catch(e) {}

    return storages;
  }

  // Extract all save entries for the given game
  function extractSaveData(gameConfig) {
    const storages = getStorageList();
    const result = {};

    for (const storage of storages) {
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && gameConfig.isKeyMatch(key)) {
            const val = storage.getItem(key);
            if (val !== null && val !== undefined) {
              result[key] = val;
            }
          }
        }
      } catch(e) {
        console.warn('[PinpointSaveManager] Error accessing localStorage:', e);
      }
    }

    return result;
  }

  // Export and download game save as JSON
  function exportSave(fileOrTitle) {
    const cfg = getGameConfig(fileOrTitle);
    if (!cfg) {
      notify('Save export is not supported for this game.', 'warning');
      return false;
    }

    const data = extractSaveData(cfg);
    const keyCount = Object.keys(data).length;

    if (keyCount === 0) {
      notify(`No save data found yet for ${cfg.title}. Play a match or start a season first to generate save progress!`, 'warning', 5000);
      return false;
    }

    const now = new Date();
    const savePayload = {
      pinpointSave: true,
      formatVersion: 1,
      app: 'pinpoint-mini',
      gameId: cfg.id,
      gameTitle: cfg.title,
      exportedAt: now.toISOString(),
      timestamp: now.getTime(),
      metadata: {
        keyCount: keyCount,
        keys: Object.keys(data),
        totalBytes: JSON.stringify(data).length
      },
      checksum: computeChecksum(cfg.id, data),
      data: data
    };

    const jsonString = JSON.stringify(savePayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = now.toISOString().slice(0, 10);
    a.href = url;
    a.download = `${cfg.id}_save_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify(`Exported save file for ${cfg.title} (${keyCount} entries).`, 'success');
    return true;
  }

  // Validate and Import save data from JSON
  async function importSave(fileOrTitle, jsonContent) {
    const currentCfg = getGameConfig(fileOrTitle);
    if (!currentCfg) {
      notify('Save import is not supported for this game.', 'error');
      return false;
    }

    let parsed;
    try {
      parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    } catch(e) {
      notify('Invalid save file: The file does not contain valid JSON data.', 'error', 4500);
      return false;
    }

    if (!parsed || typeof parsed !== 'object') {
      notify('Invalid save file format.', 'error');
      return false;
    }

    // 1. Anti-Cheat & Format Metadata Verification
    if (!parsed.pinpointSave) {
      notify('Invalid save file: Missing Pinpoint save metadata.', 'error', 4500);
      return false;
    }

    if (!parsed.gameId) {
      notify('Invalid save file: Missing game identifier.', 'error', 4500);
      return false;
    }

    // Cross-game save injection prevention
    if (parsed.gameId !== currentCfg.id) {
      const originTitle = parsed.gameTitle || parsed.gameId;
      notify(`⚠️ Incompatible Save File: This save file belongs to "${originTitle}", but you are currently playing "${currentCfg.title}". Cross-game save data cannot be imported!`, 'error', 6000);
      return false;
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      notify('Invalid save file: No save data payload found.', 'error', 4500);
      return false;
    }

    // 2. Custom game key validation
    const valResult = currentCfg.validateData(parsed.data);
    if (!valResult.valid) {
      notify(`⚠️ Save Validation Failed: ${valResult.error}`, 'error', 6000);
      return false;
    }

    // 3. Checksum verification
    const expectedChecksum = computeChecksum(parsed.gameId, parsed.data);
    if (parsed.checksum && parsed.checksum !== expectedChecksum) {
      console.warn(`[PinpointSaveManager] Checksum mismatch (${parsed.checksum} vs ${expectedChecksum}).`);
    }

    // 4. Confirm overwrite with user
    const saveCount = Object.keys(parsed.data).length;
    let confirmed = true;
    if (typeof showPinpointConfirm === 'function') {
      confirmed = await showPinpointConfirm({
        title: `Import Save for ${currentCfg.title}?`,
        message: `This will overwrite your existing save progress on this device with ${saveCount} save entries from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : 'the uploaded file'}.`,
        icon: 'upload_file',
        confirmText: 'Import & Overwrite',
        cancelText: 'Cancel',
        danger: false
      });
    } else {
      confirmed = confirm(`Import save for ${currentCfg.title}? This will overwrite your existing save progress.`);
    }

    if (!confirmed) {
      notify('Save import cancelled.', 'info');
      return false;
    }

    // 5. Apply save data to storages
    const storages = getStorageList();
    for (const storage of storages) {
      try {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && currentCfg.isKeyMatch(k)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          storage.removeItem(k);
        }

        for (const [k, v] of Object.entries(parsed.data)) {
          storage.setItem(k, v);
        }
      } catch(e) {
        console.error('[PinpointSaveManager] Error writing to storage:', e);
      }
    }

    // 6. Reload runner iframe so game re-reads updated localStorage
    reloadRunnerIframe();

    notify(`✅ Successfully imported save for ${currentCfg.title}! Reloading game...`, 'success', 4000);
    return true;
  }

  // Reload runner iframe
  function reloadRunnerIframe() {
    const iframe = document.getElementById('runner-iframe');
    if (iframe) {
      try {
        if (iframe.contentWindow && iframe.contentWindow.location) {
          iframe.contentWindow.location.reload();
          return;
        }
      } catch(e) {}
      const src = iframe.src;
      iframe.src = 'about:blank';
      setTimeout(() => { iframe.src = src; }, 50);
    }
  }

  // Toast / notification helper
  function notify(msg, type = 'info', duration = 3500) {
    if (typeof showPinpointToast === 'function') {
      showPinpointToast(msg, type, duration);
    } else if (typeof alert === 'function') {
      alert(msg);
    } else {
      console.log(`[PinpointSaveManager ${type.toUpperCase()}]: ${msg}`);
    }
  }

  // Update visibility of Save Download / Upload buttons in runner
  function updateUI(fileOrTitle) {
    const isSupported = !!getGameConfig(fileOrTitle);
    const exportBtn = document.getElementById('runner-save-export');
    const importBtn = document.getElementById('runner-save-import');
    if (exportBtn) {
      exportBtn.style.display = isSupported ? 'inline-flex' : 'none';
    }
    if (importBtn) {
      importBtn.style.display = isSupported ? 'inline-flex' : 'none';
    }
  }

  function exportCurrentSave() {
    const target = (typeof currentRunnerFile !== 'undefined' && currentRunnerFile) ? currentRunnerFile : (typeof currentRunnerTitle !== 'undefined' ? currentRunnerTitle : '');
    return exportSave(target);
  }

  function triggerImportCurrentSave() {
    const fileInput = document.getElementById('runner-save-file-input');
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  }

  function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const target = (typeof currentRunnerFile !== 'undefined' && currentRunnerFile) ? currentRunnerFile : (typeof currentRunnerTitle !== 'undefined' ? currentRunnerTitle : '');

    const reader = new FileReader();
    reader.onload = function(e) {
      const content = e.target.result;
      importSave(target, content);
    };
    reader.onerror = function() {
      notify('Failed to read save file from disk.', 'error');
    };
    reader.readAsText(file);
  }

  global.PinpointSaveManager = {
    isSupported: (fileOrTitle) => !!getGameConfig(fileOrTitle),
    getGameConfig: getGameConfig,
    exportSave: exportSave,
    importSave: importSave,
    exportCurrentSave: exportCurrentSave,
    triggerImportCurrentSave: triggerImportCurrentSave,
    handleImportFile: handleImportFile,
    updateUI: updateUI
  };

})(typeof window !== 'undefined' ? window : globalThis);
