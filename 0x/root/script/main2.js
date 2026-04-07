// /root/script/main.js

const DB_NAME = 'PrefixStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'media_cache';

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getCachedMedia(url) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(url);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            console.error(`Get failed for ${url}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

async function cacheMedia(url) {
    const existing = await getCachedMedia(url);
    if (existing) {
        console.log(`[Cache] Already cached: ${url}`);
        return existing;
    }
    
    try {
        console.log(`[Cache] Fetching: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log(`[Cache] Fetched blob: ${blob.size} bytes, type: ${blob.type} for ${url}`);
        
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.put(blob, url);
            
            request.onsuccess = () => {
                console.log(`[Cache] Successfully stored: ${url}`);
                resolve(blob);
            };
            
            request.onerror = (event) => {
                console.error(`[Cache] Put request failed for ${url}:`, event.target.error);
                reject(event.target.error);
            };
            
            // Also listen to transaction errors
            transaction.onerror = (event) => {
                console.error(`[Cache] Transaction error for ${url}:`, event.target.error);
            };
            
            transaction.oncomplete = () => {
                console.log(`[Cache] Transaction completed for ${url}`);
            };
        });
    } catch (e) {
        console.error(`[Cache] Failed for ${url}:`, e.name || e, e.message || e);
        
        // Extra hint for quota issues
        if (e.name === 'QuotaExceededError' || (e.message && e.message.includes('quota'))) {
            console.error("💥 IndexedDB quota exceeded! Try clearing site data or using smaller files.");
        }
        
        return null;
    }
}

let isTextToHex = true;
let currentThemeIndex = 0;
let currentFontIndex = 0;

// --- Dark Mode ---
function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#202124' : '#ffffff');
    }
}

// --- Theme Logic ---
function nextTheme() {
    document.body.classList.remove(themes[currentThemeIndex].class);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    
    applyTheme(currentThemeIndex);
    localStorage.setItem('selectedThemeIndex', currentThemeIndex);
    
    showToast(`${themes[currentThemeIndex].name}`);
}

async function applyTheme(index) {
    const theme = themes[index];
    currentThemeIndex = index;
    
    document.body.classList.add(theme.class);
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-dark', theme.primaryDark);
    document.documentElement.style.setProperty('--theme-hover', theme.hover);
    document.documentElement.style.setProperty('--theme-header-dark', theme.headerDark);
    document.documentElement.style.setProperty('--theme-bg-dark', theme.bgDark);
    document.documentElement.style.setProperty('--theme-textout-dark', theme.bgDarkTextOut);
    document.documentElement.style.setProperty('--theme-text-btn-dark', theme.btnTextDark);
    document.documentElement.style.setProperty('--theme-bg-btn-dark', theme.btnBgDark);
    document.documentElement.style.setProperty('--theme-bg-btn-dark', theme.btnBgDark || theme.primaryDark);
    
    // If btnTextDark is missing, use #202124 (your dark mode background color) for high contrast.
    document.documentElement.style.setProperty('--theme-text-btn-dark', theme.btnTextDark || '#202124');

    const stickerImg = document.getElementById('sticker-img');
    const indicator = document.getElementById('indicator');

    // Handle Video from Cache
    if (indicator && theme.indicator) {
        console.log(`Applying indicator: ${theme.indicator}`);
        const videoBlob = await getCachedMedia(theme.indicator);
    
        if (videoBlob) {
            console.log(`Using cached blob (${videoBlob.size} bytes)`);
            const objectUrl = URL.createObjectURL(videoBlob);
            indicator.src = objectUrl;
            // Optional: revoke later if you want (but not necessary for <video>)
        } else {
            console.warn(`No cached blob, falling back to direct URL: ${theme.indicator}`);
            indicator.src = theme.indicator;
        }
    
        indicator.load();
        indicator.play().catch(e => console.warn("Video play failed:", e));
    }
}

// --- Font Logic ---
function changeFont() {
    document.body.classList.remove(fonts[currentFontIndex].class);
    currentFontIndex = (currentFontIndex + 1) % fonts.length;
    
    applyFont(currentFontIndex);
    localStorage.setItem('selectedFontIndex', currentFontIndex);
    showToast(`Font: ${fonts[currentFontIndex].name}`);
}

function applyFont(index) {
    currentFontIndex = index;
    document.body.classList.add(fonts[index].class);
}

// --- App Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#202124' : '#ffffff');
    
    const savedThemeIndex = localStorage.getItem('selectedThemeIndex');
    if (savedThemeIndex !== null) applyTheme(parseInt(savedThemeIndex));
    
    const savedFontIndex = localStorage.getItem('selectedFontIndex');
    if (savedFontIndex !== null) {
        applyFont(parseInt(savedFontIndex));
    } else {
        applyFont(0);
    }
    setMode(isTextToHex);
});

// --- UI & Conversion Logic ---
function setMode(toHex) {
    isTextToHex = toHex;
    const btn1 = document.getElementById('modeTextToHex');
    const btn2 = document.getElementById('modeHexToText');
    const inLabel = document.getElementById('inputLabel');
    const outLabel = document.getElementById('outputLabel');
    const inArea = document.getElementById('inputArea');
    const outArea = document.getElementById('outputArea');
    
    // Define the active and inactive classes once to avoid typos
    const activeClasses = "px-6 py-2 rounded-full text-sm font-medium transition-all bg-themePrimary text-white shadow-sm dark:bg-themeBgBtnDark dark:text-themeTextBtnDark";
    const inactiveClasses = "px-6 py-2 rounded-full text-sm font-medium transition-all text-themePrimary dark:text-themeDark hover:bg-gray-100 dark:hover:bg-gray-800";
    
    if (isTextToHex) {
        btn1.className = activeClasses;
        btn2.className = inactiveClasses;
        inLabel.innerText = "Source Text";
        outLabel.innerText = "Hexadecimal";
        inArea.classList.remove('mono');
        outArea.classList.add('mono');
    } else {
        btn2.className = activeClasses;
        btn1.className = inactiveClasses;
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
    if (!val) { output.value = ""; return; }
    
    if (isTextToHex) {
        const bytes = new TextEncoder().encode(val);
        output.value = Array.from(bytes).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(delimiter);
    } else {
        const hex = val.replace(/[^0-9A-Fa-f]/g, '');
        if (hex.length % 2 !== 0) return;
        try {
            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            output.value = new TextDecoder().decode(bytes);
        } catch (e) { output.value = "Invalid Hex"; }
    }
}

// --- Utility Functions ---
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('inputArea').value = e.target.result;
        convert();
        showToast("File loaded");
    };
    reader.readAsText(file);
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


// Preload stickers for instant switching
window.addEventListener('load', () => {
    themes.forEach(theme => {
        if (theme.sticker) {
            const img = new Image();
            img.src = theme.sticker;
        }
    });
});
