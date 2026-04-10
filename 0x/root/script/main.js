// /root/script/main.js

let isTextToHex = true;
let currentThemeIndex = 0;
let currentFontIndex = 0;

const DB_NAME = 'Prefix_Studio_Assets_v2';
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
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const buffer = await new Promise((res) => {
            const req = store.get(url);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
        
        if (buffer) {
            const type = url.toLowerCase().endsWith('.webm') ? 'video/webm' : 'image/png';
            return URL.createObjectURL(new Blob([buffer], { type }));
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        
        const data = await response.arrayBuffer();
        
        const saveTx = db.transaction(STORE_NAME, 'readwrite');
        saveTx.objectStore(STORE_NAME).put(data, url);
        
        const type = url.toLowerCase().endsWith('.webm') ? 'video/webm' : 'image/png';
        return URL.createObjectURL(new Blob([data], { type }));
        
    } catch (err) {
        console.warn(`Storage fallback for: ${url}`, err);
        return url;
    }
}

async function preloadAppAssets() {
    const percentEl = document.getElementById('load-percent');
    const assetUrls = [
        "./root/media/HuTaoStatic1.png",
        ...themes.flatMap(t => [t.sticker, t.indicator])
    ].filter(Boolean);
    
    let loadedCount = 0;
    const total = assetUrls.length;
    
    const updateProgress = () => {
        loadedCount++;
        const percent = Math.floor((loadedCount / total) * 100);
        if (percentEl) {
            requestAnimationFrame(() => {
                percentEl.innerText = `${percent}`;
            });
        }
    };
    
    await Promise.all(assetUrls.map(async (url) => {
        try {
            const blobUrl = await processMedia(url);
            
            themes.forEach(theme => {
                if (theme.sticker === url) theme.blobSticker = blobUrl;
                if (theme.indicator === url) theme.blobIndicator = blobUrl;
            });
            
            if (url.includes('HuTaoStatic1')) {
                window.footerImageBlobUrl = blobUrl;
            }
            
            updateProgress();
        } catch (err) {
            console.error(`Failed to load asset: ${url}`, err);
            updateProgress();
        }
    }));
    
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
    showToast(`Theme: ${themes[currentThemeIndex].name}`);
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
    
    if (stickerImg) stickerImg.src = theme.blobSticker || theme.sticker;
    if (indicator) {
        indicator.src = theme.blobIndicator || theme.indicator;
        indicator.load();
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

window.addEventListener('assetsLoaded', () => {
    const isDark = localStorage.getItem('darkMode') === 'enabled';
    if (isDark) document.documentElement.classList.add('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#202124' : '#ffffff');
    
    const footerImg = document.querySelector('footer img');
    if (footerImg && window.footerImageBlobUrl) footerImg.src = window.footerImageBlobUrl;
    
    const savedTheme = localStorage.getItem('selectedThemeIndex') || 0;
    const savedFont = localStorage.getItem('selectedFontIndex') || 0;
    
    applyTheme(parseInt(savedTheme));
    applyFont(parseInt(savedFont));
    setMode(isTextToHex);
    
    const loaderScreen = document.getElementById('loading-screen');
    if (loaderScreen) {
        setTimeout(() => {
            loaderScreen.style.opacity = '0';
            setTimeout(() => {
                loaderScreen.style.display = 'none';
            }, 500);
        }, 50);
    }
});

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

let toastTimer;

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    
    if (toastTimer) {
        clearTimeout(toastTimer);
    }
    
    toastTimer = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(40px)";
    }, 1500);
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
