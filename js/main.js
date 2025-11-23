import { SoundManager } from './classes/SoundManager.js';
import { SpatialHash, Vector, rand, distSq, applyManualBlur, lerpColor } from './utils.js';
import { Fish } from './classes/Fish.js';
import { Food } from './classes/Food.js';
import { Bubble } from './classes/Bubble.js';
import { Ripple } from './classes/Ripple.js';
import { BloodMist } from './classes/BloodMist.js';
import { CONFIG, SPECIES } from './config.js';
import * as UI from './ui.js';

// --- Game State ---
let canvas, ctx;
let width, height;
let score = 0;
let particles = [];
let fishes = [];
let ripples = [];
let lastTime = 0;
let lastAutoFeedTime = 0;
let isTalkMode = false;
let isAutoFeed = false;
let autoFeedTimer = null;
let mousePos = { x: -9999, y: -9999 };
let deadCount = 0;
let idleTimer = null;
let frameCount = 0;
let backgroundImage = null;
let bgCache = null;
let causticCanvas = null; // Low-res canvas for free blur
let weedImages = [];
const WEED_FILES = ['assets/weeds/Weeds.png', 'assets/weeds/Weeds 2.png', 'assets/weeds/Weed 3.png'];
let weedInstances = [];
let weedCanvases = []; // Cache for pre-blurred weeds

let timeCycle = 0; // 0 to 1
let currentColors = { ...CONFIG.timeColors.day };
let isNight = false;

// UI State
let affordableSpeciesIds = new Set();
let shopForcedOpenTimer = null; // Timer to keep shop forced open

const sound = new SoundManager();
const spatialGrid = new SpatialHash(150);

// --- Core Systems ---

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    window.addEventListener('resize', resize);
    resize();

    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', (e) => {
        handleInput(e.touches[0]);
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        // Dock Logic: Show bottom UI when mouse is near bottom
        const bottomUI = document.querySelector('.bottom-ui');
        const threshold = 150; // Detection zone height in pixels
        
        // Only toggle based on mouse if NOT forced open by timer
        if (bottomUI && !shopForcedOpenTimer) {
            if (height - mousePos.y < threshold) {
                bottomUI.classList.add('active');
            } else {
                bottomUI.classList.remove('active');
            }
        }
    });

    // Attach UI Event Listeners
    document.getElementById('autoFeedBtn').addEventListener('click', toggleAutoFeed);
    document.getElementById('talkBtn').addEventListener('click', toggleTalkMode);
    document.getElementById('soundToggleBtn').addEventListener('click', () => sound.toggle());
    document.getElementById('uiToggleBtn').addEventListener('click', toggleUI);
    document.querySelector('.help-btn').addEventListener('click', UI.toggleHelp);
    document.querySelector('.close-help').addEventListener('click', UI.toggleHelp);
    document.querySelector('.restart-btn').addEventListener('click', restartGame);
    
    // Debug Buttons
    document.getElementById('fullResetBtn').addEventListener('click', () => {
        if(confirm("Are you sure? This will delete all save data and reload the page.")) {
            localStorage.clear();
            location.reload();
        }
    });
    
    document.getElementById('debugOrbsBtn').addEventListener('click', () => {
        score += 100000;
        UI.updateScore(score);
        updateShopUI();
        UI.showToast("💰 100,000 Orbs Added!");
        saveGame();
    });

    // Load background image
    backgroundImage = new Image();
    backgroundImage.src = 'assets/Background.jpg';
    backgroundImage.onerror = () => {
        console.warn('Background image failed to load');
        backgroundImage = null;
    };

    // Load weeds
    WEED_FILES.forEach(src => {
        const img = new Image();
        img.src = src;
        weedImages.push(img);
    });
    
    // Generate weeds
    for(let i=0; i<8; i++) {
        weedInstances.push({
            imgIndex: Math.floor(Math.random() * WEED_FILES.length),
            xRatio: Math.random(),
            scale: 0.25 + Math.random() * 0.25, // Reduced to 50% of previous (0.5-1.0 -> 0.25-0.5)
            speed: 0.0005 + Math.random() * 0.0005,
            phase: Math.random() * Math.PI * 2
        });
    }

    // Try to load game, otherwise initialize default
    if (!loadGame()) {
        fishes.push(new Fish(SPECIES[0], false, width, height));
    }
    
    for(let i=0; i<20; i++) particles.push(new Bubble(width, height));

    initShop();
    loop();
    
    setInterval(() => {
        score += fishes.length;
        UI.updateScore(score);
        UI.updateFishCounts(fishes); // Update counts periodically
        saveGame(); // Autosave
    }, 3000);

    // Save on close
    window.addEventListener('beforeunload', () => saveGame());

    resetIdleTimer();
}

