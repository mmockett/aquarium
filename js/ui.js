// Spirit Aquarium - UI Module
// Handles all UI interactions and state

// ===== State =====
let gameState = {
    score: 100, // Starting score
    autoFeed: false,
    talkMode: false,
    showDebug: false,
    timeSpeed: 2, // 0=Stopped, 1=Realtime, 2=Normal, 3=Fast
    selectedBackground: 1,
    totalBirths: 0,
    totalDeaths: 0,
    currentAliveFish: 0,
    unreadMemories: 0,
    spiritEvents: [],
    fishCounts: {},
    unlockedSpecies: new Set(['basic']) // Track unlocked species
};

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
export function initUI(species, callbacks = {}) {
    speciesCatalog = species;
    onPurchase = callbacks.onPurchase;
    onBackgroundChange = callbacks.onBackgroundChange;
    onTimeSpeedChange = callbacks.onTimeSpeedChange;
    onRestart = callbacks.onRestart;
    
    setupEventListeners();
    renderBackgroundList();
    renderShop();
    updateTimeSlider();
    loadState();
}

function setupEventListeners() {
    // Score pill opens settings
    document.getElementById('scorePill').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettings();
    });
    
    // Control buttons - using direct handlers with stopPropagation
    document.getElementById('autoFeedBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAutoFeed();
    });
    
    document.getElementById('talkBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTalkMode();
    });
    
    document.getElementById('memoriesBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMemories();
    });
    
    document.getElementById('shopBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openShop();
    });
    
    // Settings
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
    
    // Time slider
    setupTimeSlider();
    
    // Close modals on overlay click
    document.getElementById('settingsOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'settingsOverlay') closeSettings();
    });
    document.getElementById('shopOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'shopOverlay') closeShop();
    });
    document.getElementById('memoriesOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'memoriesOverlay') closeMemories();
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
        gameState.autoFeed ? 'Autofeed On – Fish will be fed automatically' : 'Autofeed Off – Tap to drop food',
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
        gameState.talkMode ? 'Spirit Mode On – Tap fish to hear them speak' : 'Spirit Mode Off – Tap to drop food',
        'sparkles'
    );
    
    saveState();
}

export function isTalkModeEnabled() {
    return gameState.talkMode;
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
    
    // Add click handlers
    list.querySelectorAll('.settings-item').forEach(item => {
        item.addEventListener('click', () => {
            const bgId = parseInt(item.dataset.bgId);
            selectBackground(bgId);
        });
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
    
    // Add click handlers
    content.querySelectorAll('.shop-item:not(.locked)').forEach(item => {
        item.addEventListener('click', () => {
            const speciesId = item.dataset.speciesId;
            purchaseSpecies(speciesId);
        });
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
        } else {
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
        unlockedSpecies: gameState.unlockedSpecies ? Array.from(gameState.unlockedSpecies) : []
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
            
            // Update UI to reflect loaded state
            updateScore(gameState.score);
            document.getElementById('autoFeedBtn').classList.toggle('active', gameState.autoFeed);
            document.getElementById('talkBtn').classList.toggle('active', gameState.talkMode);
            document.getElementById('debugSwitch').classList.toggle('active', gameState.showDebug);
            document.getElementById('debugInfo').classList.toggle('show', gameState.showDebug);
            updateTimeSlider();
            renderBackgroundList();
        }
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
