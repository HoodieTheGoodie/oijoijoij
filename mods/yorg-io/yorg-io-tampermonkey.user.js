// ==UserScript==
// @name         yorg.io QoL Starter
// @namespace    copilot.multi-game.mods
// @version      0.1.0
// @description  Starter script scaffold for yorg.io mods.
// @author       GitHub Copilot
// @match        https://yorg.io/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = [
    '#yorg-qol-badge {',
    '  position: fixed;',
    '  right: 12px;',
    '  bottom: 12px;',
    '  z-index: 2147483647;',
    '  padding: 6px 10px;',
    '  border-radius: 8px;',
    '  border: 1px solid rgba(255,255,255,0.25);',
    '  background: rgba(9, 14, 24, 0.85);',
    '  color: #e2e8f0;',
    '  font: 12px/1.3 Verdana, sans-serif;',
    '}'
  ].join('\n');

  const badge = document.createElement('div');
  badge.id = 'yorg-qol-badge';
  badge.textContent = 'yorg.io mod scaffold loaded';

  document.head.appendChild(style);
  document.body.appendChild(badge);

  console.log('[yorg.io QoL] Starter loaded.');
})();
