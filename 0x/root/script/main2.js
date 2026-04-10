// /root/script/main.js

let isTextToHex = true;
let currentThemeIndex = 0;
let currentFontIndex = 0;

const DB_NAME = '0xStudio_Assets_v2'; // Incremented version to clear old Blob-based stores
const STORE_NAME = 'media_cache';

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function processMedia(url) {
    if (!url) return null;
    const db = await initDB();
    
    try {
        // IndexedDB Cache
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const buffer = await new Promise((res) => {
            const req = store.get(url);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
        
        if (buffer) {
            // Determine MIME type based on extension
            const type = url.toLowerCase().endsWith('.webm') ? 'video/webm' : 'image/png';
            return URL.createObjectURL(new Blob([buffer], { type }));
        }
        
        // Fetch from Network if not cached
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        
        // Convert to ArrayBuffer (The "Incognito Cure")
        const data = await response.arrayBuffer();
        
        // Save to DB for next time
        const saveTx = db.transaction(STORE_NAME, 'readwrite');
        saveTx.objectStore(STORE_NAME).put(data, url);
        
        const type = url.toLowerCase().endsWith('.webm') ? 'video/webm' : 'image/png';
        return URL.createObjectURL(new Blob([data], { type }));
        
    } catch (err) {
        console.warn(`Storage fallback for: ${url}`, err);
        return url; // Return original URL so app doesn't break if DB fails
    }
}

/**
 * Global Bootstrapper
 */
async function preloadAppAssets() {
    const percentEl = document.getElementById('load-percent');
    const statusTextEl = document.getElementById('load-status-text');
    const loaderScreen = document.getElementById('loading-screen');
    
    // Compile list of all unique assets to load
    const assetUrls = [
        "./root/media/HuTaoStatic1.png",
        ...themes.flatMap(t => [t.sticker, t.indicator])
    ].filter(Boolean);
    
    let loadedCount = 0;
    
    // Process all assets concurrently
    await Promise.all(assetUrls.map(async (url) => {
        const blobUrl = await processMedia(url);
        
        // Map the generated Blob URL back to the themes array
        themes.forEach(theme => {
            if (theme.sticker === url) theme.blobSticker = blobUrl;
            if (theme.indicator === url) theme.blobIndicator = blobUrl;
        });
        
        if (url.includes('HuTaoStatic1')) window.footerImageBlobUrl = blobUrl;
        
        loadedCount++;
        const percent = Math.floor((loadedCount / assetUrls.length) * 100);
        if (percentEl) percentEl.innerText = percent;
    }));
    
    /*/ Hide loader and signal main.js to start
    if (loaderScreen) {
        loaderScreen.style.opacity = '0';
        setTimeout(() => {
            loaderScreen.style.display = 'none';
            window.dispatchEvent(new Event('assetsLoaded'));
        }, 500);
    }*/
        // Signal main.js that assets are ready FIRST
    window.dispatchEvent(new Event('assetsLoaded'));
    
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#202124' : '#ffffff');
}

function nextTheme() {
    document.body.classList.remove(themes[currentThemeIndex].class);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(currentThemeIndex);
    localStorage.setItem('selectedThemeIndex', currentThemeIndex);
    showToast(`${themes[currentThemeIndex].name}`);
}

function applyTheme(index) {
    const theme = themes[index];
    currentThemeIndex = index;
    
    document.body.classList.add(theme.class);
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-dark', theme.primaryDark);
    root.style.setProperty('--theme-hover', theme.hover);
    root.style.setProperty('--theme-header-dark', theme.headerDark);
    root.style.setProperty('--theme-bg-dark', theme.bgDark);
    root.style.setProperty('--theme-textout-dark', theme.bgDarkTextOut);
    root.style.setProperty('--theme-bg-btn-dark', theme.btnBgDark || theme.primaryDark);
    root.style.setProperty('--theme-text-btn-dark', theme.btnTextDark || '#202124');
    
    const stickerImg = document.getElementById('sticker-img');
    const indicator = document.getElementById('indicator');
    
    // Use the Blob URLs generated in storage.js
    if (stickerImg) stickerImg.src = theme.blobSticker || theme.sticker;
    if (indicator) {
        indicator.src = theme.blobIndicator || theme.indicator;
        indicator.load(); // Required for some browsers to refresh video source
    }
}

function applyFont(index) {
    document.body.classList.remove(fonts[currentFontIndex].class);
    currentFontIndex = index;
    document.body.classList.add(fonts[index].class);
}

function changeFont() {
    const newIndex = (currentFontIndex + 1) % fonts.length;
    applyFont(newIndex);
    localStorage.setItem('selectedFontIndex', newIndex);
    showToast(`Font: ${fonts[newIndex].name}`);
}

// --- App Initialization ---
window.addEventListener('assetsLoaded', () => {
    // 1. Initial Dark Mode Setup
    const isDark = localStorage.getItem('darkMode') === 'enabled';
    if (isDark) document.documentElement.classList.add('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#202124' : '#ffffff');
    
    // 2. Footer Image
    const footerImg = document.querySelector('footer img');
    if (footerImg && window.footerImageBlobUrl) footerImg.src = window.footerImageBlobUrl;

    // 3. Load State & Apply Themes (This changes the DOM immediately)
    const savedTheme = localStorage.getItem('selectedThemeIndex') || 0;
    const savedFont = localStorage.getItem('selectedFontIndex') || 0;
    
    applyTheme(parseInt(savedTheme));
    applyFont(parseInt(savedFont));
    setMode(isTextToHex);

    // 4. NOW fade out the loading screen, after the UI is perfectly set up!
    const loaderScreen = document.getElementById('loading-screen');
    if (loaderScreen) {
        // A tiny 50ms delay ensures the browser has painted the new theme colors
        setTimeout(() => {
            loaderScreen.style.opacity = '0';
            setTimeout(() => {
                loaderScreen.style.display = 'none';
            }, 500); // Matches your CSS transition duration
        }, 50);
    }
});

// Kick off the preloader as soon as the DOM is parsed
window.addEventListener('DOMContentLoaded', preloadAppAssets);

function setMode(toHex) {
    isTextToHex = toHex;
    const btn1 = document.getElementById('modeTextToHex');
    const btn2 = document.getElementById('modeHexToText');
    const inLabel = document.getElementById('inputLabel');
    const outLabel = document.getElementById('outputLabel');
    const inArea = document.getElementById('inputArea');
    const outArea = document.getElementById('outputArea');
    
    const active = "px-6 py-2 rounded-full text-sm font-medium transition-all bg-themePrimary text-white shadow-sm dark:bg-themeBgBtnDark dark:text-themeTextBtnDark";
    const inactive = "px-6 py-2 rounded-full text-sm font-medium transition-all text-themePrimary dark:text-themeDark hover:bg-gray-100 dark:hover:bg-gray-800";
    
    if (isTextToHex) {
        btn1.className = active;
        btn2.className = inactive;
        inLabel.innerText = "Source Text";
        outLabel.innerText = "Hexadecimal";
        inArea.classList.remove('mono');
        outArea.classList.add('mono');
    } else {
        btn2.className = active;
        btn1.className = inactive;
        inLabel.innerText = "Hexadecimal";
        outLabel.innerText = "Plain Text";
        inArea.classList.add('mono');
        outArea.classList.remove('mono');
    }
    clearAll();
}

function convert() {
    const val = document.getElementById('inputArea').value;
    const output = document.getElementById('outputArea');
    const delimiter = document.getElementById('delimiter').value;
    if (!val) {
        output.value = "";
        return;
    }
    
    if (isTextToHex) {
        const bytes = new TextEncoder().encode(val);
        output.value = Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(delimiter);
    } else {
        const hex = val.replace(/[^0-9A-Fa-f]/g, '');
        if (hex.length % 2 !== 0) return;
        try {
            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            output.value = new TextDecoder().decode(bytes);
        } catch (e) {
            output.value = "Invalid Hex";
        }
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(40px)";
    }, 2500);
}

function clearAll() {
    document.getElementById('inputArea').value = "";
    document.getElementById('outputArea').value = "";
}

function downloadOutput() {
    const text = document.getElementById('outputArea').value;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = isTextToHex ? "hex.txt" : "text.txt";
    a.click();
}

async function copyOutput() {
    const text = document.getElementById('outputArea').value;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    showToast("Copied!");
}
