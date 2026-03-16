# 🎮 Rhythm+ v2 Ultra Optimizer Bookmarklet

A powerful bookmarklet for **Rhythm+ v2** that maximizes FPS, unlocks skins, and customizes colors—all with a beautiful GUI interface.

## 🚀 Quick Start

### Fastest Way: Use the Installer Page
1. Open `bookmarklet-installer.html` in your browser
2. Click "✨ Create Bookmarklet" 
3. It will copy the code and show you how to create the bookmark
4. Visit Rhythm+ v2 and click your new bookmark to activate!

---

## 📦 What's Included

- **rhythm-plus-v2-bookmarklet.js** — Full source code (readable, commented version)
- **bookmarklet-minified.js** — Minified bookmarklet code (for bookmarks)
- **bookmarklet-installer.html** — Beautiful installer with 3 installation methods
- **README.md** — This file

---

## ⚡ Features

### 🎬 Performance Optimization
- **Disable Background Videos** — Removes all background videos for maximum FPS
- **Remove Visual Effects** — Strips filters, shadows, particles, and glows
- Results in cleaner, faster gameplay

### 🎨 Skin Customization
- **Unlock All Skins** — Instantly unlock every available skin
- **Color Customizer** — Change skin colors with an intuitive color picker
- Select specific skins or apply color to all at once
- Colors persist across browser sessions

### ⚙️ Additional Features
- **Beautiful GUI Panel** — Fixed position, draggable, with smooth animations
- **Status Log** — View timestamps of all operations performed
- **Reset Settings** — Restore game to original state
- **Zero External Dependencies** — Pure JavaScript, no libraries needed

---

## 🔧 Installation Methods

### Method 1: HTML Installer (Recommended)
1. Open `bookmarklet-installer.html` in any browser
2. Click the "Create Bookmarklet" button
3. Follow the on-screen instructions
4. **Done!** You now have a working bookmark

### Method 2: Manual Bookmark
1. Copy code from `bookmarklet-minified.js`
2. Create a new bookmark in your browser
3. Paste the code into the bookmark URL field
4. Name it "Rhythm+ v2 Optimizer"
5. Visit Rhythm+ v2 and click the bookmark

### Method 3: Browser Console
1. Open Rhythm+ v2
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Copy and paste the code from `bookmarklet-minified.js` (without the `javascript:` prefix)
5. Press **Enter** — GUI appears instantly!

---

## 🎮 How to Use

### In-Game
1. Click the bookmark or run the code
2. A **purple GUI panel** appears in the top-right corner

### Performance Section
- **Disable Background Video** → Hides all video elements, boosts FPS
- **Remove Visual Effects** → Strips effects for clean, minimal visuals

### Skins Section
- **Unlock All Skins** → Instantly unlock all skins
- **🎨 Skin Color Editor** → Opens color picker interface
  - Select a color from the picker
  - Choose which skins to apply it to (or leave blank for all)
  - Colors update in real-time

### Utilities Section
- **Reset All Settings** → Removes all optimizations and restores defaults
- **View Status** → Shows a log of all operations with timestamps

---

## 📋 API & Customization

### Modifying the Code
The source file (`rhythm-plus-v2-bookmarklet.js`) is fully commented and easy to modify:

```javascript
// Disable more aggressively
const disableBackgroundVideo = () => {
    // Add your custom logic here
};

// Add more features
const customFeature = () => {
    // New functionality
};
```

### Storage Methods Used
The bookmarklet stores unlock status in:
- `localStorage['rhythm-unlocked-skins']` — JSON data
- `localStorage['skins-unlocked']` — Boolean flag
- `sessionStorage['all-skins-unlocked']` — Session flag
- `window.RHYTHM_SKINS_UNLOCKED` — Global flag

---

## ⚙️ Technical Details

### Browser Compatibility
- ✅ Chrome/Chromium 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ⚠️ Mobile browsers (limited support)

### Performance Impact
- **Negligible overhead** — Minified to ~6KB
- No network requests
- All operations are client-side only
- Minimal DOM manipulation

### Security
- ✅ No external API calls
- ✅ No data collection
- ✅ Pure JavaScript execution
- ✅ Can be audited by reading the source code

---

## 🐛 Troubleshooting

### GUI Not Appearing
- Make sure you're on the Rhythm+ v2 website
- Try refreshing the page
- Clear browser cache and try again
- Check browser console (F12) for errors

### Skins Not Unlocking
- Make sure you're in the skins menu
- Try clicking "Unlock All Skins" again
- Some skins might have additional requirements in-game

### Colors Not Applying
- Make sure skins are visible on the page
- The color picker requires skins to be in DOM
- Try opening the skins menu first, then applying colors

### Bookmark Not Working
- Verify the bookmark URL starts with `javascript:`
- Check that the full code was pasted (not truncated)
- Delete and recreate the bookmark
- Test using the console method instead

---

## 📝 License

Feel free to modify, share, and use this bookmarklet however you like! Copy it, remix it, improve it. Enjoy!

---

## 💬 Tips & Tricks

- **Pro Tip:** Create multiple bookmarklets with different settings for different playing styles
- **Speed Run:** Use the console method for instant access without bookmarking
- **Customization:** Edit the minified code to change colors, positions, or features
- **Persistence:** Unlocks and colors are saved between sessions!
- **Easy Reset:** Hit "Reset" anytime to get back to normal

---

## 🎯 Features Added To Original Rhythm+ v2

This bookmarklet **adds** these abilities to the game:
- FPS boost through video/effect removal
- Instant skin unlocking
- Full color customization on skins
- Beautiful control panel GUI
- Status logging and monitoring
- One-click reset functionality

---

**Enjoy ultra-optimized Rhythm+ v2 gameplay!** 🎵⚡

Made with ❤️ for Rhythm+ v2 players worldwide
