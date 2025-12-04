// SoundPond - UI Module
// Handles all UI interactions and state

import { soundCloudAuth } from './services/SoundCloudAuth.js';
import { artistStore } from './services/ArtistStore.js';
import { soundCloudAPI } from './services/SoundCloudAPI.js';

// ===== State =====
let gameState = {
    score: 100, // Starting score
    autoFeed: false,
    talkMode: false,
    showDebug: false,
    soundEnabled: true, // Sound enabled by default
    timeSpeed: 2, // 0=Stopped, 1=Realtime, 2=Normal, 3=Fast
    selectedBackground: 1,
    totalBirths: 0,
    totalDeaths: 0,
    currentAliveFish: 0,
    unreadMemories: 0,
    spiritEvents: [],
    fishCounts: {},
    unlockedSpecies: new Set(['basic']), // Track unlocked species
    hasSeenOnboarding: false // Track if user has seen the welcome tooltip
};

// Sound manager reference (set via initUI)
let soundManager = null;

// Time speed labels
const TIME_SPEED_LABELS = ['Stopped', 'Real Time', 'Normal', 'Fast'];

// Background options
const BACKGROUNDS = [
    { id: 1, name: 'Ocean Depths', file: 'Background1.jpg' },
    { id: 2, name: 'Coral Reef', file: 'Background2.jpg' },
    { id: 3, name: 'Twilight Waters', file: 'Background3.jpg' },
    { id: 4, name: 'Mystic Lagoon', file: 'Background4.jpg' }
];

// Species catalog (must match config.js)
let speciesCatalog = [];

// Callbacks
let onPurchase = null;
let onBackgroundChange = null;
let onTimeSpeedChange = null;
let onRestart = null;

// ===== Initialization =====
export function initUI(species, callbacks = {}, sound = null) {
    speciesCatalog = species;
    onPurchase = callbacks.onPurchase;
    onBackgroundChange = callbacks.onBackgroundChange;
    onTimeSpeedChange = callbacks.onTimeSpeedChange;
    onRestart = callbacks.onRestart;
    soundManager = sound;
    
    setupEventListeners();
    renderBackgroundList();
    renderShop();
    updateTimeSlider();
    loadState();
    
    // Sync sound toggle with sound manager state
    if (soundManager) {
        updateSoundToggle(soundManager.isEnabled);
    }
    
    // Initialize SoundCloud UI
    initSoundCloudUI();
}

function setupEventListeners() {
    // Auto-start sound on any UI interaction (browser requirement)
    const autoStartSound = () => {
        if (soundManager) soundManager.autoStart();
    };
    
    // Score pill opens settings
    document.getElementById('scorePill').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoStartSound();
        hideWelcomeTooltip(); // Dismiss tooltip when user taps score pill
        openSettings();
    });
    
    // Control buttons - using direct handlers with stopPropagation
    document.getElementById('autoFeedBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoStartSound();
        toggleAutoFeed();
    });
    
    document.getElementById('talkBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoStartSound();
        toggleTalkMode();
    });
    
    document.getElementById('memoriesBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoStartSound();
        openMemories();
    });
    
    document.getElementById('shopBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        autoStartSound();
        openShop();
    });
    
    // Settings
    document.getElementById('soundToggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSound();
    });
    
    document.getElementById('debugToggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDebug();
    });
    
    document.getElementById('restartBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showRestartConfirm();
    });
    
    document.getElementById('confirmRestartBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        confirmRestart();
    });
    
    // How to Play button
    document.getElementById('howToPlayBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openHowToPlay();
    });
    
    // SoundCloud Connect button
    const scConnectBtn = document.getElementById('scConnectBtn');
    if (scConnectBtn) {
        scConnectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSoundCloudConnect();
        });
    }
    
    // SoundCloud Disconnect button
    const scDisconnectBtn = document.getElementById('scDisconnectBtn');
    if (scDisconnectBtn) {
        scDisconnectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSoundCloudDisconnect();
        });
    }
    
    // SoundCloud Sync button
    const scSyncBtn = document.getElementById('scSyncBtn');
    if (scSyncBtn) {
        console.log('Sync button found in setupEventListeners, attaching listener');
        scSyncBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleArtistSync();
        });
    } else {
        console.warn('Sync button not found in setupEventListeners');
    }
    
    // Time slider
    setupTimeSlider();
    
    // Close modals on overlay click (only if clicking the overlay itself, not content)
    document.getElementById('settingsOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'settingsOverlay') closeSettings();
    });
    document.getElementById('shopOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'shopOverlay') closeShop();
    });
    document.getElementById('memoriesOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'memoriesOverlay') closeMemories();
    });
    document.getElementById('howToPlayOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'howToPlayOverlay') closeHowToPlay();
    });
    
    // Prevent clicks inside modal sheets from bubbling to overlay
    document.querySelectorAll('.modal-sheet').forEach(sheet => {
        sheet.addEventListener('click', (e) => e.stopPropagation());
        sheet.addEventListener('mousedown', (e) => e.stopPropagation());
        sheet.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });
}

