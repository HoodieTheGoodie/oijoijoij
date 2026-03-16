// ==UserScript==
// @name         Rhythm+ v2 Store Mod
// @namespace    rhythm-plus-v2-mod
// @version      3.0
// @description  Runtime mod for Rhythm+ v2 using the real Nuxt/Pinia stores.
// @author       GitHub Copilot
// @match        https://v2.rhythm-plus.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PAGE_WINDOW = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const MOD_ID = 'rhythm-plus-store-mod';
  const MOD_STYLE_ID = 'rhythm-plus-store-mod-style';
  const STATE_KEY = 'rhythm_plus_store_mod_state';
  const DRAG_KEY = 'rhythm_plus_store_mod_pos';
  const USER_STORE_ID = 'user';
  const CONFIG_STORE_ID = 'config';

  const DEFAULT_PERF_OPTIONS = {
    lowQualityMode: true,
    disableAnimations: true,
    disableVisualizer: true,
    forceFloatingBga: true,
    dimBackgroundHard: true,
    disableAccuracyBar: true,
    disableConfetti: true,
    hideBgaCss: true
  };

  const DEFAULT_STATE = {
    lowSpecMode: true,
    removeBgaCss: true,
    unlockSkins: true,
    selectedSkinId: '',
    noteColor: '#ffff00',
    trackColor: '#212121',
    trackHitColor: '#ffff00',
    leftNoteColor: '#ff4d4d',
    downNoteColor: '#4d9cff',
    upNoteColor: '#50d890',
    rightNoteColor: '#ff9f43',
    longNoteColor: '#7c3aed',
    longNoteTailColor: '#c084fc',
    simplisticSkinMode: false,
    minimized: false,
    activeTab: 'performance',
    perfAdvancedOpen: false,
    perfOptions: { ...DEFAULT_PERF_OPTIONS },
    unlockFps: true,
    fpsLimit: 0,
    skinPresets: {},
    uiTheme: 'dark',
    uiDisableEffects: false,
    uiDisableAnimations: false
  };

  function loadValue(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') {
        return GM_getValue(key, fallback);
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] Failed to read GM value:', error);
    }

    try {
      const raw = PAGE_WINDOW.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveValue(key, value) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
        return;
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] Failed to write GM value:', error);
    }

    try {
      PAGE_WINDOW.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[Rhythm+ Mod] Failed to write local value:', error);
    }
  }

  const mergedPrefs = { ...DEFAULT_STATE, ...loadValue(STATE_KEY, DEFAULT_STATE) };
  mergedPrefs.perfOptions = { ...DEFAULT_PERF_OPTIONS, ...(mergedPrefs.perfOptions || {}) };
  if (!mergedPrefs.skinPresets || typeof mergedPrefs.skinPresets !== 'object') {
    mergedPrefs.skinPresets = {};
  }
  if (!mergedPrefs.uiTheme) {
    mergedPrefs.uiTheme = 'dark';
  }
  if (typeof mergedPrefs.uiDisableEffects !== 'boolean') {
    mergedPrefs.uiDisableEffects = false;
  }
  if (typeof mergedPrefs.uiDisableAnimations !== 'boolean') {
    mergedPrefs.uiDisableAnimations = false;
  }

  const modState = {
    prefs: mergedPrefs,
    position: loadValue(DRAG_KEY, { top: 20, right: 20, left: null }),
    logLines: [],
    selectedPreviewPart: 'leftNoteColor',
    selectedAssetIndex: 0,
    tintedPreviewCache: new Map(),
    applySkinTimer: null,
    suppressRestoreClick: false,
    pinnedUserStore: null,
    pinnedConfigStore: null,
    reapplyTimer: null,
    unlockTimer: null
  };

  function log(message) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' + message;
    modState.logLines.unshift(line);
    modState.logLines = modState.logLines.slice(0, 40);
    const logBox = document.getElementById('rp-store-mod-log');
    if (logBox) {
      logBox.textContent = modState.logLines.join('\n');
    }
    console.log('[Rhythm+ Mod]', message);
  }

  function persistPrefs() {
    saveValue(STATE_KEY, modState.prefs);
  }

  function persistPosition() {
    saveValue(DRAG_KEY, modState.position);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultSkinPreset() {
    return {
      noteColor: '#ffff00',
      trackColor: '#212121',
      trackHitColor: '#ffff00',
      leftNoteColor: '#ff4d4d',
      downNoteColor: '#4d9cff',
      upNoteColor: '#50d890',
      rightNoteColor: '#ff9f43',
      longNoteColor: '#7c3aed',
      longNoteTailColor: '#c084fc',
      simplisticSkinMode: false
    };
  }

  function readSkinDefaultColors(userStore, skinId) {
    const fallback = createDefaultSkinPreset();
    if (!userStore) {
      return fallback;
    }

    const appearance = userStore.preferences && userStore.preferences.appearance
      ? userStore.preferences.appearance
      : {};
    const skinPrefs = appearance.gameSkinPrefs && appearance.gameSkinPrefs[skinId]
      ? appearance.gameSkinPrefs[skinId]
      : {};
    const skin = Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null;

    const skinColors = skin && skin.colors && typeof skin.colors === 'object' ? skin.colors : {};
    const laneColors = skinColors.lanes && typeof skinColors.lanes === 'object' ? skinColors.lanes : {};
    const holdColors = skinColors.hold && typeof skinColors.hold === 'object' ? skinColors.hold : {};
    const noteArray = Array.isArray(skin.noteColors)
      ? skin.noteColors
      : (Array.isArray(skin.arrowColors) ? skin.arrowColors : null);
    const prefNoteArray = Array.isArray(skinPrefs.noteColors)
      ? skinPrefs.noteColors
      : (Array.isArray(skinPrefs.arrowColors) ? skinPrefs.arrowColors : null);

    return {
      noteColor: skin.noteColor || skinColors.note || skinPrefs.noteColor || appearance.noteColor || fallback.noteColor,
      trackColor: skin.trackColor || skinColors.track || skinPrefs.trackColor || appearance.trackColor || fallback.trackColor,
      trackHitColor: skin.trackHitColor || skinColors.trackHit || skinPrefs.trackHitColor || appearance.trackHitColor || fallback.trackHitColor,
      leftNoteColor: laneColors.left || (noteArray && noteArray[0]) || skin.leftNoteColor || skinPrefs.leftNoteColor || (prefNoteArray && prefNoteArray[0]) || fallback.leftNoteColor,
      downNoteColor: laneColors.down || (noteArray && noteArray[1]) || skin.downNoteColor || skinPrefs.downNoteColor || (prefNoteArray && prefNoteArray[1]) || fallback.downNoteColor,
      upNoteColor: laneColors.up || (noteArray && noteArray[2]) || skin.upNoteColor || skinPrefs.upNoteColor || (prefNoteArray && prefNoteArray[2]) || fallback.upNoteColor,
      rightNoteColor: laneColors.right || (noteArray && noteArray[3]) || skin.rightNoteColor || skinPrefs.rightNoteColor || (prefNoteArray && prefNoteArray[3]) || fallback.rightNoteColor,
      longNoteColor: holdColors.head || skin.sustainColor || skin.longNoteColor || skinPrefs.longNoteColor || skinPrefs.sustainColor || fallback.longNoteColor,
      longNoteTailColor: holdColors.tail || skin.sustainTailColor || skin.longNoteTailColor || skinPrefs.longNoteTailColor || skinPrefs.sustainTailColor || fallback.longNoteTailColor,
      simplisticSkinMode: false
    };
  }

  function getSkinPreset(skinId) {
    if (!modState.prefs.skinPresets || typeof modState.prefs.skinPresets !== 'object') {
      modState.prefs.skinPresets = {};
    }

    if (!modState.prefs.skinPresets[skinId]) {
      modState.prefs.skinPresets[skinId] = readSkinDefaultColors(getUserStore(), skinId);
    }

    return modState.prefs.skinPresets[skinId];
  }

  function rebuildSkinPresetsFromDefaults() {
    const userStore = getUserStore();
    if (!userStore || !Array.isArray(userStore.skins) || userStore.skins.length === 0) {
      modState.prefs.skinPresets = {};
      return;
    }

    const next = {};
    userStore.skins.forEach((skin) => {
      if (!skin || !skin.id) return;
      next[skin.id] = readSkinDefaultColors(userStore, skin.id);
    });
    modState.prefs.skinPresets = next;
  }

  function applyPresetToUiState(preset) {
    modState.prefs.noteColor = preset.noteColor;
    modState.prefs.trackColor = preset.trackColor;
    modState.prefs.trackHitColor = preset.trackHitColor;
    modState.prefs.leftNoteColor = preset.leftNoteColor;
    modState.prefs.downNoteColor = preset.downNoteColor;
    modState.prefs.upNoteColor = preset.upNoteColor;
    modState.prefs.rightNoteColor = preset.rightNoteColor;
    modState.prefs.longNoteColor = preset.longNoteColor;
    modState.prefs.longNoteTailColor = preset.longNoteTailColor;
    modState.prefs.simplisticSkinMode = !!preset.simplisticSkinMode;
  }

  function saveUiStateToPreset(skinId) {
    const preset = getSkinPreset(skinId);
    preset.noteColor = modState.prefs.noteColor;
    preset.trackColor = modState.prefs.trackColor;
    preset.trackHitColor = modState.prefs.trackHitColor;
    preset.leftNoteColor = modState.prefs.leftNoteColor;
    preset.downNoteColor = modState.prefs.downNoteColor;
    preset.upNoteColor = modState.prefs.upNoteColor;
    preset.rightNoteColor = modState.prefs.rightNoteColor;
    preset.longNoteColor = modState.prefs.longNoteColor;
    preset.longNoteTailColor = modState.prefs.longNoteTailColor;
    preset.simplisticSkinMode = !!modState.prefs.simplisticSkinMode;
  }

  function syncUiStateToSelectedSkin() {
    const userStore = getUserStore();
    const skinId = modState.prefs.selectedSkinId
      || (userStore && userStore.preferences && userStore.preferences.appearance && userStore.preferences.appearance.gameSkin)
      || 'canvas';
    const liveState = readSkinDefaultColors(userStore, skinId);
    modState.prefs.skinPresets[skinId] = deepClone(liveState);
    applyPresetToUiState(liveState);
  }

  function resolveSelectedSkinId() {
    const userStore = getUserStore();
    return modState.prefs.selectedSkinId
      || (userStore && userStore.preferences && userStore.preferences.appearance && userStore.preferences.appearance.gameSkin)
      || 'canvas';
  }

  function pullActiveSkinFromStore() {
    const userStore = getUserStore();
    if (!userStore || !userStore.preferences || !userStore.preferences.appearance) {
      return false;
    }

    const activeSkinId = userStore.preferences.appearance.gameSkin;
    if (!activeSkinId || activeSkinId === modState.prefs.selectedSkinId) {
      return false;
    }

    modState.prefs.selectedSkinId = activeSkinId;
    syncUiStateToSelectedSkin();
    persistPrefs();
    log('Detected active skin: ' + activeSkinId + '. Loaded its preset.');
    return true;
  }

  function getPreviewPartMap() {
    return {
      leftNoteColor: 'Left Note',
      downNoteColor: 'Down Note',
      upNoteColor: 'Up Note',
      rightNoteColor: 'Right Note',
      longNoteColor: 'Long Note',
      longNoteTailColor: 'Long Note Tail',
      noteColor: 'Global Note',
      trackHitColor: 'Track Hit',
      trackColor: 'Track'
    };
  }

  function inferPreviewShapeClass() {
    const userStore = getUserStore();
    const skinId = (modState.prefs.selectedSkinId || '').toLowerCase();
    const skin = userStore && Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === modState.prefs.selectedSkinId)
      : null;
    const title = (skin && skin.title ? skin.title : '').toLowerCase();
    const probe = skinId + ' ' + title;

    if (probe.includes('circle') || probe.includes('funky')) {
      return 'shape-circle';
    }
    if (probe.includes('classic') || probe.includes('pixel') || probe.includes('block')) {
      return 'shape-square';
    }
    return 'shape-diamond';
  }

  function collectSkinAssetUrls(value, out, depth) {
    if (!value || depth > 5 || out.length >= 24) {
      return;
    }

    if (typeof value === 'string') {
      const maybeAsset = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(value)
        || value.startsWith('data:image/')
        || value.includes('/assets/');
      if (maybeAsset) {
        out.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((item) => collectSkinAssetUrls(item, out, depth + 1));
      return;
    }

    if (typeof value === 'object') {
      Object.values(value).slice(0, 40).forEach((item) => collectSkinAssetUrls(item, out, depth + 1));
    }
  }

  function isLikelyNoteAssetUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    const probe = url.toLowerCase();
    const isImage = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(url)
      || probe.startsWith('data:image/');
    if (!isImage) {
      return false;
    }

    const excluded = [
      'logo',
      'wordmark',
      'avatar',
      'banner',
      'cover',
      'profile',
      'icon',
      'brand',
      'rhythm-plus',
      'long',
      'hold',
      'tail',
      'sustain',
      'trail',
      'beam',
      'line',
      'lane',
      'body',
      'cap',
      'end'
    ];
    if (excluded.some((word) => probe.includes(word))) {
      return false;
    }

    return true;
  }

  function getSkinAssetUrlsFromDom() {
    const allTextNodes = Array.from(document.querySelectorAll('*'));
    const titleNode = allTextNodes.find((node) => (node.textContent || '').trim() === 'Skin Assets');
    if (!titleNode) {
      return [];
    }

    const root = titleNode.closest('section, div, aside') || titleNode.parentElement;
    if (!root) {
      return [];
    }

    const urls = Array.from(root.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src || '')
      .filter(Boolean)
      .filter((url) => isLikelyNoteAssetUrl(url));

    if (urls.length > 0) {
      return Array.from(new Set(urls)).slice(0, 8);
    }

    // Avoid loose document-wide fallback so logos/navigation images are never pulled into preview.
    return [];
  }

  function getSkinAssetUrls(skinId) {
    const domUrls = getSkinAssetUrlsFromDom();
    if (domUrls.length > 0) {
      return domUrls;
    }

    const userStore = getUserStore();
    const skin = userStore && Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null;

    if (!skin) {
      return [];
    }

    const urls = [];
    collectSkinAssetUrls(skin, urls, 0);
    return Array.from(new Set(urls)).filter((url) => isLikelyNoteAssetUrl(url)).slice(0, 8);
  }

  function setPreviewSelection(partKey) {
    const preview = document.querySelector('[data-mod="skin-preview"]');
    if (!preview) {
      return;
    }

    const selectableParts = {
      leftNoteColor: true,
      downNoteColor: true,
      upNoteColor: true,
      rightNoteColor: true,
      longNoteColor: true,
      longNoteTailColor: true
    };
    const partMap = getPreviewPartMap();
    modState.selectedPreviewPart = selectableParts[partKey] ? partKey : 'leftNoteColor';

    preview.querySelectorAll('[data-part]').forEach((node) => {
      node.classList.toggle('is-selected', node.getAttribute('data-part') === modState.selectedPreviewPart);
    });

    const selectedLabel = document.querySelector('[data-mod="selected-note-label"]');
    const selectedPicker = document.querySelector('[data-mod="selected-note-color"]');
    if (selectedLabel) {
      selectedLabel.textContent = partMap[modState.selectedPreviewPart] || 'Selected Note';
    }
    if (selectedPicker && modState.prefs[modState.selectedPreviewPart]) {
      selectedPicker.value = modState.prefs[modState.selectedPreviewPart];
    }
  }

  function getTintedAssetUrl(assetUrl, color) {
    if (!assetUrl || !color) {
      return Promise.resolve(assetUrl || '');
    }

    const cacheKey = assetUrl + '|' + color;
    if (modState.tintedPreviewCache.has(cacheKey)) {
      return modState.tintedPreviewCache.get(cacheKey);
    }

    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 64;
          canvas.height = img.naturalHeight || img.height || 64;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(assetUrl);
            return;
          }

          // Base sprite
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Apply selected color only where note pixels exist.
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = 0.72;
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Blend sprite details back in so texture remains readable.
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.5;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          resolve(assetUrl);
        }
      };

      img.onerror = () => resolve(assetUrl);
      img.src = assetUrl;
    });

    modState.tintedPreviewCache.set(cacheKey, promise);
    return promise;
  }

  function applyLanePreviewTint(previewRoot, laneParts, assetUrls, colorMap) {
    const laneButtons = previewRoot.querySelectorAll('.rp-preview-note[data-part]');
    laneButtons.forEach((button, index) => {
      const part = button.getAttribute('data-part') || laneParts[index] || laneParts[0];
      const img = button.querySelector('img');
      if (!img) {
        return;
      }

      const baseUrl = img.getAttribute('data-base-src') || img.src;
      const color = colorMap[part] || colorMap.noteColor || '#ffffff';
      getTintedAssetUrl(baseUrl, color).then((tintedUrl) => {
        if (img.isConnected) {
          img.src = tintedUrl || baseUrl;
        }
      });
    });
  }

  function renderSkinPreview() {
    const preview = document.querySelector('[data-mod="skin-preview"]');
    if (!preview) {
      return;
    }

    preview.classList.remove('shape-circle', 'shape-square', 'shape-diamond');
    preview.classList.add('shape-square');

    const skinId = resolveSelectedSkinId();
    const assetUrls = getSkinAssetUrls(skinId);
    const laneParts = ['leftNoteColor', 'downNoteColor', 'upNoteColor', 'rightNoteColor'];
    const activeLaneIndex = Math.max(0, laneParts.indexOf(modState.selectedPreviewPart));
    modState.selectedAssetIndex = Math.min(activeLaneIndex, Math.max(0, assetUrls.length - 1));
    const assetsBox = document.querySelector('[data-mod="skin-preview-assets"]');
    if (assetsBox) {
      assetsBox.innerHTML = assetUrls.length
        ? assetUrls.map((url, index) => {
          const lanePart = laneParts[index % laneParts.length];
          const selected = lanePart === modState.selectedPreviewPart ? ' is-selected' : '';
          return '<button class="rp-asset-thumb' + selected + '" data-asset-index="' + index + '" data-part="' + lanePart + '" type="button"><img src="' + url + '" alt="asset"></button>';
        }).join('')
        : '<div class="rp-store-mod-note">No direct asset URLs found for this skin. Using color-only preview.</div>';
    }

    const stageLanes = preview.querySelector('[data-mod="skin-preview-stage-lanes"]');
    if (stageLanes) {
      stageLanes.innerHTML = laneParts.map((part, index) => {
        const assetUrl = assetUrls[index % Math.max(1, assetUrls.length)];
        const asset = assetUrl ? '<img src="' + assetUrl + '" data-base-src="' + assetUrl + '" alt="note">' : '';
        return '<button class="rp-preview-note" data-part="' + part + '" title="' + part + '">' + asset + '</button>';
      }).join('');
    }

    const colorMap = {
      leftNoteColor: modState.prefs.leftNoteColor,
      downNoteColor: modState.prefs.downNoteColor,
      upNoteColor: modState.prefs.upNoteColor,
      rightNoteColor: modState.prefs.rightNoteColor,
      longNoteColor: modState.prefs.longNoteColor,
      longNoteTailColor: modState.prefs.longNoteTailColor,
      noteColor: modState.prefs.noteColor,
      trackColor: modState.prefs.trackColor,
      trackHitColor: modState.prefs.trackHitColor
    };

    applyLanePreviewTint(preview, laneParts, assetUrls, colorMap);

    Object.keys(colorMap).forEach((part) => {
      const node = preview.querySelector('[data-part="' + part + '"]');
      if (node) {
        if (!node.querySelector('img')) {
          node.style.background = colorMap[part] || '#ffffff';
        }
      }
    });

    const pills = preview.querySelectorAll('.rp-preview-part-btn');
    pills.forEach((pill) => {
      const part = pill.getAttribute('data-part');
      if (part && colorMap[part]) {
        pill.style.borderColor = colorMap[part] + 'aa';
        pill.style.boxShadow = 'inset 0 0 0 2px ' + colorMap[part] + '44';
      }
    });

    setPreviewSelection(modState.selectedPreviewPart);
  }

  function ensureStyle() {
    if (document.getElementById(MOD_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = MOD_STYLE_ID;
    style.textContent = [
      '#' + MOD_ID + ' {',
      '  --rp-bg: linear-gradient(180deg, #0f172a 0%, #172554 100%);',
      '  --rp-fg: #f8fafc;',
      '  --rp-border: #d9e2ec;',
      '  --rp-panel-bg: rgba(2, 6, 23, 0.55);',
      '  --rp-input-bg: rgba(15, 23, 42, 0.55);',
      '  --rp-tab-bg: rgba(255, 255, 255, 0.08);',
      '  --rp-tab-active: linear-gradient(90deg, rgba(37,99,235,0.85), rgba(59,130,246,0.65));',
      '  --rp-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);',
      '  position: fixed;',
      '  display: flex;',
      '  flex-direction: column;',
      '  top: 20px;',
      '  right: 20px;',
      '  width: min(860px, calc(100vw - 20px));',
      '  height: min(760px, calc(100vh - 24px));',
      '  max-height: calc(100vh - 24px);',
      '  z-index: 2147483647;',
      '  border: 1px solid var(--rp-border);',
      '  border-radius: 12px;',
      '  background: var(--rp-bg);',
      '  color: var(--rp-fg);',
      '  box-shadow: var(--rp-shadow);',
      '  font: 13px/1.4 Arial, sans-serif;',
      '  overflow: hidden;',
      '  transition: box-shadow 180ms ease, transform 180ms ease;',
      '}',
      '#' + MOD_ID + '.theme-light {',
      '  --rp-bg: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);',
      '  --rp-fg: #0f172a;',
      '  --rp-border: #94a3b8;',
      '  --rp-panel-bg: rgba(255, 255, 255, 0.72);',
      '  --rp-input-bg: rgba(255, 255, 255, 0.84);',
      '  --rp-tab-bg: rgba(15, 23, 42, 0.10);',
      '  --rp-tab-active: linear-gradient(90deg, rgba(14,116,144,0.78), rgba(2,132,199,0.58));',
      '  --rp-shadow: 0 16px 32px rgba(15, 23, 42, 0.20);',
      '}',
      '#' + MOD_ID + '.theme-auto {',
      '  --rp-bg: linear-gradient(180deg, #0f172a 0%, #172554 100%);',
      '  --rp-fg: #f8fafc;',
      '  --rp-border: #d9e2ec;',
      '  --rp-panel-bg: rgba(2, 6, 23, 0.55);',
      '  --rp-input-bg: rgba(15, 23, 42, 0.55);',
      '  --rp-tab-bg: rgba(255, 255, 255, 0.08);',
      '  --rp-tab-active: linear-gradient(90deg, rgba(37,99,235,0.85), rgba(59,130,246,0.65));',
      '  --rp-shadow: 0 18px 40px rgba(15, 23, 42, 0.35);',
      '}',
      '#' + MOD_ID + ' * { box-sizing: border-box; }',
      '#' + MOD_ID + ' .rp-mini-icon { display: none; }',
      '#' + MOD_ID + '.is-minimized {',
      '  width: 38px;',
      '  height: 38px;',
      '  border-radius: 999px;',
      '  border-color: rgba(255, 255, 255, 0.28);',
      '  box-shadow: none;',
      '  transform: none;',
      '}',
      '#' + MOD_ID + '.is-minimized .rp-store-mod-header,',
      '#' + MOD_ID + '.is-minimized .rp-store-mod-shell { display: none; }',
      '#' + MOD_ID + '.is-minimized *,',
      '#' + MOD_ID + '.is-minimized *::before,',
      '#' + MOD_ID + '.is-minimized *::after {',
      '  animation: none !important;',
      '  transition: none !important;',
      '}',
      '#' + MOD_ID + '.is-minimized .rp-mini-icon {',
      '  width: 38px;',
      '  height: 38px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  border: 0;',
      '  border-radius: 999px;',
      '  background: #000000;',
      '  color: #fff;',
      '  font-size: 11px;',
      '  font-weight: 800;',
      '  letter-spacing: 0.03em;',
      '  cursor: pointer;',
      '  transition: transform 120ms ease;',
      '}',
      '#' + MOD_ID + '.is-minimized .rp-mini-icon:hover { transform: scale(1.04); }',
      '#' + MOD_ID + '.ui-no-effects .rp-store-mod-header { background: transparent; }',
      '#' + MOD_ID + '.ui-no-effects .rp-store-mod-button:hover { filter: none; transform: none; }',
      '#' + MOD_ID + '.ui-no-effects .rp-tab-btn:hover { transform: none; }',
      '#' + MOD_ID + ' .rp-store-mod-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 12px;',
      '  padding: 12px 14px;',
      '  cursor: move;',
      '  border-bottom: 1px solid rgba(255, 255, 255, 0.12);',
      '  background: linear-gradient(120deg, rgba(255,255,255,0.05), rgba(255,255,255,0));',
      '  background-size: 200% 100%;',
      '  animation: rpHeaderSweep 8s linear infinite;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-title { font-weight: 700; letter-spacing: 0.04em; }',
      '#' + MOD_ID + ' .rp-store-mod-subtitle { font-size: 11px; opacity: 0.78; }',
      '#' + MOD_ID + ' .rp-store-mod-actions { display: flex; gap: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-icon-btn {',
      '  width: 28px;',
      '  height: 28px;',
      '  border: 0;',
      '  border-radius: 999px;',
      '  background: rgba(255, 255, 255, 0.12);',
      '  color: var(--rp-fg);',
      '  cursor: pointer;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-shell {',
      '  display: grid;',
      '  grid-template-columns: 160px 1fr;',
      '  min-height: 0;',
      '  height: 100%;',
      '  flex: 1;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-tabs {',
      '  border-right: 1px solid rgba(255, 255, 255, 0.12);',
      '  padding: 10px;',
      '  display: grid;',
      '  align-content: start;',
      '  gap: 8px;',
      '}',
      '#' + MOD_ID + ' .rp-tab-btn {',
      '  border: 0;',
      '  border-radius: 8px;',
      '  background: var(--rp-tab-bg);',
      '  color: var(--rp-fg);',
      '  text-align: left;',
      '  padding: 9px 10px;',
      '  cursor: pointer;',
      '  font-weight: 700;',
      '  transition: background 140ms ease, transform 140ms ease;',
      '}',
      '#' + MOD_ID + ' .rp-tab-btn:hover { transform: translateY(-1px); }',
      '#' + MOD_ID + ' .rp-tab-btn.is-active {',
      '  background: var(--rp-tab-active);',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-content {',
      '  padding: 12px;',
      '  overflow-y: auto;',
      '  min-height: 0;',
      '}',
      '#' + MOD_ID + ' .rp-panel { display: none; }',
      '#' + MOD_ID + ' .rp-panel.is-active { display: block; animation: rpPanelIn 180ms ease; }',
      '#' + MOD_ID + ' .rp-store-mod-section { margin-bottom: 14px; }',
      '#' + MOD_ID + ' .rp-store-mod-section:last-child { margin-bottom: 0; }',
      '#' + MOD_ID + ' .rp-store-mod-section-title {',
      '  margin: 0 0 8px;',
      '  font-size: 11px;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.08em;',
      '  opacity: 0.78;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-grid { display: grid; gap: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-button {',
      '  width: 100%;',
      '  border: 0;',
      '  border-radius: 9px;',
      '  background: #2563eb;',
      '  color: var(--rp-fg);',
      '  padding: 10px 12px;',
      '  cursor: pointer;',
      '  font-weight: 700;',
      '  transition: transform 140ms ease, filter 140ms ease;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-button:hover { transform: translateY(-1px); filter: brightness(1.06); }',
      '#' + MOD_ID + ' .rp-store-mod-button:active { transform: translateY(0); }',
      '#' + MOD_ID + ' .rp-store-mod-button.alt { background: #0f766e; }',
      '#' + MOD_ID + ' .rp-store-mod-button.warn { background: #b45309; }',
      '#' + MOD_ID + ' .rp-store-mod-button.dim { background: #334155; }',
      '#' + MOD_ID + ' .rp-advanced-box {',
      '  display: none;',
      '  background: var(--rp-panel-bg);',
      '  border: 1px solid rgba(255, 255, 255, 0.12);',
      '  border-radius: 8px;',
      '  padding: 10px;',
      '}',
      '#' + MOD_ID + ' .rp-advanced-box.is-open { display: block; }',
      '#' + MOD_ID + ' .rp-store-mod-field { display: grid; gap: 6px; margin-bottom: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-field:last-child { margin-bottom: 0; }',
      '#' + MOD_ID + ' .rp-store-mod-label { font-size: 12px; opacity: 0.92; }',
      '#' + MOD_ID + ' .rp-store-mod-inline { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-input, #' + MOD_ID + ' .rp-store-mod-select {',
      '  width: 100%;',
      '  border: 1px solid rgba(255, 255, 255, 0.16);',
      '  border-radius: 8px;',
      '  background: var(--rp-input-bg);',
      '  color: var(--rp-fg);',
      '  padding: 8px 10px;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-checkbox { display: flex; align-items: center; gap: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-note { font-size: 11px; opacity: 0.78; }',
      '#' + MOD_ID + ' .rp-store-mod-log {',
      '  white-space: pre-wrap;',
      '  max-height: 180px;',
      '  overflow: auto;',
      '  padding: 10px;',
      '  border-radius: 8px;',
      '  background: var(--rp-panel-bg);',
      '  border: 1px solid rgba(255, 255, 255, 0.08);',
      '  font: 11px/1.45 monospace;',
      '}',
      '#' + MOD_ID + ' .rp-skin-preview-wrap {',
      '  border: 1px solid rgba(255, 255, 255, 0.14);',
      '  border-radius: 10px;',
      '  padding: 10px;',
      '  margin-bottom: 10px;',
      '  background: rgba(0, 0, 0, 0.24);',
      '}',
      '#' + MOD_ID + ' .rp-skin-preview-head {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  gap: 8px;',
      '  margin-bottom: 8px;',
      '}',
      '#' + MOD_ID + ' .rp-skin-preview-title { font-size: 11px; opacity: 0.84; text-transform: uppercase; }',
      '#' + MOD_ID + ' .rp-preview-stage {',
      '  border-radius: 10px;',
      '  padding: 10px;',
      '  background: #06090f;',
      '  border: 1px solid rgba(255, 255, 255, 0.12);',
      '}',
      '#' + MOD_ID + ' .rp-preview-layout { display: grid; grid-template-columns: 1.2fr 0.9fr; gap: 10px; }',
      '#' + MOD_ID + ' .rp-preview-asset-panel {',
      '  border-left: 1px solid rgba(255,255,255,0.12);',
      '  padding-left: 10px;',
      '  overflow-y: auto;',
      '  max-height: 240px;',
      '}',
      '#' + MOD_ID + ' .rp-preview-assets-title { font-size: 12px; margin-bottom: 8px; opacity: 0.9; }',
      '#' + MOD_ID + ' .rp-preview-assets-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
      '#' + MOD_ID + ' .rp-asset-thumb { border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); padding: 6px; width: 100%; cursor: pointer; }',
      '#' + MOD_ID + ' .rp-asset-thumb.is-selected { border-color: rgba(255,255,255,0.9); box-shadow: 0 0 0 2px rgba(255,255,255,0.28) inset; }',
      '#' + MOD_ID + ' .rp-asset-thumb img { width: 100%; height: 54px; object-fit: contain; display: block; }',
      '#' + MOD_ID + ' .rp-preview-track {',
      '  display: grid;',
      '  grid-template-columns: repeat(4, 1fr);',
      '  gap: 8px;',
      '}',
      '#' + MOD_ID + ' .rp-preview-parts { margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center; }',
      '#' + MOD_ID + ' .rp-preview-parts [data-mod="selected-note-color"] { grid-column: 1 / -1; }',
      '#' + MOD_ID + ' .rp-preview-part-btn { border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; background: rgba(255,255,255,0.05); color: var(--rp-fg); padding: 8px; cursor: pointer; text-align: center; }',
      '#' + MOD_ID + ' .rp-preview-note {',
      '  width: 100%;',
      '  aspect-ratio: 1 / 1;',
      '  border: 2px solid rgba(255,255,255,0.45);',
      '  cursor: pointer;',
      '  transition: transform 120ms ease, box-shadow 120ms ease;',
      '  position: relative;',
      '  overflow: hidden;',
      '}',
      '#' + MOD_ID + ' .rp-preview-note img { width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 1; }',
      '#' + MOD_ID + ' .rp-preview-tint { position: absolute; inset: 0; z-index: 2; opacity: 0.42; mix-blend-mode: screen; }',
      '#' + MOD_ID + ' .rp-preview-stage.shape-circle .rp-preview-note { border-radius: 999px; }',
      '#' + MOD_ID + ' .rp-preview-stage.shape-square .rp-preview-note { border-radius: 5px; }',
      '#' + MOD_ID + ' .rp-preview-stage.shape-diamond .rp-preview-note { border-radius: 5px; }',
      '#' + MOD_ID + ' .rp-preview-stage.shape-diamond .rp-preview-note:hover { transform: scale(1.03); }',
      '#' + MOD_ID + ' .rp-preview-stage.shape-circle .rp-preview-note:hover,',
      '#' + MOD_ID + ' .rp-preview-stage.shape-square .rp-preview-note:hover { transform: scale(1.03); }',
      '#' + MOD_ID + ' .rp-preview-note.is-selected { box-shadow: 0 0 0 2px #ffffff88, 0 0 14px #ffffff66; }',
      '#' + MOD_ID + ' .rp-preview-part-btn.is-selected { box-shadow: 0 0 0 2px #ffffff88, 0 0 14px #ffffff33; border-color: #ffffffaa; }',
      '#' + MOD_ID + ' .rp-preview-footer { margin-top: 10px; display: grid; grid-template-columns: 1fr 140px; gap: 8px; }',
      '#' + MOD_ID + ' .rp-watermark {',
      '  margin-top: 12px;',
      '  text-align: center;',
      '  font-size: 11px;',
      '  letter-spacing: 0.06em;',
      '  font-weight: 700;',
      '  opacity: 0.95;',
      '  text-transform: uppercase;',
      '}',
      '#' + MOD_ID + ' .rp-watermark span {',
      '  display: inline-block;',
      '  background: linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ef4444);',
      '  background-size: 260% 100%;',
      '  -webkit-background-clip: text;',
      '  background-clip: text;',
      '  color: transparent;',
      '  animation: rpRainbowShift 6s linear infinite, rpWatermarkWave 1.5s ease-in-out infinite;',
      '}',
      '#' + MOD_ID + '.ui-no-effects .rp-watermark span {',
      '  background: none;',
      '  color: var(--rp-fg);',
      '}',
      '#' + MOD_ID + '.ui-no-motion,',
      '#' + MOD_ID + '.ui-no-motion *,',
      '#' + MOD_ID + '.ui-no-motion *::before,',
      '#' + MOD_ID + '.ui-no-motion *::after {',
      '  animation: none !important;',
      '  transition: none !important;',
      '}',
      '@keyframes rpPanelIn {',
      '  from { opacity: 0; transform: translateY(4px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '@keyframes rpHeaderSweep {',
      '  0% { background-position: 0% 0%; }',
      '  100% { background-position: 200% 0%; }',
      '}',
      '@keyframes rpRainbowShift {',
      '  0% { background-position: 0% 50%; }',
      '  100% { background-position: 260% 50%; }',
      '}',
      '@keyframes rpWatermarkWave {',
      '  0% { transform: translateY(0); }',
      '  50% { transform: translateY(-2px); }',
      '  100% { transform: translateY(0); }',
      '}',
      'body.rhythm-plus-mod-hide-bga iframe[src*="youtube.com"],',
      'body.rhythm-plus-mod-hide-bga iframe[src*="youtube-nocookie.com"],',
      'body.rhythm-plus-mod-hide-bga video {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '}',
      'body.disable-animations *,',
      'body.disable-animations *::before,',
      'body.disable-animations *::after {',
      '  animation-duration: 0s !important;',
      '  transition-duration: 0s !important;',
      '}',
      '@media (max-width: 760px) {',
      '  #' + MOD_ID + ' { width: calc(100vw - 20px); height: calc(100vh - 20px); top: 10px; right: 10px; left: 10px; }',
      '  #' + MOD_ID + ' .rp-store-mod-shell { grid-template-columns: 1fr; }',
      '  #' + MOD_ID + ' .rp-store-mod-tabs {',
      '    border-right: 0;',
      '    border-bottom: 1px solid rgba(255, 255, 255, 0.12);',
      '    grid-auto-flow: column;',
      '    grid-auto-columns: 1fr;',
      '  }',
      '  #' + MOD_ID + ' .rp-tab-btn { text-align: center; }',
      '  #' + MOD_ID + ' .rp-preview-footer { grid-template-columns: 1fr; }',
      '  #' + MOD_ID + ' .rp-preview-layout { grid-template-columns: 1fr; }',
      '  #' + MOD_ID + ' .rp-preview-asset-panel { border-left: 0; padding-left: 0; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 8px; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + MOD_ID + ', #' + MOD_ID + ' *, #' + MOD_ID + ' *::before, #' + MOD_ID + ' *::after {',
      '    animation: none !important;',
      '    transition: none !important;',
      '  }',
      '}',
      '@media (prefers-color-scheme: light) {',
      '  #' + MOD_ID + '.theme-auto {',
      '    --rp-bg: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);',
      '    --rp-fg: #0f172a;',
      '    --rp-border: #94a3b8;',
      '    --rp-panel-bg: rgba(255, 255, 255, 0.72);',
      '    --rp-input-bg: rgba(255, 255, 255, 0.84);',
      '    --rp-tab-bg: rgba(15, 23, 42, 0.10);',
      '    --rp-tab-active: linear-gradient(90deg, rgba(14,116,144,0.78), rgba(2,132,199,0.58));',
      '    --rp-shadow: 0 16px 32px rgba(15, 23, 42, 0.20);',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyUiAccessibilitySettings() {
    const root = document.getElementById(MOD_ID);
    if (!root) {
      return;
    }

    root.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    root.classList.add('theme-' + modState.prefs.uiTheme);
    root.classList.toggle('ui-no-effects', !!modState.prefs.uiDisableEffects);
    root.classList.toggle('ui-no-motion', !!modState.prefs.uiDisableAnimations);
  }

  function applyFpsSettings(userStore) {
    const unlockFps = !!modState.prefs.unlockFps;
    const parsedLimit = Number(modState.prefs.fpsLimit);
    const fpsLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.round(parsedLimit) : 0;

    // Best effort: set known/likely FPS cap fields if they exist in the live performance config.
    if (userStore && userStore.performanceConfig && typeof userStore.performanceConfig === 'object') {
      const perf = userStore.performanceConfig;
      const capCandidates = ['fpsCap', 'frameRateCap', 'frameRateLimit', 'maxFps', 'targetFps', 'fpsLimit'];
      const disableCandidates = ['limitFps', 'capFps', 'fpsCapped', 'frameRateLimited'];

      capCandidates.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(perf, key)) {
          perf[key] = unlockFps ? 0 : (fpsLimit || 60);
        }
      });

      disableCandidates.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(perf, key)) {
          perf[key] = !unlockFps;
        }
      });
    }

    // Also try PIXI ticker when available (many rhythm clients rely on this cap).
    const pixi = PAGE_WINDOW.PIXI;
    const ticker = pixi && pixi.Ticker && pixi.Ticker.shared;
    if (ticker) {
      ticker.minFPS = 0;
      ticker.maxFPS = unlockFps ? 0 : (fpsLimit || 60);
    }
  }

  function applyPerformanceOptions(userStore) {
    const options = modState.prefs.perfOptions;
    userStore.performanceConfig.lowQualityMode = !!options.lowQualityMode;
    userStore.performanceConfig.disableAnimations = !!options.disableAnimations;
    userStore.preferences.appearance.visualizer = options.disableVisualizer ? 'off' : 'purpleSpace';
    userStore.preferences.appearance.visualizerPrefs = options.disableVisualizer ? {} : userStore.preferences.appearance.visualizerPrefs;
    userStore.preferences.appearance.bgaPosition = options.forceFloatingBga ? 'floating' : 'embedded';
    userStore.preferences.appearance.hideOverlaysWhenFloating = !!options.forceFloatingBga;
    userStore.preferences.game.backgroundDim = options.dimBackgroundHard ? 0.8 : 0.5;
    userStore.preferences.game.accuracyBarPosition = options.disableAccuracyBar ? 'off' : 'right';

    const configStore = getConfigStore();
    if (configStore) {
      configStore.showConfetti = !options.disableConfetti;
    }

    applyFpsSettings(userStore);

    modState.prefs.removeBgaCss = !!options.hideBgaCss;
    if (modState.prefs.removeBgaCss) {
      document.body.classList.add('rhythm-plus-mod-hide-bga');
    } else {
      document.body.classList.remove('rhythm-plus-mod-hide-bga');
    }
  }

  function getVueApp() {
    const roots = [
      document.getElementById('__nuxt'),
      document.querySelector('[data-v-app]'),
      document.body
    ].filter(Boolean);

    for (const root of roots) {
      if (root.__vue_app__) {
        return root.__vue_app__;
      }
    }

    const all = document.querySelectorAll('*');
    for (const element of all) {
      if (element.__vue_app__) {
        return element.__vue_app__;
      }
    }

    return null;
  }

  function getPinia() {
    const app = getVueApp();
    if (!app) {
      return null;
    }

    const direct = app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
    if (direct && direct._s instanceof Map) {
      return direct;
    }

    const provides = app._context && app._context.provides;
    if (!provides) {
      return null;
    }

    for (const value of Object.values(provides)) {
      if (value && value._s instanceof Map && value.state) {
        return value;
      }
    }

    return null;
  }

  function getUserStore() {
    if (modState.pinnedUserStore && modState.pinnedUserStore.$id === USER_STORE_ID) {
      return modState.pinnedUserStore;
    }

    const pinia = getPinia();
    if (!pinia) {
      return null;
    }

    const store = pinia._s.get(USER_STORE_ID);
    if (store) {
      modState.pinnedUserStore = store;
    }
    return store || null;
  }

  function getConfigStore() {
    if (modState.pinnedConfigStore && modState.pinnedConfigStore.$id === CONFIG_STORE_ID) {
      return modState.pinnedConfigStore;
    }

    const pinia = getPinia();
    if (!pinia) {
      return null;
    }

    const store = pinia._s.get(CONFIG_STORE_ID);
    if (store) {
      modState.pinnedConfigStore = store;
    }
    return store || null;
  }

  async function persistUserStore(userStore) {
    if (!userStore) {
      return;
    }

    try {
      if (typeof userStore.$persist === 'function') {
        userStore.$persist();
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] $persist failed:', error);
    }

    try {
      if (typeof userStore.savePreferences === 'function') {
        await userStore.savePreferences();
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] savePreferences failed:', error);
    }
  }

  function patchUnlockState(userStore) {
    if (!userStore || !Array.isArray(userStore.skins)) {
      return false;
    }

    for (const skin of userStore.skins) {
      if (skin && skin.requireLevel) {
        skin.requireLevel = 0;
      }
      if (skin && skin.overlayTitle) {
        delete skin.overlayTitle;
      }
      if (skin && skin.overlayIcon) {
        delete skin.overlayIcon;
      }
      if (skin && skin.disabled) {
        skin.disabled = false;
      }
    }

    return true;
  }

  function applyDomUnlockBypass() {
    document.querySelectorAll('[class*="lock"], [class*="disabled"], [disabled]').forEach((node) => {
      node.classList.remove('locked', 'disabled');
      node.removeAttribute('disabled');
      node.style.pointerEvents = 'auto';
      node.style.opacity = '1';
      node.style.filter = 'none';
    });
  }

  function ensureSkinPrefs(userStore, skinId) {
    const prefs = userStore.preferences.appearance;
    if (!prefs.gameSkinPrefs || typeof prefs.gameSkinPrefs !== 'object') {
      prefs.gameSkinPrefs = {};
    }
    if (!prefs.gameSkinPrefs[skinId] || typeof prefs.gameSkinPrefs[skinId] !== 'object') {
      prefs.gameSkinPrefs[skinId] = {};
    }
    return prefs.gameSkinPrefs[skinId];
  }

  function applySimplisticSkinMode(userStore, skinPrefs) {
    if (!modState.prefs.simplisticSkinMode) {
      return;
    }

    userStore.preferences.appearance.visualizer = 'off';
    userStore.preferences.appearance.blur = false;
    userStore.preferences.appearance.blurMenuItem = false;
    userStore.preferences.appearance.hideOverlaysWhenFloating = true;

    if (userStore.performanceConfig) {
      userStore.performanceConfig.disableAnimations = true;
    }

    // Best-effort toggles for note-skin effects if those fields exist.
    if (Object.prototype.hasOwnProperty.call(skinPrefs, 'glow')) skinPrefs.glow = false;
    if (Object.prototype.hasOwnProperty.call(skinPrefs, 'particleEffects')) skinPrefs.particleEffects = false;
    if (Object.prototype.hasOwnProperty.call(skinPrefs, 'trail')) skinPrefs.trail = false;
    if (Object.prototype.hasOwnProperty.call(skinPrefs, 'splash')) skinPrefs.splash = false;
  }

  async function applyLowSpecMode() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for low-spec mode.');
      return false;
    }

    applyPerformanceOptions(userStore);
    userStore.preferences.appearance.blur = false;
    userStore.preferences.appearance.blurMenuItem = false;
    modState.prefs.lowSpecMode = true;
    persistPrefs();

    await persistUserStore(userStore);
    log('Applied low-spec mode through the real user store.');
    return true;
  }

  async function disableBgaOnly() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for BGA update.');
      return false;
    }

    userStore.preferences.appearance.bgaPosition = 'floating';
    userStore.preferences.appearance.hideOverlaysWhenFloating = true;
    userStore.preferences.appearance.visualizer = 'off';
    userStore.preferences.game.backgroundDim = 0.8;

    if (modState.prefs.removeBgaCss) {
      document.body.classList.add('rhythm-plus-mod-hide-bga');
    }

    await persistUserStore(userStore);
    log('Disabled embedded BGA and forced lightweight background settings.');
    return true;
  }

  async function applySkinUnlock() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for skin unlock.');
      return false;
    }

    const changed = patchUnlockState(userStore);
    applyDomUnlockBypass();
    await persistUserStore(userStore);

    if (changed) {
      log('Removed client-side skin level requirements for this session.');
    } else {
      log('Skin unlock bypass re-applied to the current page.');
    }
    return true;
  }

  async function applySkinColors() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for skin color update.');
      return false;
    }

    const skinId = resolveSelectedSkinId();
    const skinPrefs = ensureSkinPrefs(userStore, skinId);
    saveUiStateToPreset(skinId);

    userStore.preferences.appearance.gameSkin = skinId;
    userStore.preferences.appearance.noteColor = modState.prefs.noteColor;
    userStore.preferences.appearance.trackColor = modState.prefs.trackColor;
    userStore.preferences.appearance.trackHitColor = modState.prefs.trackHitColor;

    skinPrefs.noteColor = modState.prefs.noteColor;
    skinPrefs.trackColor = modState.prefs.trackColor;
    skinPrefs.trackHitColor = modState.prefs.trackHitColor;
    skinPrefs.leftNoteColor = modState.prefs.leftNoteColor;
    skinPrefs.downNoteColor = modState.prefs.downNoteColor;
    skinPrefs.upNoteColor = modState.prefs.upNoteColor;
    skinPrefs.rightNoteColor = modState.prefs.rightNoteColor;
    skinPrefs.longNoteColor = modState.prefs.longNoteColor;
    skinPrefs.longNoteTailColor = modState.prefs.longNoteTailColor;
    skinPrefs.noteColors = [
      modState.prefs.leftNoteColor,
      modState.prefs.downNoteColor,
      modState.prefs.upNoteColor,
      modState.prefs.rightNoteColor
    ];
    skinPrefs.arrowColors = skinPrefs.noteColors;
    skinPrefs.colors = {
      note: modState.prefs.noteColor,
      track: modState.prefs.trackColor,
      trackHit: modState.prefs.trackHitColor,
      lanes: {
        left: modState.prefs.leftNoteColor,
        down: modState.prefs.downNoteColor,
        up: modState.prefs.upNoteColor,
        right: modState.prefs.rightNoteColor
      },
      hold: {
        head: modState.prefs.longNoteColor,
        tail: modState.prefs.longNoteTailColor
      }
    };
    skinPrefs.sustainColor = modState.prefs.longNoteColor;
    skinPrefs.sustainTailColor = modState.prefs.longNoteTailColor;
    skinPrefs.simplisticSkinMode = !!modState.prefs.simplisticSkinMode;

    const activeSkin = Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null;

    if (activeSkin) {
      activeSkin.noteColor = modState.prefs.noteColor;
      activeSkin.trackColor = modState.prefs.trackColor;
      activeSkin.trackHitColor = modState.prefs.trackHitColor;
      activeSkin.leftNoteColor = modState.prefs.leftNoteColor;
      activeSkin.downNoteColor = modState.prefs.downNoteColor;
      activeSkin.upNoteColor = modState.prefs.upNoteColor;
      activeSkin.rightNoteColor = modState.prefs.rightNoteColor;
      activeSkin.longNoteColor = modState.prefs.longNoteColor;
      activeSkin.longNoteTailColor = modState.prefs.longNoteTailColor;
      activeSkin.sustainColor = modState.prefs.longNoteColor;
      activeSkin.sustainTailColor = modState.prefs.longNoteTailColor;
      activeSkin.noteColors = [
        modState.prefs.leftNoteColor,
        modState.prefs.downNoteColor,
        modState.prefs.upNoteColor,
        modState.prefs.rightNoteColor
      ];
      activeSkin.arrowColors = activeSkin.noteColors;
      if (!activeSkin.colors || typeof activeSkin.colors !== 'object') {
        activeSkin.colors = {};
      }
      activeSkin.colors.note = modState.prefs.noteColor;
      activeSkin.colors.track = modState.prefs.trackColor;
      activeSkin.colors.trackHit = modState.prefs.trackHitColor;
      if (!activeSkin.colors.lanes || typeof activeSkin.colors.lanes !== 'object') {
        activeSkin.colors.lanes = {};
      }
      activeSkin.colors.lanes.left = modState.prefs.leftNoteColor;
      activeSkin.colors.lanes.down = modState.prefs.downNoteColor;
      activeSkin.colors.lanes.up = modState.prefs.upNoteColor;
      activeSkin.colors.lanes.right = modState.prefs.rightNoteColor;
      if (!activeSkin.colors.hold || typeof activeSkin.colors.hold !== 'object') {
        activeSkin.colors.hold = {};
      }
      activeSkin.colors.hold.head = modState.prefs.longNoteColor;
      activeSkin.colors.hold.tail = modState.prefs.longNoteTailColor;
    }

    // Update existing nested/default structures so in-song renderers that read alternate keys still pick up changes.
    if (skinPrefs.colors && typeof skinPrefs.colors === 'object') {
      skinPrefs.colors.note = modState.prefs.noteColor;
      skinPrefs.colors.track = modState.prefs.trackColor;
      skinPrefs.colors.trackHit = modState.prefs.trackHitColor;
      if (skinPrefs.colors.lanes && typeof skinPrefs.colors.lanes === 'object') {
        skinPrefs.colors.lanes.left = modState.prefs.leftNoteColor;
        skinPrefs.colors.lanes.down = modState.prefs.downNoteColor;
        skinPrefs.colors.lanes.up = modState.prefs.upNoteColor;
        skinPrefs.colors.lanes.right = modState.prefs.rightNoteColor;
      }
      if (skinPrefs.colors.hold && typeof skinPrefs.colors.hold === 'object') {
        skinPrefs.colors.hold.head = modState.prefs.longNoteColor;
        skinPrefs.colors.hold.tail = modState.prefs.longNoteTailColor;
      }
    }

    applySimplisticSkinMode(userStore, skinPrefs);
    persistPrefs();

    await persistUserStore(userStore);
    log('Applied store-backed skin color preferences directly to ' + skinId + '.');
    return true;
  }

  function scheduleAutoApplySkinColors(delayMs) {
    if (modState.applySkinTimer) {
      PAGE_WINDOW.clearTimeout(modState.applySkinTimer);
    }

    modState.applySkinTimer = PAGE_WINDOW.setTimeout(async () => {
      modState.applySkinTimer = null;
      try {
        persistPrefs();
        await applySkinColors();
      } catch (error) {
        console.warn('[Rhythm+ Mod] Auto-apply skin colors failed:', error);
      }
    }, Math.max(80, delayMs || 240));
  }

  async function resetToDefaults() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for reset.');
      return false;
    }

    const defaults = deepClone(userStore.preferences);
    defaults.appearance.visualizer = 'purpleSpace';
    defaults.appearance.blur = false;
    defaults.appearance.noteColor = '#ffff00';
    defaults.appearance.trackColor = '#212121';
    defaults.appearance.trackHitColor = '#ffff00';
    defaults.appearance.gameSkin = 'dynamic';
    defaults.appearance.gameSkinPrefs = {};
    defaults.appearance.bgaPosition = 'embedded';
    defaults.game.backgroundDim = 0.5;
    defaults.game.accuracyBarPosition = 'right';

    userStore.preferences = defaults;
    userStore.performanceConfig.lowQualityMode = false;
    userStore.performanceConfig.disableAnimations = false;
    document.body.classList.remove('rhythm-plus-mod-hide-bga');

    modState.prefs.skinPresets = {};
    syncUiStateToSelectedSkin();
    persistPrefs();

    await persistUserStore(userStore);
    log('Reset modified settings back toward site defaults.');
    return true;
  }

  async function reapplyConfiguredState() {
    const userStore = getUserStore();
    if (!userStore) {
      return false;
    }

    applyFpsSettings(userStore);

    if (modState.prefs.lowSpecMode) {
      await applyLowSpecMode();
    } else if (modState.prefs.removeBgaCss) {
      document.body.classList.add('rhythm-plus-mod-hide-bga');
    } else {
      document.body.classList.remove('rhythm-plus-mod-hide-bga');
    }

    if (modState.prefs.unlockSkins) {
      await applySkinUnlock();
    }

    await applySkinColors();
    return true;
  }

  function updateFormFromPrefs() {
    const root = document.getElementById(MOD_ID);
    if (!root) {
      return;
    }

    const lowSpec = root.querySelector('[data-mod="low-spec"]');
    const unlock = root.querySelector('[data-mod="unlock-skins"]');
    const activeTabBtn = root.querySelector('[data-tab="' + modState.prefs.activeTab + '"]');
    const panels = root.querySelectorAll('.rp-panel');
    const tabs = root.querySelectorAll('.rp-tab-btn');
    const skinSelect = root.querySelector('[data-mod="skin-select"]');
    const noteColor = root.querySelector('[data-mod="note-color"]');
    const trackColor = root.querySelector('[data-mod="track-color"]');
    const hitColor = root.querySelector('[data-mod="track-hit-color"]');
    const leftColor = root.querySelector('[data-mod="left-note-color"]');
    const downColor = root.querySelector('[data-mod="down-note-color"]');
    const upColor = root.querySelector('[data-mod="up-note-color"]');
    const rightColor = root.querySelector('[data-mod="right-note-color"]');
    const longColor = root.querySelector('[data-mod="long-note-color"]');
    const longTailColor = root.querySelector('[data-mod="long-note-tail-color"]');
    const simplisticMode = root.querySelector('[data-mod="simplistic-skin-mode"]');
    const perfAdvanced = root.querySelector('[data-mod="perf-advanced"]');
    const uiTheme = root.querySelector('[data-mod="ui-theme"]');
    const uiDisableEffects = root.querySelector('[data-mod="ui-disable-effects"]');
    const uiDisableAnimations = root.querySelector('[data-mod="ui-disable-animations"]');

    const perfLowQuality = root.querySelector('[data-mod="perf-low-quality"]');
    const perfAnimations = root.querySelector('[data-mod="perf-disable-animations"]');
    const perfVisualizer = root.querySelector('[data-mod="perf-disable-visualizer"]');
    const perfFloating = root.querySelector('[data-mod="perf-force-floating"]');
    const perfDim = root.querySelector('[data-mod="perf-dim-hard"]');
    const perfAccuracy = root.querySelector('[data-mod="perf-disable-accuracy"]');
    const perfConfetti = root.querySelector('[data-mod="perf-disable-confetti"]');
    const perfHideBgaCss = root.querySelector('[data-mod="perf-hide-bga-css"]');
    const perfUnlockFps = root.querySelector('[data-mod="perf-unlock-fps"]');
    const perfFpsLimit = root.querySelector('[data-mod="perf-fps-limit"]');

    if (lowSpec) lowSpec.checked = !!modState.prefs.lowSpecMode;
    if (unlock) unlock.checked = !!modState.prefs.unlockSkins;
    if (skinSelect) skinSelect.value = modState.prefs.selectedSkinId;
    if (noteColor) noteColor.value = modState.prefs.noteColor;
    if (trackColor) trackColor.value = modState.prefs.trackColor;
    if (hitColor) hitColor.value = modState.prefs.trackHitColor;
    if (leftColor) leftColor.value = modState.prefs.leftNoteColor;
    if (downColor) downColor.value = modState.prefs.downNoteColor;
    if (upColor) upColor.value = modState.prefs.upNoteColor;
    if (rightColor) rightColor.value = modState.prefs.rightNoteColor;
    if (longColor) longColor.value = modState.prefs.longNoteColor;
    if (longTailColor) longTailColor.value = modState.prefs.longNoteTailColor;
    if (simplisticMode) simplisticMode.checked = !!modState.prefs.simplisticSkinMode;
    if (perfLowQuality) perfLowQuality.checked = !!modState.prefs.perfOptions.lowQualityMode;
    if (perfAnimations) perfAnimations.checked = !!modState.prefs.perfOptions.disableAnimations;
    if (perfVisualizer) perfVisualizer.checked = !!modState.prefs.perfOptions.disableVisualizer;
    if (perfFloating) perfFloating.checked = !!modState.prefs.perfOptions.forceFloatingBga;
    if (perfDim) perfDim.checked = !!modState.prefs.perfOptions.dimBackgroundHard;
    if (perfAccuracy) perfAccuracy.checked = !!modState.prefs.perfOptions.disableAccuracyBar;
    if (perfConfetti) perfConfetti.checked = !!modState.prefs.perfOptions.disableConfetti;
    if (perfHideBgaCss) perfHideBgaCss.checked = !!modState.prefs.perfOptions.hideBgaCss;
    if (perfUnlockFps) perfUnlockFps.checked = !!modState.prefs.unlockFps;
    if (perfFpsLimit) {
      const limit = Number(modState.prefs.fpsLimit);
      perfFpsLimit.value = Number.isFinite(limit) && limit > 0 ? String(limit) : '';
      perfFpsLimit.disabled = !!modState.prefs.unlockFps;
    }
    if (uiTheme) uiTheme.value = modState.prefs.uiTheme || 'dark';
    if (uiDisableEffects) uiDisableEffects.checked = !!modState.prefs.uiDisableEffects;
    if (uiDisableAnimations) uiDisableAnimations.checked = !!modState.prefs.uiDisableAnimations;

    tabs.forEach((tab) => tab.classList.remove('is-active'));
    panels.forEach((panel) => panel.classList.remove('is-active'));
    if (activeTabBtn) activeTabBtn.classList.add('is-active');
    const activePanel = root.querySelector('[data-panel="' + modState.prefs.activeTab + '"]');
    if (activePanel) activePanel.classList.add('is-active');

    if (perfAdvanced) {
      perfAdvanced.classList.toggle('is-open', !!modState.prefs.perfAdvancedOpen);
    }

    applyUiAccessibilitySettings();
    renderSkinPreview();
  }

  function getAvailableSkins() {
    const userStore = getUserStore();
    if (!userStore || !Array.isArray(userStore.skins) || userStore.skins.length === 0) {
      return [
        { id: 'dynamic', title: 'Dynamic' },
        { id: 'canvas', title: 'Classic' },
        { id: 'purple', title: 'Purple Pixi' }
      ];
    }

    return userStore.skins.map((skin) => ({
      id: skin.id,
      title: skin.title || skin.id
    }));
  }

  function renderSkinOptions() {
    const select = document.querySelector('[data-mod="skin-select"]');
    if (!select) {
      return;
    }

    const skins = getAvailableSkins();
    const userStore = getUserStore();
    const currentSkin = userStore && userStore.preferences && userStore.preferences.appearance
      ? userStore.preferences.appearance.gameSkin
      : null;
    if (currentSkin && currentSkin !== modState.prefs.selectedSkinId) {
      modState.prefs.selectedSkinId = currentSkin;
      syncUiStateToSelectedSkin();
      persistPrefs();
    }

    const selectedId = modState.prefs.selectedSkinId || '';
    select.innerHTML = ['<option value="">Default (Current Skin)</option>'].concat(skins.map((skin) => {
      const selected = skin.id === selectedId ? ' selected' : '';
      return '<option value="' + skin.id + '"' + selected + '>' + skin.title + '</option>';
    })).join('');
  }

  function createGui() {
    if (document.getElementById(MOD_ID)) {
      return;
    }

    ensureStyle();

    const root = document.createElement('div');
    root.id = MOD_ID;
    if (modState.prefs.minimized) {
      root.classList.add('is-minimized');
    }

    if (modState.position.left !== null) {
      root.style.left = modState.position.left + 'px';
      root.style.right = 'auto';
    } else {
      root.style.right = String(modState.position.right || 20) + 'px';
    }
    root.style.top = String(modState.position.top || 20) + 'px';

    root.innerHTML = [
      '<button class="rp-mini-icon" data-mod="restore" type="button" title="Open Mod">H+</button>',
      '<div class="rp-store-mod-header" data-mod="drag-handle">',
      '  <div>',
      '    <div class="rp-store-mod-title">Rhythm+ v2 Mod</div>',
      '    <div class="rp-store-mod-subtitle">Store-backed controls</div>',
      '  </div>',
      '  <div class="rp-store-mod-actions">',
      '    <button class="rp-store-mod-icon-btn" data-mod="minimize" type="button">_</button>',
      '    <button class="rp-store-mod-icon-btn" data-mod="close" type="button">x</button>',
      '  </div>',
      '</div>',
      '<div class="rp-store-mod-shell">',
      '  <aside class="rp-store-mod-tabs">',
      '    <button class="rp-tab-btn" data-tab="performance" type="button">Performance</button>',
      '    <button class="rp-tab-btn" data-tab="skins" type="button">Skins</button>',
      '    <button class="rp-tab-btn" data-tab="accessibility" type="button">Accessibility</button>',
      '    <button class="rp-tab-btn" data-tab="tools" type="button">Tools</button>',
      '  </aside>',
      '  <main class="rp-store-mod-content">',
      '    <section class="rp-panel" data-panel="performance">',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">Performance Mode</div>',
      '        <div class="rp-store-mod-grid">',
      '          <label class="rp-store-mod-checkbox"><input data-mod="low-spec" type="checkbox"> <span>Performance mode active</span></label>',
      '          <button class="rp-store-mod-button" data-mod="apply-performance" type="button">Enable Performance Mode</button>',
      '          <button class="rp-store-mod-button dim" data-mod="toggle-advanced" type="button">Advanced FPS Options</button>',
      '        </div>',
      '      </div>',
      '      <div class="rp-store-mod-section rp-advanced-box" data-mod="perf-advanced">',
      '        <div class="rp-store-mod-grid">',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-low-quality" type="checkbox"> <span>Low quality mode</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-disable-animations" type="checkbox"> <span>Disable animations</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-disable-visualizer" type="checkbox"> <span>Disable visualizer</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-force-floating" type="checkbox"> <span>Force floating BGA</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-dim-hard" type="checkbox"> <span>Set heavy background dim</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-disable-accuracy" type="checkbox"> <span>Disable accuracy bar</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-disable-confetti" type="checkbox"> <span>Disable confetti</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-hide-bga-css" type="checkbox"> <span>Hide video/iframe with CSS</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-unlock-fps" type="checkbox"> <span>Unlock FPS (remove cap)</span></label>',
      '          <label class="rp-store-mod-label" for="rp-store-mod-fps-limit">FPS cap (used when unlock is off)</label>',
      '          <input id="rp-store-mod-fps-limit" class="rp-store-mod-input" data-mod="perf-fps-limit" type="number" min="30" max="360" step="1" placeholder="60">',
      '          <button class="rp-store-mod-button dim" data-mod="apply-bga" type="button">Disable BGA Only</button>',
      '        </div>',
      '      </div>',
      '      <div class="rp-store-mod-note">Main button applies the checked advanced options through the real user/config stores.</div>',
      '    </section>',
      '    <section class="rp-panel" data-panel="accessibility">',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">UI Accessibility</div>',
      '        <div class="rp-store-mod-field">',
      '          <label class="rp-store-mod-label" for="rp-store-mod-ui-theme">Theme</label>',
      '          <select id="rp-store-mod-ui-theme" class="rp-store-mod-select" data-mod="ui-theme">',
      '            <option value="dark">Dark</option>',
      '            <option value="light">Light</option>',
      '            <option value="auto">Auto (System)</option>',
      '          </select>',
      '        </div>',
      '        <div class="rp-store-mod-grid">',
      '          <label class="rp-store-mod-checkbox"><input data-mod="ui-disable-effects" type="checkbox"> <span>Disable visual effects</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="ui-disable-animations" type="checkbox"> <span>Disable animations/transitions</span></label>',
      '        </div>',
      '        <div class="rp-store-mod-note">UI-only settings for readability and motion comfort. Minimized mode always disables motion for performance.</div>',
      '      </div>',
      '    </section>',
      '    <section class="rp-panel" data-panel="skins">',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">Skin Bypass</div>',
      '        <div class="rp-store-mod-grid">',
      '          <label class="rp-store-mod-checkbox"><input data-mod="unlock-skins" type="checkbox"> <span>Bypass client-side level locks</span></label>',
      '          <button class="rp-store-mod-button alt" data-mod="apply-unlock" type="button">Apply Skin Bypass</button>',
      '        </div>',
      '      </div>',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">Customization</div>',
      '        <label class="rp-store-mod-checkbox"><input data-mod="simplistic-skin-mode" type="checkbox"> <span>Simplistic mode (bare notes, no extra effects)</span></label>',
      '        <div class="rp-skin-preview-wrap">',
      '          <div class="rp-skin-preview-head">',
      '            <div class="rp-skin-preview-title">Live Skin Preview</div>',
      '            <div class="rp-store-mod-note" data-mod="selected-note-label">Left Note</div>',
      '          </div>',
      '          <div class="rp-preview-stage" data-mod="skin-preview">',
      '            <div class="rp-preview-layout">',
      '              <div>',
      '                <div class="rp-preview-track" data-mod="skin-preview-stage-lanes"></div>',
      '                <div class="rp-preview-parts">',
      '                  <button class="rp-preview-part-btn" data-part="longNoteColor" type="button" title="Long Note">Long Note</button>',
      '                  <button class="rp-preview-part-btn" data-part="longNoteTailColor" type="button" title="Long Note Tail">Long Tail</button>',
      '                  <input class="rp-store-mod-input" data-mod="selected-note-color" type="color">',
      '                </div>',
      '              </div>',
      '              <div class="rp-preview-asset-panel">',
      '                <div class="rp-preview-assets-title">Skin Assets</div>',
      '                <div class="rp-preview-assets-grid" data-mod="skin-preview-assets"></div>',
      '              </div>',
      '            </div>',
      '          </div>',
      '          <div class="rp-preview-footer">',
      '            <button class="rp-store-mod-button warn" data-mod="save-skin-draft" type="button">Save Skin Colors</button>',
      '            <button class="rp-store-mod-button dim" data-mod="revert-skin-draft" type="button">Revert Draft</button>',
      '          </div>',
      '        </div>',
      '        <div class="rp-store-mod-field">',
      '          <label class="rp-store-mod-label" for="rp-store-mod-skin-select">Target skin</label>',
      '          <select id="rp-store-mod-skin-select" class="rp-store-mod-select" data-mod="skin-select"></select>',
      '        </div>',
      '        <div class="rp-store-mod-note">Select a skin, click a note/hold in preview, adjust color, then save.</div>',
      '      </div>',
      '    </section>',
      '    <section class="rp-panel" data-panel="tools">',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">Utility</div>',
      '        <div class="rp-store-mod-grid">',
      '          <button class="rp-store-mod-button dim" data-mod="reapply" type="button">Reapply Everything</button>',
      '          <button class="rp-store-mod-button dim" data-mod="reset" type="button">Reset Modded Settings</button>',
      '        </div>',
      '      </div>',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">Log</div>',
      '        <div id="rp-store-mod-log" class="rp-store-mod-log"></div>',
      '        <div class="rp-watermark"><span>Developed by HoodieTheGoodie on GitHub</span></div>',
      '      </div>',
      '    </section>',
      '  </main>',
      '</div>'
    ].join('');

    document.body.appendChild(root);
    renderSkinOptions();
    updateFormFromPrefs();
    bindGuiEvents(root);
    log('GUI ready. Waiting for Nuxt stores.');
  }

  function bindGuiEvents(root) {
    const persistActiveSkinPreset = () => {
      const skinId = resolveSelectedSkinId();
      saveUiStateToPreset(skinId);
    };

    const setActiveTab = (tabId) => {
      modState.prefs.activeTab = tabId;
      persistPrefs();
      updateFormFromPrefs();
    };

    root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.getAttribute('data-tab')));
    });

    root.querySelector('[data-mod="skin-preview"]').addEventListener('click', (event) => {
      const target = event.target.closest('[data-part]');
      if (!target) {
        return;
      }
      setPreviewSelection(target.getAttribute('data-part'));
      renderSkinPreview();
    });

    root.querySelector('[data-mod="skin-preview-assets"]').addEventListener('click', (event) => {
      const target = event.target.closest('[data-asset-index][data-part]');
      if (!target) {
        return;
      }

      const nextIndex = Number(target.getAttribute('data-asset-index'));
      if (Number.isFinite(nextIndex) && nextIndex >= 0) {
        modState.selectedAssetIndex = nextIndex;
      }
      setPreviewSelection(target.getAttribute('data-part'));
      renderSkinPreview();
    });

    root.querySelector('[data-mod="restore"]').addEventListener('click', () => {
      if (modState.suppressRestoreClick) {
        return;
      }
      modState.prefs.minimized = false;
      root.classList.remove('is-minimized');
      persistPrefs();
    });

    root.querySelector('[data-mod="close"]').addEventListener('click', () => {
      root.remove();
    });

    root.querySelector('[data-mod="minimize"]').addEventListener('click', () => {
      modState.prefs.minimized = !modState.prefs.minimized;
      root.classList.toggle('is-minimized', modState.prefs.minimized);
      persistPrefs();
    });

    root.querySelector('[data-mod="low-spec"]').addEventListener('change', (event) => {
      modState.prefs.lowSpecMode = event.target.checked;
      if (!event.target.checked) {
        document.body.classList.remove('rhythm-plus-mod-hide-bga');
      }
      persistPrefs();
    });

    root.querySelector('[data-mod="unlock-skins"]').addEventListener('change', (event) => {
      modState.prefs.unlockSkins = event.target.checked;
      persistPrefs();
    });

    root.querySelector('[data-mod="skin-select"]').addEventListener('change', (event) => {
      persistActiveSkinPreset();
      modState.prefs.selectedSkinId = event.target.value;
      syncUiStateToSelectedSkin();
      persistPrefs();
      updateFormFromPrefs();
      scheduleAutoApplySkinColors(120);
    });

    root.querySelector('[data-mod="note-color"]')?.addEventListener('input', (event) => {
      modState.prefs.noteColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="track-color"]')?.addEventListener('input', (event) => {
      modState.prefs.trackColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="track-hit-color"]')?.addEventListener('input', (event) => {
      modState.prefs.trackHitColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="left-note-color"]')?.addEventListener('input', (event) => {
      modState.prefs.leftNoteColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="down-note-color"]')?.addEventListener('input', (event) => {
      modState.prefs.downNoteColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="up-note-color"]')?.addEventListener('input', (event) => {
      modState.prefs.upNoteColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="right-note-color"]')?.addEventListener('input', (event) => {
      modState.prefs.rightNoteColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="long-note-color"]')?.addEventListener('input', (event) => {
      modState.prefs.longNoteColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="long-note-tail-color"]')?.addEventListener('input', (event) => {
      modState.prefs.longNoteTailColor = event.target.value;
      renderSkinPreview();
      scheduleAutoApplySkinColors(220);
    });

    root.querySelector('[data-mod="simplistic-skin-mode"]').addEventListener('change', (event) => {
      modState.prefs.simplisticSkinMode = event.target.checked;
      renderSkinPreview();
    });

    root.querySelector('[data-mod="selected-note-color"]').addEventListener('input', (event) => {
      const part = modState.selectedPreviewPart;
      if (!part || !Object.prototype.hasOwnProperty.call(modState.prefs, part)) {
        return;
      }

      modState.prefs[part] = event.target.value;
      const partToInput = {
        noteColor: 'note-color',
        trackColor: 'track-color',
        trackHitColor: 'track-hit-color',
        leftNoteColor: 'left-note-color',
        downNoteColor: 'down-note-color',
        upNoteColor: 'up-note-color',
        rightNoteColor: 'right-note-color',
        longNoteColor: 'long-note-color',
        longNoteTailColor: 'long-note-tail-color'
      };
      const directInput = root.querySelector('[data-mod="' + partToInput[part] + '"]');
      if (directInput) {
        directInput.value = event.target.value;
      }
      renderSkinPreview();
      scheduleAutoApplySkinColors(180);
    });

    root.querySelector('[data-mod="save-skin-draft"]').addEventListener('click', async () => {
      persistActiveSkinPreset();
      persistPrefs();
      await applySkinColors();
    });

    root.querySelector('[data-mod="revert-skin-draft"]').addEventListener('click', () => {
      syncUiStateToSelectedSkin();
      updateFormFromPrefs();
      log('Reverted skin draft to saved preset for ' + (modState.prefs.selectedSkinId || 'current skin') + '.');
    });

    root.querySelector('[data-mod="toggle-advanced"]').addEventListener('click', () => {
      modState.prefs.perfAdvancedOpen = !modState.prefs.perfAdvancedOpen;
      persistPrefs();
      updateFormFromPrefs();
    });

    root.querySelector('[data-mod="ui-theme"]').addEventListener('change', (event) => {
      modState.prefs.uiTheme = event.target.value;
      persistPrefs();
      applyUiAccessibilitySettings();
    });

    root.querySelector('[data-mod="ui-disable-effects"]').addEventListener('change', (event) => {
      modState.prefs.uiDisableEffects = event.target.checked;
      persistPrefs();
      applyUiAccessibilitySettings();
    });

    root.querySelector('[data-mod="ui-disable-animations"]').addEventListener('change', (event) => {
      modState.prefs.uiDisableAnimations = event.target.checked;
      persistPrefs();
      applyUiAccessibilitySettings();
    });

    root.querySelector('[data-mod="perf-low-quality"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.lowQualityMode = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-disable-animations"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.disableAnimations = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-disable-visualizer"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.disableVisualizer = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-force-floating"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.forceFloatingBga = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-dim-hard"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.dimBackgroundHard = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-disable-accuracy"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.disableAccuracyBar = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-disable-confetti"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.disableConfetti = event.target.checked;
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-hide-bga-css"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.hideBgaCss = event.target.checked;
      modState.prefs.removeBgaCss = event.target.checked;
      persistPrefs();
    });

    root.querySelector('[data-mod="perf-unlock-fps"]').addEventListener('change', async (event) => {
      modState.prefs.unlockFps = event.target.checked;
      persistPrefs();
      updateFormFromPrefs();
      const userStore = getUserStore();
      if (userStore) {
        applyFpsSettings(userStore);
        await persistUserStore(userStore);
      }
    });

    root.querySelector('[data-mod="perf-fps-limit"]').addEventListener('input', async (event) => {
      const value = Number(event.target.value);
      modState.prefs.fpsLimit = Number.isFinite(value) && value > 0 ? Math.min(360, Math.max(30, Math.round(value))) : 0;
      persistPrefs();
      const userStore = getUserStore();
      if (userStore) {
        applyFpsSettings(userStore);
        await persistUserStore(userStore);
      }
    });

    root.querySelector('[data-mod="apply-performance"]').addEventListener('click', async () => {
      await applyLowSpecMode();
    });

    root.querySelector('[data-mod="apply-bga"]').addEventListener('click', async () => {
      await disableBgaOnly();
    });

    root.querySelector('[data-mod="apply-unlock"]').addEventListener('click', async () => {
      await applySkinUnlock();
      renderSkinOptions();
    });

    root.querySelector('[data-mod="apply-colors"]')?.addEventListener('click', async () => {
      await applySkinColors();
    });

    root.querySelector('[data-mod="reapply"]').addEventListener('click', async () => {
      await reapplyConfiguredState();
      renderSkinOptions();
    });

    root.querySelector('[data-mod="reset"]').addEventListener('click', async () => {
      await resetToDefaults();
    });

    setupDragging(root);
  }

  function setupDragging(root) {
    const handle = root.querySelector('[data-mod="drag-handle"]');
    if (!handle) {
      return;
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let dragFromMiniIcon = false;
    let dragDistance = 0;

    const beginDrag = (event, fromMini) => {
      const rect = root.getBoundingClientRect();
      dragging = true;
      dragFromMiniIcon = !!fromMini;
      dragDistance = 0;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      event.preventDefault();
    };

    handle.addEventListener('mousedown', (event) => {
      if (event.target.closest('button')) {
        return;
      }

      beginDrag(event, false);
    });

    const miniIcon = root.querySelector('[data-mod="restore"]');
    if (miniIcon) {
      miniIcon.addEventListener('mousedown', (event) => {
        if (!root.classList.contains('is-minimized')) {
          return;
        }
        beginDrag(event, true);
      });
    }

    document.addEventListener('mousemove', (event) => {
      if (!dragging) {
        return;
      }

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      dragDistance = Math.max(dragDistance, Math.abs(deltaX) + Math.abs(deltaY));
      const nextLeft = Math.max(8, startLeft + deltaX);
      const nextTop = Math.max(8, startTop + deltaY);

      root.style.left = nextLeft + 'px';
      root.style.right = 'auto';
      root.style.top = nextTop + 'px';
      modState.position = { left: nextLeft, top: nextTop, right: null };
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) {
        return;
      }

      if (dragFromMiniIcon && dragDistance > 3) {
        modState.suppressRestoreClick = true;
        PAGE_WINDOW.setTimeout(() => {
          modState.suppressRestoreClick = false;
        }, 80);
      }

      dragging = false;
      persistPosition();
    });
  }

  function startWatchers() {
    if (!modState.reapplyTimer) {
      modState.reapplyTimer = PAGE_WINDOW.setInterval(() => {
        const userStore = getUserStore();
        if (!userStore) {
          return;
        }

        renderSkinOptions();
        const activeSkinChanged = pullActiveSkinFromStore();
        if (activeSkinChanged) {
          updateFormFromPrefs();
        }

        if (modState.prefs.removeBgaCss) {
          document.body.classList.add('rhythm-plus-mod-hide-bga');
        }
      }, 1500);
    }

    if (!modState.unlockTimer) {
      modState.unlockTimer = PAGE_WINDOW.setInterval(() => {
        if (!modState.prefs.unlockSkins) {
          return;
        }

        const userStore = getUserStore();
        if (!userStore) {
          return;
        }

        patchUnlockState(userStore);
        applyDomUnlockBypass();
      }, 1200);
    }
  }

  async function boot() {
    ensureStyle();
    createGui();
    startWatchers();

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      const userStore = getUserStore();
      if (userStore) {
        rebuildSkinPresetsFromDefaults();
        syncUiStateToSelectedSkin();
        persistPrefs();
        pullActiveSkinFromStore();
        renderSkinOptions();
        updateFormFromPrefs();
        await reapplyConfiguredState();
        log('Connected to the live Rhythm+ Pinia user store.');
        return;
      }

      attempts += 1;
      await new Promise((resolve) => PAGE_WINDOW.setTimeout(resolve, 500));
    }

    log('Nuxt stores were not found automatically. Reload the page if the app is still starting.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
