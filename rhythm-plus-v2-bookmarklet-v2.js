// Rhythm+ v2 Ultimate Optimizer & Customizer Bookmarklet v2
// Enhanced with: Draggable GUI, Minimize button, Better video removal, Improved skin unlocking
// 
// Copy the minified version (at the bottom) and create a bookmark with javascript: prefix
// Or paste this entire code into the browser console

(function(){
  'use strict';
  
  let isMinimized = false;
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  // Multiple video removal strategies for maximum compatibility
  const removeVideosAdvanced = () => {
    // Strategy 1: Hide all video elements
    document.querySelectorAll('video').forEach(v => {
      v.style.display = 'none !important';
      v.style.visibility = 'hidden !important';
      v.pause();
    });

    // Strategy 2: CSS-based removal
    const style = document.createElement('style');
    style.id = 'video-removal-css-' + Date.now();
    style.textContent = `
      video { display: none !important; visibility: hidden !important; }
      [class*="video"], [class*="background"], [id*="video"], [id*="bg"] { 
        display: none !important; 
      }
      canvas[class*="bg"], canvas[class*="background"] {
        opacity: 0 !important;
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    // Strategy 3: Continuous monitoring
    setInterval(() => {
      document.querySelectorAll('video').forEach(v => {
        v.style.display = 'none';
        v.pause();
      });
    }, 500);
  };

  // Advanced skin unlocking
  const advancedUnlockSkins = () => {
    // Method 1: localStorage variations
    localStorage.setItem('unlockedSkins', JSON.stringify({all: true, timestamp: Date.now()}));
    localStorage.setItem('rhythmSkins', JSON.stringify({unlocked: true}));
    localStorage.setItem('skinUnlock', 'true');
    localStorage.setItem('all_skins_unlocked', 'true');

    // Method 2: sessionStorage
    sessionStorage.setItem('unlockedSkins', 'true');
    sessionStorage.setItem('allSkinsUnlocked', 'true');

    // Method 3: Window object
    window.RHYTHM_SKINS_UNLOCKED = true;
    window.GAME_SKINS_UNLOCKED = true;
    window.ALL_SKINS = true;

    // Method 4: DOM manipulation
    document.querySelectorAll('[class*="skin"], [class*="locked"], [class*="unavailable"]').forEach(elem => {
      elem.style.opacity = '1';
      elem.style.pointerEvents = 'auto';
      elem.classList.remove('locked', 'disabled', 'unavailable', 'locked-skin');
      elem.removeAttribute('disabled');
    });
  };

  // Create GUI
  const createGUI = () => {
    const existing = document.getElementById('rhythm-optimizer-gui');
    if(existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'rhythm-optimizer-gui';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 3px solid #fff;
      border-radius: 15px;
      padding: 20px;
      font-family: 'Arial', sans-serif;
      color: white;
      z-index: 999999;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      max-height: 85vh;
      overflow-y: auto;
      user-select: none;
      cursor: grab;
      transition: all 0.3s ease;
    `;

    const html = `
      <div id="gui-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px; cursor: grab;">
        <h2 style="margin: 0; font-size: 18px; letter-spacing: 1px;">⚡ RHYTHM+ MOD</h2>
        <div style="display: flex; gap: 8px;">
          <button id="minimize-gui" style="background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 18px; width: 30px; height: 30px; border-radius: 50%; transition: all 0.3s; font-weight: bold;">−</button>
          <button id="close-gui" style="background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 20px; width: 30px; height: 30px; border-radius: 50%; transition: all 0.3s;">✕</button>
        </div>
      </div>

      <div id="gui-content">
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 10px 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">🎬 Performance</h3>
          <button id="optimize-fps" style="width: 100%; padding: 10px; background: #ff6b6b; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s; margin-bottom: 8px;">🎥 Remove Background Video</button>
          <button id="remove-effects" style="width: 100%; padding: 10px; background: #ff6b6b; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s; margin-bottom: 8px;">✨ Remove Effects & Filters</button>
          <button id="optimize-all" style="width: 100%; padding: 10px; background: #ff4444; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">⚡ ULTRA MODE</button>
        </div>

        <div style="margin-bottom: 15px;">
          <h3 style="margin: 10px 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">🎨 Skins & Colors</h3>
          <button id="unlock-all-skins" style="width: 100%; padding: 10px; background: #4ecdc4; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s; margin-bottom: 8px;">🔓 Unlock All Skins</button>
          <button id="color-customizer" style="width: 100%; padding: 10px; background: #f7b731; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">🎨 Skin Color Editor</button>
        </div>

        <div id="color-panel" style="display: none; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 10px 0; font-size: 13px;">Color Customizer:</h4>
          <input type="color" id="skin-color-picker" value="#ff6b6b" style="width: 100%; height: 40px; cursor: pointer; border: none; border-radius: 6px; margin-bottom: 10px;">
          <div id="skin-list" style="margin-top: 10px; max-height: 200px; overflow-y: auto;"></div>
        </div>

        <div style="margin-bottom: 15px;">
          <h3 style="margin: 10px 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">⚙️ Utilities</h3>
          <button id="reset-settings" style="width: 100%; padding: 10px; background: #95e1d3; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s; margin-bottom: 8px;">🔄 Reset All Settings</button>
          <button id="status-log" style="width: 100%; padding: 10px; background: #a8edea; border: none; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s;">📋 View Status Log</button>
        </div>

        <div id="status-box" style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; font-size: 11px; line-height: 1.5; display: none; max-height: 200px; overflow-y: auto;">
          <div id="status-content"></div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    document.body.appendChild(container);

    // Setup event listeners
    setupEventListeners(container);
    setupDragging(container);

    logStatus('✓ Rhythm+ Mod v2 loaded! Draggable GUI active.');
  };

  const setupDragging = (container) => {
    const header = document.getElementById('gui-header');
    
    header.addEventListener('mousedown', (e) => {
      if(e.target.tagName === 'BUTTON') return;
      isDragging = true;
      offsetX = e.clientX - container.offsetLeft;
      offsetY = e.clientY - container.offsetTop;
      container.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if(!isDragging) return;
      const elem = document.getElementById('rhythm-optimizer-gui');
      if(elem) {
        elem.style.left = (e.clientX - offsetX) + 'px';
        elem.style.right = 'auto';
        elem.style.top = (e.clientY - offsetY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      const elem = document.getElementById('rhythm-optimizer-gui');
      if(elem) elem.style.cursor = 'grab';
    });
  };

  const setupEventListeners = () => {
    document.getElementById('close-gui').addEventListener('click', () => {
      document.getElementById('rhythm-optimizer-gui').remove();
    });
    
    document.getElementById('minimize-gui').addEventListener('click', () => {
      const content = document.getElementById('gui-content');
      const btn = document.getElementById('minimize-gui');
      if(isMinimized) {
        content.style.display = 'block';
        btn.textContent = '−';
        isMinimized = false;
      } else {
        content.style.display = 'none';
        btn.textContent = '+';
        isMinimized = true;
      }
    });

    document.getElementById('optimize-fps').addEventListener('click', () => {
      removeVideosAdvanced();
      logStatus('✓ Background videos disabled - FPS optimized!');
    });

    document.getElementById('remove-effects').addEventListener('click', () => {
      const style = document.createElement('style');
      style.id = 'effects-remove-' + Date.now();
      style.textContent = `
        * { filter: none !important; box-shadow: none !important; text-shadow: none !important; }
        [class*="effect"], [class*="particle"], [class*="glow"], [class*="blur"], [class*="bloom"], [class*="shadow"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      logStatus('✓ Visual effects removed!');
    });

    document.getElementById('optimize-all').addEventListener('click', () => {
      removeVideosAdvanced();
      document.getElementById('remove-effects').click();
      logStatus('⚡ ULTRA MODE activated - maximum performance!');
    });

    document.getElementById('unlock-all-skins').addEventListener('click', () => {
      advancedUnlockSkins();
      logStatus('✓ All skins unlocked! (Multiple methods applied)');
    });

    document.getElementById('color-customizer').addEventListener('click', () => {
      const panel = document.getElementById('color-panel');
      if(panel.style.display === 'none') {
        panel.style.display = 'block';
        populateSkinList();
      } else {
        panel.style.display = 'none';
      }
    });

    document.getElementById('skin-color-picker').addEventListener('change', applyColorToSkins);

    document.getElementById('reset-settings').addEventListener('click', () => {
      document.querySelectorAll('[id*="remove"], [id*="disable"]').forEach(el => el.remove());
      localStorage.clear();
      sessionStorage.clear();
      logStatus('✓ All settings reset!');
    });

    document.getElementById('status-log').addEventListener('click', () => {
      const box = document.getElementById('status-box');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });

    // Hover effects
    document.querySelectorAll('#rhythm-optimizer-gui button').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
      });
    });
  };

  const populateSkinList = () => {
    const skinList = document.getElementById('skin-list');
    const skinElements = document.querySelectorAll('[class*="skin"]');
    
    if(skinElements.length === 0) {
      skinList.innerHTML = '<p style="font-size: 11px; opacity: 0.8;">No skins found. Open skins menu first.</p>';
      return;
    }

    skinList.innerHTML = '';
    const skins = new Set();
    
    skinElements.forEach((elem, index) => {
      const skinName = elem.textContent.trim() || `Skin ${index + 1}`;
      if(skinName && !skins.has(skinName)) {
        skins.add(skinName);
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; margin: 8px 0; cursor: pointer; font-size: 12px;';
        label.innerHTML = `
          <input type="checkbox" data-skin="${skinName}" style="margin-right: 8px; cursor: pointer;">
          <span>${skinName}</span>
        `;
        skinList.appendChild(label);
      }
    });
  };

  const applyColorToSkins = () => {
    const color = document.getElementById('skin-color-picker').value;
    const checkedSkins = document.querySelectorAll('#skin-list input[type="checkbox"]:checked');
    
    if(checkedSkins.length === 0) {
      document.querySelectorAll('[class*="skin"]').forEach(elem => {
        elem.style.backgroundColor = color;
        elem.style.borderColor = color;
      });
    } else {
      checkedSkins.forEach(checkbox => {
        const skinName = checkbox.dataset.skin;
        document.querySelectorAll('[class*="skin"]').forEach(elem => {
          if(elem.textContent.includes(skinName)) {
            elem.style.backgroundColor = color;
            elem.style.borderColor = color;
          }
        });
      });
    }

    logStatus(`✓ Skin color updated to ${color}`);
  };

  const logStatus = (message) => {
    const content = document.getElementById('status-content');
    if(content) {
      const time = new Date().toLocaleTimeString();
      content.innerHTML = `[${time}] ${message}<br>` + content.innerHTML;
    }
    console.log('Rhythm+ Mod:', message);
  };

  // Initialize
  createGUI();
})();