function saveGame() {
    const data = {
        score,
        unlockedSpecies: Array.from(unlockedSpecies),
        fishes: fishes.map(f => ({
            speciesId: f.species.id,
            pos: f.pos,
            vel: f.vel,
            size: f.size,
            energy: f.energy,
            name: f.name,
            birthTime: f.birthTime,
            lifespan: f.lifespan,
            childrenCount: f.childrenCount,
            fullCooldown: f.fullCooldown
        }))
    };
    localStorage.setItem('spiritAquariumSave', JSON.stringify(data));
}

function loadGame() {
    const saved = localStorage.getItem('spiritAquariumSave');
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);
        
        // Validate data structure minimally
        if (typeof data.score !== 'number' || !Array.isArray(data.fishes)) {
            console.warn("Invalid save data format");
            return false;
        }

        // Restore score
        score = data.score;
        UI.updateScore(score);

        // Restore unlocks
        if (Array.isArray(data.unlockedSpecies)) {
            unlockedSpecies = new Set(data.unlockedSpecies);
        }

        // Restore fishes
        fishes = [];
        data.fishes.forEach(fData => {
            const species = SPECIES.find(s => s.id === fData.speciesId);
            if (species) {
                const fish = new Fish(species, false, width, height);
                // Override properties
                if (fData.pos) fish.pos = new Vector(fData.pos.x, fData.pos.y);
                if (fData.vel) fish.vel = new Vector(fData.vel.x, fData.vel.y);
                if (fData.size) fish.size = fData.size;
                if (fData.energy) fish.energy = fData.energy;
                if (fData.name) fish.name = fData.name;
                if (fData.birthTime) fish.birthTime = fData.birthTime;
                if (fData.lifespan) fish.lifespan = fData.lifespan;
                if (fData.childrenCount) fish.childrenCount = fData.childrenCount;
                if (fData.fullCooldown) fish.fullCooldown = fData.fullCooldown;
                
                fishes.push(fish);
            }
        });

        // If no fish survived loading (or empty save), return false to trigger default init
        return fishes.length > 0;

    } catch (e) {
        console.error("Failed to load game:", e);
        return false;
    }
}

function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    const el = document.getElementById('idlePrompt');
    if(el) el.style.opacity = 0;
    
    // Only set idle timer if Auto Feed is OFF
    if (!isAutoFeed) {
        idleTimer = setTimeout(() => {
            if(el) el.style.opacity = 1;
        }, 60000);
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    bgCache = null; // Invalidate background cache on resize
    
    // Create low-res caustic canvas (1/4 resolution for free blur effect)
    causticCanvas = document.createElement('canvas');
    causticCanvas.width = Math.ceil(width / 4);
    causticCanvas.height = Math.ceil(height / 4);
}

function toggleUI() {
    document.body.classList.toggle('ui-hidden');
}

function toggleTalkMode() {
    isTalkMode = !isTalkMode;
    const btn = document.getElementById('talkBtn');
    if (isTalkMode) {
        btn.classList.add('active');
        btn.innerText = "🐟 Feed the Spirits";
        document.body.style.cursor = "help";
        sound.playBloop(1.5);
        
        // Show status message at smaller breakpoint
        if (window.innerWidth < 660) {
            UI.showToast("✨ Talk to Spirits: ON");
        }
    } else {
        btn.classList.remove('active');
        btn.innerText = "✨ Talk to Spirits";
        document.body.style.cursor = "default";
        
        // Show status message at smaller breakpoint
        if (window.innerWidth < 660) {
            UI.showToast("✨ Talk to Spirits: OFF");
        }
    }
}

