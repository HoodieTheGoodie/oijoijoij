// ==UserScript==
// @name         Rhythm+ v2 Store Mod
// @namespace    rhythm-plus-v2-mod
// @version      3.4
// @description  Runtime mod for Rhythm+ v2 using the real Nuxt/Pinia stores.
// @author       GitHub Copilot
// @match        https://v2.rhythm-plus.com/*
// @match        http://v2.rhythm-plus.com/*
// @match        https://rhythm-plus.com/*
// @match        http://rhythm-plus.com/*
// @match        https://www.rhythm-plus.com/*
// @match        http://www.rhythm-plus.com/*
// @match        https://*.rhythm-plus.com/*
// @match        http://*.rhythm-plus.com/*
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
  const TRANSPARENT_ASSET_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=';
  const PANEL_MIN_WIDTH = 420;
  const PANEL_MIN_HEIGHT = 320;
  const PANEL_DEFAULT_WIDTH = 860;
  const PANEL_DEFAULT_HEIGHT = 760;
  const ALLOWED_UI_THEMES = ['dark', 'light', 'auto', 'midnight-gold', 'sunset'];

  const DEFAULT_PERF_OPTIONS = {
    lowQualityMode: false,
    disableAnimations: false,
    disableVisualizer: false,
    forceFloatingBga: false,
    dimBackgroundHard: false,
    disableAccuracyBar: false,
    disableConfetti: false,
    hideBgaCss: false,
    disableBgaOnly: false
  };

  const DEFAULT_STATE = {
    lowSpecMode: false,
    removeBgaCss: false,
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
    assetTintColor: '#ff7f50',
    simplisticSkinMode: false,
    minimized: false,
    activeTab: 'performance',
    perfAdvancedOpen: false,
    perfOptions: { ...DEFAULT_PERF_OPTIONS },
    unlockFps: true,
    fpsLimit: 0,
    skinPresets: {},
    assetOverrides: {},
    uiWidth: PANEL_DEFAULT_WIDTH,
    uiHeight: PANEL_DEFAULT_HEIGHT,
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
  if (!mergedPrefs.assetOverrides || typeof mergedPrefs.assetOverrides !== 'object') {
    mergedPrefs.assetOverrides = {};
  }
  if (!isHexColor(mergedPrefs.assetTintColor)) {
    mergedPrefs.assetTintColor = DEFAULT_STATE.assetTintColor;
  }
  if (!mergedPrefs.uiTheme) {
    mergedPrefs.uiTheme = 'dark';
  }
  if (!ALLOWED_UI_THEMES.includes(mergedPrefs.uiTheme)) {
    mergedPrefs.uiTheme = 'dark';
  }
  if (typeof mergedPrefs.uiDisableEffects !== 'boolean') {
    mergedPrefs.uiDisableEffects = false;
  }
  if (typeof mergedPrefs.uiDisableAnimations !== 'boolean') {
    mergedPrefs.uiDisableAnimations = false;
  }
  mergedPrefs.uiWidth = clampPanelWidth(mergedPrefs.uiWidth);
  mergedPrefs.uiHeight = clampPanelHeight(mergedPrefs.uiHeight);

  const modState = {
    prefs: mergedPrefs,
    position: loadValue(DRAG_KEY, { top: 20, right: 20, left: null }),
    logLines: [],
    originalSkinPresets: {},
    originalRuntimeState: null,
    selectedPreviewPart: 'leftNoteColor',
    selectedAssetIndex: -1,
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

  function clampPanelWidth(value) {
    const max = Math.max(PANEL_MIN_WIDTH, Math.floor(PAGE_WINDOW.innerWidth - 12));
    const fallback = Math.min(PANEL_DEFAULT_WIDTH, max);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(max, Math.max(PANEL_MIN_WIDTH, Math.round(parsed)));
  }

  function clampPanelHeight(value) {
    const max = Math.max(PANEL_MIN_HEIGHT, Math.floor(PAGE_WINDOW.innerHeight - 12));
    const fallback = Math.min(PANEL_DEFAULT_HEIGHT, max);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(max, Math.max(PANEL_MIN_HEIGHT, Math.round(parsed)));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function tryDeepClone(value, fallback) {
    try {
      return deepClone(value);
    } catch (error) {
      return fallback;
    }
  }

  function isHexColor(value) {
    return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  }

  function clampColor(value, fallback) {
    return isHexColor(value) ? value : fallback;
  }

  function hexToRgb(value) {
    const safe = clampColor(value, '#ffffff').slice(1);
    const full = safe.length === 3
      ? safe.split('').map((part) => part + part).join('')
      : safe;

    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
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

  function normalizeSkinPreset(value, fallbackPreset) {
    const source = value && typeof value === 'object' ? value : {};
    const fallback = fallbackPreset && typeof fallbackPreset === 'object'
      ? fallbackPreset
      : createDefaultSkinPreset();

    return {
      noteColor: clampColor(source.noteColor, fallback.noteColor),
      trackColor: clampColor(source.trackColor, fallback.trackColor),
      trackHitColor: clampColor(source.trackHitColor, fallback.trackHitColor),
      leftNoteColor: clampColor(source.leftNoteColor, fallback.leftNoteColor),
      downNoteColor: clampColor(source.downNoteColor, fallback.downNoteColor),
      upNoteColor: clampColor(source.upNoteColor, fallback.upNoteColor),
      rightNoteColor: clampColor(source.rightNoteColor, fallback.rightNoteColor),
      longNoteColor: clampColor(source.longNoteColor, fallback.longNoteColor),
      longNoteTailColor: clampColor(source.longNoteTailColor, fallback.longNoteTailColor),
      simplisticSkinMode: !!source.simplisticSkinMode
    };
  }

  function normalizeAssetOverrideMap(value) {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const next = {};
    Object.entries(value).forEach(([fromUrl, toUrl]) => {
      if (typeof fromUrl !== 'string' || typeof toUrl !== 'string') {
        return;
      }
      if (!fromUrl || !toUrl) {
        return;
      }
      next[fromUrl] = toUrl;
    });
    return next;
  }

  function resolveAssetOverrideSourceUrl(skinId, assetUrl) {
    const perSkin = modState.prefs.assetOverrides && modState.prefs.assetOverrides[skinId];
    if (!perSkin || typeof perSkin !== 'object') {
      return assetUrl;
    }

    if (Object.prototype.hasOwnProperty.call(perSkin, assetUrl)) {
      return assetUrl;
    }

    for (const [sourceUrl, overrideUrl] of Object.entries(perSkin)) {
      if (isSameAssetUrl(assetUrl, sourceUrl) || isSameAssetUrl(assetUrl, overrideUrl)) {
        return sourceUrl;
      }
    }

    return assetUrl;
  }

  function resolveAssetDisplayUrl(skinId, assetUrl) {
    const perSkin = modState.prefs.assetOverrides && modState.prefs.assetOverrides[skinId];
    if (!perSkin || typeof perSkin !== 'object') {
      return assetUrl;
    }

    if (Object.prototype.hasOwnProperty.call(perSkin, assetUrl)) {
      return perSkin[assetUrl];
    }

    for (const [sourceUrl, overrideUrl] of Object.entries(perSkin)) {
      if (isSameAssetUrl(assetUrl, sourceUrl) || isSameAssetUrl(assetUrl, overrideUrl)) {
        return overrideUrl;
      }
    }

    return assetUrl;
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
    const skins = Array.isArray(userStore.skins) ? userStore.skins : [];
    const skinById = skins.find((item) => item && item.id === skinId);
    const skinDataEntries = getSkinDataMapEntriesForSkinId(userStore, skinId);
    const cachedSkin = skinDataEntries.length > 0
      && skinDataEntries[0][1]
      && skinDataEntries[0][1].skin
      && typeof skinDataEntries[0][1].skin === 'object'
      ? skinDataEntries[0][1].skin
      : null;
    const skin = cachedSkin || skinById || getActiveSkinEntry(userStore);
    const skinObject = skin && typeof skin === 'object' ? skin : {};

    const skinColors = skinObject.colors && typeof skinObject.colors === 'object' ? skinObject.colors : {};
    const laneColors = skinColors.lanes && typeof skinColors.lanes === 'object' ? skinColors.lanes : {};
    const holdColors = skinColors.hold && typeof skinColors.hold === 'object' ? skinColors.hold : {};
    const noteArray = Array.isArray(skinObject.noteColors)
      ? skinObject.noteColors
      : (Array.isArray(skinObject.arrowColors) ? skinObject.arrowColors : null);
    const prefNoteArray = Array.isArray(skinPrefs.noteColors)
      ? skinPrefs.noteColors
      : (Array.isArray(skinPrefs.arrowColors) ? skinPrefs.arrowColors : null);

    return {
      noteColor: skinObject.noteColor || skinColors.note || skinPrefs.noteColor || appearance.noteColor || fallback.noteColor,
      trackColor: skinObject.trackColor || skinColors.track || skinPrefs.trackColor || appearance.trackColor || fallback.trackColor,
      trackHitColor: skinObject.trackHitColor || skinColors.trackHit || skinPrefs.trackHitColor || appearance.trackHitColor || fallback.trackHitColor,
      leftNoteColor: laneColors.left || (noteArray && noteArray[0]) || skinObject.leftNoteColor || skinPrefs.leftNoteColor || (prefNoteArray && prefNoteArray[0]) || fallback.leftNoteColor,
      downNoteColor: laneColors.down || (noteArray && noteArray[1]) || skinObject.downNoteColor || skinPrefs.downNoteColor || (prefNoteArray && prefNoteArray[1]) || fallback.downNoteColor,
      upNoteColor: laneColors.up || (noteArray && noteArray[2]) || skinObject.upNoteColor || skinPrefs.upNoteColor || (prefNoteArray && prefNoteArray[2]) || fallback.upNoteColor,
      rightNoteColor: laneColors.right || (noteArray && noteArray[3]) || skinObject.rightNoteColor || skinPrefs.rightNoteColor || (prefNoteArray && prefNoteArray[3]) || fallback.rightNoteColor,
      longNoteColor: holdColors.head || skinObject.sustainColor || skinObject.longNoteColor || skinPrefs.longNoteColor || skinPrefs.sustainColor || fallback.longNoteColor,
      longNoteTailColor: holdColors.tail || skinObject.sustainTailColor || skinObject.longNoteTailColor || skinPrefs.longNoteTailColor || skinPrefs.sustainTailColor || fallback.longNoteTailColor,
      simplisticSkinMode: false
    };
  }

  function captureOriginalRuntimeSnapshot(userStore) {
    if (!userStore || modState.originalRuntimeState) {
      return;
    }

    const configStore = getConfigStore();
    modState.originalRuntimeState = {
      preferences: tryDeepClone(userStore.preferences || {}, {}),
      performanceConfig: tryDeepClone(userStore.performanceConfig || {}, {}),
      skins: tryDeepClone(Array.isArray(userStore.skins) ? userStore.skins : [], []),
      skinDataMap: tryDeepClone(
        userStore.skinDataMap && typeof userStore.skinDataMap === 'object'
          ? userStore.skinDataMap
          : {},
        {}
      ),
      showConfetti: (configStore && Object.prototype.hasOwnProperty.call(configStore, 'showConfetti'))
        ? !!configStore.showConfetti
        : null
    };

    const snapshotStore = {
      preferences: modState.originalRuntimeState.preferences,
      skins: modState.originalRuntimeState.skins,
      skinDataMap: modState.originalRuntimeState.skinDataMap
    };
    modState.originalRuntimeState.skins.forEach((skin) => {
      if (!skin || !skin.id || modState.originalSkinPresets[skin.id]) {
        return;
      }
      modState.originalSkinPresets[skin.id] = deepClone(readSkinDefaultColors(snapshotStore, skin.id));
    });
  }

  function restoreOriginalRuntimeSnapshot(userStore) {
    if (!userStore || !modState.originalRuntimeState) {
      return false;
    }

    const snapshot = modState.originalRuntimeState;
    const nextPreferences = tryDeepClone(snapshot.preferences, null);
    const nextPerformanceConfig = tryDeepClone(snapshot.performanceConfig, null);
    const nextSkins = tryDeepClone(snapshot.skins, null);
    const nextSkinDataMap = tryDeepClone(snapshot.skinDataMap, null);

    if (!nextPreferences || typeof nextPreferences !== 'object') {
      return false;
    }

    userStore.preferences = nextPreferences;
    if (nextPerformanceConfig && typeof nextPerformanceConfig === 'object') {
      userStore.performanceConfig = nextPerformanceConfig;
    }
    if (Array.isArray(nextSkins)) {
      userStore.skins = nextSkins;
    }
    if (nextSkinDataMap && typeof nextSkinDataMap === 'object') {
      userStore.skinDataMap = nextSkinDataMap;
    }

    const configStore = getConfigStore();
    if (
      configStore
      && Object.prototype.hasOwnProperty.call(configStore, 'showConfetti')
      && typeof snapshot.showConfetti === 'boolean'
    ) {
      configStore.showConfetti = snapshot.showConfetti;
    }

    return true;
  }

  function restoreSkinRuntimeFromSnapshotForSkin(userStore, skinId) {
    if (!userStore || !skinId || !modState.originalRuntimeState) {
      return false;
    }

    const snapshot = modState.originalRuntimeState;
    const snapshotStore = {
      preferences: snapshot.preferences && typeof snapshot.preferences === 'object' ? snapshot.preferences : {},
      skins: Array.isArray(snapshot.skins) ? snapshot.skins : [],
      skinDataMap: snapshot.skinDataMap && typeof snapshot.skinDataMap === 'object' ? snapshot.skinDataMap : {}
    };

    let changed = false;

    if (Array.isArray(userStore.skins) && userStore.skins.length > 0) {
      const snapshotSkin = snapshotStore.skins.find((item) => item && item.id === skinId);
      const liveSkinIndex = userStore.skins.findIndex((item) => item && item.id === skinId);
      if (snapshotSkin && liveSkinIndex >= 0) {
        userStore.skins[liveSkinIndex] = deepClone(snapshotSkin);
        changed = true;
      }
    }

    if (userStore.preferences && userStore.preferences.appearance) {
      const appearance = userStore.preferences.appearance;
      if (!appearance.gameSkinPrefs || typeof appearance.gameSkinPrefs !== 'object') {
        appearance.gameSkinPrefs = {};
      }

      const snapshotPrefs = snapshotStore.preferences
        && snapshotStore.preferences.appearance
        && snapshotStore.preferences.appearance.gameSkinPrefs
        && snapshotStore.preferences.appearance.gameSkinPrefs[skinId];

      if (snapshotPrefs && typeof snapshotPrefs === 'object') {
        appearance.gameSkinPrefs[skinId] = deepClone(snapshotPrefs);
        changed = true;
      } else if (Object.prototype.hasOwnProperty.call(appearance.gameSkinPrefs, skinId)) {
        delete appearance.gameSkinPrefs[skinId];
        changed = true;
      }
    }

    if (userStore.skinDataMap && typeof userStore.skinDataMap === 'object') {
      const liveEntries = getSkinDataMapEntriesForSkinId(userStore, skinId);
      const snapshotEntries = getSkinDataMapEntriesForSkinId(snapshotStore, skinId);

      const snapshotUrls = snapshotEntries.map(([url]) => normalizeAssetUrl(url));
      liveEntries.forEach(([url]) => {
        const normalized = normalizeAssetUrl(url);
        if (!snapshotUrls.includes(normalized)) {
          delete userStore.skinDataMap[url];
          changed = true;
        }
      });

      snapshotEntries.forEach(([url, entry]) => {
        userStore.skinDataMap[url] = deepClone(entry);
        changed = true;
      });
    }

    if (changed) {
      if (Array.isArray(userStore.skins)) {
        userStore.skins = userStore.skins.slice();
      }
      if (userStore.skinDataMap && typeof userStore.skinDataMap === 'object') {
        userStore.skinDataMap = { ...userStore.skinDataMap };
      }
      if (userStore.preferences && userStore.preferences.appearance) {
        const appearance = userStore.preferences.appearance;
        if (appearance.gameSkinPrefs && typeof appearance.gameSkinPrefs === 'object') {
          appearance.gameSkinPrefs = { ...appearance.gameSkinPrefs };
        }
        userStore.preferences.appearance = { ...appearance };
      }
    }

    return changed;
  }

  function buildOriginalSkinPayload(userStore, skinId) {
    if (!skinId) {
      return null;
    }

    captureOriginalSkinPreset(userStore, skinId);
    const originalPreset = modState.originalSkinPresets[skinId];
    if (!originalPreset) {
      return null;
    }

    return {
      type: 'rhythm-plus-custom-colors',
      version: 1,
      skinId,
      exportedAt: new Date().toISOString(),
      skinPreset: deepClone(originalPreset),
      assetTintColor: DEFAULT_STATE.assetTintColor,
      assetOverrides: {}
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

  function applyColorPresetToUiState(preset) {
    if (!preset || typeof preset !== 'object') {
      return;
    }

    modState.prefs.noteColor = preset.noteColor || modState.prefs.noteColor;
    modState.prefs.trackColor = preset.trackColor || modState.prefs.trackColor;
    modState.prefs.trackHitColor = preset.trackHitColor || modState.prefs.trackHitColor;
    modState.prefs.leftNoteColor = preset.leftNoteColor || modState.prefs.leftNoteColor;
    modState.prefs.downNoteColor = preset.downNoteColor || modState.prefs.downNoteColor;
    modState.prefs.upNoteColor = preset.upNoteColor || modState.prefs.upNoteColor;
    modState.prefs.rightNoteColor = preset.rightNoteColor || modState.prefs.rightNoteColor;
    modState.prefs.longNoteColor = preset.longNoteColor || modState.prefs.longNoteColor;
    modState.prefs.longNoteTailColor = preset.longNoteTailColor || modState.prefs.longNoteTailColor;
  }

  function captureOriginalSkinPreset(userStore, skinId) {
    if (!userStore || !skinId) {
      return;
    }

    if (modState.originalSkinPresets[skinId]) {
      return;
    }

    modState.originalSkinPresets[skinId] = deepClone(readSkinDefaultColors(userStore, skinId));
  }

  function captureOriginalSkinPresets(userStore) {
    if (!userStore) {
      return;
    }

    const ids = new Set();
    if (Array.isArray(userStore.skins)) {
      userStore.skins.forEach((skin) => {
        if (skin && skin.id) {
          ids.add(skin.id);
        }
      });
    }

    const activeSkin = getActiveSkinEntry(userStore);
    if (activeSkin && activeSkin.id) {
      ids.add(activeSkin.id);
    }

    const selectedSkinId = modState.prefs.selectedSkinId;
    if (selectedSkinId) {
      ids.add(selectedSkinId);
    }

    ids.forEach((skinId) => captureOriginalSkinPreset(userStore, skinId));
  }

  async function resetSelectedSkinColorsToOriginal() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for original color reset.');
      return false;
    }

    const skinId = resolveSelectedSkinId();
    captureOriginalSkinPreset(userStore, skinId);

    const originalPreset = modState.originalSkinPresets[skinId];
    if (!originalPreset) {
      log('Original color scheme was not found for ' + skinId + '.');
      return false;
    }

    const keepSimplisticMode = !!modState.prefs.simplisticSkinMode;
    applyColorPresetToUiState(originalPreset);
    modState.prefs.simplisticSkinMode = keepSimplisticMode;

    const perSkin = modState.prefs.assetOverrides && modState.prefs.assetOverrides[skinId];
    const hadAssetOverrides = !!(perSkin && typeof perSkin === 'object' && Object.keys(perSkin).length > 0);
    if (hadAssetOverrides) {
      delete modState.prefs.assetOverrides[skinId];
    }

    const targetPreset = getSkinPreset(skinId);
    Object.assign(targetPreset, deepClone(originalPreset), {
      simplisticSkinMode: keepSimplisticMode
    });

    persistPrefs();
    updateFormFromPrefs();
    await applySkinColors();

    if (hadAssetOverrides) {
      log('Reset colors and restored asset edits to original scheme for ' + skinId + '.');
    } else {
      log('Reset colors to original scheme for ' + skinId + '.');
    }
    return true;
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
    const activeSkin = getActiveSkinEntry(userStore);
    const skinId = modState.prefs.selectedSkinId
      || (activeSkin && activeSkin.id)
      || (userStore && userStore.preferences && userStore.preferences.appearance && userStore.preferences.appearance.gameSkin)
      || 'canvas';

    captureOriginalSkinPreset(userStore, skinId);

    const liveState = readSkinDefaultColors(userStore, skinId);
    modState.prefs.skinPresets[skinId] = deepClone(liveState);
    applyPresetToUiState(liveState);
  }

  function resolveSelectedSkinId() {
    const userStore = getUserStore();
    if (modState.prefs.selectedSkinId) {
      return modState.prefs.selectedSkinId;
    }

    const activeSkin = getActiveSkinEntry(userStore);
    if (activeSkin && activeSkin.id) {
      return activeSkin.id;
    }

    return (userStore && userStore.preferences && userStore.preferences.appearance && userStore.preferences.appearance.gameSkin)
      || 'canvas';
  }

  function pullActiveSkinFromStore() {
    const userStore = getUserStore();
    if (!userStore || !userStore.preferences || !userStore.preferences.appearance) {
      return false;
    }

    const activeSkin = getActiveSkinEntry(userStore);
    const activeSkinId = (activeSkin && activeSkin.id) || userStore.preferences.appearance.gameSkin;
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
    const activeSkin = getActiveSkinEntry(userStore);
    const skinById = userStore && Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === modState.prefs.selectedSkinId)
      : null;
    const skin = skinById || activeSkin;
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

  function getSkinDataMapAssetUrls(userStore, skinId) {
    const entries = getSkinDataMapEntriesForSkinId(userStore, skinId);
    if (entries.length === 0) {
      return [];
    }

    const urls = [];
    entries.forEach(([, entry]) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      if (entry.assetUrls) {
        collectSkinAssetUrls(entry.assetUrls, urls, 0);
      }
      if (entry.skin) {
        collectSkinAssetUrls(entry.skin, urls, 0);
      }
    });

    return Array.from(new Set(urls)).filter((url) => isLikelyNoteAssetUrl(url));
  }

  function getSkinAssetUrls(skinId) {
    const domUrls = getSkinAssetUrlsFromDom();
    if (domUrls.length > 0) {
      return domUrls;
    }

    const userStore = getUserStore();
    const skin = (userStore && Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null) || getActiveSkinEntry(userStore);

    if (!skin) {
      return getSkinDataMapAssetUrls(userStore, skinId).slice(0, 8);
    }

    const urls = [];
    collectSkinAssetUrls(skin, urls, 0);

    const mapUrls = getSkinDataMapAssetUrls(userStore, skinId);
    mapUrls.forEach((url) => urls.push(url));

    return Array.from(new Set(urls)).filter((url) => isLikelyNoteAssetUrl(url)).slice(0, 8);
  }

  function isSkinsEditorRoute() {
    const pathname = PAGE_WINDOW.location.pathname || '';
    return /^\/(?:[a-z]{2}(?:-[a-z0-9]{2,8})*\/)?skins\/?$/i.test(pathname);
  }

  function normalizeAssetUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    if (url.startsWith('data:image/')) {
      return url;
    }

    try {
      const absolute = new URL(url, PAGE_WINDOW.location.href);
      return (absolute.origin + absolute.pathname + absolute.search).toLowerCase();
    } catch (error) {
      return url.split('#')[0].toLowerCase();
    }
  }

  function isSameAssetUrl(left, right) {
    const a = normalizeAssetUrl(left);
    const b = normalizeAssetUrl(right);
    if (!a || !b) {
      return false;
    }
    if (a === b) {
      return true;
    }
    if (a.startsWith('data:image/') || b.startsWith('data:image/')) {
      return a === b;
    }

    const aPath = a.replace(/^https?:\/\/[^/]+/i, '');
    const bPath = b.replace(/^https?:\/\/[^/]+/i, '');
    return aPath === bPath || a.endsWith(bPath) || b.endsWith(aPath);
  }

  function getEditableSkinAssetsFromDom() {
    const allTextNodes = Array.from(document.querySelectorAll('*'));
    const titleNode = allTextNodes.find((node) => (node.textContent || '').trim() === 'Skin Assets');
    if (!titleNode) {
      return [];
    }

    const root = titleNode.closest('section, div, aside') || titleNode.parentElement;
    if (!root) {
      return [];
    }

    const seen = new Set();
    const assets = [];
    Array.from(root.querySelectorAll('img')).forEach((img) => {
      const url = img.currentSrc || img.src || '';
      if (!url) {
        return;
      }

      const probe = url.toLowerCase();
      const isImage = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(url)
        || probe.startsWith('data:image/');
      if (!isImage) {
        return;
      }

      const normalized = normalizeAssetUrl(url);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);

      assets.push({
        url,
        label: (img.getAttribute('alt') || img.getAttribute('title') || '').trim() || ('Asset ' + (assets.length + 1))
      });
    });

    return assets.slice(0, 48);
  }

  function getEditableSkinAssets(skinId) {
    const domAssets = getEditableSkinAssetsFromDom();
    if (domAssets.length > 0) {
      return domAssets;
    }

    const userStore = getUserStore();
    const skin = (userStore && Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null) || getActiveSkinEntry(userStore);

    if (!skin) {
      const mapUrlsOnly = getSkinDataMapAssetUrls(userStore, skinId);
      return mapUrlsOnly.slice(0, 48).map((url, index) => ({
        url,
        label: 'Asset ' + (index + 1)
      }));
    }

    const urls = [];
    collectSkinAssetUrls(skin, urls, 0);

    const mapUrls = getSkinDataMapAssetUrls(userStore, skinId);
    mapUrls.forEach((url) => urls.push(url));

    const seen = new Set();
    const assets = [];
    urls.forEach((url) => {
      if (!url || typeof url !== 'string') {
        return;
      }
      const probe = url.toLowerCase();
      const isImage = /\.(png|jpg|jpeg|webp|gif|svg)(\?|$)/i.test(url)
        || probe.startsWith('data:image/');
      if (!isImage) {
        return;
      }

      const normalized = normalizeAssetUrl(url);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      assets.push({
        url,
        label: 'Asset ' + (assets.length + 1)
      });
    });

    return assets.slice(0, 48);
  }

  function inferPreviewPartFromAssetUrl(url) {
    const probe = String(url || '').toLowerCase();
    if (probe.includes('left')) return 'leftNoteColor';
    if (probe.includes('down')) return 'downNoteColor';
    if (probe.includes('up')) return 'upNoteColor';
    if (probe.includes('right')) return 'rightNoteColor';
    if (probe.includes('tail') || probe.includes('end')) return 'longNoteTailColor';
    if (probe.includes('hold') || probe.includes('long') || probe.includes('sustain')) return 'longNoteColor';
    return modState.selectedPreviewPart || 'leftNoteColor';
  }

  function replaceAssetUrlsDeep(target, replacementEntries, depth, visited) {
    if (!target || typeof target !== 'object' || depth > 7) {
      return false;
    }
    if (visited.has(target)) {
      return false;
    }
    visited.add(target);

    let changed = false;

    if (Array.isArray(target)) {
      for (let index = 0; index < target.length; index += 1) {
        const value = target[index];
        if (typeof value === 'string') {
          for (const [fromUrl, toUrl] of replacementEntries) {
            if (isSameAssetUrl(value, fromUrl)) {
              if (value !== toUrl) {
                target[index] = toUrl;
                changed = true;
              }
              break;
            }
          }
          continue;
        }
        if (value && typeof value === 'object') {
          if (replaceAssetUrlsDeep(value, replacementEntries, depth + 1, visited)) {
            changed = true;
          }
        }
      }
      return changed;
    }

    Object.keys(target).forEach((key) => {
      const value = target[key];
      if (typeof value === 'string') {
        for (const [fromUrl, toUrl] of replacementEntries) {
          if (isSameAssetUrl(value, fromUrl)) {
            if (value !== toUrl) {
              target[key] = toUrl;
              changed = true;
            }
            break;
          }
        }
        return;
      }

      if (value && typeof value === 'object') {
        if (replaceAssetUrlsDeep(value, replacementEntries, depth + 1, visited)) {
          changed = true;
        }
      }
    });

    return changed;
  }

  function ensureAssetOverrideBucket(skinId) {
    if (!modState.prefs.assetOverrides || typeof modState.prefs.assetOverrides !== 'object') {
      modState.prefs.assetOverrides = {};
    }
    if (!modState.prefs.assetOverrides[skinId] || typeof modState.prefs.assetOverrides[skinId] !== 'object') {
      modState.prefs.assetOverrides[skinId] = {};
    }
    return modState.prefs.assetOverrides[skinId];
  }

  function applyAssetOverridesToCurrentSkin(userStore, skinId) {
    if (!userStore || !skinId) {
      return false;
    }

    const perSkin = modState.prefs.assetOverrides && modState.prefs.assetOverrides[skinId];
    if (!perSkin || typeof perSkin !== 'object') {
      return false;
    }

    const replacementEntries = Object.entries(perSkin)
      .filter(([fromUrl, toUrl]) => typeof fromUrl === 'string' && typeof toUrl === 'string' && fromUrl && toUrl);
    if (replacementEntries.length === 0) {
      return false;
    }

    const skinPrefs = ensureSkinPrefs(userStore, skinId);
    const activeSkin = (Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null) || getActiveSkinEntry(userStore);
    const skinDataEntries = getSkinDataMapEntriesForSkinId(userStore, skinId);

    let changed = false;
    if (activeSkin) {
      changed = replaceAssetUrlsDeep(activeSkin, replacementEntries, 0, new WeakSet()) || changed;
    }
    changed = replaceAssetUrlsDeep(skinPrefs, replacementEntries, 0, new WeakSet()) || changed;

    skinDataEntries.forEach(([url, entry]) => {
      let entryChanged = false;
      if (entry.skin && typeof entry.skin === 'object') {
        entryChanged = replaceAssetUrlsDeep(entry.skin, replacementEntries, 0, new WeakSet()) || entryChanged;
      }
      if (entry.assetUrls && typeof entry.assetUrls === 'object') {
        entryChanged = replaceAssetUrlsDeep(entry.assetUrls, replacementEntries, 0, new WeakSet()) || entryChanged;
      }
      if (entryChanged && userStore.skinDataMap && typeof userStore.skinDataMap === 'object') {
        userStore.skinDataMap[url] = { ...entry };
      }
      changed = entryChanged || changed;
    });

    return changed;
  }

  function getSelectedEditableAsset(skinId) {
    const assets = getEditableSkinAssets(skinId);
    if (!assets.length) {
      return null;
    }

    const index = Number(modState.selectedAssetIndex);
    if (!Number.isFinite(index) || index < 0 || index >= assets.length) {
      modState.selectedAssetIndex = -1;
      return null;
    }

    modState.selectedAssetIndex = index;
    const selected = assets[index];
    if (!selected || !selected.url) {
      return selected;
    }

    return {
      ...selected,
      sourceUrl: resolveAssetOverrideSourceUrl(skinId, selected.url)
    };
  }

  async function tintSelectedAssetWithCurrentColor() {
    if (!isSkinsEditorRoute()) {
      log('Open https://v2.rhythm-plus.com/skins to edit skin assets directly.');
      return false;
    }

    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for asset editing.');
      return false;
    }

    const skinId = resolveSelectedSkinId();
    const asset = getSelectedEditableAsset(skinId);
    if (!asset || !asset.url) {
      log('No skin asset selected to tint.');
      return false;
    }

    const sourceUrl = asset.sourceUrl || asset.url;
    const tintColor = clampColor(modState.prefs.assetTintColor, '#ffffff');
    const tintedUrl = await getTintedAssetUrl(sourceUrl, tintColor);

    const bucket = ensureAssetOverrideBucket(skinId);
    bucket[sourceUrl] = tintedUrl || sourceUrl;
    persistPrefs();

    renderSkinPreview();
    log('Queued selected asset color for ' + skinId + '. Click Save Skin Colors to apply.');
    return true;
  }

  async function stripSelectedAsset() {
    if (!isSkinsEditorRoute()) {
      log('Open https://v2.rhythm-plus.com/skins to edit skin assets directly.');
      return false;
    }

    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for asset editing.');
      return false;
    }

    const skinId = resolveSelectedSkinId();
    const asset = getSelectedEditableAsset(skinId);
    if (!asset || !asset.url) {
      log('No skin asset selected to strip.');
      return false;
    }

    const sourceUrl = asset.sourceUrl || asset.url;
    const bucket = ensureAssetOverrideBucket(skinId);
    bucket[sourceUrl] = TRANSPARENT_ASSET_DATA_URL;
    persistPrefs();

    renderSkinPreview();
    log('Queued disable for selected asset on ' + skinId + '. Click Save Skin Colors to apply.');
    return true;
  }

  async function resetSelectedAssetToNormal() {
    if (!isSkinsEditorRoute()) {
      log('Open https://v2.rhythm-plus.com/skins to edit skin assets directly.');
      return false;
    }

    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for asset editing.');
      return false;
    }

    const skinId = resolveSelectedSkinId();
    const asset = getSelectedEditableAsset(skinId);
    if (!asset || !asset.url) {
      log('No skin asset selected to reset.');
      return false;
    }

    const sourceUrl = asset.sourceUrl || asset.url;
    const perSkin = modState.prefs.assetOverrides && modState.prefs.assetOverrides[skinId];
    if (!perSkin || typeof perSkin !== 'object' || !Object.prototype.hasOwnProperty.call(perSkin, sourceUrl)) {
      log('Selected asset is already using its normal color.');
      return false;
    }

    delete perSkin[sourceUrl];
    if (Object.keys(perSkin).length === 0) {
      delete modState.prefs.assetOverrides[skinId];
    }
    persistPrefs();

    renderSkinPreview();
    log('Queued normal color restore for selected asset on ' + skinId + '. Click Save Skin Colors to apply.');
    return true;
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] Clipboard write failed:', error);
    }
    return false;
  }

  async function exportSelectedSkinCustomColors() {
    const skinId = resolveSelectedSkinId();
    saveUiStateToPreset(skinId);
    const payload = {
      type: 'rhythm-plus-custom-colors',
      version: 1,
      skinId,
      exportedAt: new Date().toISOString(),
      skinPreset: deepClone(getSkinPreset(skinId)),
      assetTintColor: modState.prefs.assetTintColor,
      assetOverrides: deepClone((modState.prefs.assetOverrides && modState.prefs.assetOverrides[skinId]) || {})
    };

    const text = JSON.stringify(payload, null, 2);
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      PAGE_WINDOW.prompt('Copy custom color JSON:', text);
    }

    log(copied
      ? ('Exported custom colors for ' + skinId + ' to clipboard.')
      : ('Clipboard not available. Custom color JSON opened for copy for ' + skinId + '.'));
    return true;
  }

  async function applyCustomColorPayload(parsed, options) {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for import.');
      return { ok: false };
    }

    if (!parsed || typeof parsed !== 'object') {
      log('Invalid payload. Import cancelled.');
      return { ok: false };
    }

    const targetSkinId = options && typeof options.targetSkinId === 'string' && options.targetSkinId
      ? options.targetSkinId
      : resolveSelectedSkinId();
    const sourceSkinId = typeof parsed.skinId === 'string' && parsed.skinId ? parsed.skinId : targetSkinId;
    const liveDefaults = readSkinDefaultColors(userStore, targetSkinId);
    const importedPreset = normalizeSkinPreset(parsed.skinPreset, liveDefaults);
    importedPreset.simplisticSkinMode = !!modState.prefs.simplisticSkinMode;

    modState.prefs.selectedSkinId = targetSkinId;
    modState.prefs.skinPresets[targetSkinId] = deepClone(importedPreset);
    applyColorPresetToUiState(importedPreset);

    if (Object.prototype.hasOwnProperty.call(parsed, 'assetTintColor')) {
      modState.prefs.assetTintColor = clampColor(parsed.assetTintColor, modState.prefs.assetTintColor);
    }

    const importedOverrides = normalizeAssetOverrideMap(parsed.assetOverrides);
    if (Object.keys(importedOverrides).length > 0) {
      modState.prefs.assetOverrides[targetSkinId] = importedOverrides;
    } else {
      delete modState.prefs.assetOverrides[targetSkinId];
    }

    persistPrefs();
    updateFormFromPrefs();
    renderSkinPreview();

    if (options && options.autoApply) {
      await applySkinColors();
    }

    return {
      ok: true,
      targetSkinId,
      sourceSkinId
    };
  }

  async function importSelectedSkinCustomColors() {
    const raw = PAGE_WINDOW.prompt('Paste custom color JSON:');
    if (!raw) {
      return false;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      log('Invalid JSON. Import cancelled.');
      return false;
    }

    if (!parsed || typeof parsed !== 'object') {
      log('Invalid payload. Import cancelled.');
      return false;
    }

    const applied = await applyCustomColorPayload(parsed, { autoApply: false });
    if (!applied.ok) {
      return false;
    }

    const extra = applied.sourceSkinId !== applied.targetSkinId ? (' (from ' + applied.sourceSkinId + ')') : '';
    log('Imported custom colors for ' + applied.targetSkinId + extra + '. Click Save Skin Colors to apply.');
    return true;
  }

  async function clearAssetOverridesForSelectedSkin() {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for asset reset.');
      return false;
    }

    const skinId = resolveSelectedSkinId();
    captureOriginalRuntimeSnapshot(userStore);
    captureOriginalSkinPreset(userStore, skinId);
    restoreSkinRuntimeFromSnapshotForSkin(userStore, skinId);

    const originalPayload = buildOriginalSkinPayload(userStore, skinId);
    if (!originalPayload) {
      log('Original skin code was not found for ' + skinId + '.');
      return false;
    }

    const applied = await applyCustomColorPayload(originalPayload, {
      targetSkinId: skinId,
      autoApply: true
    });

    if (!applied.ok) {
      return false;
    }

    modState.selectedAssetIndex = -1;
    modState.tintedPreviewCache.clear();
    updateFormFromPrefs();

    log('Reset all asset edits by importing original skin code and auto-saving for ' + skinId + '.');
    return true;
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

          const { r, g, b } = hexToRgb(color);

          // Draw base sprite and replace non-transparent pixels with the selected color.
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha === 0) {
              continue;
            }
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
          ctx.putImageData(imageData, 0, 0);

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
    const editableAssets = getEditableSkinAssets(skinId);
    const laneParts = ['leftNoteColor', 'downNoteColor', 'upNoteColor', 'rightNoteColor'];

    if (!editableAssets.length) {
      modState.selectedAssetIndex = -1;
    } else if (modState.selectedAssetIndex >= editableAssets.length) {
      modState.selectedAssetIndex = -1;
    }

    const assetsBox = document.querySelector('[data-mod="skin-preview-assets"]');
    if (assetsBox) {
      assetsBox.innerHTML = editableAssets.length
        ? editableAssets.map((asset, index) => {
          const selected = index === modState.selectedAssetIndex ? ' is-selected' : '';
          const label = String(asset.label || ('Asset ' + (index + 1))).replace(/"/g, '&quot;');
          const displayUrl = resolveAssetDisplayUrl(skinId, asset.url);
          return '<button class="rp-asset-thumb' + selected + '" data-asset-index="' + index + '" title="' + label + '" type="button"><img src="' + displayUrl + '" alt="' + label + '"></button>';
        }).join('')
        : '<div class="rp-store-mod-note">No skin assets detected for this skin.</div>';
    }

    const selectedLabelNode = document.querySelector('[data-mod="selected-note-label"]');
    if (selectedLabelNode) {
      if (modState.selectedAssetIndex >= 0 && modState.selectedAssetIndex < editableAssets.length) {
        const selectedAsset = editableAssets[modState.selectedAssetIndex];
        selectedLabelNode.textContent = 'Selected: ' + (selectedAsset.label || ('Asset ' + (modState.selectedAssetIndex + 1)));
      } else {
        selectedLabelNode.textContent = 'Click asset to select or deselect';
      }
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

  }

  function ensureStyle() {
    if (document.getElementById(MOD_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = MOD_STYLE_ID;
    style.textContent = [
      '#' + MOD_ID + ' {',
      '  --rp-bg: radial-gradient(circle at 14% 10%, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0.06) 30%, rgba(59,130,246,0) 52%), linear-gradient(165deg, #050712 0%, #11193a 56%, #101d4a 100%);',
      '  --rp-fg: #f8fafc;',
      '  --rp-border: rgba(203, 213, 225, 0.42);',
      '  --rp-panel-bg: rgba(7, 13, 34, 0.66);',
      '  --rp-input-bg: rgba(13, 20, 49, 0.62);',
      '  --rp-tab-bg: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03));',
      '  --rp-tab-active: linear-gradient(92deg, #0ea5e9 0%, #2563eb 56%, #1d4ed8 100%);',
      '  --rp-shadow: 0 26px 56px rgba(3, 7, 18, 0.55);',
      '  --rp-accent: #38bdf8;',
      '  --rp-accent-soft: rgba(56, 189, 248, 0.3);',
      '  --rp-surface-stroke: rgba(148, 163, 184, 0.28);',
      '  position: fixed;',
      '  display: flex;',
      '  flex-direction: column;',
      '  top: 20px;',
      '  right: 20px;',
      '  width: min(860px, calc(100vw - 20px));',
      '  height: min(760px, calc(100vh - 20px));',
      '  min-width: 420px;',
      '  min-height: 320px;',
      '  max-width: calc(100vw - 10px);',
      '  max-height: calc(100vh - 10px);',
      '  z-index: 2147483647;',
      '  border: 1px solid var(--rp-border);',
      '  border-radius: 16px;',
      '  background: var(--rp-bg);',
      '  color: var(--rp-fg);',
      '  box-shadow: var(--rp-shadow);',
      '  font: 13px/1.45 "Trebuchet MS", "Segoe UI", "Ubuntu", "Noto Sans", sans-serif;',
      '  overflow: hidden;',
      '  isolation: isolate;',
      '  backdrop-filter: blur(16px);',
      '  resize: both;',
      '  transition: box-shadow 220ms ease, transform 220ms ease, filter 220ms ease;',
      '}',
      '#' + MOD_ID + '::before {',
      '  content: "";',
      '  position: absolute;',
      '  top: -28%;',
      '  left: -12%;',
      '  width: 64%;',
      '  height: 54%;',
      '  background: radial-gradient(circle, rgba(56,189,248,0.42), rgba(37,99,235,0));',
      '  filter: blur(40px);',
      '  opacity: 0.72;',
      '  pointer-events: none;',
      '  animation: rpNebulaDriftA 26s ease-in-out infinite alternate;',
      '  z-index: 0;',
      '}',
      '#' + MOD_ID + '::after {',
      '  content: "";',
      '  position: absolute;',
      '  inset: 0;',
      '  background-image: linear-gradient(120deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 40%), linear-gradient(0deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02));',
      '  pointer-events: none;',
      '  animation: rpNebulaDriftB 34s ease-in-out infinite alternate;',
      '  z-index: 0;',
      '}',
      '#' + MOD_ID + ' > * { position: relative; z-index: 1; }',
      '#' + MOD_ID + '::-webkit-resizer {',
      '  background: linear-gradient(135deg, rgba(56,189,248,0.9), rgba(59,130,246,0.22));',
      '  border-top-left-radius: 8px;',
      '}',
      '#' + MOD_ID + ' .rp-nebula-field {',
      '  position: absolute;',
      '  inset: -30%;',
      '  overflow: hidden;',
      '  pointer-events: none;',
      '  z-index: 0 !important;',
      '}',
      '#' + MOD_ID + ' .rp-nebula-orb {',
      '  position: absolute;',
      '  border-radius: 999px;',
      '  filter: blur(46px);',
      '  mix-blend-mode: screen;',
      '  opacity: 0.42;',
      '}',
      '#' + MOD_ID + ' .rp-nebula-orb.orb-a {',
      '  width: 340px;',
      '  height: 340px;',
      '  top: 2%;',
      '  left: 4%;',
      '  background: radial-gradient(circle at 30% 30%, rgba(56,189,248,0.95), rgba(56,189,248,0));',
      '  animation: rpNebulaDriftA 27s ease-in-out infinite alternate;',
      '}',
      '#' + MOD_ID + ' .rp-nebula-orb.orb-b {',
      '  width: 420px;',
      '  height: 420px;',
      '  right: -4%;',
      '  top: 22%;',
      '  background: radial-gradient(circle at 40% 40%, rgba(167,139,250,0.85), rgba(99,102,241,0));',
      '  animation: rpNebulaDriftB 36s ease-in-out infinite alternate;',
      '}',
      '#' + MOD_ID + ' .rp-nebula-orb.orb-c {',
      '  width: 300px;',
      '  height: 300px;',
      '  left: 36%;',
      '  bottom: -6%;',
      '  background: radial-gradient(circle at 38% 38%, rgba(45,212,191,0.76), rgba(13,148,136,0));',
      '  animation: rpNebulaDriftC 31s ease-in-out infinite alternate;',
      '}',
      '#' + MOD_ID + '.ui-no-effects::before,',
      '#' + MOD_ID + '.ui-no-effects::after,',
      '#' + MOD_ID + '.ui-no-effects .rp-nebula-field {',
      '  display: none;',
      '}',
      '#' + MOD_ID + '.theme-light {',
      '  --rp-bg: radial-gradient(circle at 12% 6%, rgba(6,182,212,0.2) 0%, rgba(6,182,212,0) 42%), linear-gradient(170deg, #fbfdff 0%, #e8eef7 56%, #dde7f4 100%);',
      '  --rp-fg: #0f172a;',
      '  --rp-border: rgba(100, 116, 139, 0.44);',
      '  --rp-panel-bg: rgba(255, 255, 255, 0.74);',
      '  --rp-input-bg: rgba(255, 255, 255, 0.82);',
      '  --rp-tab-bg: linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.02));',
      '  --rp-tab-active: linear-gradient(90deg, rgba(14,116,144,0.88), rgba(2,132,199,0.66));',
      '  --rp-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);',
      '  --rp-accent: #0f766e;',
      '  --rp-accent-soft: rgba(13, 148, 136, 0.22);',
      '  --rp-surface-stroke: rgba(100, 116, 139, 0.24);',
      '}',
      '#' + MOD_ID + '.theme-auto {',
      '  --rp-bg: radial-gradient(circle at 14% 10%, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0.06) 30%, rgba(59,130,246,0) 52%), linear-gradient(165deg, #050712 0%, #11193a 56%, #101d4a 100%);',
      '  --rp-fg: #f8fafc;',
      '  --rp-border: rgba(203, 213, 225, 0.42);',
      '  --rp-panel-bg: rgba(7, 13, 34, 0.66);',
      '  --rp-input-bg: rgba(13, 20, 49, 0.62);',
      '  --rp-tab-bg: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03));',
      '  --rp-tab-active: linear-gradient(92deg, #0ea5e9 0%, #2563eb 56%, #1d4ed8 100%);',
      '  --rp-shadow: 0 26px 56px rgba(3, 7, 18, 0.55);',
      '  --rp-accent: #38bdf8;',
      '  --rp-accent-soft: rgba(56, 189, 248, 0.3);',
      '  --rp-surface-stroke: rgba(148, 163, 184, 0.28);',
      '}',
      '#' + MOD_ID + '.theme-midnight-gold {',
      '  --rp-bg: radial-gradient(circle at 14% 10%, rgba(250,204,21,0.2) 0%, rgba(250,204,21,0.04) 34%, rgba(250,204,21,0) 52%), linear-gradient(168deg, #020202 0%, #0a0a0a 50%, #16120a 100%);',
      '  --rp-fg: #fefce8;',
      '  --rp-border: rgba(250, 204, 21, 0.46);',
      '  --rp-panel-bg: rgba(18, 14, 6, 0.72);',
      '  --rp-input-bg: rgba(26, 20, 8, 0.7);',
      '  --rp-tab-bg: linear-gradient(180deg, rgba(250,204,21,0.1), rgba(250,204,21,0.03));',
      '  --rp-tab-active: linear-gradient(92deg, #f59e0b 0%, #ca8a04 56%, #a16207 100%);',
      '  --rp-shadow: 0 28px 56px rgba(0, 0, 0, 0.62);',
      '  --rp-accent: #facc15;',
      '  --rp-accent-soft: rgba(250, 204, 21, 0.28);',
      '  --rp-surface-stroke: rgba(250, 204, 21, 0.24);',
      '}',
      '#' + MOD_ID + '.theme-sunset {',
      '  --rp-bg: radial-gradient(circle at 18% 12%, rgba(251,146,60,0.26) 0%, rgba(251,146,60,0.06) 30%, rgba(251,146,60,0) 52%), linear-gradient(168deg, #13040f 0%, #2a0b24 50%, #1f173a 100%);',
      '  --rp-fg: #fff7ed;',
      '  --rp-border: rgba(251, 146, 60, 0.46);',
      '  --rp-panel-bg: rgba(34, 11, 29, 0.7);',
      '  --rp-input-bg: rgba(44, 16, 38, 0.62);',
      '  --rp-tab-bg: linear-gradient(180deg, rgba(251,146,60,0.1), rgba(244,114,182,0.04));',
      '  --rp-tab-active: linear-gradient(92deg, #f97316 0%, #ec4899 56%, #8b5cf6 100%);',
      '  --rp-shadow: 0 28px 56px rgba(15, 2, 18, 0.62);',
      '  --rp-accent: #fb923c;',
      '  --rp-accent-soft: rgba(251, 146, 60, 0.28);',
      '  --rp-surface-stroke: rgba(251, 146, 60, 0.24);',
      '}',
      '#' + MOD_ID + ' * { box-sizing: border-box; }',
      '#' + MOD_ID + ' .rp-mini-icon { display: none; }',
      '#' + MOD_ID + '.is-minimized {',
      '  width: 58px !important;',
      '  height: 58px !important;',
      '  min-width: 58px !important;',
      '  min-height: 58px !important;',
      '  resize: none;',
      '  border-radius: 999px;',
      '  border-color: rgba(125, 211, 252, 0.74);',
      '  background: radial-gradient(circle at 35% 28%, rgba(125,211,252,0.45), rgba(14,116,144,0.22) 48%, rgba(15,23,42,0.9));',
      '  box-shadow: 0 0 0 1px rgba(125,211,252,0.28), 0 0 24px rgba(56,189,248,0.5), 0 10px 22px rgba(2,8,23,0.55);',
      '  overflow: visible;',
      '  transform: none;',
      '}',
      '#' + MOD_ID + '.is-minimized .rp-store-mod-header,',
      '#' + MOD_ID + '.is-minimized .rp-store-mod-shell { display: none; }',
      '#' + MOD_ID + '.is-minimized .rp-mini-icon {',
      '  width: 58px;',
      '  height: 58px;',
      '  display: grid;',
      '  place-items: center;',
      '  border: 1px solid rgba(191, 219, 254, 0.76);',
      '  border-radius: 999px;',
      '  background: conic-gradient(from 0deg, #22d3ee, #3b82f6, #a855f7, #22d3ee);',
      '  background-size: 180% 180%;',
      '  color: #f8fafc;',
      '  font-size: 10px;',
      '  font-weight: 900;',
      '  letter-spacing: 0.09em;',
      '  text-shadow: 0 1px 2px rgba(0,0,0,0.55);',
      '  cursor: pointer;',
      '  box-shadow: inset 0 0 16px rgba(15,23,42,0.65), 0 0 16px rgba(56,189,248,0.52);',
      '  animation: rpMiniSpin 6s linear infinite, rpMiniPulse 2.8s ease-in-out infinite;',
      '  transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease;',
      '}',
      '#' + MOD_ID + '.is-minimized .rp-mini-icon:hover { transform: scale(1.08); filter: brightness(1.08); box-shadow: inset 0 0 18px rgba(15,23,42,0.64), 0 0 22px rgba(56,189,248,0.66); }',
      '#' + MOD_ID + '.ui-no-effects .rp-store-mod-header { background: transparent; }',
      '#' + MOD_ID + '.ui-no-effects .rp-store-mod-button:hover { filter: none; transform: none; }',
      '#' + MOD_ID + '.ui-no-effects .rp-tab-btn:hover { transform: none; }',
      '#' + MOD_ID + ' .rp-store-mod-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 12px;',
      '  padding: 13px 15px;',
      '  cursor: move;',
      '  border-bottom: 1px solid var(--rp-surface-stroke);',
      '  background: linear-gradient(122deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0));',
      '  box-shadow: inset 0 -1px 0 rgba(255,255,255,0.08);',
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
      '  transition: transform 140ms ease, background 140ms ease, box-shadow 140ms ease;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-icon-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.2); box-shadow: 0 6px 12px rgba(15,23,42,0.28); }',
      '#' + MOD_ID + ' .rp-store-mod-icon-btn:active { transform: scale(0.96); }',
      '#' + MOD_ID + ' .rp-store-mod-shell {',
      '  display: grid;',
      '  grid-template-columns: 160px 1fr;',
      '  min-height: 0;',
      '  height: 100%;',
      '  flex: 1;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-tabs {',
      '  border-right: 1px solid var(--rp-surface-stroke);',
      '  padding: 10px;',
      '  display: grid;',
      '  align-content: start;',
      '  gap: 8px;',
      '  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));',
      '}',
      '#' + MOD_ID + ' .rp-tab-btn {',
      '  border: 1px solid rgba(255,255,255,0.12);',
      '  border-radius: 10px;',
      '  background: var(--rp-tab-bg);',
      '  color: var(--rp-fg);',
      '  text-align: left;',
      '  padding: 9px 11px;',
      '  cursor: pointer;',
      '  font-weight: 700;',
      '  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);',
      '  transition: background 160ms ease, transform 160ms ease, border-color 160ms ease;',
      '}',
      '#' + MOD_ID + ' .rp-tab-btn:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.34); }',
      '#' + MOD_ID + ' .rp-tab-btn.is-active {',
      '  background: var(--rp-tab-active);',
      '  border-color: rgba(255,255,255,0.4);',
      '  box-shadow: 0 8px 20px rgba(14,165,233,0.34);',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-content {',
      '  padding: 12px;',
      '  overflow-y: auto;',
      '  min-height: 0;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-content::-webkit-scrollbar { width: 10px; }',
      '#' + MOD_ID + ' .rp-store-mod-content::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(148,163,184,0.58), rgba(100,116,139,0.48)); border-radius: 999px; }',
      '#' + MOD_ID + ' .rp-store-mod-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.06); }',
      '#' + MOD_ID + ' .rp-panel { display: none; }',
      '#' + MOD_ID + ' .rp-panel.is-active { display: block; animation: rpPanelIn 180ms ease; }',
      '#' + MOD_ID + ' .rp-store-mod-section { margin-bottom: 14px; border: 1px solid var(--rp-surface-stroke); border-radius: 12px; padding: 10px; background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }',
      '#' + MOD_ID + ' .rp-store-mod-section:last-child { margin-bottom: 0; }',
      '#' + MOD_ID + ' .rp-store-mod-section-title {',
      '  margin: 0 0 10px;',
      '  font-size: 11px;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.1em;',
      '  opacity: 0.92;',
      '  color: var(--rp-accent);',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-grid { display: grid; gap: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-button {',
      '  width: 100%;',
      '  border: 1px solid rgba(255,255,255,0.24);',
      '  border-radius: 10px;',
      '  background: linear-gradient(96deg, #0ea5e9 0%, #2563eb 58%, #1d4ed8 100%);',
      '  color: var(--rp-fg);',
      '  padding: 10px 12px;',
      '  cursor: pointer;',
      '  font-weight: 700;',
      '  box-shadow: 0 10px 20px rgba(14,165,233,0.24), inset 0 1px 0 rgba(255,255,255,0.22);',
      '  transition: transform 150ms ease, filter 150ms ease, box-shadow 150ms ease;',
      '  position: relative;',
      '  overflow: hidden;',
      '  isolation: isolate;',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-button::after { content: ""; position: absolute; top: 0; left: -55%; width: 38%; height: 100%; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.24), rgba(255,255,255,0)); transform: skewX(-20deg); transition: left 260ms ease; z-index: 0; }',
      '#' + MOD_ID + ' .rp-store-mod-button:hover::after { left: 120%; }',
      '#' + MOD_ID + ' .rp-store-mod-button:hover { transform: translateY(-1px); filter: brightness(1.07); box-shadow: 0 14px 24px rgba(14,165,233,0.32), inset 0 1px 0 rgba(255,255,255,0.24); }',
      '#' + MOD_ID + ' .rp-store-mod-button:active { transform: translateY(0); }',
      '#' + MOD_ID + ' .rp-store-mod-button:active,',
      '#' + MOD_ID + ' .rp-tab-btn:active,',
      '#' + MOD_ID + ' .rp-asset-thumb:active,',
      '#' + MOD_ID + ' .rp-mini-icon:active {',
      '  transform: scale(0.97);',
      '}',
      '#' + MOD_ID + ' .rp-click-pop { animation: rpClickPop 260ms cubic-bezier(0.16, 1, 0.3, 1); }',
      '#' + MOD_ID + ' .rp-master-toggle { text-transform: uppercase; letter-spacing: 0.08em; }',
      '#' + MOD_ID + ' .rp-master-toggle.is-on {',
      '  background: linear-gradient(96deg, #16a34a 0%, #22c55e 58%, #15803d 100%);',
      '  box-shadow: 0 12px 22px rgba(22,163,74,0.32), inset 0 1px 0 rgba(255,255,255,0.24);',
      '}',
      '#' + MOD_ID + ' .rp-store-mod-button.alt { background: linear-gradient(98deg, #0f766e 0%, #0ea5a6 100%); box-shadow: 0 10px 20px rgba(13,148,136,0.26), inset 0 1px 0 rgba(255,255,255,0.24); }',
      '#' + MOD_ID + ' .rp-store-mod-button.warn { background: linear-gradient(98deg, #c2410c 0%, #ea580c 100%); box-shadow: 0 10px 20px rgba(234,88,12,0.22), inset 0 1px 0 rgba(255,255,255,0.2); }',
      '#' + MOD_ID + ' .rp-store-mod-button.dim { background: linear-gradient(98deg, #334155 0%, #475569 100%); box-shadow: 0 8px 16px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.18); }',
      '#' + MOD_ID + ' .rp-og-reset-btn { margin-top: 10px; background: linear-gradient(97deg, #7c3aed 0%, #4338ca 100%); box-shadow: 0 10px 20px rgba(99,102,241,0.28), inset 0 1px 0 rgba(255,255,255,0.22); }',
      '#' + MOD_ID + ' .rp-advanced-box {',
      '  display: none;',
      '  background: var(--rp-panel-bg);',
      '  border: 1px solid var(--rp-surface-stroke);',
      '  border-radius: 10px;',
      '  padding: 10px;',
      '}',
      '#' + MOD_ID + ' .rp-advanced-box.is-open { display: block; }',
      '#' + MOD_ID + ' .rp-store-mod-field { display: grid; gap: 6px; margin-bottom: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-field:last-child { margin-bottom: 0; }',
      '#' + MOD_ID + ' .rp-store-mod-label { font-size: 12px; opacity: 0.92; }',
      '#' + MOD_ID + ' .rp-store-mod-inline { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
      '#' + MOD_ID + ' .rp-store-mod-input, #' + MOD_ID + ' .rp-store-mod-select {',
      '  width: 100%;',
      '  border: 1px solid rgba(255, 255, 255, 0.22);',
      '  border-radius: 8px;',
      '  background: var(--rp-input-bg);',
      '  color: var(--rp-fg);',
      '  padding: 8px 10px;',
      '  box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);',
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
      '  border: 1px solid var(--rp-surface-stroke);',
      '  border-radius: 12px;',
      '  padding: 10px;',
      '  margin-bottom: 10px;',
      '  background: linear-gradient(160deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));',
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
      '  border-radius: 12px;',
      '  padding: 10px;',
      '  background: radial-gradient(circle at 18% 22%, rgba(56,189,248,0.12), rgba(56,189,248,0) 40%), #06090f;',
      '  border: 1px solid rgba(255, 255, 255, 0.16);',
      '}',
      '#' + MOD_ID + ' .rp-preview-layout { display: grid; grid-template-columns: 1fr; gap: 10px; }',
      '#' + MOD_ID + ' .rp-preview-asset-panel {',
      '  border-left: 0;',
      '  padding-left: 0;',
      '  overflow-y: auto;',
      '  max-height: 290px;',
      '}',
      '#' + MOD_ID + ' .rp-preview-assets-title { font-size: 12px; margin-bottom: 8px; opacity: 0.9; }',
      '#' + MOD_ID + ' .rp-preview-assets-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
      '#' + MOD_ID + ' .rp-asset-thumb { border-radius: 10px; background: linear-gradient(160deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)); border: 1px solid rgba(255,255,255,0.18); padding: 6px; width: 100%; cursor: pointer; transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease; }',
      '#' + MOD_ID + ' .rp-asset-thumb:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.34); }',
      '#' + MOD_ID + ' .rp-asset-thumb.is-selected { border-color: rgba(56,189,248,0.94); box-shadow: 0 0 0 2px rgba(56,189,248,0.3) inset, 0 8px 18px rgba(14,165,233,0.22); }',
      '#' + MOD_ID + ' .rp-asset-thumb img { width: 100%; height: 54px; object-fit: contain; display: block; }',
      '#' + MOD_ID + ' .rp-preview-track {',
      '  display: grid;',
      '  grid-template-columns: repeat(4, 1fr);',
      '  gap: 8px;',
      '}',
      '#' + MOD_ID + ' .rp-preview-parts { margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: center; }',
      '#' + MOD_ID + ' .rp-preview-parts [data-mod="selected-note-color"] { grid-column: 1 / -1; }',
      '#' + MOD_ID + ' .rp-preview-part-btn { border: 1px solid rgba(255,255,255,0.25); border-radius: 9px; background: rgba(255,255,255,0.06); color: var(--rp-fg); padding: 8px; cursor: pointer; text-align: center; transition: transform 130ms ease, border-color 130ms ease; }',
      '#' + MOD_ID + ' .rp-preview-part-btn:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.38); }',
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
      '#' + MOD_ID + ' .rp-preview-footer { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }',
      '#' + MOD_ID + ' .rp-preview-footer-asset-color { grid-template-columns: 78px 1fr; }',
      '#' + MOD_ID + ' [data-mod="selected-asset-color"] { width: 100%; min-height: 42px; padding: 2px; border-radius: 10px; }',
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
      '@keyframes rpNebulaDriftA {',
      '  0% { transform: translate3d(-16px, -10px, 0) scale(1); }',
      '  50% { transform: translate3d(18px, 14px, 0) scale(1.08); }',
      '  100% { transform: translate3d(-8px, 10px, 0) scale(0.98); }',
      '}',
      '@keyframes rpNebulaDriftB {',
      '  0% { transform: translate3d(8px, -14px, 0) scale(1); }',
      '  50% { transform: translate3d(-22px, 10px, 0) scale(1.1); }',
      '  100% { transform: translate3d(14px, 18px, 0) scale(0.98); }',
      '}',
      '@keyframes rpNebulaDriftC {',
      '  0% { transform: translate3d(0, 12px, 0) scale(1); }',
      '  50% { transform: translate3d(16px, -10px, 0) scale(1.06); }',
      '  100% { transform: translate3d(-12px, 8px, 0) scale(1); }',
      '}',
      '@keyframes rpMiniPulse {',
      '  0% { box-shadow: inset 0 0 16px rgba(15,23,42,0.65), 0 0 14px rgba(56,189,248,0.4); }',
      '  50% { box-shadow: inset 0 0 20px rgba(15,23,42,0.62), 0 0 24px rgba(56,189,248,0.75); }',
      '  100% { box-shadow: inset 0 0 16px rgba(15,23,42,0.65), 0 0 14px rgba(56,189,248,0.4); }',
      '}',
      '@keyframes rpMiniSpin {',
      '  0% { background-position: 0% 50%; }',
      '  100% { background-position: 220% 50%; }',
      '}',
      '@keyframes rpClickPop {',
      '  0% { transform: scale(0.95); }',
      '  45% { transform: scale(1.03); }',
      '  100% { transform: scale(1); }',
      '}',
      'body.rhythm-plus-mod-hide-bga iframe[src*="youtube.com"],',
      'body.rhythm-plus-mod-hide-bga iframe[src*="youtube-nocookie.com"],',
      'body.rhythm-plus-mod-hide-bga video {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '}',
      'body.rhythm-plus-mod-bare-skin [class*="particle"],',
      'body.rhythm-plus-mod-bare-skin [class*="spark"],',
      'body.rhythm-plus-mod-bare-skin [class*="trail"],',
      'body.rhythm-plus-mod-bare-skin [class*="splash"],',
      'body.rhythm-plus-mod-bare-skin [class*="flare"],',
      'body.rhythm-plus-mod-bare-skin [class*="bloom"],',
      'body.rhythm-plus-mod-bare-skin [class*="confetti"],',
      'body.rhythm-plus-mod-bare-skin [class*="judgement"],',
      'body.rhythm-plus-mod-bare-skin [class*="hit-effect"],',
      'body.rhythm-plus-mod-bare-skin [class*="combo-effect"] {',
      '  display: none !important;',
      '  opacity: 0 !important;',
      '}',
      'body.rhythm-plus-mod-bare-skin [class*="note"],',
      'body.rhythm-plus-mod-bare-skin [class*="arrow"],',
      'body.rhythm-plus-mod-bare-skin [class*="lane"] {',
      '  filter: none !important;',
      '  box-shadow: none !important;',
      '  text-shadow: none !important;',
      '  animation: none !important;',
      '  transition: none !important;',
      '}',
      'body.disable-animations *,',
      'body.disable-animations *::before,',
      'body.disable-animations *::after {',
      '  animation-duration: 0s !important;',
      '  transition-duration: 0s !important;',
      '}',
      '@media (max-width: 760px) {',
      '  #' + MOD_ID + ' { width: calc(100vw - 20px); height: calc(100vh - 20px); min-width: 0; min-height: 0; resize: none; top: 10px; right: 10px; left: 10px; }',
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
      '  #' + MOD_ID + ' .rp-preview-asset-panel { border-left: 0; padding-left: 0; border-top: 0; padding-top: 0; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + MOD_ID + ', #' + MOD_ID + ' *, #' + MOD_ID + ' *::before, #' + MOD_ID + ' *::after {',
      '    animation: none !important;',
      '    transition: none !important;',
      '  }',
      '}',
      '@media (prefers-color-scheme: light) {',
      '  #' + MOD_ID + '.theme-auto {',
      '    --rp-bg: radial-gradient(circle at 12% 6%, rgba(6,182,212,0.2) 0%, rgba(6,182,212,0) 42%), linear-gradient(170deg, #fbfdff 0%, #e8eef7 56%, #dde7f4 100%);',
      '    --rp-fg: #0f172a;',
      '    --rp-border: rgba(100, 116, 139, 0.44);',
      '    --rp-panel-bg: rgba(255, 255, 255, 0.74);',
      '    --rp-input-bg: rgba(255, 255, 255, 0.82);',
      '    --rp-tab-bg: linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.02));',
      '    --rp-tab-active: linear-gradient(90deg, rgba(14,116,144,0.88), rgba(2,132,199,0.66));',
      '    --rp-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);',
      '    --rp-accent: #0f766e;',
      '    --rp-accent-soft: rgba(13, 148, 136, 0.22);',
      '    --rp-surface-stroke: rgba(100, 116, 139, 0.24);',
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

    root.classList.remove('theme-dark', 'theme-light', 'theme-auto', 'theme-midnight-gold', 'theme-sunset');
    root.classList.add('theme-' + modState.prefs.uiTheme);
    root.classList.toggle('ui-no-effects', !!modState.prefs.uiDisableEffects);
    root.classList.toggle('ui-no-motion', !!modState.prefs.uiDisableAnimations);
  }

  function applyFpsSettings(userStore) {
    const unlockFps = !!modState.prefs.unlockFps;
    const parsedLimit = Number(modState.prefs.fpsLimit);
    const fpsLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.round(parsedLimit) : 0;
    const unlockedCap = 1000;

    // Best effort: set known/likely FPS cap fields if they exist in the live performance config.
    if (userStore && userStore.performanceConfig && typeof userStore.performanceConfig === 'object') {
      const perf = userStore.performanceConfig;
      const capCandidates = ['fpsCap', 'frameRateCap', 'frameRateLimit', 'maxFps', 'targetFps', 'fpsLimit'];
      const disableCandidates = ['limitFps', 'capFps', 'fpsCapped', 'frameRateLimited'];

      capCandidates.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(perf, key)) {
          perf[key] = unlockFps ? unlockedCap : (fpsLimit || 60);
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
      ticker.maxFPS = unlockFps ? unlockedCap : (fpsLimit || 60);
    }
  }

  function restorePerformanceDefaultsInStore(userStore) {
    if (!userStore) {
      return;
    }

    const snapshot = modState.originalRuntimeState;
    if (snapshot && snapshot.performanceConfig && typeof snapshot.performanceConfig === 'object') {
      userStore.performanceConfig = deepClone(snapshot.performanceConfig);
    } else if (userStore.performanceConfig && typeof userStore.performanceConfig === 'object') {
      userStore.performanceConfig.lowQualityMode = false;
      userStore.performanceConfig.disableAnimations = false;
    }

    if (!userStore.preferences || !userStore.preferences.appearance || !userStore.preferences.game) {
      return;
    }

    const appearance = userStore.preferences.appearance;
    const game = userStore.preferences.game;
    const snapAppearance = snapshot
      && snapshot.preferences
      && snapshot.preferences.appearance
      && typeof snapshot.preferences.appearance === 'object'
      ? snapshot.preferences.appearance
      : null;
    const snapGame = snapshot
      && snapshot.preferences
      && snapshot.preferences.game
      && typeof snapshot.preferences.game === 'object'
      ? snapshot.preferences.game
      : null;

    appearance.visualizer = snapAppearance && typeof snapAppearance.visualizer === 'string'
      ? snapAppearance.visualizer
      : 'purpleSpace';
    appearance.visualizerPrefs = snapAppearance && snapAppearance.visualizerPrefs && typeof snapAppearance.visualizerPrefs === 'object'
      ? deepClone(snapAppearance.visualizerPrefs)
      : {};
    appearance.bgaPosition = snapAppearance && typeof snapAppearance.bgaPosition === 'string'
      ? snapAppearance.bgaPosition
      : 'embedded';
    appearance.hideOverlaysWhenFloating = !!(snapAppearance && snapAppearance.hideOverlaysWhenFloating);
    appearance.blur = !!(snapAppearance && snapAppearance.blur);
    appearance.blurMenuItem = !!(snapAppearance && snapAppearance.blurMenuItem);

    game.backgroundDim = snapGame && Number.isFinite(Number(snapGame.backgroundDim))
      ? Number(snapGame.backgroundDim)
      : 0.5;
    game.accuracyBarPosition = snapGame && typeof snapGame.accuracyBarPosition === 'string'
      ? snapGame.accuracyBarPosition
      : 'right';

    const configStore = getConfigStore();
    if (
      configStore
      && Object.prototype.hasOwnProperty.call(configStore, 'showConfetti')
      && snapshot
      && typeof snapshot.showConfetti === 'boolean'
    ) {
      configStore.showConfetti = snapshot.showConfetti;
    }

    if (appearance.gameSkinPrefs && typeof appearance.gameSkinPrefs === 'object') {
      appearance.gameSkinPrefs = { ...appearance.gameSkinPrefs };
    }
    userStore.preferences.appearance = { ...appearance };
    userStore.preferences.game = { ...game };
  }

  function applyPerformanceHardening(userStore, options) {
    if (!userStore || !userStore.performanceConfig || typeof userStore.performanceConfig !== 'object') {
      return;
    }

    if (options && options.disableBgaOnly) {
      return;
    }

    const perf = userStore.performanceConfig;
    const setBooleanIfPresent = (keys, value) => {
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(perf, key)) {
          perf[key] = value;
        }
      });
    };
    const setNumberIfPresent = (keys, value) => {
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(perf, key)) {
          perf[key] = value;
        }
      });
    };

    setBooleanIfPresent(['vsync', 'vSync', 'enableVsync', 'useVsync'], false);
    setBooleanIfPresent(['antialias', 'antiAliasing', 'enableAntialias'], false);
    setBooleanIfPresent(['postProcessing', 'postProcess', 'bloom', 'motionBlur', 'screenShake'], false);
    setBooleanIfPresent(['particleEffects', 'hitEffects', 'laneEffects', 'uiAnimations'], false);
    setBooleanIfPresent(['disablePostProcessing', 'disableEffects', 'disableParticles'], true);
    setNumberIfPresent(['particleLimit', 'maxParticles', 'particles'], 0);
  }

  function applyPerformanceOptions(userStore) {
    const options = modState.prefs.perfOptions;
    const bgaOnly = !!options.disableBgaOnly;

    if (userStore.performanceConfig && typeof userStore.performanceConfig === 'object') {
      userStore.performanceConfig.lowQualityMode = bgaOnly ? userStore.performanceConfig.lowQualityMode : !!options.lowQualityMode;
      userStore.performanceConfig.disableAnimations = bgaOnly ? userStore.performanceConfig.disableAnimations : !!options.disableAnimations;
    }

    if (bgaOnly) {
      userStore.preferences.appearance.bgaPosition = 'floating';
      userStore.preferences.appearance.hideOverlaysWhenFloating = true;
      userStore.preferences.appearance.visualizer = 'off';
      userStore.preferences.appearance.visualizerPrefs = {};
      userStore.preferences.game.backgroundDim = 0.8;
    } else {
      userStore.preferences.appearance.visualizer = options.disableVisualizer ? 'off' : 'purpleSpace';
      userStore.preferences.appearance.visualizerPrefs = options.disableVisualizer ? {} : userStore.preferences.appearance.visualizerPrefs;
      userStore.preferences.appearance.bgaPosition = options.forceFloatingBga ? 'floating' : 'embedded';
      userStore.preferences.appearance.hideOverlaysWhenFloating = !!options.forceFloatingBga;
      userStore.preferences.game.backgroundDim = options.dimBackgroundHard ? 0.8 : 0.5;
      userStore.preferences.game.accuracyBarPosition = options.disableAccuracyBar ? 'off' : 'right';
      userStore.preferences.appearance.blur = false;
      userStore.preferences.appearance.blurMenuItem = false;
    }

    const configStore = getConfigStore();
    if (configStore) {
      configStore.showConfetti = bgaOnly ? configStore.showConfetti : !options.disableConfetti;
    }

    applyFpsSettings(userStore);
    applyPerformanceHardening(userStore, options);

    modState.prefs.removeBgaCss = !!(options.hideBgaCss || options.disableBgaOnly);
    if (modState.prefs.removeBgaCss) {
      document.body.classList.add('rhythm-plus-mod-hide-bga');
    } else {
      document.body.classList.remove('rhythm-plus-mod-hide-bga');
    }
  }

  async function applyPerformanceChanges(silentMode) {
    const userStore = getUserStore();
    if (!userStore) {
      log('User store not ready for performance mode.');
      return false;
    }

    if (!modState.prefs.lowSpecMode) {
      restorePerformanceDefaultsInStore(userStore);
      modState.prefs.removeBgaCss = false;
      persistPrefs();
      document.body.classList.remove('rhythm-plus-mod-hide-bga');
      await persistUserStore(userStore);
      if (!silentMode) {
        log('Performance mode is off. Advanced performance settings were skipped.');
      }
      return true;
    }

    applyPerformanceOptions(userStore);
    persistPrefs();
    await persistUserStore(userStore);
    if (!silentMode) {
      log('Applied performance mode changes.');
    }
    return true;
  }

  async function resetPerformanceModeDefaults() {
    const userStore = getUserStore();

    modState.prefs.lowSpecMode = false;
    modState.prefs.perfOptions = { ...DEFAULT_PERF_OPTIONS };
    modState.prefs.unlockFps = true;
    modState.prefs.fpsLimit = 0;
    modState.prefs.removeBgaCss = false;
    persistPrefs();
    updateFormFromPrefs();

    if (userStore) {
      restorePerformanceDefaultsInStore(userStore);
      await persistUserStore(userStore);
    }

    document.body.classList.remove('rhythm-plus-mod-hide-bga');
    log('Reset performance mode settings to defaults. Toggle Performance Mode on when you want to apply them.');
    return true;
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

  function getActiveSkinEntry(userStore) {
    if (!userStore) {
      return null;
    }

    if (userStore.gameSkin && typeof userStore.gameSkin === 'object') {
      return userStore.gameSkin;
    }

    const skinId = userStore.preferences && userStore.preferences.appearance
      ? userStore.preferences.appearance.gameSkin
      : '';
    if (!Array.isArray(userStore.skins) || userStore.skins.length === 0) {
      return null;
    }

    return userStore.skins.find((item) => item && item.id === skinId) || userStore.skins[0] || null;
  }

  function getSkinDataMapEntriesForSkinId(userStore, skinId) {
    if (!userStore || !userStore.skinDataMap || typeof userStore.skinDataMap !== 'object') {
      return [];
    }

    const mapEntries = Object.entries(userStore.skinDataMap)
      .filter(([, value]) => value && typeof value === 'object');
    if (mapEntries.length === 0) {
      return [];
    }

    const urls = [];
    const byId = Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null;
    if (byId && byId.url) {
      urls.push(byId.url);
    }

    const activeSkin = getActiveSkinEntry(userStore);
    if (activeSkin && activeSkin.url) {
      urls.push(activeSkin.url);
    }

    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length > 0) {
      const directMatches = uniqueUrls
        .map((url) => [url, userStore.skinDataMap[url]])
        .filter(([, value]) => value && typeof value === 'object');
      if (directMatches.length > 0) {
        return directMatches;
      }
    }

    const probe = String(skinId || '').toLowerCase();
    if (probe) {
      const heuristicMatches = mapEntries.filter(([url]) => String(url || '').toLowerCase().includes(probe));
      if (heuristicMatches.length > 0) {
        return heuristicMatches;
      }
    }

    return [];
  }

  async function persistUserStore(userStore, options) {
    if (!userStore) {
      return;
    }

    const syncRemote = !!(options && options.syncRemote);

    try {
      if (typeof userStore.$persist === 'function') {
        userStore.$persist();
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] $persist failed:', error);
    }

    try {
      if (typeof userStore.updatePreferencesBackup === 'function') {
        userStore.updatePreferencesBackup();
      }
    } catch (error) {
      console.warn('[Rhythm+ Mod] updatePreferencesBackup failed:', error);
    }

    if (!syncRemote) {
      return;
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

  function getLaneColorArray() {
    return [
      modState.prefs.leftNoteColor,
      modState.prefs.downNoteColor,
      modState.prefs.upNoteColor,
      modState.prefs.rightNoteColor
    ];
  }

  function applyCurrentColorsToSkinObject(targetSkin) {
    if (!targetSkin || typeof targetSkin !== 'object') {
      return;
    }

    const laneColors = getLaneColorArray();
    targetSkin.noteColor = modState.prefs.noteColor;
    targetSkin.trackColor = modState.prefs.trackColor;
    targetSkin.trackHitColor = modState.prefs.trackHitColor;
    targetSkin.leftNoteColor = laneColors[0];
    targetSkin.downNoteColor = laneColors[1];
    targetSkin.upNoteColor = laneColors[2];
    targetSkin.rightNoteColor = laneColors[3];
    targetSkin.longNoteColor = modState.prefs.longNoteColor;
    targetSkin.longNoteTailColor = modState.prefs.longNoteTailColor;
    targetSkin.sustainColor = modState.prefs.longNoteColor;
    targetSkin.sustainTailColor = modState.prefs.longNoteTailColor;
    targetSkin.noteColors = laneColors.slice();
    targetSkin.arrowColors = laneColors.slice();

    if (!targetSkin.colors || typeof targetSkin.colors !== 'object') {
      targetSkin.colors = {};
    }
    targetSkin.colors.note = modState.prefs.noteColor;
    targetSkin.colors.track = modState.prefs.trackColor;
    targetSkin.colors.trackHit = modState.prefs.trackHitColor;

    if (!targetSkin.colors.lanes || typeof targetSkin.colors.lanes !== 'object') {
      targetSkin.colors.lanes = {};
    }
    targetSkin.colors.lanes.left = laneColors[0];
    targetSkin.colors.lanes.down = laneColors[1];
    targetSkin.colors.lanes.up = laneColors[2];
    targetSkin.colors.lanes.right = laneColors[3];

    if (!targetSkin.colors.hold || typeof targetSkin.colors.hold !== 'object') {
      targetSkin.colors.hold = {};
    }
    targetSkin.colors.hold.head = modState.prefs.longNoteColor;
    targetSkin.colors.hold.tail = modState.prefs.longNoteTailColor;
  }

  function resolveSkinColorForKey(key) {
    const probe = String(key || '').toLowerCase();
    if (!probe) {
      return null;
    }

    if (probe.includes('trackhit') || (probe.includes('track') && probe.includes('hit'))) {
      return modState.prefs.trackHitColor;
    }
    if (probe.includes('track')) {
      return modState.prefs.trackColor;
    }
    if (probe.includes('left')) {
      return modState.prefs.leftNoteColor;
    }
    if (probe.includes('down')) {
      return modState.prefs.downNoteColor;
    }
    if (probe.includes('up')) {
      return modState.prefs.upNoteColor;
    }
    if (probe.includes('right')) {
      return modState.prefs.rightNoteColor;
    }
    if ((probe.includes('tail') || probe.includes('end')) && (probe.includes('long') || probe.includes('hold') || probe.includes('sustain'))) {
      return modState.prefs.longNoteTailColor;
    }
    if (probe.includes('long') || probe.includes('hold') || probe.includes('sustain')) {
      return modState.prefs.longNoteColor;
    }
    if (probe.includes('note') || probe.includes('arrow') || probe.includes('lane')) {
      return modState.prefs.noteColor;
    }

    return null;
  }

  function forceColorAliasesDeep(target, depth, visited) {
    if (!target || typeof target !== 'object' || depth > 6) {
      return;
    }
    if (visited.has(target)) {
      return;
    }
    visited.add(target);

    if (Array.isArray(target)) {
      target.forEach((item) => forceColorAliasesDeep(item, depth + 1, visited));
      return;
    }

    const laneColors = getLaneColorArray();
    Object.keys(target).forEach((key) => {
      const value = target[key];
      const lower = key.toLowerCase();

      if ((lower === 'notecolors' || lower === 'arrowcolors' || lower === 'lanecolors') && Array.isArray(value)) {
        target[key] = laneColors.slice();
        return;
      }

      if (lower === 'colors' && value && typeof value === 'object' && !Array.isArray(value)) {
        value.note = modState.prefs.noteColor;
        value.track = modState.prefs.trackColor;
        value.trackHit = modState.prefs.trackHitColor;
        if (!value.lanes || typeof value.lanes !== 'object') {
          value.lanes = {};
        }
        value.lanes.left = modState.prefs.leftNoteColor;
        value.lanes.down = modState.prefs.downNoteColor;
        value.lanes.up = modState.prefs.upNoteColor;
        value.lanes.right = modState.prefs.rightNoteColor;
        if (!value.hold || typeof value.hold !== 'object') {
          value.hold = {};
        }
        value.hold.head = modState.prefs.longNoteColor;
        value.hold.tail = modState.prefs.longNoteTailColor;
      }

      if (typeof value === 'string' && lower.includes('color')) {
        const nextColor = resolveSkinColorForKey(lower);
        if (nextColor) {
          target[key] = nextColor;
        }
        return;
      }

      if (value && typeof value === 'object') {
        if (!Array.isArray(value) && lower === 'lanes') {
          value.left = modState.prefs.leftNoteColor;
          value.down = modState.prefs.downNoteColor;
          value.up = modState.prefs.upNoteColor;
          value.right = modState.prefs.rightNoteColor;
        }
        if (!Array.isArray(value) && lower === 'hold') {
          value.head = modState.prefs.longNoteColor;
          value.tail = modState.prefs.longNoteTailColor;
        }
        forceColorAliasesDeep(value, depth + 1, visited);
      }
    });
  }

  function forceDisableEffectsDeep(target, depth, visited) {
    if (!target || typeof target !== 'object' || depth > 6) {
      return;
    }
    if (visited.has(target)) {
      return;
    }
    visited.add(target);

    if (Array.isArray(target)) {
      target.forEach((item) => forceDisableEffectsDeep(item, depth + 1, visited));
      return;
    }

    const effectKeyPattern = /(glow|particle|spark|trail|splash|flare|aura|bloom|blur|shake|flash|pulse|wobble|spin|rotate|rainbow|gradient|anim|effect|overlay|judg(e)?ment|combo|afterimage|ghost)/i;
    const modeKeyPattern = /(mode|type|style)$/i;

    Object.keys(target).forEach((key) => {
      const value = target[key];
      const lower = key.toLowerCase();

      if (effectKeyPattern.test(lower)) {
        if (typeof value === 'boolean') {
          target[key] = false;
          return;
        }
        if (typeof value === 'number') {
          target[key] = 0;
          return;
        }
        if (typeof value === 'string') {
          target[key] = modeKeyPattern.test(lower) ? 'off' : 'none';
          return;
        }
      }

      if (value && typeof value === 'object') {
        forceDisableEffectsDeep(value, depth + 1, visited);
      }
    });
  }

  function applyBareSkinBodyClass() {
    document.body.classList.toggle('rhythm-plus-mod-bare-skin', !!modState.prefs.simplisticSkinMode);
  }

  function applySimplisticSkinMode(userStore, skinPrefs, activeSkin) {
    applyBareSkinBodyClass();

    const skinId = resolveSelectedSkinId();
    const skinDataEntries = getSkinDataMapEntriesForSkinId(userStore, skinId);

    if (!modState.prefs.simplisticSkinMode) {
      return;
    }

    userStore.preferences.appearance.visualizer = 'off';
    userStore.preferences.appearance.visualizerPrefs = {};
    userStore.preferences.appearance.blur = false;
    userStore.preferences.appearance.blurMenuItem = false;
    userStore.preferences.appearance.hideOverlaysWhenFloating = true;
    userStore.preferences.game.accuracyBarPosition = 'off';

    if (userStore.performanceConfig) {
      userStore.performanceConfig.lowQualityMode = true;
      userStore.performanceConfig.disableAnimations = true;
    }

    const configStore = getConfigStore();
    if (configStore && Object.prototype.hasOwnProperty.call(configStore, 'showConfetti')) {
      configStore.showConfetti = false;
    }

    // Best-effort toggles for note-skin effects if those fields exist.
    if (skinPrefs && typeof skinPrefs === 'object') {
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'glow')) skinPrefs.glow = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'particleEffects')) skinPrefs.particleEffects = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'trail')) skinPrefs.trail = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'splash')) skinPrefs.splash = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'effects')) skinPrefs.effects = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'noteEffects')) skinPrefs.noteEffects = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'hitEffects')) skinPrefs.hitEffects = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'judgementEffects')) skinPrefs.judgementEffects = false;
      if (Object.prototype.hasOwnProperty.call(skinPrefs, 'comboEffects')) skinPrefs.comboEffects = false;
    }

    forceDisableEffectsDeep(skinPrefs, 0, new WeakSet());
    forceDisableEffectsDeep(activeSkin, 0, new WeakSet());
    skinDataEntries.forEach(([, entry]) => {
      if (entry && entry.skin && typeof entry.skin === 'object') {
        forceDisableEffectsDeep(entry.skin, 0, new WeakSet());
      }
    });

    // Re-assert colors after effect stripping so circle skins keep the selected colors.
    forceColorAliasesDeep(skinPrefs, 0, new WeakSet());
    forceColorAliasesDeep(activeSkin, 0, new WeakSet());
    skinDataEntries.forEach(([, entry]) => {
      if (entry && entry.skin && typeof entry.skin === 'object') {
        forceColorAliasesDeep(entry.skin, 0, new WeakSet());
      }
    });
  }

  async function applyLowSpecMode() {
    return applyPerformanceChanges(false);
  }

  async function disableBgaOnly() {
    modState.prefs.lowSpecMode = true;
    modState.prefs.perfOptions.disableBgaOnly = true;
    persistPrefs();
    return applyPerformanceChanges(false);
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

    const activeSkin = (Array.isArray(userStore.skins)
      ? userStore.skins.find((item) => item && item.id === skinId)
      : null) || getActiveSkinEntry(userStore);
    const skinDataEntries = getSkinDataMapEntriesForSkinId(userStore, skinId);

    if (activeSkin) {
      applyCurrentColorsToSkinObject(activeSkin);
    }

    skinDataEntries.forEach(([url, entry]) => {
      if (!entry || typeof entry !== 'object' || !entry.skin || typeof entry.skin !== 'object') {
        return;
      }
      applyCurrentColorsToSkinObject(entry.skin);
      if (userStore.skinDataMap && typeof userStore.skinDataMap === 'object') {
        userStore.skinDataMap[url] = { ...entry };
      }
    });

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

    applyAssetOverridesToCurrentSkin(userStore, skinId);

    forceColorAliasesDeep(skinPrefs, 0, new WeakSet());
    if (activeSkin) {
      forceColorAliasesDeep(activeSkin, 0, new WeakSet());
    }
    skinDataEntries.forEach(([, entry]) => {
      if (entry && entry.skin && typeof entry.skin === 'object') {
        forceColorAliasesDeep(entry.skin, 0, new WeakSet());
      }
    });

    // Trigger reactive updates in renderers that depend on object identity changes.
    if (userStore.preferences && userStore.preferences.appearance) {
      const appearance = userStore.preferences.appearance;
      if (appearance.gameSkinPrefs && typeof appearance.gameSkinPrefs === 'object') {
        appearance.gameSkinPrefs = { ...appearance.gameSkinPrefs };
        if (appearance.gameSkinPrefs[skinId] && typeof appearance.gameSkinPrefs[skinId] === 'object') {
          appearance.gameSkinPrefs[skinId] = { ...appearance.gameSkinPrefs[skinId] };
        }
      }
      userStore.preferences.appearance = { ...appearance };
    }
    if (Array.isArray(userStore.skins)) {
      userStore.skins = userStore.skins.slice();
    }
    if (userStore.skinDataMap && typeof userStore.skinDataMap === 'object') {
      userStore.skinDataMap = { ...userStore.skinDataMap };
    }

    applySimplisticSkinMode(userStore, skinPrefs, activeSkin);
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

    const restoredFromSnapshot = restoreOriginalRuntimeSnapshot(userStore);
    if (!restoredFromSnapshot) {
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

      if (userStore.performanceConfig && typeof userStore.performanceConfig === 'object') {
        userStore.performanceConfig.lowQualityMode = false;
        userStore.performanceConfig.disableAnimations = false;
      }
    }

    if (modState.applySkinTimer) {
      PAGE_WINDOW.clearTimeout(modState.applySkinTimer);
      modState.applySkinTimer = null;
    }

    document.body.classList.remove('rhythm-plus-mod-hide-bga');
    document.body.classList.remove('rhythm-plus-mod-bare-skin');

    modState.prefs.lowSpecMode = false;
    modState.prefs.removeBgaCss = false;
    modState.prefs.unlockSkins = false;
    modState.prefs.unlockFps = false;
    modState.prefs.fpsLimit = 0;
    modState.prefs.selectedSkinId = '';
    modState.prefs.assetTintColor = DEFAULT_STATE.assetTintColor;
    modState.prefs.perfOptions = { ...DEFAULT_PERF_OPTIONS };
    modState.prefs.skinPresets = {};
    modState.prefs.assetOverrides = {};
    modState.prefs.simplisticSkinMode = false;

    modState.selectedAssetIndex = -1;
    modState.tintedPreviewCache.clear();

    captureOriginalSkinPresets(userStore);
    rebuildSkinPresetsFromDefaults();
    syncUiStateToSelectedSkin();
    persistPrefs();
    updateFormFromPrefs();

    await persistUserStore(userStore);
    log(restoredFromSnapshot
      ? 'Hard reset restored original skins/assets and cleared all mod overrides.'
      : 'Reset modified settings back toward site defaults.');
    return true;
  }

  async function reapplyConfiguredState() {
    const userStore = getUserStore();
    if (!userStore) {
      return false;
    }

    if (modState.prefs.lowSpecMode) {
      await applyPerformanceChanges(true);
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

    const perfMasterToggle = root.querySelector('[data-mod="performance-master-toggle"]');
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
    const selectedAssetColor = root.querySelector('[data-mod="selected-asset-color"]');
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
    const perfBgaOnly = root.querySelector('[data-mod="perf-bga-only"]');
    const perfUnlockFps = root.querySelector('[data-mod="perf-unlock-fps"]');
    const perfFpsLimit = root.querySelector('[data-mod="perf-fps-limit"]');

    if (perfMasterToggle) {
      perfMasterToggle.classList.toggle('is-on', !!modState.prefs.lowSpecMode);
      perfMasterToggle.textContent = modState.prefs.lowSpecMode ? 'Performance Mode: ENABLED' : 'Performance Mode: OFF';
    }
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
    if (selectedAssetColor) selectedAssetColor.value = clampColor(modState.prefs.assetTintColor, '#ffffff');
    if (simplisticMode) simplisticMode.checked = !!modState.prefs.simplisticSkinMode;
    if (perfLowQuality) perfLowQuality.checked = !!modState.prefs.perfOptions.lowQualityMode;
    if (perfAnimations) perfAnimations.checked = !!modState.prefs.perfOptions.disableAnimations;
    if (perfVisualizer) perfVisualizer.checked = !!modState.prefs.perfOptions.disableVisualizer;
    if (perfFloating) perfFloating.checked = !!modState.prefs.perfOptions.forceFloatingBga;
    if (perfDim) perfDim.checked = !!modState.prefs.perfOptions.dimBackgroundHard;
    if (perfAccuracy) perfAccuracy.checked = !!modState.prefs.perfOptions.disableAccuracyBar;
    if (perfConfetti) perfConfetti.checked = !!modState.prefs.perfOptions.disableConfetti;
    if (perfHideBgaCss) perfHideBgaCss.checked = !!modState.prefs.perfOptions.hideBgaCss;
    if (perfBgaOnly) perfBgaOnly.checked = !!modState.prefs.perfOptions.disableBgaOnly;
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
    captureOriginalSkinPresets(userStore);
    const activeSkin = getActiveSkinEntry(userStore);
    const currentSkin = (activeSkin && activeSkin.id)
      || (userStore && userStore.preferences && userStore.preferences.appearance
        ? userStore.preferences.appearance.gameSkin
        : null);
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
    root.style.width = clampPanelWidth(modState.prefs.uiWidth) + 'px';
    root.style.height = clampPanelHeight(modState.prefs.uiHeight) + 'px';

    root.innerHTML = [
      '<button class="rp-mini-icon" data-mod="restore" type="button" title="Open Mod">RP</button>',
      '<div class="rp-nebula-field" aria-hidden="true"><span class="rp-nebula-orb orb-a"></span><span class="rp-nebula-orb orb-b"></span><span class="rp-nebula-orb orb-c"></span></div>',
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
      '          <button class="rp-store-mod-button alt rp-master-toggle" data-mod="performance-master-toggle" type="button">Performance Mode: OFF</button>',
      '          <button class="rp-store-mod-button" data-mod="apply-performance" type="button">Apply Changes</button>',
      '          <button class="rp-store-mod-button dim" data-mod="perf-reset-defaults" type="button">Reset Performance Defaults</button>',
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
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-bga-only" type="checkbox"> <span>Disable BGA only (ignore other perf toggles)</span></label>',
      '          <label class="rp-store-mod-checkbox"><input data-mod="perf-unlock-fps" type="checkbox"> <span>Unlock FPS (remove cap)</span></label>',
      '          <label class="rp-store-mod-label" for="rp-store-mod-fps-limit">FPS cap (used when unlock is off)</label>',
      '          <input id="rp-store-mod-fps-limit" class="rp-store-mod-input" data-mod="perf-fps-limit" type="number" min="30" max="360" step="1" placeholder="60">',
      '        </div>',
      '      </div>',
      '      <div class="rp-store-mod-note">Tip 1: Toggle Performance Mode on, pick settings, then click Apply Changes.</div>',
      '      <div class="rp-store-mod-note">Tip 2: Check Unlock FPS for uncapped FPS, or uncheck it and set a cap manually.</div>',
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
      '            <option value="midnight-gold">Midnight Gold</option>',
      '            <option value="sunset">Sunset Neon</option>',
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
      '            <div class="rp-skin-preview-title">Skin Assets</div>',
      '            <div class="rp-store-mod-note" data-mod="selected-note-label">Click asset to select or deselect</div>',
      '          </div>',
      '          <div class="rp-preview-stage" data-mod="skin-preview">',
      '            <div class="rp-preview-layout">',
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
      '          <button class="rp-store-mod-button alt rp-og-reset-btn" data-mod="reset-og-colors" type="button">Reset OG Colors</button>',
      '          <div class="rp-store-mod-note">Selected Asset Color</div>',
      '          <div class="rp-preview-footer rp-preview-footer-asset-color">',
      '            <input class="rp-store-mod-input" data-mod="selected-asset-color" type="color" title="Selected asset color">',
      '            <button class="rp-store-mod-button alt" data-mod="tint-selected-asset" type="button">Color Selected Asset</button>',
      '          </div>',
      '          <div class="rp-preview-footer">',
      '            <button class="rp-store-mod-button dim" data-mod="reset-selected-asset" type="button">Change To Normal Color</button>',
      '            <button class="rp-store-mod-button dim" data-mod="strip-selected-asset" type="button">Disable</button>',
      '          </div>',
      '          <button class="rp-store-mod-button dim" data-mod="clear-asset-overrides" type="button">Reset All Asset Edits (Auto Save)</button>',
      '          <div class="rp-preview-footer">',
      '            <button class="rp-store-mod-button dim" data-mod="export-custom-colors" type="button">Export Custom Colors</button>',
      '            <button class="rp-store-mod-button dim" data-mod="import-custom-colors" type="button">Import Custom Colors</button>',
      '          </div>',
      '        </div>',
      '        <div class="rp-store-mod-field">',
      '          <label class="rp-store-mod-label" for="rp-store-mod-skin-select">Target skin</label>',
      '          <select id="rp-store-mod-skin-select" class="rp-store-mod-select" data-mod="skin-select"></select>',
      '        </div>',
      '        <div class="rp-store-mod-note">Select an asset on the right, pick a color, then click Color Selected Asset. Use Change To Normal Color, Disable, Save Skin Colors, and Import/Export as needed.</div>',
      '      </div>',
      '    </section>',
      '    <section class="rp-panel" data-panel="tools">',
      '      <div class="rp-store-mod-section">',
      '        <div class="rp-store-mod-section-title">Utility</div>',
      '        <div class="rp-store-mod-grid">',
      '          <button class="rp-store-mod-button dim" data-mod="reapply" type="button">Reapply Everything</button>',
      '          <button class="rp-store-mod-button dim" data-mod="reset" type="button">Reset Modded Settings</button>',
      '        </div>',
      '        <div class="rp-store-mod-note">Tip: drag the bottom-right corner to resize this panel.</div>',
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
    setupResizePersistence(root);
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

    root.addEventListener('pointerdown', (event) => {
      const clickable = event.target.closest('.rp-store-mod-button, .rp-tab-btn, .rp-store-mod-icon-btn, .rp-asset-thumb, .rp-mini-icon');
      if (!clickable || !root.contains(clickable)) {
        return;
      }

      clickable.classList.remove('rp-click-pop');
      // Force reflow so repeated fast clicks still replay the keyframe.
      void clickable.offsetWidth;
      clickable.classList.add('rp-click-pop');
      PAGE_WINDOW.setTimeout(() => {
        clickable.classList.remove('rp-click-pop');
      }, 340);
    });

    root.addEventListener('animationend', (event) => {
      const node = event.target;
      if (node && node.classList && node.classList.contains('rp-click-pop')) {
        node.classList.remove('rp-click-pop');
      }
    });

    root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.getAttribute('data-tab')));
    });

    root.querySelector('[data-mod="skin-preview"]').addEventListener('click', (event) => {
      const target = event.target.closest('.rp-preview-note[data-part], .rp-preview-part-btn[data-part]');
      if (!target) {
        return;
      }
      setPreviewSelection(target.getAttribute('data-part'));
      renderSkinPreview();
    });

    root.querySelector('[data-mod="skin-preview-assets"]').addEventListener('click', (event) => {
      const target = event.target.closest('[data-asset-index]');
      if (!target) {
        return;
      }

      const nextIndex = Number(target.getAttribute('data-asset-index'));
      if (Number.isFinite(nextIndex) && nextIndex >= 0) {
        modState.selectedAssetIndex = modState.selectedAssetIndex === nextIndex ? -1 : nextIndex;
      }
      renderSkinPreview();
    });

    root.querySelector('[data-mod="restore"]').addEventListener('click', () => {
      if (modState.suppressRestoreClick) {
        return;
      }

      modState.prefs.minimized = false;
      root.classList.remove('is-minimized');
      root.style.width = clampPanelWidth(modState.prefs.uiWidth) + 'px';
      root.style.height = clampPanelHeight(modState.prefs.uiHeight) + 'px';
      persistPrefs();
    });

    root.querySelector('[data-mod="close"]').addEventListener('click', () => {
      root.remove();
    });

    root.querySelector('[data-mod="minimize"]').addEventListener('click', () => {
      const willMinimize = !modState.prefs.minimized;
      if (willMinimize) {
        const rect = root.getBoundingClientRect();
        modState.prefs.uiWidth = clampPanelWidth(rect.width);
        modState.prefs.uiHeight = clampPanelHeight(rect.height);
      }

      modState.prefs.minimized = willMinimize;
      root.classList.toggle('is-minimized', willMinimize);

      if (!willMinimize) {
        root.style.width = clampPanelWidth(modState.prefs.uiWidth) + 'px';
        root.style.height = clampPanelHeight(modState.prefs.uiHeight) + 'px';
      }

      persistPrefs();
    });

    root.querySelector('[data-mod="performance-master-toggle"]').addEventListener('click', async () => {
      modState.prefs.lowSpecMode = !modState.prefs.lowSpecMode;
      persistPrefs();
      updateFormFromPrefs();

      if (!modState.prefs.lowSpecMode) {
        await applyPerformanceChanges(true);
      }
    });

    root.querySelector('[data-mod="unlock-skins"]').addEventListener('change', (event) => {
      modState.prefs.unlockSkins = event.target.checked;
      persistPrefs();
    });

    root.querySelector('[data-mod="skin-select"]').addEventListener('change', (event) => {
      persistActiveSkinPreset();
      modState.prefs.selectedSkinId = event.target.value;
      modState.selectedAssetIndex = -1;
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
      persistPrefs();
      applyBareSkinBodyClass();
      renderSkinPreview();
      scheduleAutoApplySkinColors(100);
    });

    const selectedNoteColorInput = root.querySelector('[data-mod="selected-note-color"]');
    if (selectedNoteColorInput) {
      selectedNoteColorInput.addEventListener('input', (event) => {
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
    }

    root.querySelector('[data-mod="selected-asset-color"]').addEventListener('input', (event) => {
      modState.prefs.assetTintColor = clampColor(event.target.value, modState.prefs.assetTintColor);
      persistPrefs();
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

    root.querySelector('[data-mod="reset-og-colors"]').addEventListener('click', async () => {
      await resetSelectedSkinColorsToOriginal();
    });

    root.querySelector('[data-mod="tint-selected-asset"]').addEventListener('click', async () => {
      await tintSelectedAssetWithCurrentColor();
    });

    root.querySelector('[data-mod="reset-selected-asset"]').addEventListener('click', async () => {
      await resetSelectedAssetToNormal();
    });

    root.querySelector('[data-mod="strip-selected-asset"]').addEventListener('click', async () => {
      await stripSelectedAsset();
    });

    root.querySelector('[data-mod="clear-asset-overrides"]').addEventListener('click', async () => {
      await clearAssetOverridesForSelectedSkin();
    });

    root.querySelector('[data-mod="export-custom-colors"]').addEventListener('click', async () => {
      await exportSelectedSkinCustomColors();
    });

    root.querySelector('[data-mod="import-custom-colors"]').addEventListener('click', async () => {
      await importSelectedSkinCustomColors();
    });

    root.querySelector('[data-mod="toggle-advanced"]').addEventListener('click', () => {
      modState.prefs.perfAdvancedOpen = !modState.prefs.perfAdvancedOpen;
      persistPrefs();
      updateFormFromPrefs();
    });

    root.querySelector('[data-mod="ui-theme"]').addEventListener('change', (event) => {
      modState.prefs.uiTheme = ALLOWED_UI_THEMES.includes(event.target.value) ? event.target.value : 'dark';
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
      persistPrefs();
    });
    root.querySelector('[data-mod="perf-bga-only"]').addEventListener('change', (event) => {
      modState.prefs.perfOptions.disableBgaOnly = event.target.checked;
      persistPrefs();
    });

    root.querySelector('[data-mod="perf-unlock-fps"]').addEventListener('change', (event) => {
      modState.prefs.unlockFps = event.target.checked;
      persistPrefs();
      updateFormFromPrefs();
    });

    root.querySelector('[data-mod="perf-fps-limit"]').addEventListener('input', (event) => {
      const value = Number(event.target.value);
      modState.prefs.fpsLimit = Number.isFinite(value) && value > 0 ? Math.min(360, Math.max(30, Math.round(value))) : 0;
      persistPrefs();
    });

    root.querySelector('[data-mod="apply-performance"]').addEventListener('click', async () => {
      await applyPerformanceChanges(false);
    });

    root.querySelector('[data-mod="perf-reset-defaults"]').addEventListener('click', async () => {
      await resetPerformanceModeDefaults();
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

  function setupResizePersistence(root) {
    if (!root) {
      return;
    }

    const persistCurrentSize = () => {
      if (root.classList.contains('is-minimized')) {
        return;
      }

      const rect = root.getBoundingClientRect();
      const width = clampPanelWidth(rect.width);
      const height = clampPanelHeight(rect.height);

      if (Math.abs(rect.width - width) > 1) {
        root.style.width = width + 'px';
      }
      if (Math.abs(rect.height - height) > 1) {
        root.style.height = height + 'px';
      }

      modState.prefs.uiWidth = width;
      modState.prefs.uiHeight = height;
      persistPrefs();
    };

    let resizePersistTimer = null;
    const schedulePersist = () => {
      if (resizePersistTimer) {
        PAGE_WINDOW.clearTimeout(resizePersistTimer);
      }

      resizePersistTimer = PAGE_WINDOW.setTimeout(() => {
        resizePersistTimer = null;
        persistCurrentSize();
      }, 120);
    };

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => {
        if (!root.classList.contains('is-minimized')) {
          schedulePersist();
        }
      });
      observer.observe(root);
    }

    PAGE_WINDOW.addEventListener('resize', () => {
      if (root.classList.contains('is-minimized')) {
        return;
      }
      persistCurrentSize();
    });
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
        applyBareSkinBodyClass();

        const userStore = getUserStore();
        if (!userStore) {
          return;
        }

        captureOriginalRuntimeSnapshot(userStore);

        renderSkinOptions();
        const activeSkinChanged = pullActiveSkinFromStore();
        if (activeSkinChanged) {
          updateFormFromPrefs();
        }

        const skinId = resolveSelectedSkinId();
        const skinPrefs = ensureSkinPrefs(userStore, skinId);
        const activeSkin = (Array.isArray(userStore.skins)
          ? userStore.skins.find((item) => item && item.id === skinId)
          : null) || getActiveSkinEntry(userStore);
        const skinDataEntries = getSkinDataMapEntriesForSkinId(userStore, skinId);

        forceColorAliasesDeep(skinPrefs, 0, new WeakSet());
        if (activeSkin) {
          forceColorAliasesDeep(activeSkin, 0, new WeakSet());
        }
        skinDataEntries.forEach(([, entry]) => {
          if (entry && entry.skin && typeof entry.skin === 'object') {
            forceColorAliasesDeep(entry.skin, 0, new WeakSet());
          }
        });
        applySimplisticSkinMode(userStore, skinPrefs, activeSkin);

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
        captureOriginalRuntimeSnapshot(userStore);
        captureOriginalSkinPresets(userStore);
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