// ===== Toast Notifications =====
// Icon can be a Lucide icon name (string without emoji) or an emoji
export function showToast(message, icon = 'sparkles', duration = 2500) {
    const toast = document.getElementById('toast');
    const iconEl = toast.querySelector('.toast-icon');
    
    // Check if icon is a Lucide icon name (no emoji characters)
    const isLucideIcon = /^[a-z-]+$/.test(icon);
    
    if (isLucideIcon) {
        iconEl.innerHTML = `<i data-lucide="${icon}" class="icon-toast"></i>`;
        refreshIcons();
    } else {
        // Fallback to emoji/text
        iconEl.innerHTML = icon;
    }
    
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ===== Score =====
export function updateScore(score) {
    gameState.score = Math.floor(score);
    
    let displayVal = gameState.score.toString();
    if (gameState.score >= 1000000) {
        displayVal = (gameState.score / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    } else if (gameState.score >= 1000) {
        displayVal = (gameState.score / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    
    document.getElementById('scoreDisplay').textContent = displayVal;
    renderShop(); // Update affordability
}

// ===== Auto Feed =====
function toggleAutoFeed() {
    gameState.autoFeed = !gameState.autoFeed;
    const btn = document.getElementById('autoFeedBtn');
    btn.classList.toggle('active', gameState.autoFeed);
    
    showToast(
        gameState.autoFeed ? 'Autofeed On – Fish will be fed automatically' : 'Autofeed Off',
        'leaf'
    );
    
    saveState();
}

export function isAutoFeedEnabled() {
    return gameState.autoFeed;
}

// ===== Talk Mode =====
function toggleTalkMode() {
    gameState.talkMode = !gameState.talkMode;
    const btn = document.getElementById('talkBtn');
    btn.classList.toggle('active', gameState.talkMode);
    
    showToast(
        gameState.talkMode ? 'Spirit Mode On – Tap fish to read their thoughts' : 'Spirit Mode Off',
        'sparkles'
    );
    
    saveState();
}

export function isTalkModeEnabled() {
    return gameState.talkMode;
}

// ===== Sound =====
function toggleSound() {
    if (soundManager) {
        const newState = soundManager.toggle();
        updateSoundToggle(newState);
        showToast(
            newState ? 'Sound On' : 'Sound Off',
            newState ? 'volume-2' : 'volume-x'
        );
    }
}

function updateSoundToggle(enabled) {
    const switchEl = document.getElementById('soundSwitch');
    const iconEl = document.querySelector('#soundToggle .icon-sm');
    
    switchEl.classList.toggle('active', enabled);
    
    // Update icon to reflect state
    if (iconEl) {
        iconEl.setAttribute('data-lucide', enabled ? 'volume-2' : 'volume-x');
        refreshIcons();
    }
}

// ===== Debug =====
function toggleDebug() {
    gameState.showDebug = !gameState.showDebug;
    document.getElementById('debugSwitch').classList.toggle('active', gameState.showDebug);
    document.getElementById('debugInfo').classList.toggle('show', gameState.showDebug);
    saveState();
}

export function updateDebugInfo(fps, fishCount) {
    document.getElementById('fpsDisplay').textContent = Math.round(fps);
    document.getElementById('fishCountDisplay').textContent = fishCount;
}

// ===== Settings Modal =====
function openSettings() {
    document.getElementById('settingsOverlay').classList.add('show');
}

window.closeSettings = function() {
    document.getElementById('settingsOverlay').classList.remove('show');
};

// ===== How to Play Modal =====
function openHowToPlay() {
    document.getElementById('howToPlayOverlay').classList.add('show');
    refreshIcons(); // Ensure icons render in the How to Play sheet
}

window.closeHowToPlay = function() {
    document.getElementById('howToPlayOverlay').classList.remove('show');
};

// ===== Welcome Tooltip =====
function showWelcomeTooltip() {
    if (gameState.hasSeenOnboarding) return;
    
    const tooltip = document.getElementById('welcomeTooltip');
    if (tooltip) {
        // Show after a short delay to let the UI settle
        setTimeout(() => {
            tooltip.classList.add('show');
            refreshIcons();
        }, 1500);
    }
}

function hideWelcomeTooltip() {
    const tooltip = document.getElementById('welcomeTooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
    }
    
    // Mark as seen and save
    if (!gameState.hasSeenOnboarding) {
        gameState.hasSeenOnboarding = true;
        saveState();
    }
}

// ===== Background Selection =====
function renderBackgroundList() {
    const list = document.getElementById('backgroundList');
    list.innerHTML = BACKGROUNDS.map(bg => `
        <div class="settings-item ${gameState.selectedBackground === bg.id ? 'selected' : ''}" 
             data-bg-id="${bg.id}">
            <div class="settings-item-preview">
                <img src="assets/backgrounds/${bg.file}" alt="${bg.name}">
            </div>
            <span class="settings-item-label">${bg.name}</span>
            ${gameState.selectedBackground === bg.id ? '<i data-lucide="check-circle" class="settings-item-check icon-sm"></i>' : ''}
        </div>
    `).join('');
    
    refreshIcons();
    
    // Add click handlers with proper event handling
    list.querySelectorAll('.settings-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const bgId = parseInt(item.dataset.bgId);
            selectBackground(bgId);
        });
        
        // Prevent child elements from blocking clicks
        item.addEventListener('mousedown', (e) => e.stopPropagation());
        item.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });
}

function selectBackground(id) {
    gameState.selectedBackground = id;
    renderBackgroundList();
    saveState();
    if (onBackgroundChange) onBackgroundChange(id);
}

export function getSelectedBackground() {
    return gameState.selectedBackground;
}

// ===== Time Speed Slider =====
function setupTimeSlider() {
    const slider = document.getElementById('timeSlider');
    const thumb = document.getElementById('timeSliderThumb');
    let isDragging = false;
    
    const updateSliderPosition = (value) => {
        const percent = (value / 3) * 100;
        document.getElementById('timeSliderFill').style.width = `${percent}%`;
        thumb.style.left = `${percent}%`;
        document.getElementById('timeSpeedValue').textContent = TIME_SPEED_LABELS[value];
    };
    
    const handleMove = (clientX) => {
        const rect = slider.getBoundingClientRect();
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        const value = Math.round(percent * 3);
        
        if (value !== gameState.timeSpeed) {
            gameState.timeSpeed = value;
            updateSliderPosition(value);
            saveState();
            if (onTimeSpeedChange) onTimeSpeedChange(value);
        }
    };
    
    slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleMove(e.clientX);
    });
    
    slider.addEventListener('touchstart', (e) => {
        isDragging = true;
        handleMove(e.touches[0].clientX);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) handleMove(e.clientX);
    });
    
    document.addEventListener('touchmove', (e) => {
        if (isDragging) handleMove(e.touches[0].clientX);
    });
    
    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('touchend', () => isDragging = false);
}

