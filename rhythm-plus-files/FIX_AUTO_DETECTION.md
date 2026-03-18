# 🔧 Fixing Rhythm+ v2 Mod Auto-Detection

## Problem
The Tampermonkey script isn't auto-injecting when you visit Rhythm+ v2

## Solution (Try in Order)

### Step 1: Update to New Version (v2.1)
I've updated the script to use **automatic detection** instead of specific URLs.

1. Open Tampermonkey Dashboard
2. Edit your Rhythm+ v2 Ultimate Mod script
3. Replace with the latest `rhythm-plus-v2-tampermonkey.js`
4. Save (Ctrl+S)
5. Visit Rhythm+ v2 again

**This should work now!** The script auto-detects Rhythm+ v2 websites.

---

## If It Still Doesn't Work

### Option A: Manual Detection (Copy Your URL)

1. **Go to Rhythm+ v2 website**
2. **Look at the URL bar** - what does it say?
   - Example: `https://mysite.com/rhythm`
   - Example: `https://rhythm-game.itch.io/`

3. **Copy the URL pattern** you see

4. **Open Tampermonkey Dashboard**
5. **Edit your script**
6. **Replace the `@match` line with this:**

```javascript
@match        https://YOURURL.com/*
```

Replace `YOURURL.com` with your actual site!

---

### Option B: Exact URL Configuration

If you know the exact URL, replace the first `@match` line with all of these:

```javascript
// Replace @match        *://*/
// With:
@match        https://mysite.com/*
@match        http://mysite.com/*
@match        https://mysite.com/**
@match        *://mysite.com/*
```

(Replace `mysite.com` with your actual domain)

---

## Finding Your Exact Rhythm+ v2 URL

### Method 1: Inspect the Website

1. **Visit Rhythm+ v2**
2. **Right-click** → **Inspect** (or press F12)
3. **Go to Console tab**
4. **Type this and press Enter:**
   ```javascript
   console.log(window.location.href);
   ```
5. **Copy the URL you see**
6. **Use that in `@match` patterns**

### Method 2: Look at Browser Bar

1. Visit Rhythm+ v2
2. Look at the URL bar at the top of browser
3. It will show the exact URL
4. Copy it (excluding anything after `#`)

### Method 3: Check Bookmark

If you have a bookmark to Rhythm+ v2:
1. Right-click the bookmark
2. Edit
3. Look at the URL field
4. That's your exact URL!

---

## Common Rhythm+ v2 URLs

Try these, one might work:

```javascript
@match        *://rhythm*.com/*
@match        *://rhythm*.net/*
@match        *://rhythm*.io/*
@match        *://rhythm*.github.io/*
@match        *://*rhythm*.com/*
@match        *://*rhythm*.net/*
@match        http://localhost:*/*
@match        https://localhost:*/*
```

---

## Tampermonkey Dashboard (How to Edit)

1. **Click Tampermonkey icon** in browser toolbar
2. **Click "Dashboard"**
3. **You'll see your scripts listed**
4. **Click "Rhythm+ v2 Ultimate Mod"**
5. **Find these lines at the top:**
   ```javascript
   // ==UserScript==
   // @match        *://*/
   // @name         Rhythm+ v2 Ultimate Mod
   ```
6. **Edit the `@match` line**
7. **Save (Ctrl+S)**

---

## Testing It Works

### Method 1: Console Check
1. Go to Rhythm+ v2
2. Open browser console (F12 → Console)
3. You should see:
   ```
   Rhythm+ Mod: ✓ Harmony+ Mod loaded!...
   ```
4. If you see it, **it's working!** ✅

### Method 2: Visual Check
1. Visit Rhythm+ v2
2. Look for **purple GUI panel** in top-right corner
3. If it appears, **it's working!** ✅

---

## Auto-Detection Features

The new v2.1 script:
✅ Detects "rhythm" in URL, title, or HTML  
✅ Detects game-related elements automatically  
✅ Detects canvas elements (games use canvas)  
✅ Detects game data objects  
✅ Works on most game sites  

---

## Still Not Working? Try These:

### 1. Hard Refresh
- Press **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
- This clears cache and reloads the page
- Tampermonkey should then inject

### 2. Check Tampermonkey is Enabled
- Click Tampermonkey icon
- Make sure the script has a **✓ checkmark** next to it
- If disabled, **enable it**

### 3. Check Script Has Right Name
- Dashboard
- Look for "Rhythm+ v2 Ultimate Mod"
- Should have 2/2 or similar (indicating it matched)

### 4. Console Error Check
- Press F12 → Console tab
- Look for red error messages
- Copy any errors and check them

### 5. Verify @match is Correct
- Dashboard
- Edit script
- Look at `@match` lines
- Make sure they match your website URL

---

##  Quick @match Examples

| Your URL | @match to Use |
|----------|------|
| `https://rhythm-game.itch.io/` | `@match *://rhythm-game.itch.io/*` |
| `https://mysite.com/rhythm+` | `@match *://mysite.com/*` |
| `http://localhost:3000/` | `@match http://localhost:3000/*` |
| `https://rhythm.gamesite.io/v2` | `@match *://rhythm.gamesite.io/*` |

---

## How Blooket Hacks Work (For Reference)

Blooket hacks match with:
```javascript
@match        https://www.blooket.com/*
@match        http://www.blooket.com/*
@match        https://blooket.com/*
@match        *://*.blooket.com/*
```

For Rhythm+ v2, do the same but use your actual domain!

---

## Still Stuck?

1. **Tell me your Rhythm+ v2 URL** 
   - What do you see in the browser address bar?
2. **I'll give you exact @match patterns to use**

For now, the new v2.1 auto-detection should work on most sites!

---

## Summary

✅ **Updated Tampermonkey script** to v2.1 with auto-detection  
✅ **Replace your script** with new code  
✅ **Hard refresh** the Rhythm+ v2 page (Ctrl+Shift+R)  
✅ **Purple GUI should appear!**  

If still no luck, reply with your exact Rhythm+ v2 URL and I'll customize it for you!

🎮 **Should work now like Blooket hacks!**