function toggleAutoFeed() {
    isAutoFeed = !isAutoFeed;
    const btn = document.getElementById('autoFeedBtn');
    sound.playBloop(0.8);
    
    if (isAutoFeed) {
        btn.classList.add('active');
        btn.innerText = "🍂 Auto Feed: ON";
        // Reset timer so it feeds immediately
        lastAutoFeedTime = 0;
        
        // Clear any existing idle prompt immediately
        resetIdleTimer();
        
        // Show status message at smaller breakpoint
        if (window.innerWidth < 660) {
            UI.showToast("🍂 Auto Feed: ON");
        }
    } else {
        btn.classList.remove('active');
        btn.innerText = "🍂 Auto Feed: OFF";
        
        // Re-enable idle tracking
        resetIdleTimer();
        
        // Show status message at smaller breakpoint
        if (window.innerWidth < 660) {
            UI.showToast("🍂 Auto Feed: OFF");
        }
    }
    
    // Clear legacy timer if it exists (cleanup)
    if (autoFeedTimer) {
        clearInterval(autoFeedTimer);
        autoFeedTimer = null;
    }
}

function handleInput(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    resetIdleTimer();

    if (isTalkMode) {
        let clickedFish = null;
        for (let f of fishes) {
            if (!f.isDead) {
                let dSq = distSq(x, y, f.pos.x, f.pos.y);
                if (dSq < (f.size + 20)**2) {
                    clickedFish = f;
                    break;
                }
            }
        }

        if (clickedFish) {
            clickedFish.talk();
            sound.playChime(); 
        } else {
            ripples.push(new Ripple(x, y));
        }
    } else {
        particles.push(new Food(x, y));
        ripples.push(new Ripple(x, y));
        sound.playBloop(rand(0.8, 1.2)); 
    }
}

let unlockedSpecies = new Set(['basic']); // Track unlocked species IDs

function initShop() {
    const container = document.getElementById('shopContainer');
    container.innerHTML = '';
    
    SPECIES.forEach(s => {
        const el = document.createElement('div');
        el.className = 'fish-card';
        el.id = `shop-item-${s.id}`;
        
        // If unlocked, show full details
        if (unlockedSpecies.has(s.id)) {
            if (s.isPredator) {
                const badge = document.createElement('div');
                badge.className = 'predator-badge';
                badge.innerHTML = '⚠️'; 
                badge.title = 'Aggressive Predator';
                el.appendChild(badge);
            }

            const previewContainer = document.createElement('div');
            previewContainer.style.height = '40px';
            previewContainer.style.display = 'flex';
            previewContainer.style.alignItems = 'center';
            previewContainer.style.justifyContent = 'center';
            previewContainer.style.marginBottom = '5px';

            if (s.imagePath) {
                const img = new Image();
                img.src = `${s.imagePath}/Thumbnail.png`;
                img.style.maxWidth = '80px';
                img.style.maxHeight = '50px';
                img.style.objectFit = 'contain';
                
                img.onerror = () => {
                    img.remove();
                    const canvas = document.createElement('canvas');
                    canvas.width = 60;
                    canvas.height = 40;
                    canvas.className = 'fish-preview-canvas';
                    canvas.id = `preview-${s.id}`;
                    previewContainer.appendChild(canvas);
                    renderSingleShopIcon(s);
                };
                previewContainer.appendChild(img);
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = 60;
                canvas.height = 40;
                canvas.className = 'fish-preview-canvas';
                canvas.id = `preview-${s.id}`;
                previewContainer.appendChild(canvas);
            }
            
            el.appendChild(previewContainer);
            
            const nameEl = document.createElement('div');
            nameEl.className = 'fish-name';
            nameEl.innerText = s.name;
            el.appendChild(nameEl);

            const countEl = document.createElement('div');
            countEl.className = 'fish-count';
            countEl.id = `count-${s.id}`;
            countEl.innerText = `0 alive`;
            el.appendChild(countEl);
        } else {
            // Locked / Mysterious State
            const mysteryIcon = document.createElement('div');
            mysteryIcon.style.fontSize = '30px';
            mysteryIcon.style.marginBottom = '10px';
            mysteryIcon.style.opacity = '0.5';
            mysteryIcon.innerText = '?';
            el.appendChild(mysteryIcon);

            // Still show predator badge if it's a predator (safety warning!)
            if (s.isPredator) {
                const badge = document.createElement('div');
                badge.className = 'predator-badge';
                badge.innerHTML = '⚠️'; 
                badge.title = 'Aggressive Predator';
                el.appendChild(badge);
            }

            const nameEl = document.createElement('div');
            nameEl.className = 'fish-name';
            nameEl.innerText = "Unknown";
            el.appendChild(nameEl);

            const countEl = document.createElement('div');
            countEl.className = 'fish-count';
            countEl.id = `count-${s.id}`;
            countEl.innerText = `0 alive`;
            el.appendChild(countEl);
        }
        
        const costEl = document.createElement('div');
        costEl.className = 'fish-cost';
        costEl.innerText = `${s.cost} Orbs`;
        el.appendChild(costEl);
        
        el.onclick = () => buyFish(s);
        container.appendChild(el);
    });
    
    renderShopIcons();
    updateShopUI();
}