function updateTimeSlider() {
    const percent = (gameState.timeSpeed / 3) * 100;
    document.getElementById('timeSliderFill').style.width = `${percent}%`;
    document.getElementById('timeSliderThumb').style.left = `${percent}%`;
    document.getElementById('timeSpeedValue').textContent = TIME_SPEED_LABELS[gameState.timeSpeed];
}

export function getTimeSpeed() {
    return gameState.timeSpeed;
}

export function getCycleDuration() {
    switch (gameState.timeSpeed) {
        case 0: return Infinity; // Stopped
        case 1: return 86400000; // Realtime (24h in ms)
        case 2: return 300000;   // Normal (5 min)
        case 3: return 60000;    // Fast (1 min)
        default: return 300000;
    }
}

// ===== Shop Modal =====
function openShop() {
    document.getElementById('shopOverlay').classList.add('show');
    renderShop();
}

window.closeShop = function() {
    document.getElementById('shopOverlay').classList.remove('show');
};

function renderShop() {
    const content = document.getElementById('shopContent');
    if (!content) return;
    
    // Sort species by cost
    const sortedSpecies = [...speciesCatalog].sort((a, b) => a.cost - b.cost);
    
    let html = sortedSpecies.map(species => {
        const canAfford = gameState.score >= species.cost;
        const aliveCount = gameState.fishCounts[species.id] || 0;
        const isNew = !gameState.unlockedSpecies?.has(species.id) && canAfford;
        
        return `
            <div class="shop-item ${canAfford ? '' : 'locked'}" data-species-id="${species.id}">
                <div class="shop-item-thumb">
                    <img src="assets/fish/${species.folder}/Thumbnail.png" alt="${species.name}">
                    ${isNew ? '<span class="new-badge">NEW</span>' : ''}
                </div>
                <div class="shop-item-info">
                    <div class="shop-item-header">
                        <span class="shop-item-name">${species.name}</span>
                        ${species.isPredator ? '<span class="predator-badge">Predator</span>' : ''}
                        <span class="shop-item-cost">${species.cost}</span>
                    </div>
                    <div class="shop-item-details">
                        <span>${species.description || 'A mysterious spirit'}</span>
                        ${aliveCount > 0 ? `<span class="alive-count"><i data-lucide="fish" class="icon-xs"></i> ${aliveCount} alive</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add unlock hint if there are locked species
    const lockedSpecies = sortedSpecies.filter(s => gameState.score < s.cost);
    if (lockedSpecies.length > 0) {
        const next = lockedSpecies[0];
        const needed = next.cost - gameState.score;
        html += `
            <div class="unlock-hint">
                <div class="unlock-hint-icon"><i data-lucide="lock" class="icon-sm"></i></div>
                <div class="unlock-hint-text">More Species Locked</div>
                <div class="unlock-hint-next">
                    Next: <strong>${next.name}</strong> • ${needed} more orbs needed
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    refreshIcons();
    
    // Add click handlers with proper event handling
    content.querySelectorAll('.shop-item:not(.locked)').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const speciesId = item.dataset.speciesId;
            purchaseSpecies(speciesId);
        });
        
        // Prevent child elements from blocking clicks
        item.addEventListener('mousedown', (e) => e.stopPropagation());
        item.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });
}

function purchaseSpecies(speciesId) {
    const species = speciesCatalog.find(s => s.id === speciesId);
    if (!species || gameState.score < species.cost) return;
    
    gameState.score -= species.cost;
    updateScore(gameState.score);
    
    // Track unlocked species
    if (!gameState.unlockedSpecies) gameState.unlockedSpecies = new Set();
    gameState.unlockedSpecies.add(speciesId);
    
    showToast(`Summoned ${species.name}!`, 'sparkles');
    
    if (onPurchase) onPurchase(speciesId);
    saveState();
    renderShop();
}

export function updateFishCounts(fishes) {
    gameState.fishCounts = {};
    gameState.currentAliveFish = 0;
    
    fishes.forEach(f => {
        const id = f.species.id;
        gameState.fishCounts[id] = (gameState.fishCounts[id] || 0) + 1;
        gameState.currentAliveFish++;
    });

    // Update stats display if memories is open
    document.getElementById('statAlive').textContent = gameState.currentAliveFish;
    
    renderShop();
}

// ===== Spirit Memories Modal =====
function openMemories() {
    document.getElementById('memoriesOverlay').classList.add('show');
    gameState.unreadMemories = 0;
    updateMemoriesBadge();
    renderMemories();
}

window.closeMemories = function() {
    document.getElementById('memoriesOverlay').classList.remove('show');
};

function renderMemories() {
    // Update stats
    document.getElementById('statAlive').textContent = gameState.currentAliveFish;
    document.getElementById('statBorn').textContent = gameState.totalBirths;
    document.getElementById('statPassed').textContent = gameState.totalDeaths;
    
    const list = document.getElementById('eventsList');
    
    if (gameState.spiritEvents.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="heart" class="icon-lg"></i></div>
                <div class="empty-state-text">No events yet</div>
            </div>
        `;
        refreshIcons();
        return;
    }
    
    list.innerHTML = gameState.spiritEvents.map(event => {
        const species = speciesCatalog.find(s => s.name === event.speciesName);
        const thumbPath = species ? `assets/fish/${species.folder}/Thumbnail.png` : null;
        
        if (event.type === 'death') {
            return `
                <div class="event-row">
                    <div class="event-icon death">
                        ${thumbPath 
                            ? `<img src="${thumbPath}" alt="${event.speciesName}">`
                            : '<i data-lucide="heart-crack" class="icon-event"></i>'
                        }
                    </div>
                    <div class="event-info">
                        <div class="event-title">
                            <i data-lucide="heart-crack" class="icon-title death"></i>
                            <span>${event.name}</span>
                        </div>
                        <div class="event-details">
                            ${event.speciesName} <span>•</span> ${event.reason} <span>•</span> Age: ${event.age}
                        </div>
                    </div>
                </div>
            `;
        } else if (event.type === 'birth') {
            return `
                <div class="event-row">
                    <div class="event-icon birth">
                        ${thumbPath 
                            ? `<img src="${thumbPath}" alt="${event.speciesName}">`
                            : '<i data-lucide="sparkles" class="icon-event"></i>'
                        }
                    </div>
                    <div class="event-info">
                        <div class="event-title">
                            <i data-lucide="sparkles" class="icon-title birth"></i>
                            <span>${event.babies.join(', ')} was born!</span>
                        </div>
                        <div class="event-details">
                            ${event.speciesName} <span>•</span> Parents: ${event.parent1} & ${event.parent2}
                        </div>
                    </div>
                </div>
            `;
        } else if (event.type === 'purchased') {
            return `
                <div class="event-row">
                    <div class="event-icon purchased">
                        ${thumbPath 
                            ? `<img src="${thumbPath}" alt="${event.speciesName}">`
                            : '<i data-lucide="shopping-bag" class="icon-event"></i>'
                        }
                    </div>
                    <div class="event-info">
                        <div class="event-title">
                            <i data-lucide="shopping-bag" class="icon-title purchased"></i>
                            <span>${event.name} joined!</span>
                        </div>
                        <div class="event-details">
                            ${event.speciesName} <span>•</span> Welcomed to the aquarium
                        </div>
                    </div>
                </div>
            `;
        } else if (event.type === 'grewUp') {
            return `
                <div class="event-row">
                    <div class="event-icon grewUp">
                        ${thumbPath 
                            ? `<img src="${thumbPath}" alt="${event.speciesName}">`
                            : '<i data-lucide="trending-up" class="icon-event"></i>'
                        }
                    </div>
                    <div class="event-info">
                        <div class="event-title">
                            <i data-lucide="trending-up" class="icon-title grewUp"></i>
                            <span>${event.name} grew up!</span>
                        </div>
                        <div class="event-details">
                            ${event.speciesName} <span>•</span> Reached adulthood
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Fallback for unknown event types
            return `
                <div class="event-row">
                    <div class="event-icon">
                        <i data-lucide="info" class="icon-event"></i>
                    </div>
                    <div class="event-info">
                        <div class="event-title">
                            <span>Unknown event</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    refreshIcons();
}

function updateMemoriesBadge() {
    const badge = document.getElementById('memoriesBadge');
    if (gameState.unreadMemories > 0) {
        badge.textContent = gameState.unreadMemories > 99 ? '99+' : gameState.unreadMemories;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

export function addDeathEvent(fish) {
    const ageMs = Date.now() - fish.birthTime;
    const ageMins = Math.floor(ageMs / 60000);
    const ageText = ageMins < 60 ? `${ageMins}m` : `${Math.floor(ageMins / 60)}h ${ageMins % 60}m`;
    
    const event = {
        type: 'death',
        name: fish.name,
        speciesName: fish.species.name,
        reason: fish.deathReason || 'passed away',
        age: ageText,
        timestamp: Date.now()
    };
    
    gameState.spiritEvents.unshift(event);
    if (gameState.spiritEvents.length > 50) {
        gameState.spiritEvents = gameState.spiritEvents.slice(0, 50);
    }
    
    gameState.totalDeaths++;
    gameState.unreadMemories++;
    updateMemoriesBadge();
    saveState();
}

export function addBirthEvent(parent1Name, parent2Name, babyNames, speciesName) {
    const event = {
        type: 'birth',
        parent1: parent1Name,
        parent2: parent2Name,
        babies: babyNames,
        speciesName: speciesName,
        timestamp: Date.now()
    };
    
    gameState.spiritEvents.unshift(event);
    if (gameState.spiritEvents.length > 50) {
        gameState.spiritEvents = gameState.spiritEvents.slice(0, 50);
    }
    
    gameState.totalBirths += babyNames.length;
    gameState.unreadMemories++;
    updateMemoriesBadge();
    saveState();
}

// Legacy function for compatibility
export function addToGraveyard(fish, deadCount) {
    addDeathEvent(fish);
}

export function addPurchaseEvent(name, speciesName) {
    const event = {
        type: 'purchased',
        name: name,
        speciesName: speciesName,
        timestamp: Date.now()
    };
    
    gameState.spiritEvents.unshift(event);
    if (gameState.spiritEvents.length > 50) {
        gameState.spiritEvents = gameState.spiritEvents.slice(0, 50);
    }
    
    gameState.unreadMemories++;
    updateMemoriesBadge();
    saveState();
}

export function addGrewUpEvent(name, speciesName) {
    const event = {
        type: 'grewUp',
        name: name,
        speciesName: speciesName,
        timestamp: Date.now()
    };
    
    gameState.spiritEvents.unshift(event);
    if (gameState.spiritEvents.length > 50) {
        gameState.spiritEvents = gameState.spiritEvents.slice(0, 50);
    }
    
    gameState.unreadMemories++;
    updateMemoriesBadge();
    saveState();
}

// ===== SoundCloud Integration =====
function initSoundCloudUI() {
    // Set up auth change callback - note: main.js also sets this for loading fish
    const existingCallback = soundCloudAuth.onAuthChange;
    soundCloudAuth.onAuthChange = (isAuthenticated, user) => {
        updateSoundCloudUI(isAuthenticated, user);
        if (isAuthenticated && user) {
            showToast(`Connected as ${user.username}!`, 'music', 3000);
        }
        // Call existing callback if set (from main.js for loading fish)
        if (existingCallback) {
            existingCallback(isAuthenticated, user);
        }
    };
    
    // Check current auth state
    const isAuth = soundCloudAuth.isAuthenticated();
    const user = soundCloudAuth.getUser();
    updateSoundCloudUI(isAuth, user);
    
    // Update artist stats if we have cached data
    if (artistStore.hasArtists()) {
        updateArtistStats();
    }
}

function updateSoundCloudUI(isAuthenticated, user) {
    const notConnected = document.getElementById('scNotConnected');
    const connected = document.getElementById('scConnected');
    const artistControls = document.getElementById('scArtistControls');
    const footer = document.getElementById('scFooter');
    
    if (!notConnected || !connected) return;
    
    if (isAuthenticated && user) {
        // Show connected state
        notConnected.style.display = 'none';
        connected.style.display = 'flex';
        if (artistControls) artistControls.style.display = 'flex';
        
        // Update user info
        const avatar = document.getElementById('scUserAvatar');
        const name = document.getElementById('scUserName');
        
        if (avatar && user.avatar_url) {
            // Use larger avatar if available
            avatar.src = user.avatar_url.replace('-large', '-t300x300');
            avatar.onerror = () => {
                avatar.src = user.avatar_url;
            };
        }
        if (name) {
            name.textContent = user.username || user.full_name || 'SoundCloud User';
        }
        
        if (footer) {
            footer.textContent = 'Only followed artists you\'ve liked tracks from become fish';
        }
        
        // Update artist stats
        updateArtistStats();
    } else {
        // Show not connected state
        notConnected.style.display = 'flex';
        connected.style.display = 'none';
        if (artistControls) artistControls.style.display = 'none';
        
        if (footer) {
            footer.textContent = 'Connect to turn followed artists you\'ve liked into fish';
        }
    }
    
    refreshIcons();
}

export function updateArtistStats() {
    const stats = artistStore.getStats();
    
    // Total counts (all data)
    const followingCount = document.getElementById('scFollowingCount');
    const totalLikes = document.getElementById('scTotalLikes');
    
    // Filtered counts (followed with likes)
    const artistCount = document.getElementById('scArtistCount');
    const likeCount = document.getElementById('scLikeCount');
    
    if (followingCount) followingCount.textContent = stats.totalFollowing;
    if (totalLikes) totalLikes.textContent = stats.totalLikedTracks;
    if (artistCount) artistCount.textContent = stats.followedWithLikes;
    if (likeCount) likeCount.textContent = stats.likesFromFollowed;
}

async function handleArtistSync() {
    console.log('Sync button clicked');
    const btn = document.getElementById('scSyncBtn');
    if (!btn) {
        console.error('Sync button not found');
        return;
    }
    if (btn.classList.contains('loading')) {
        console.log('Already loading, skipping');
        return;
    }
    
    btn.classList.add('loading');
    const originalHTML = btn.innerHTML;
    
    // Set up progress callback
    soundCloudAPI.setProgressCallback((progress) => {
        let statusText = '';
        switch (progress.stage) {
            case 'followings':
                statusText = `Artists: ${progress.current || 0}`;
                break;
            case 'likes':
                statusText = `Likes: ${progress.current || 0}`;
                break;
            case 'processing':
                statusText = 'Processing...';
                break;
            default:
                statusText = progress.message || 'Syncing...';
        }
        btn.innerHTML = `<i data-lucide="loader" class="icon-sm spinning"></i> ${statusText}`;
        refreshIcons();
    });
    
    try {
        // Call the global loadArtistFish function exposed by main.js
        if (window.loadArtistFish) {
            console.log('Calling loadArtistFish...');
            await window.loadArtistFish();
            console.log('loadArtistFish completed');
        } else {
            console.error('window.loadArtistFish is not defined');
            showToast('Sync not available - try refreshing', 'alert-circle', 3000);
        }
        updateArtistStats();
    } catch (e) {
        console.error('Artist sync failed:', e);
        showToast('Sync failed: ' + e.message, 'alert-circle', 3000);
    } finally {
        // Clear progress callback and restore button
        soundCloudAPI.setProgressCallback(null);
        btn.classList.remove('loading');
        btn.innerHTML = originalHTML;
        refreshIcons();
    }
}

async function handleSoundCloudConnect() {
    const btn = document.getElementById('scConnectBtn');
    if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
    }
    
    try {
        // Start OAuth flow - this will redirect to SoundCloud
        await soundCloudAuth.login();
    } catch (e) {
        console.error('SoundCloud connect error:', e);
        showToast('Failed to connect to SoundCloud', 'alert-circle', 3000);
        
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
}

function handleSoundCloudDisconnect() {
    soundCloudAuth.logout();
    artistStore.clear(); // Clear cached artist data
    updateSoundCloudUI(false, null);
    showToast('Disconnected from SoundCloud', 'log-out', 2500);
}

// Export for external use
export function isSoundCloudConnected() {
    return soundCloudAuth.isAuthenticated();
}

export function getSoundCloudUser() {
    return soundCloudAuth.getUser();
}

export function getSoundCloudAuth() {
    return soundCloudAuth;
}

// ===== Restart Confirmation =====
function showRestartConfirm() {
    document.getElementById('confirmBackdrop').classList.add('show');
    document.getElementById('confirmModal').classList.add('show');
}

window.closeConfirm = function() {
    document.getElementById('confirmBackdrop').classList.remove('show');
    document.getElementById('confirmModal').classList.remove('show');
};

function confirmRestart() {
    closeConfirm();
    closeSettings();
    
    // Reset state
    gameState.score = 100;
    gameState.totalBirths = 0;
    gameState.totalDeaths = 0;
    gameState.spiritEvents = [];
    gameState.unreadMemories = 0;
    gameState.fishCounts = {};
    gameState.currentAliveFish = 0;
    gameState.unlockedSpecies = new Set(['basic']);
    
    updateScore(gameState.score);
    updateMemoriesBadge();
    saveState();
    
    if (onRestart) onRestart();
    
    showToast('Game restarted', 'rotate-ccw');
}

// ===== Persistence =====
const STORAGE_KEY = 'spiritAquarium_ui';

function saveState() {
    const data = {
        score: gameState.score,
        autoFeed: gameState.autoFeed,
        talkMode: gameState.talkMode,
        showDebug: gameState.showDebug,
        timeSpeed: gameState.timeSpeed,
        selectedBackground: gameState.selectedBackground,
        totalBirths: gameState.totalBirths,
        totalDeaths: gameState.totalDeaths,
        spiritEvents: gameState.spiritEvents,
        unlockedSpecies: gameState.unlockedSpecies ? Array.from(gameState.unlockedSpecies) : [],
        hasSeenOnboarding: gameState.hasSeenOnboarding
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data) {
            gameState.score = data.score ?? 100;
            gameState.autoFeed = data.autoFeed ?? false;
            gameState.talkMode = data.talkMode ?? false;
            gameState.showDebug = data.showDebug ?? false;
            gameState.timeSpeed = data.timeSpeed ?? 2;
            gameState.selectedBackground = data.selectedBackground ?? 1;
            gameState.totalBirths = data.totalBirths ?? 0;
            gameState.totalDeaths = data.totalDeaths ?? 0;
            gameState.spiritEvents = data.spiritEvents ?? [];
            gameState.unlockedSpecies = new Set(data.unlockedSpecies ?? ['basic']);
            gameState.hasSeenOnboarding = data.hasSeenOnboarding ?? false;
    
            // Update UI to reflect loaded state
            updateScore(gameState.score);
            document.getElementById('autoFeedBtn').classList.toggle('active', gameState.autoFeed);
            document.getElementById('talkBtn').classList.toggle('active', gameState.talkMode);
            document.getElementById('debugSwitch').classList.toggle('active', gameState.showDebug);
            document.getElementById('debugInfo').classList.toggle('show', gameState.showDebug);
            updateTimeSlider();
            renderBackgroundList();
        }
        
        // Show welcome tooltip for first-time users
        showWelcomeTooltip();
    } catch (e) {
        console.warn('Failed to load UI state:', e);
    }
}

export function getState() {
    return gameState;
}

// ===== Help (legacy compatibility) =====
export function toggleHelp() {
    openSettings();
}

// ===== Lucide Icons Helper =====
function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
}
}
