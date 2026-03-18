// ==UserScript==
// @name         Zombs.io Dev Menu (QoL)
// @namespace    copilot.multi-game.mods
// @version      0.3.0
// @description  Locked dev menu with inspector, simulator, visual overlays, command palette, profiles, and event logs.
// @author       GitHub Copilot
// @match        https://zombs.io/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const MOD_ID = 'zombs-qol-mod-pack';
  const STYLE_ID = MOD_ID + '-style';
  const STORAGE_KEY = MOD_ID + '-settings';
  const PASSPHRASE_KEY = MOD_ID + '-passphrase';
  const MAX_EVENT_LOG = 500;

  function makeDefaultHotkeys() {
    return {
      unlock: 'ctrl+alt+shift+d',
      togglePanel: 'alt+m',
      togglePrank: 'alt+p',
      toggleFakeHud: 'alt+o',
      togglePalette: 'ctrl+k'
    };
  }

  const defaults = {
    uiScale: 1,
    hideChat: false,
    hideAds: true,
    showFps: true,
    showClock: true,
    highContrast: false,
    rainbowHud: false,
    prankMode: false,
    fakeHudNumbers: false,
    showInspector: true,
    showPlacementOverlay: true,
    showRangeOverlay: false,
    simulatorEnabled: false,
    simGold: 125000,
    simWood: 90000,
    simStone: 90000,
    simWave: 120,
    activeTab: 'general',
    panelX: null,
    panelY: null,
    requireUnlock: true,
    panelOpen: true,
    hotkeys: makeDefaultHotkeys(),
    profiles: {}
  };

  const state = {
    settings: loadSettings(),
    fpsFrameCount: 0,
    fpsLastTs: performance.now(),
    fpsLabel: null,
    clockLabel: null,
    fakeHudLabel: null,
    inspectorLabel: null,
    isUnlocked: false,
    mouseX: 0,
    mouseY: 0,
    paletteOpen: false,
    eventLog: [],
    replayTimer: null,
    replayIndex: 0,
    placementDot: null,
    dragActive: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function logEvent(type, detail) {
    state.eventLog.push({
      t: Date.now(),
      type: type,
      detail: detail || null
    });
    if (state.eventLog.length > MAX_EVENT_LOG) {
      state.eventLog = state.eventLog.slice(-MAX_EVENT_LOG);
    }
  }

  function loadPassphrase() {
    try {
      return localStorage.getItem(PASSPHRASE_KEY) || '';
    } catch (err) {
      return '';
    }
  }

  function savePassphrase(value) {
    try {
      localStorage.setItem(PASSPHRASE_KEY, value);
    } catch (err) {
      console.warn('[Zombs QoL] Failed to save passphrase:', err);
    }
  }

  function ensurePassphrase() {
    let passphrase = loadPassphrase();
    if (passphrase) {
      return true;
    }

    const created = window.prompt('Create dev menu passphrase (local browser only):');
    if (!created || !created.trim()) {
      return false;
    }

    passphrase = created.trim();
    savePassphrase(passphrase);
    logEvent('security.passphrase.create');
    showToast('Dev passphrase created');
    return true;
  }

  function unlockMenuFlow() {
    if (!state.settings.requireUnlock) {
      state.isUnlocked = true;
      applySettings();
      logEvent('security.unlock.bypass');
      return true;
    }

    if (!ensurePassphrase()) {
      showToast('Passphrase setup canceled');
      return false;
    }

    const expected = loadPassphrase();
    const entered = window.prompt('Enter dev menu passphrase:');
    if (!entered) {
      showToast('Unlock canceled');
      return false;
    }

    if (entered.trim() !== expected) {
      logEvent('security.unlock.failed');
      showToast('Wrong passphrase');
      return false;
    }

    state.isUnlocked = true;
    applySettings();
    logEvent('security.unlock.ok');
    showToast('Dev menu unlocked');
    return true;
  }

  function lockMenu() {
    state.isUnlocked = false;
    applySettings();
    logEvent('security.lock');
    showToast('Dev menu locked');
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        hotkeys: {
          ...makeDefaultHotkeys(),
          ...(parsed && parsed.hotkeys ? parsed.hotkeys : {})
        },
        profiles: parsed && parsed.profiles && typeof parsed.profiles === 'object'
          ? parsed.profiles
          : {}
      };
    } catch (err) {
      console.warn('[Zombs QoL] Failed to load settings:', err);
      return { ...defaults };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (err) {
      console.warn('[Zombs QoL] Failed to save settings:', err);
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      ':root { --zq-ui-scale: 1; }',
      '#zombs-qol-panel {',
      '  position: fixed;',
      '  top: 16px;',
      '  right: 16px;',
      '  z-index: 2147483647;',
      '  width: min(980px, calc(100vw - 24px));',
      '  height: min(78vh, 760px);',
      '  border: 1px solid rgba(255,255,255,0.2);',
      '  border-radius: 12px;',
      '  background: rgba(8, 14, 28, 0.88);',
      '  color: #f8fafc;',
      '  font: 12px/1.4 Verdana, sans-serif;',
      '  box-shadow: 0 10px 30px rgba(0,0,0,0.35);',
      '  overflow: hidden;',
      '  display: flex;',
      '  flex-direction: column;',
      '}',
      '#zombs-qol-panel.is-hidden { display: none; }',
      '#zombs-qol-panel .zq-head {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  padding: 10px 12px;',
      '  background: rgba(255,255,255,0.08);',
      '  cursor: move;',
      '  user-select: none;',
      '}',
      '#zombs-qol-panel .zq-title { font-weight: 700; letter-spacing: 0.02em; }',
      '#zombs-qol-panel .zq-sub { opacity: 0.8; font-size: 11px; }',
      '#zombs-qol-panel .zq-head-actions { display: flex; align-items: center; gap: 6px; }',
      '#zombs-qol-panel .zq-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 190px 1fr; }',
      '#zombs-qol-panel .zq-tabs { border-right: 1px solid rgba(255,255,255,0.12); padding: 10px 8px; overflow-y: auto; }',
      '#zombs-qol-panel .zq-tab-btn { width: 100%; text-align: left; margin-bottom: 6px; }',
      '#zombs-qol-panel .zq-tab-btn.is-active { background: rgba(59,130,246,0.25); border-color: rgba(147,197,253,0.65); }',
      '#zombs-qol-panel .zq-panels { min-height: 0; overflow: hidden; }',
      '#zombs-qol-panel .zq-panel-section { display: none; height: 100%; overflow-y: auto; padding: 10px 12px; }',
      '#zombs-qol-panel .zq-panel-section.is-active { display: grid; align-content: start; gap: 8px; }',
      '#zombs-qol-panel .zq-section-title { font-size: 11px; letter-spacing: 0.06em; opacity: 0.86; text-transform: uppercase; margin-bottom: 2px; }',
      '#zombs-qol-panel .zq-divider { border-top: 1px solid rgba(255,255,255,0.15); margin: 6px 0; }',
      '#zombs-qol-panel .zq-small-grid { display: grid; gap: 6px; grid-template-columns: 1fr 1fr 1fr; }',
      '#zombs-qol-panel .zq-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }',
      '#zombs-qol-panel input[type="range"] { width: 130px; }',
      '#zombs-qol-panel button {',
      '  border: 1px solid rgba(255,255,255,0.35);',
      '  background: rgba(255,255,255,0.1);',
      '  color: #f8fafc;',
      '  border-radius: 8px;',
      '  padding: 3px 8px;',
      '  cursor: pointer;',
      '}',
      '#zombs-qol-panel .zq-meta { opacity: 0.82; font-size: 11px; }',
      '#zombs-qol-panel .zq-num { width: 98px; border: 1px solid rgba(255,255,255,0.35); border-radius: 7px; background: rgba(0,0,0,0.24); color: #f8fafc; padding: 2px 6px; }',
      '#zombs-qol-unlock-tip {',
      '  position: fixed;',
      '  right: 12px;',
      '  top: 12px;',
      '  z-index: 2147483647;',
      '  border-radius: 8px;',
      '  border: 1px solid rgba(255,255,255,0.25);',
      '  background: rgba(15, 23, 42, 0.88);',
      '  color: #cbd5e1;',
      '  font: 11px/1.3 Verdana, sans-serif;',
      '  padding: 5px 8px;',
      '  opacity: 0.86;',
      '}',
      '#zombs-qol-fps {',
      '  position: fixed;',
      '  left: 12px;',
      '  bottom: 12px;',
      '  z-index: 2147483647;',
      '  border-radius: 8px;',
      '  border: 1px solid rgba(255,255,255,0.3);',
      '  background: rgba(0, 0, 0, 0.75);',
      '  color: #d1fae5;',
      '  font: 12px monospace;',
      '  padding: 4px 8px;',
      '}',
      '#zombs-qol-clock {',
      '  position: fixed;',
      '  left: 12px;',
      '  bottom: 44px;',
      '  z-index: 2147483647;',
      '  border-radius: 8px;',
      '  border: 1px solid rgba(255,255,255,0.3);',
      '  background: rgba(0, 0, 0, 0.75);',
      '  color: #bfdbfe;',
      '  font: 12px monospace;',
      '  padding: 4px 8px;',
      '}',
      '#zombs-qol-fakehud {',
      '  position: fixed;',
      '  top: 12px;',
      '  left: 12px;',
      '  z-index: 2147483647;',
      '  border-radius: 10px;',
      '  border: 1px solid rgba(255,255,255,0.3);',
      '  background: rgba(0, 0, 0, 0.78);',
      '  color: #fef3c7;',
      '  font: 12px monospace;',
      '  padding: 8px 10px;',
      '  min-width: 180px;',
      '  white-space: pre-line;',
      '}',
      '#zombs-qol-inspector {',
      '  position: fixed;',
      '  right: 12px;',
      '  bottom: 12px;',
      '  z-index: 2147483647;',
      '  border-radius: 10px;',
      '  border: 1px solid rgba(255,255,255,0.3);',
      '  background: rgba(5, 10, 18, 0.82);',
      '  color: #dbeafe;',
      '  font: 11px/1.4 monospace;',
      '  padding: 7px 9px;',
      '  min-width: 240px;',
      '  white-space: pre-line;',
      '}',
      '#zombs-qol-placement {',
      '  position: fixed;',
      '  left: 0;',
      '  top: 0;',
      '  width: 14px;',
      '  height: 14px;',
      '  border-radius: 999px;',
      '  border: 2px solid rgba(34,197,94,0.9);',
      '  background: rgba(34,197,94,0.16);',
      '  transform: translate(-50%, -50%);',
      '  pointer-events: none;',
      '  z-index: 2147483647;',
      '}',
      '.zq-range-ring {',
      '  position: fixed;',
      '  border-radius: 999px;',
      '  border: 2px dashed rgba(59,130,246,0.9);',
      '  background: rgba(59,130,246,0.08);',
      '  pointer-events: none;',
      '  transform: translate(-50%, -50%);',
      '  z-index: 2147483646;',
      '}',
      '#zombs-qol-palette {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 2147483647;',
      '  display: none;',
      '  background: rgba(2, 6, 23, 0.48);',
      '}',
      '#zombs-qol-palette .zq-palette-shell {',
      '  width: min(560px, calc(100vw - 24px));',
      '  margin: 10vh auto 0;',
      '  border-radius: 12px;',
      '  border: 1px solid rgba(255,255,255,0.3);',
      '  background: rgba(10, 16, 30, 0.96);',
      '  overflow: hidden;',
      '}',
      '#zombs-qol-palette input {',
      '  width: 100%;',
      '  border: 0;',
      '  border-bottom: 1px solid rgba(255,255,255,0.2);',
      '  background: rgba(255,255,255,0.04);',
      '  color: #f8fafc;',
      '  font: 13px/1.35 monospace;',
      '  padding: 10px 12px;',
      '}',
      '#zombs-qol-palette .zq-palette-list { max-height: 46vh; overflow-y: auto; }',
      '#zombs-qol-palette .zq-cmd {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  gap: 8px;',
      '  padding: 8px 12px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.08);',
      '  cursor: pointer;',
      '  color: #e2e8f0;',
      '  font: 12px/1.3 monospace;',
      '}',
      '#zombs-qol-palette .zq-cmd:hover { background: rgba(59,130,246,0.18); }',
      '@media (max-width: 900px) {',
      '  #zombs-qol-panel { width: calc(100vw - 16px); left: 8px !important; right: auto !important; height: min(82vh, 760px); }',
      '  #zombs-qol-panel .zq-body { grid-template-columns: 1fr; }',
      '  #zombs-qol-panel .zq-tabs { display: flex; gap: 6px; overflow-x: auto; border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.12); }',
      '  #zombs-qol-panel .zq-tab-btn { width: auto; white-space: nowrap; margin-bottom: 0; }',
      '}',
      '#zombs-qol-toast {',
      '  position: fixed;',
      '  top: 12px;',
      '  left: 50%;',
      '  transform: translateX(-50%);',
      '  z-index: 2147483647;',
      '  border-radius: 8px;',
      '  border: 1px solid rgba(255,255,255,0.35);',
      '  background: rgba(15, 23, 42, 0.92);',
      '  color: #e2e8f0;',
      '  font: 12px/1.35 Verdana, sans-serif;',
      '  padding: 6px 10px;',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 150ms ease;',
      '}',
      '#zombs-qol-toast.is-visible { opacity: 1; }',
      '#zombs-qol-panel.is-closed .zq-body { display: none; }',
      '.hud, #hud, .hud-menu, .hud-bottom-left, .hud-bottom-right, .hud-top-right {',
      '  transform: scale(var(--zq-ui-scale));',
      '  transform-origin: top right;',
      '}',
      'body.zq-high-contrast * { text-shadow: none !important; }',
      'body.zq-high-contrast .hud, body.zq-high-contrast #hud, body.zq-high-contrast .hud-menu { filter: contrast(1.15) saturate(1.2); }',
      'body.zq-rainbow-hud .hud, body.zq-rainbow-hud #hud, body.zq-rainbow-hud .hud-menu { animation: zqHue 5s linear infinite; }',
      'body.zq-prank-mode .hud, body.zq-prank-mode #hud, body.zq-prank-mode .hud-menu { animation: zqWobble 1.7s ease-in-out infinite; }',
      'body.zq-hide-chat .hud-chat, body.zq-hide-chat .chat, body.zq-hide-chat [class*="chat"] { display: none !important; }',
      'body.zq-hide-ads iframe, body.zq-hide-ads [id*="google_ads"], body.zq-hide-ads [class*="ads"], body.zq-hide-ads [class*="ad-"] { display: none !important; }',
      '@keyframes zqHue { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }',
      '@keyframes zqWobble {',
      '  0% { transform: translate(0px, 0px) rotate(0deg); }',
      '  25% { transform: translate(1px, -1px) rotate(0.4deg); }',
      '  50% { transform: translate(0px, 1px) rotate(-0.4deg); }',
      '  75% { transform: translate(-1px, 0px) rotate(0.3deg); }',
      '  100% { transform: translate(0px, 0px) rotate(0deg); }',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  }

  function applySettings() {
    document.documentElement.style.setProperty('--zq-ui-scale', String(state.settings.uiScale));
    document.body.classList.toggle('zq-hide-chat', !!state.settings.hideChat);
    document.body.classList.toggle('zq-hide-ads', !!state.settings.hideAds);
    document.body.classList.toggle('zq-high-contrast', !!state.settings.highContrast);
    document.body.classList.toggle('zq-rainbow-hud', !!state.settings.rainbowHud);
    document.body.classList.toggle('zq-prank-mode', !!state.settings.prankMode);

    const panel = document.getElementById('zombs-qol-panel');
    if (panel) {
      panel.classList.toggle('is-hidden', state.settings.requireUnlock && !state.isUnlocked);
      panel.classList.toggle('is-closed', !state.settings.panelOpen);
      if (typeof state.settings.panelX === 'number' && typeof state.settings.panelY === 'number') {
        panel.style.left = state.settings.panelX + 'px';
        panel.style.top = state.settings.panelY + 'px';
        panel.style.right = 'auto';
      }

      panel.querySelectorAll('.zq-tab-btn[data-tab]').forEach((node) => {
        node.classList.toggle('is-active', node.getAttribute('data-tab') === state.settings.activeTab);
      });
      panel.querySelectorAll('.zq-panel-section[data-tab]').forEach((node) => {
        node.classList.toggle('is-active', node.getAttribute('data-tab') === state.settings.activeTab);
      });
    }

    const unlockTip = document.getElementById('zombs-qol-unlock-tip');
    if (unlockTip) {
      const showUnlockTip = state.settings.requireUnlock && !state.isUnlocked;
      unlockTip.style.display = showUnlockTip ? 'block' : 'none';
    }

    const fps = document.getElementById('zombs-qol-fps');
    if (fps) {
      fps.style.display = state.settings.showFps ? 'block' : 'none';
    }

    const clock = document.getElementById('zombs-qol-clock');
    if (clock) {
      clock.style.display = state.settings.showClock ? 'block' : 'none';
    }

    const fakeHud = document.getElementById('zombs-qol-fakehud');
    if (fakeHud) {
      fakeHud.style.display = (state.settings.fakeHudNumbers || state.settings.simulatorEnabled) ? 'block' : 'none';
    }

    const inspector = document.getElementById('zombs-qol-inspector');
    if (inspector) {
      inspector.style.display = state.settings.showInspector ? 'block' : 'none';
    }

    if (state.placementDot) {
      state.placementDot.style.display = state.settings.showPlacementOverlay ? 'block' : 'none';
    }

    const palette = document.getElementById('zombs-qol-palette');
    if (palette) {
      palette.style.display = state.paletteOpen ? 'block' : 'none';
    }
  }

  function showToast(message) {
    const toast = document.getElementById('zombs-qol-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1200);
  }

  function makeRow(labelText, control) {
    const row = document.createElement('label');
    row.className = 'zq-row';
    const name = document.createElement('span');
    name.textContent = labelText;
    row.appendChild(name);
    row.appendChild(control);
    return row;
  }

  function makeToggle(key) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!state.settings[key];
    input.addEventListener('change', () => {
      state.settings[key] = input.checked;
      saveSettings();
      applySettings();
    });
    return input;
  }

  function makeButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function makeNumberInput(key, min, max, step) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'zq-num';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(state.settings[key]);
    input.setAttribute('data-zq-key', key);
    input.addEventListener('change', () => {
      const next = Number(input.value);
      state.settings[key] = clamp(Number.isFinite(next) ? next : defaults[key], min, max);
      input.value = String(state.settings[key]);
      saveSettings();
      applySettings();
      logEvent('sim.value', { key: key, value: state.settings[key] });
    });
    return input;
  }

  function makeTrackedToggle(key, eventType) {
    const input = makeToggle(key);
    input.setAttribute('data-zq-key', key);
    input.addEventListener('change', () => {
      logEvent(eventType || 'toggle', { key: key, value: state.settings[key] });
    });
    return input;
  }

  function exportSettings() {
    const payload = JSON.stringify(state.settings, null, 2);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(payload)
        .then(() => showToast('Settings copied to clipboard'))
        .catch(() => window.prompt('Copy your settings JSON:', payload));
      return;
    }
    window.prompt('Copy your settings JSON:', payload);
  }

  function importSettings() {
    const raw = window.prompt('Paste settings JSON to import:');
    if (!raw) return;
    try {
      const next = JSON.parse(raw);
      state.settings = { ...defaults, ...next };
      state.settings.hotkeys = {
        ...makeDefaultHotkeys(),
        ...(next.hotkeys || {})
      };
      state.settings.profiles = next.profiles && typeof next.profiles === 'object'
        ? next.profiles
        : {};
      saveSettings();
      applySettings();
      syncPanelControls();
      logEvent('settings.import');
      showToast('Settings imported');
    } catch (err) {
      showToast('Invalid JSON');
    }
  }

  function resetSettings() {
    state.settings = { ...defaults };
    state.settings.hotkeys = makeDefaultHotkeys();
    state.settings.profiles = {};
    saveSettings();
    applySettings();
    syncPanelControls();
    logEvent('settings.reset');
    showToast('Settings reset');
  }

  function buildProfileSnapshot() {
    const snapshot = clone(state.settings);
    delete snapshot.profiles;
    return snapshot;
  }

  function saveProfile() {
    const name = window.prompt('Profile name to save:', 'profile-' + new Date().getHours());
    if (!name || !name.trim()) return;
    const key = name.trim();
    state.settings.profiles[key] = buildProfileSnapshot();
    saveSettings();
    logEvent('profile.save', { name: key });
    showToast('Saved profile: ' + key);
  }

  function loadProfile() {
    const keys = Object.keys(state.settings.profiles || {});
    if (!keys.length) {
      showToast('No saved profiles');
      return;
    }
    const picked = window.prompt('Load profile name:\n' + keys.join('\n'), keys[0]);
    if (!picked || !picked.trim()) return;
    const key = picked.trim();
    const profile = state.settings.profiles[key];
    if (!profile) {
      showToast('Profile not found');
      return;
    }
    const keepProfiles = state.settings.profiles;
    state.settings = {
      ...defaults,
      ...clone(profile),
      profiles: keepProfiles,
      hotkeys: {
        ...makeDefaultHotkeys(),
        ...(profile.hotkeys || {})
      }
    };
    saveSettings();
    applySettings();
    syncPanelControls();
    logEvent('profile.load', { name: key });
    showToast('Loaded profile: ' + key);
  }

  function editHotkeys() {
    const raw = window.prompt('Edit hotkeys JSON', JSON.stringify(state.settings.hotkeys, null, 2));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      state.settings.hotkeys = {
        ...makeDefaultHotkeys(),
        ...parsed
      };
      saveSettings();
      logEvent('hotkeys.edit', clone(state.settings.hotkeys));
      showToast('Hotkeys updated');
    } catch (err) {
      showToast('Invalid hotkeys JSON');
    }
  }

  function exportEventLog() {
    const payload = JSON.stringify({ exportedAt: nowIso(), events: state.eventLog }, null, 2);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(payload)
        .then(() => showToast('Event log copied'))
        .catch(() => window.prompt('Copy event log JSON:', payload));
      return;
    }
    window.prompt('Copy event log JSON:', payload);
  }

  function replayEventLog() {
    const events = state.eventLog.slice(-25);
    if (!events.length) {
      showToast('Event log empty');
      return;
    }
    if (state.replayTimer) {
      window.clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
    state.replayIndex = 0;
    state.replayTimer = window.setInterval(() => {
      const evt = events[state.replayIndex];
      if (!evt) {
        window.clearInterval(state.replayTimer);
        state.replayTimer = null;
        return;
      }
      showToast('Replay: ' + evt.type);
      state.replayIndex += 1;
    }, 350);
  }

  function matchesHotkey(event, combo) {
    if (!combo || typeof combo !== 'string') return false;
    const tokens = combo.toLowerCase().split('+').map((s) => s.trim()).filter(Boolean);
    if (!tokens.length) return false;
    const keyToken = tokens[tokens.length - 1];
    const needCtrl = tokens.includes('ctrl');
    const needAlt = tokens.includes('alt');
    const needShift = tokens.includes('shift');
    const needMeta = tokens.includes('meta');
    const eventKey = (event.key || '').toLowerCase();

    if (needCtrl !== event.ctrlKey) return false;
    if (needAlt !== event.altKey) return false;
    if (needShift !== event.shiftKey) return false;
    if (needMeta !== event.metaKey) return false;
    return eventKey === keyToken;
  }

  function syncPanelControls() {
    const panel = document.getElementById('zombs-qol-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-zq-key]').forEach((el) => {
      const key = el.getAttribute('data-zq-key');
      if (!key) return;
      if (el.type === 'checkbox') {
        el.checked = !!state.settings[key];
      }
      if (el.type === 'range') {
        el.value = String(state.settings[key]);
      }
      if (el.type === 'number') {
        el.value = String(state.settings[key]);
      }
    });
    const closeBtn = panel.querySelector('[data-zq="panel-toggle"]');
    if (closeBtn) {
      closeBtn.textContent = state.settings.panelOpen ? 'Hide' : 'Show';
    }

    const profileCount = panel.querySelector('[data-zq="profile-count"]');
    if (profileCount) {
      profileCount.textContent = 'Profiles: ' + Object.keys(state.settings.profiles || {}).length;
    }
  }

  function addDivider(body) {
    const divider = document.createElement('div');
    divider.className = 'zq-divider';
    body.appendChild(divider);
  }

  function setActiveTab(tabId) {
    const validTabs = {
      general: true,
      visuals: true,
      simulator: true,
      tools: true,
      security: true
    };
    const next = validTabs[tabId] ? tabId : 'general';
    if (state.settings.activeTab === next) return;
    state.settings.activeTab = next;
    saveSettings();
    applySettings();
  }

  function attachPanelDrag(panel, handle) {
    if (!panel || !handle) return;

    handle.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button, input, select, label')) return;

      const rect = panel.getBoundingClientRect();
      state.dragActive = true;
      state.dragOffsetX = event.clientX - rect.left;
      state.dragOffsetY = event.clientY - rect.top;
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!state.dragActive) return;
      const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
      const nextX = clamp(event.clientX - state.dragOffsetX, 0, maxX);
      const nextY = clamp(event.clientY - state.dragOffsetY, 0, maxY);
      state.settings.panelX = nextX;
      state.settings.panelY = nextY;
      panel.style.left = nextX + 'px';
      panel.style.top = nextY + 'px';
      panel.style.right = 'auto';
    }, { passive: true });

    document.addEventListener('mouseup', () => {
      if (!state.dragActive) return;
      state.dragActive = false;
      saveSettings();
    });
  }

  function mountPanel() {
    if (document.getElementById('zombs-qol-panel')) return;

    const panel = document.createElement('section');
    panel.id = 'zombs-qol-panel';

    const head = document.createElement('div');
    head.className = 'zq-head';

    const title = document.createElement('div');
    title.className = 'zq-title';
    title.textContent = 'Zombs.io Dev Menu';

    const subtitle = document.createElement('div');
    subtitle.className = 'zq-sub';
    subtitle.textContent = 'Local Testing Tools';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('data-zq', 'panel-toggle');
    closeBtn.textContent = state.settings.panelOpen ? 'Hide' : 'Show';
    closeBtn.addEventListener('click', () => {
      state.settings.panelOpen = !state.settings.panelOpen;
      closeBtn.textContent = state.settings.panelOpen ? 'Hide' : 'Show';
      saveSettings();
      applySettings();
    });

    const titleWrap = document.createElement('div');
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const headActions = document.createElement('div');
    headActions.className = 'zq-head-actions';
    headActions.appendChild(closeBtn);

    head.appendChild(titleWrap);
    head.appendChild(headActions);

    const body = document.createElement('div');
    body.className = 'zq-body';

    const tabs = document.createElement('div');
    tabs.className = 'zq-tabs';

    const panels = document.createElement('div');
    panels.className = 'zq-panels';

    const sectionMap = {};
    const tabDefs = [
      { id: 'general', label: 'General' },
      { id: 'visuals', label: 'Visuals' },
      { id: 'simulator', label: 'Simulator' },
      { id: 'tools', label: 'Tools' },
      { id: 'security', label: 'Security' }
    ];

    tabDefs.forEach((tabDef) => {
      const tabBtn = makeButton(tabDef.label, () => setActiveTab(tabDef.id));
      tabBtn.classList.add('zq-tab-btn');
      tabBtn.setAttribute('data-tab', tabDef.id);
      tabs.appendChild(tabBtn);

      const section = document.createElement('section');
      section.className = 'zq-panel-section';
      section.setAttribute('data-tab', tabDef.id);
      panels.appendChild(section);
      sectionMap[tabDef.id] = section;
    });

    body.appendChild(tabs);
    body.appendChild(panels);

    const scale = document.createElement('input');
    scale.type = 'range';
    scale.setAttribute('data-zq-key', 'uiScale');
    scale.min = '0.7';
    scale.max = '1.5';
    scale.step = '0.05';
    scale.value = String(state.settings.uiScale);
    scale.addEventListener('input', () => {
      state.settings.uiScale = Number(scale.value);
      saveSettings();
      applySettings();
    });

    const fullBtn = document.createElement('button');
    fullBtn.type = 'button';
    fullBtn.textContent = 'Fullscreen';
    fullBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    const generalSection = sectionMap.general;
    const visualsSection = sectionMap.visuals;
    const simulatorSection = sectionMap.simulator;
    const toolsSection = sectionMap.tools;
    const securitySection = sectionMap.security;

    const generalTitle = document.createElement('div');
    generalTitle.className = 'zq-section-title';
    generalTitle.textContent = 'Layout & Core';
    generalSection.appendChild(generalTitle);

    generalSection.appendChild(makeRow('UI Scale', scale));
    const unlockToggle = makeTrackedToggle('requireUnlock', 'security.toggle');
    generalSection.appendChild(makeRow('Require Unlock', unlockToggle));
    const hideChatToggle = makeTrackedToggle('hideChat', 'ui.toggle');
    generalSection.appendChild(makeRow('Hide Chat', hideChatToggle));
    const hideAdsToggle = makeTrackedToggle('hideAds', 'ui.toggle');
    generalSection.appendChild(makeRow('Hide Ads', hideAdsToggle));
    const showFpsToggle = makeTrackedToggle('showFps', 'ui.toggle');
    generalSection.appendChild(makeRow('Show FPS', showFpsToggle));
    const showClockToggle = makeTrackedToggle('showClock', 'ui.toggle');
    generalSection.appendChild(makeRow('Show Clock', showClockToggle));
    const showInspectorToggle = makeTrackedToggle('showInspector', 'inspector.toggle');
    generalSection.appendChild(makeRow('Show Inspector', showInspectorToggle));
    addDivider(generalSection);
    generalSection.appendChild(makeRow('Screen', fullBtn));

    const visualsTitle = document.createElement('div');
    visualsTitle.className = 'zq-section-title';
    visualsTitle.textContent = 'Visual Toggles';
    visualsSection.appendChild(visualsTitle);

    const highContrastToggle = makeTrackedToggle('highContrast', 'ui.toggle');
    visualsSection.appendChild(makeRow('High Contrast', highContrastToggle));
    const rainbowToggle = makeTrackedToggle('rainbowHud', 'ui.toggle');
    visualsSection.appendChild(makeRow('Rainbow HUD', rainbowToggle));
    const prankToggle = makeTrackedToggle('prankMode', 'prank.toggle');
    visualsSection.appendChild(makeRow('Prank Wobble', prankToggle));
    const fakeHudToggle = makeTrackedToggle('fakeHudNumbers', 'prank.fakehud');
    visualsSection.appendChild(makeRow('Fake Resource HUD', fakeHudToggle));
    const placementToggle = makeTrackedToggle('showPlacementOverlay', 'overlay.placement');
    visualsSection.appendChild(makeRow('Placement Overlay', placementToggle));
    const rangeToggle = makeTrackedToggle('showRangeOverlay', 'overlay.range');
    visualsSection.appendChild(makeRow('Range Rings', rangeToggle));

    const simTitle = document.createElement('div');
    simTitle.className = 'zq-section-title';
    simTitle.textContent = 'Simulation Inputs';
    simulatorSection.appendChild(simTitle);

    const simToggle = makeTrackedToggle('simulatorEnabled', 'sim.toggle');
    simulatorSection.appendChild(makeRow('Simulator Mode', simToggle));
    simulatorSection.appendChild(makeRow('Sim Gold', makeNumberInput('simGold', 0, 9999999, 500)));
    simulatorSection.appendChild(makeRow('Sim Wood', makeNumberInput('simWood', 0, 9999999, 500)));
    simulatorSection.appendChild(makeRow('Sim Stone', makeNumberInput('simStone', 0, 9999999, 500)));
    simulatorSection.appendChild(makeRow('Sim Wave', makeNumberInput('simWave', 1, 9999, 1)));
    const simMeta = document.createElement('div');
    simMeta.className = 'zq-meta';
    simMeta.textContent = 'Simulator values are reflected in fake HUD and inspector.';
    simulatorSection.appendChild(simMeta);

    const actions = document.createElement('div');
    actions.className = 'zq-small-grid';
    actions.appendChild(makeButton('Export', exportSettings));
    actions.appendChild(makeButton('Import', importSettings));
    actions.appendChild(makeButton('Reset', resetSettings));
    toolsSection.appendChild(actions);

    const devActions = document.createElement('div');
    devActions.className = 'zq-small-grid';
    devActions.appendChild(makeButton('Save Prof', saveProfile));
    devActions.appendChild(makeButton('Load Prof', loadProfile));
    devActions.appendChild(makeButton('Edit Keys', editHotkeys));
    toolsSection.appendChild(devActions);

    const logActions = document.createElement('div');
    logActions.className = 'zq-small-grid';
    logActions.appendChild(makeButton('Cmd Pal', () => togglePalette(true)));
    logActions.appendChild(makeButton('Log JSON', exportEventLog));
    logActions.appendChild(makeButton('Replay', replayEventLog));
    toolsSection.appendChild(logActions);

    const securityActions = document.createElement('div');
    securityActions.className = 'zq-small-grid';
    securityActions.appendChild(makeButton('Unlock', unlockMenuFlow));
    securityActions.appendChild(makeButton('Lock', lockMenu));
    securityActions.appendChild(makeButton('Set Pass', () => {
      const value = window.prompt('Set new dev menu passphrase:');
      if (!value || !value.trim()) return;
      savePassphrase(value.trim());
      logEvent('security.passphrase.update');
      showToast('Passphrase updated');
    }));
    securitySection.appendChild(securityActions);

    const meta = document.createElement('div');
    meta.className = 'zq-meta';
    meta.textContent = 'Hotkeys are editable. Default includes Ctrl+K for command palette.';
    securitySection.appendChild(meta);

    const profileCount = document.createElement('div');
    profileCount.className = 'zq-meta';
    profileCount.setAttribute('data-zq', 'profile-count');
    toolsSection.appendChild(profileCount);

    panel.appendChild(head);
    panel.appendChild(body);

    document.body.appendChild(panel);
    attachPanelDrag(panel, head);
    syncPanelControls();
    applySettings();
  }

  function mountInspector() {
    if (document.getElementById('zombs-qol-inspector')) return;
    const label = document.createElement('div');
    label.id = 'zombs-qol-inspector';
    label.textContent = 'Inspector booting...';
    document.body.appendChild(label);
    state.inspectorLabel = label;
  }

  function renderInspector() {
    if (!state.inspectorLabel) return;
    const lines = [
      'DEV INSPECTOR',
      'Unlocked: ' + (state.isUnlocked ? 'yes' : 'no'),
      'Mouse: ' + state.mouseX + ', ' + state.mouseY,
      'FPS visible: ' + (state.settings.showFps ? 'yes' : 'no'),
      'Placement overlay: ' + (state.settings.showPlacementOverlay ? 'on' : 'off'),
      'Range rings: ' + (state.settings.showRangeOverlay ? 'on' : 'off'),
      'Simulator: ' + (state.settings.simulatorEnabled ? 'on' : 'off'),
      'Sim G/W/S/Wv: '
        + state.settings.simGold + '/'
        + state.settings.simWood + '/'
        + state.settings.simStone + '/'
        + state.settings.simWave,
      'Palette: ' + (state.paletteOpen ? 'open' : 'closed'),
      'Events: ' + state.eventLog.length
    ];
    state.inspectorLabel.textContent = lines.join('\n');
  }

  function mountPlacementOverlay() {
    if (document.getElementById('zombs-qol-placement')) return;
    const dot = document.createElement('div');
    dot.id = 'zombs-qol-placement';
    document.body.appendChild(dot);
    state.placementDot = dot;
  }

  function updatePlacementOverlay() {
    if (!state.placementDot) return;
    state.placementDot.style.left = state.mouseX + 'px';
    state.placementDot.style.top = state.mouseY + 'px';
  }

  function spawnRangeRing(x, y, radius) {
    const ring = document.createElement('div');
    ring.className = 'zq-range-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.width = radius * 2 + 'px';
    ring.style.height = radius * 2 + 'px';
    document.body.appendChild(ring);
    window.setTimeout(() => ring.remove(), 2200);
  }

  function mountFpsCounter() {
    if (document.getElementById('zombs-qol-fps')) return;

    const label = document.createElement('div');
    label.id = 'zombs-qol-fps';
    label.textContent = 'FPS: --';
    document.body.appendChild(label);
    state.fpsLabel = label;
  }

  function mountClock() {
    if (document.getElementById('zombs-qol-clock')) return;

    const label = document.createElement('div');
    label.id = 'zombs-qol-clock';
    label.textContent = '--:--:--';
    document.body.appendChild(label);
    state.clockLabel = label;
  }

  function mountFakeHud() {
    if (document.getElementById('zombs-qol-fakehud')) return;

    const label = document.createElement('div');
    label.id = 'zombs-qol-fakehud';
    label.textContent = 'Gold: 999999\nWood: 999999\nStone: 999999\nWave: ???';
    document.body.appendChild(label);
    state.fakeHudLabel = label;
  }

  function mountToast() {
    if (document.getElementById('zombs-qol-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'zombs-qol-toast';
    document.body.appendChild(toast);
  }

  function buildPaletteCommands() {
    return [
      { id: 'toggle-panel', label: 'Toggle Panel', run: () => { state.settings.panelOpen = !state.settings.panelOpen; saveSettings(); applySettings(); } },
      { id: 'toggle-prank', label: 'Toggle Prank Wobble', run: () => { state.settings.prankMode = !state.settings.prankMode; saveSettings(); applySettings(); } },
      { id: 'toggle-fakehud', label: 'Toggle Fake HUD', run: () => { state.settings.fakeHudNumbers = !state.settings.fakeHudNumbers; saveSettings(); applySettings(); } },
      { id: 'toggle-placement', label: 'Toggle Placement Overlay', run: () => { state.settings.showPlacementOverlay = !state.settings.showPlacementOverlay; saveSettings(); applySettings(); } },
      { id: 'toggle-range', label: 'Toggle Range Rings', run: () => { state.settings.showRangeOverlay = !state.settings.showRangeOverlay; saveSettings(); applySettings(); } },
      { id: 'toggle-inspector', label: 'Toggle Inspector', run: () => { state.settings.showInspector = !state.settings.showInspector; saveSettings(); applySettings(); } },
      { id: 'toggle-sim', label: 'Toggle Simulator Mode', run: () => { state.settings.simulatorEnabled = !state.settings.simulatorEnabled; saveSettings(); applySettings(); } },
      { id: 'unlock', label: 'Unlock Dev Menu', run: () => unlockMenuFlow() },
      { id: 'lock', label: 'Lock Dev Menu', run: () => lockMenu() },
      { id: 'export-settings', label: 'Export Settings JSON', run: () => exportSettings() },
      { id: 'import-settings', label: 'Import Settings JSON', run: () => importSettings() },
      { id: 'reset-settings', label: 'Reset Settings', run: () => resetSettings() },
      { id: 'save-profile', label: 'Save Profile', run: () => saveProfile() },
      { id: 'load-profile', label: 'Load Profile', run: () => loadProfile() },
      { id: 'edit-hotkeys', label: 'Edit Hotkeys JSON', run: () => editHotkeys() },
      { id: 'export-log', label: 'Export Event Log', run: () => exportEventLog() },
      { id: 'replay-log', label: 'Replay Last Events', run: () => replayEventLog() }
    ];
  }

  function mountPalette() {
    if (document.getElementById('zombs-qol-palette')) return;

    const root = document.createElement('div');
    root.id = 'zombs-qol-palette';
    root.innerHTML = ''
      + '<div class="zq-palette-shell">'
      + '  <input type="text" data-zq="palette-input" placeholder="Type a command...">'
      + '  <div class="zq-palette-list" data-zq="palette-list"></div>'
      + '</div>';
    document.body.appendChild(root);

    const input = root.querySelector('[data-zq="palette-input"]');
    const list = root.querySelector('[data-zq="palette-list"]');
    const commands = buildPaletteCommands();

    function draw(filterText) {
      const needle = (filterText || '').trim().toLowerCase();
      const filtered = commands.filter((cmd) => cmd.label.toLowerCase().includes(needle) || cmd.id.includes(needle));
      list.innerHTML = filtered.map((cmd) => {
        return '<div class="zq-cmd" data-zq-cmd="' + cmd.id + '"><span>' + cmd.label + '</span><span>' + cmd.id + '</span></div>';
      }).join('');
    }

    draw('');

    input.addEventListener('input', () => draw(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        togglePalette(false);
        return;
      }
      if (event.key === 'Enter') {
        const first = list.querySelector('[data-zq-cmd]');
        if (first) {
          first.click();
        }
      }
    });

    list.addEventListener('click', (event) => {
      const row = event.target.closest('[data-zq-cmd]');
      if (!row) return;
      const id = row.getAttribute('data-zq-cmd');
      const cmd = commands.find((item) => item.id === id);
      if (!cmd) return;
      togglePalette(false);
      cmd.run();
      logEvent('palette.run', { id: id });
      syncPanelControls();
      showToast('Ran: ' + cmd.label);
    });

    root.addEventListener('click', (event) => {
      if (event.target === root) {
        togglePalette(false);
      }
    });
  }

  function togglePalette(nextOpen) {
    state.paletteOpen = typeof nextOpen === 'boolean' ? nextOpen : !state.paletteOpen;
    applySettings();
    const root = document.getElementById('zombs-qol-palette');
    const input = root && root.querySelector('[data-zq="palette-input"]');
    if (state.paletteOpen && input) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      window.setTimeout(() => input.focus(), 0);
    }
  }

  function mountUnlockTip() {
    if (document.getElementById('zombs-qol-unlock-tip')) return;
    const tip = document.createElement('div');
    tip.id = 'zombs-qol-unlock-tip';
    tip.textContent = 'Dev menu locked. Press Ctrl+Alt+Shift+D';
    document.body.appendChild(tip);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function tickClockAndFakeHud() {
    if (state.clockLabel) {
      state.clockLabel.textContent = new Date().toLocaleTimeString();
    }
    if (state.fakeHudLabel && (state.settings.fakeHudNumbers || state.settings.simulatorEnabled)) {
      const gold = state.settings.simulatorEnabled ? state.settings.simGold : randomInt(600000, 999999);
      const wood = state.settings.simulatorEnabled ? state.settings.simWood : randomInt(600000, 999999);
      const stone = state.settings.simulatorEnabled ? state.settings.simStone : randomInt(600000, 999999);
      const wave = state.settings.simulatorEnabled ? state.settings.simWave : randomInt(900, 999);
      state.fakeHudLabel.textContent =
        'Gold: ' + gold + '\n'
        + 'Wood: ' + wood + '\n'
        + 'Stone: ' + stone + '\n'
        + 'Wave: ' + wave;
    }

    renderInspector();
    updatePlacementOverlay();
  }

  function tickFps(ts) {
    state.fpsFrameCount += 1;
    if (ts - state.fpsLastTs >= 1000) {
      const fps = Math.round((state.fpsFrameCount * 1000) / (ts - state.fpsLastTs));
      state.fpsFrameCount = 0;
      state.fpsLastTs = ts;
      if (state.fpsLabel) {
        state.fpsLabel.textContent = 'FPS: ' + fps;
      }
    }
    requestAnimationFrame(tickFps);
  }

  function setupHotkeys() {
    document.addEventListener('keydown', (event) => {
      if (event.repeat) return;

      const hotkeys = state.settings.hotkeys || makeDefaultHotkeys();

      if (matchesHotkey(event, hotkeys.unlock)) {
        unlockMenuFlow();
        syncPanelControls();
        event.preventDefault();
        return;
      }

      if (state.settings.requireUnlock && !state.isUnlocked) return;

      if (matchesHotkey(event, hotkeys.togglePalette)) {
        togglePalette();
        event.preventDefault();
        return;
      }

      if (matchesHotkey(event, hotkeys.togglePanel)) {
        state.settings.panelOpen = !state.settings.panelOpen;
        saveSettings();
        applySettings();
        syncPanelControls();
        logEvent('hotkey.panel');
        event.preventDefault();
        return;
      }

      if (matchesHotkey(event, hotkeys.togglePrank)) {
        state.settings.prankMode = !state.settings.prankMode;
        saveSettings();
        applySettings();
        syncPanelControls();
        logEvent('hotkey.prank', { enabled: state.settings.prankMode });
        showToast('Prank mode ' + (state.settings.prankMode ? 'ON' : 'OFF'));
        event.preventDefault();
        return;
      }

      if (matchesHotkey(event, hotkeys.toggleFakeHud)) {
        state.settings.fakeHudNumbers = !state.settings.fakeHudNumbers;
        saveSettings();
        applySettings();
        syncPanelControls();
        logEvent('hotkey.fakehud', { enabled: state.settings.fakeHudNumbers });
        showToast('Fake HUD ' + (state.settings.fakeHudNumbers ? 'ON' : 'OFF'));
        event.preventDefault();
      }
    });

    document.addEventListener('mousemove', (event) => {
      state.mouseX = event.clientX;
      state.mouseY = event.clientY;
    }, { passive: true });

    document.addEventListener('click', (event) => {
      if (state.settings.requireUnlock && !state.isUnlocked) return;
      if (!state.settings.showRangeOverlay) return;
      if (event.target.closest('#zombs-qol-panel') || event.target.closest('#zombs-qol-palette')) return;
      const radius = 35 + ((state.settings.simWave || 1) % 40);
      spawnRangeRing(event.clientX, event.clientY, radius);
      logEvent('overlay.range.spawn', { x: event.clientX, y: event.clientY, radius: radius });
    });
  }

  function boot() {
    ensureStyle();
    mountPanel();
    mountFpsCounter();
    mountClock();
    mountFakeHud();
    mountInspector();
    mountPlacementOverlay();
    mountPalette();
    mountToast();
    mountUnlockTip();
    setupHotkeys();
    applySettings();
    logEvent('boot');
    requestAnimationFrame(tickFps);
    window.setInterval(tickClockAndFakeHud, 500);
    console.log('[Zombs QoL] Loaded with inspector/simulator/palette/logs');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