function renderSingleShopIcon(s) {
    const canvas = document.getElementById(`preview-${s.id}`);
    if (!canvas) return; 
    
    const pCtx = canvas.getContext('2d');
    
    // Create a dummy fish just for drawing
    const dummy = new Fish(s, false, 100, 100);
    dummy.pos.x = 30;
    dummy.pos.y = 20;
    dummy.size = Math.min(s.size, 15); 
    dummy.angle = 0;
    dummy.visualAngle = 0; // Ensure it faces right immediately
    dummy.tailAngle = 0;   // Reset tail animation
    
    pCtx.clearRect(0, 0, 60, 40);
    
    // If images are cached, this will draw immediately. 
    // If not, it might draw nothing, but the static Thumbnail.png should exist now.
    dummy.draw(pCtx, { isTalkMode: false, mousePos: null, fishAlpha: 1.0, now: Date.now() });
}

function renderShopIcons() {
    SPECIES.forEach(s => {
        // Only render preview if unlocked
        if (unlockedSpecies.has(s.id)) {
            renderSingleShopIcon(s);
        }
    });
}

function buyFish(species) {
    if (score >= species.cost) {
        score -= species.cost;
        
        // Unlock the species if it's the first time
        if (!unlockedSpecies.has(species.id)) {
            unlockedSpecies.add(species.id);
            // Re-render shop to show the revealed fish
            initShop();
        }

        UI.updateScore(score);
        updateShopUI();
        UI.showToast("Summoning Spirit...");
        
        sound.playChime(); 

        const f = new Fish(species, false, width, height);
        f.pos.x = width / 2;
        f.pos.y = height / 2;
        fishes.push(f);
        
        UI.updateFishCounts(fishes); // Update immediately on purchase
        
        ripples.push(new Ripple(width/2, height/2));
    }
}

function updateShopUI() {
    let newUnlock = false;
    
    SPECIES.forEach(s => {
        const el = document.getElementById(`shop-item-${s.id}`);
        if (score >= s.cost) {
            // Check for new affordability
            if (!affordableSpeciesIds.has(s.id)) {
                affordableSpeciesIds.add(s.id);
                newUnlock = true;
            }
            
            el.classList.remove('locked');
            el.classList.add('affordable');
        } else {
            // Remove from set if it becomes unaffordable (e.g. after spending)
            // But we don't want to trigger "new unlock" when re-earning
            // So we only remove if we want to re-trigger. 
            // Usually games don't re-announce. 
            // However, if we want the set to accurately reflect CURRENT affordability:
            if (affordableSpeciesIds.has(s.id)) {
                affordableSpeciesIds.delete(s.id);
            }
            
            el.classList.add('locked');
            el.classList.remove('affordable');
        }
    });

    if (newUnlock) {
        openShopTemporarily();
    }
}

function openShopTemporarily() {
    const bottomUI = document.querySelector('.bottom-ui');
    if (bottomUI) {
        bottomUI.classList.add('active');
        
        if (shopForcedOpenTimer) clearTimeout(shopForcedOpenTimer);
        
        shopForcedOpenTimer = setTimeout(() => {
            shopForcedOpenTimer = null;
            // Check mouse position to see if we should close immediately
            // If mouse is NOT in the activation zone, close it.
            // Detection zone threshold is 150px from bottom.
            if (height - mousePos.y >= 150) {
                bottomUI.classList.remove('active');
            }
        }, 5000);
    }
}

function checkGameOver() {
    if (fishes.length === 0 && score < 100) {
        document.getElementById('restartOverlay').classList.add('show');
    }
}

function restartGame() {
    score = 0;
    fishes = [];
    particles = [];
    ripples = [];
    deadCount = 0;
    
    UI.updateScore(score);
    document.querySelector('.graveyard-title').innerText = 'Spirit Memories (0)';
    
    const list = document.getElementById('graveyardList');
    list.innerHTML = '';
    
    fishes.push(new Fish(SPECIES[0], false, width, height));
    
    document.getElementById('restartOverlay').classList.remove('show');
    
    updateShopUI();
    UI.updateFishCounts(fishes); // Update on restart
}

function drawBackground() {
    // Draw background image first (if loaded) using Cache
    if (backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth > 0) {
        // Create/Update Cache if needed
        if (!bgCache) {
            bgCache = document.createElement('canvas');
            bgCache.width = width;
            bgCache.height = height;
            const bCtx = bgCache.getContext('2d');
            
            // Calculate scaling to cover the canvas while maintaining aspect ratio
            const imgAspect = backgroundImage.width / backgroundImage.height;
            const canvasAspect = width / height;
            let drawWidth, drawHeight, drawX, drawY;
            
            if (imgAspect > canvasAspect) {
                drawHeight = height;
                drawWidth = height * imgAspect;
                drawX = (width - drawWidth) / 2;
                drawY = 0;
            } else {
                drawWidth = width;
                drawHeight = width / imgAspect;
                drawX = 0;
                drawY = (height - drawHeight) / 2;
            }

            // Apply blur (native or manual fallback)
            if (bCtx.filter !== undefined) {
                bCtx.filter = 'blur(7px)';
                bCtx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
            } else {
                bCtx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
                applyManualBlur(bCtx, width, height, 7);
            }
        }
        
        // Draw the cached, pre-blurred background (FAST)
        ctx.drawImage(bgCache, 0, 0);
    }
    
    // Draw animated weeds (Pre-blurred)
    const now = Date.now();
    weedInstances.forEach(w => {
        const img = weedImages[w.imgIndex];
        if (img && img.complete && img.naturalWidth > 0) {
             // Check if we have a pre-blurred cache for this weed species
             if (!weedCanvases[w.imgIndex]) {
                 const wc = document.createElement('canvas');
                 const pad = 20; // Padding to avoid clipping the blur
                 wc.width = img.width + pad;
                 wc.height = img.height + pad;
                 const wCtx = wc.getContext('2d');
                 wCtx.drawImage(img, pad/2, pad/2);
                 
                 if (wCtx.filter !== undefined) {
                    wCtx.filter = 'blur(6px)';
                    wCtx.clearRect(0, 0, wc.width, wc.height);
                    wCtx.drawImage(img, pad/2, pad/2);
                 } else {
                    applyManualBlur(wCtx, wc.width, wc.height, 6);
                 }
                 weedCanvases[w.imgIndex] = wc;
             }
             
             const cached = weedCanvases[w.imgIndex];
             const x = w.xRatio * width;
             const y = height + 50; 
             const sway = Math.sin(now * w.speed + w.phase) * 0.06;
             
             ctx.save();
             ctx.translate(x, y);
             ctx.rotate(sway);
             // Draw the pre-blurred cache
             ctx.drawImage(cached, -cached.width*w.scale/2, -cached.height*w.scale, cached.width*w.scale, cached.height*w.scale);
             ctx.restore();
        }
    });
    
    // Overlay gradient on top with reduced opacity
    ctx.save();
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.8; // Reduced opacity so image shows through more clearly
    let grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, currentColors.top);
    grad.addColorStop(1, currentColors.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Draw Caustics using low-res upscaling for performance-friendly "blur"
    if (causticCanvas) {
        const cCtx = causticCanvas.getContext('2d');
        // Even lower resolution for stronger blur (1/6 instead of 1/4)
        const cW = Math.ceil(width / 6);
        const cH = Math.ceil(height / 6);
        
        // Ensure canvas size matches
        if (causticCanvas.width !== cW) {
            causticCanvas.width = cW;
            causticCanvas.height = cH;
        }
        
        cCtx.clearRect(0, 0, cW, cH);
        cCtx.fillStyle = currentColors.caustic;
        
        let time = Date.now() * 0.0005;
        // Draw caustics on small canvas (coordinates scaled down)
        for (let i = 0; i < 5; i++) {
            cCtx.beginPath();
            // Scale input coordinates by 1/6
            let x = ((width * 0.2 * i) + Math.sin(time + i) * 50) * (1/6);
            cCtx.moveTo(x - 25, cH);
            cCtx.lineTo(x + 75, 0);
            cCtx.lineTo(x + 125, 0);
            cCtx.lineTo(x + 75, cH);
            cCtx.fill();
        }
        
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        // Draw the small canvas scaled up to fit screen
        // The linear interpolation during scaling acts as a blur
        ctx.drawImage(causticCanvas, 0, 0, width, height);
        ctx.restore();
    }

    // Night Overlay
    if (currentColors.overlay) {
        ctx.save();
        ctx.fillStyle = currentColors.overlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}

// World context object (reused to avoid GC)
const world = {
    width: 0, height: 0,
    spatialGrid,
    foodList: [],
    fishes: [], 
    particles: [], 
    sound,
    isTalkMode: false,
    isNight: false,
    mousePos: {x:0, y:0},
    now: 0,
    onScoreUpdate: (amount) => {
        score += amount;
        UI.updateScore(score);
        updateShopUI();
    },
    showToast: UI.showToast,
    spawnParticles: (x, y, count, color, speed = 2) => {
        for(let i=0; i<count; i++) {
            if(particles.length < 200) {
                particles.push({
                    x, y,
                    vx: rand(-speed, speed), 
                    vy: rand(-speed, speed),
                    life: 1.0, 
                    color
                });
            }
        }
    }
};

function updateTimeCycle(dt) {
    // Advance cycle
    timeCycle += (dt * 1000) / CONFIG.cycleDuration;
    if (timeCycle >= 1) timeCycle = 0;

    let phase, nextPhase, t;
    const TC = CONFIG.timeColors;

    // Determine phase
    if (timeCycle < 0.25) {
        // Dawn -> Day
        phase = TC.dawn;
        nextPhase = TC.day;
        t = timeCycle / 0.25;
        isNight = false;
    } else if (timeCycle < 0.6) {
        // Day
        phase = TC.day;
        nextPhase = TC.day; // Stay Day
        t = 0;
        isNight = false;
    } else if (timeCycle < 0.75) {
        // Day -> Dusk
        phase = TC.day;
        nextPhase = TC.dusk;
        t = (timeCycle - 0.6) / 0.15;
        isNight = false;
    } else if (timeCycle < 0.85) {
        // Dusk -> Night
        phase = TC.dusk;
        nextPhase = TC.night;
        // Ensure t goes from 0 to 1 exactly over the window 0.75 -> 0.85
        t = (timeCycle - 0.75) / 0.1;
        isNight = t > 0.5;
    } else if (timeCycle < 0.9) {
        // Full Night (Static)
        phase = TC.night;
        nextPhase = TC.night;
        t = 0;
        isNight = true;
    } else {
        // Night -> Dawn (wrap around)
        phase = TC.night;
        nextPhase = TC.dawn;
        t = (timeCycle - 0.9) / 0.1;
        // Transition back to day behavior halfway through dawn
        isNight = t < 0.5;
    }

    // Interpolate colors
    currentColors.top = lerpColor(phase.top, nextPhase.top, t);
    currentColors.bottom = lerpColor(phase.bottom, nextPhase.bottom, t);
    
    // Smoothly interpolate overlay opacity and caustic color
    // We need to parse RGBA to interpolate
    // Helper for RGBA lerp (assuming format rgba(r, g, b, a))
    const lerpRGBA = (c1, c2, t) => {
        // Quick regex parse
        const parse = (s) => s.match(/[\d.]+/g).map(Number);
        const [r1, g1, b1, a1] = parse(c1);
        const [r2, g2, b2, a2] = parse(c2);
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        const a = a1 + (a2 - a1) * t;
        
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    };

    currentColors.caustic = lerpRGBA(phase.caustic, nextPhase.caustic, t);
    currentColors.overlay = lerpRGBA(phase.overlay, nextPhase.overlay, t);

    // Calculate fish opacity based on night darkness
    // Default is 1.0. At peak night, it should be 0.8.
    // We can use the overlay alpha as a proxy for "darkness", or just logic based on phase.
    // Simpler: if phase is Night, alpha is 0.8. If transitioning to/from Night, lerp it.
    
    // Logic:
    // Day/Dawn: 1.0
    // Dusk -> Night: Lerp 1.0 -> 0.8
    // Night -> Dawn: Lerp 0.8 -> 1.0
    
    let targetAlpha = 1.0;
    if (phase === TC.dusk && nextPhase === TC.night) {
        // Dusk -> Night (0.75 - 0.85)
        targetAlpha = 1.0 - (t * 0.2); // 1.0 -> 0.8
    } else if (phase === TC.night && nextPhase === TC.dawn) {
        // Night -> Dawn (0.90 - 1.0)
        targetAlpha = 0.8 + (t * 0.2); // 0.8 -> 1.0
    } else if (phase === TC.night) {
        // Full Night (0.85 - 0.90)
        targetAlpha = 0.8;
    } else {
        targetAlpha = 1.0;
    }
    currentColors.fishAlpha = targetAlpha;
}

function loop() {
    requestAnimationFrame(loop);
    frameCount++;

    let now = Date.now();
    let dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Cap dt to prevent huge jumps
    lastTime = now;

    updateTimeCycle(dt);

    // Auto Feed Logic (Dynamic Rate)
    if (isAutoFeed) {
        // Base rate: 0.1 pellets/sec. 
        // Scale up with population: +0.08 pellets/sec per fish
        // Average fish hunger cooldown is ~17s (random 5-30s).
        // 0.08 pellets/sec = 1 pellet every 12.5s per fish, providing a slight surplus.
        const rate = 0.1 + (fishes.length * 0.08); 
        const interval = 1000 / rate;

        if (now - lastAutoFeedTime > interval) {
            if (particles.length < 200) {
                particles.push(new Food(rand(50, width - 50), -10));
                if(Math.random() < 0.1) sound.playBloop(2.0); 
            }
            lastAutoFeedTime = now;
        }
    }

    spatialGrid.clear();
    // Add both fish AND food to spatial grid for faster lookups
    for(let f of fishes) {
        if(!f.isDead) spatialGrid.add(f);
    }
    // Filter food items separately to avoid re-filtering in loop and fish
    let foodItems = [];
    for (let p of particles) {
        if (p instanceof Food) {
             foodItems.push(p);
             // Optional: Add food to spatial grid if we update fish to use it
             // spatialGrid.addFood(p); 
        }
    }

    ctx.clearRect(0, 0, width, height);
    drawBackground();
    
    for (let i = ripples.length - 1; i >= 0; i--) {
        let r = ripples[i];
        r.update();
        r.draw(ctx);
        if(r.opacity <= 0) ripples.splice(i, 1);
    }

    foodItems.forEach(f => {
        f.update(height);
        f.draw(ctx);
    });

    let deadFish = [];
    let eatenFish = []; 

    // Update world context
    world.width = width;
    world.height = height;
    world.now = now;
    world.foodList = foodItems;
    world.fishes = fishes;
    world.particles = particles;
    world.isTalkMode = isTalkMode;
    world.isNight = isNight;
    world.fishAlpha = currentColors.fishAlpha || 1.0;
    world.mousePos = mousePos;

    fishes.forEach(fish => {
        let status = fish.update(world, frameCount); 
        fish.draw(ctx, world);
        
        if (status === 'gone') {
            deadFish.push(fish);
        } else if (status === 'eaten') {
            eatenFish.push(fish);
            
            world.spawnParticles(fish.pos.x, fish.pos.y, 15, '#E74C3C', 3);
            // Add blood mist
            particles.push(new BloodMist(fish.pos.x, fish.pos.y));
        }
    });

    deadFish.forEach(fish => {
        const index = fishes.indexOf(fish);
        if (index > -1) {
            sound.playDeathToll();
            UI.addToGraveyard(fish, ++deadCount);
            fishes.splice(index, 1);
            UI.updateFishCounts(fishes); // Update on death
        }
    });
    
    eatenFish.forEach(fish => {
        const index = fishes.indexOf(fish);
        if (index > -1) {
            sound.playDeathToll();
            UI.addToGraveyard(fish, ++deadCount); 
            fishes.splice(index, 1);
            UI.updateFishCounts(fishes); // Update on eaten
        }
    });
    
    if (deadFish.length > 0 || eatenFish.length > 0) {
        checkGameOver();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        if (p instanceof Food) {
            if (p.eaten) {
                particles.splice(i, 1); 
            }
            continue;
        }
        
        if (p instanceof Bubble) {
            p.update();
            p.draw(ctx);
            continue;
        }

        if (p instanceof BloodMist) {
            p.update();
            p.draw(ctx);
            if (p.isDead) particles.splice(i, 1);
            continue;
        }

        if (p.life) {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.fillStyle = p.color ? p.color : `rgba(255, 255, 255, ${p.life})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }
}

// Start
init();

