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
let particles = [];
let fishes = [];
let ripples = [];
let lastTime = 0;
let lastAutoFeedTime = 0;
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

// Konami Code Easter Egg: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiIndex = 0;

// FPS tracking
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let currentFPS = 60;

const sound = new SoundManager();
const spatialGrid = new SpatialHash(80);  // Reduced from 150 for smaller fish

// --- Core Systems ---

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    window.addEventListener('resize', resize);
    resize();

    // Use the game container for input - it's below the UI layer
    const gameContainer = document.getElementById('game-container');
    gameContainer.addEventListener('mousedown', handleInput);
    gameContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleInput(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
    });

    // Konami Code listener
    window.addEventListener('keydown', handleKonamiCode);

    // Initialize the new UI system (pass sound manager for toggle control)
    UI.initUI(SPECIES, {
        onPurchase: (speciesId) => {
            const species = SPECIES.find(s => s.id === speciesId);
            if (species) {
                const f = new Fish(species, false, width, height);
                f.pos.x = width / 2;
                f.pos.y = height / 2;
                fishes.push(f);
                ripples.push(new Ripple(width/2, height/2));
                sound.playFishSplash();
                UI.updateFishCounts(fishes);
            }
        },
        onBackgroundChange: (bgId) => {
            loadBackground(bgId);
        },
        onTimeSpeedChange: (speed) => {
            // Time speed is read from UI.getCycleDuration() in updateTimeCycle
        },
        onRestart: () => {
            restartGame();
        }
    }, sound);
    
    // Load background based on saved setting
    loadBackground(UI.getSelectedBackground());

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
            scale: 0.25 + Math.random() * 0.25,
            speed: 0.0005 + Math.random() * 0.0005,
            phase: Math.random() * Math.PI * 2
        });
    }

    // Try to load game, otherwise initialize default
    if (!loadGame()) {
        fishes.push(new Fish(SPECIES[0], false, width, height));
    }
    
    for(let i=0; i<20; i++) particles.push(new Bubble(width, height));

    loop();
    
    // Periodic score update and autosave
    setInterval(() => {
        const state = UI.getState();
        UI.updateScore(state.score + fishes.length);
        UI.updateFishCounts(fishes);
        saveGame();
    }, 3000);

    // Save on close
    window.addEventListener('beforeunload', () => saveGame());

    resetIdleTimer();
}

function loadBackground(bgId) {
    const bgFile = `assets/backgrounds/Background${bgId}.jpg`;
    backgroundImage = new Image();
    backgroundImage.src = bgFile;
    backgroundImage.onload = () => {
        bgCache = null; // Invalidate cache to regenerate with new image
    };
    backgroundImage.onerror = () => {
        console.warn(`Background image failed to load: ${bgFile}`);
        backgroundImage = null;
    };
}

function saveGame() {
    const data = {
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
    localStorage.setItem('spiritAquariumFishes', JSON.stringify(data));
}

function loadGame() {
    const saved = localStorage.getItem('spiritAquariumFishes');
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);
        
        if (!Array.isArray(data.fishes)) {
            console.warn("Invalid save data format");
            return false;
        }

        // Restore fishes
        fishes = [];
        data.fishes.forEach(fData => {
            const species = SPECIES.find(s => s.id === fData.speciesId);
            if (species) {
                const fish = new Fish(species, false, width, height);
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

        UI.updateFishCounts(fishes);
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
    if (!UI.isAutoFeedEnabled()) {
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

function handleInput(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    resetIdleTimer();
    
    // Auto-start sound on first user interaction (browser requirement)
    sound.autoStart();

    if (UI.isTalkModeEnabled()) {
        let clickedFish = null;
        for (let f of fishes) {
            if (!f.isDead) {
                let dSq = distSq(x, y, f.pos.x, f.pos.y);
                if (dSq < (f.size + 10)**2) {  // Reduced padding from 20 for smaller fish
                    clickedFish = f;
                    break;
                }
            }
        }

        if (clickedFish) {
            clickedFish.talk();
            sound.playFishSplash(); 
        } else {
            ripples.push(new Ripple(x, y));
        }
    } else {
        particles.push(new Food(x, y));
        ripples.push(new Ripple(x, y));
        sound.playBloop(rand(0.8, 1.2)); 
    }
}

function handleKonamiCode(e) {
    // Check if the pressed key matches the expected key in the sequence
    if (e.code === KONAMI_CODE[konamiIndex]) {
        konamiIndex++;
        
        // If the entire sequence is complete, spawn a Rainbow Spirit!
        if (konamiIndex === KONAMI_CODE.length) {
            spawnRainbowSpirit();
            konamiIndex = 0; // Reset for potential future use
        }
    } else {
        // Reset if wrong key pressed
        konamiIndex = 0;
        // But check if this key starts the sequence
        if (e.code === KONAMI_CODE[0]) {
            konamiIndex = 1;
        }
    }
}

function spawnRainbowSpirit() {
    const rainbowSpecies = SPECIES.find(s => s.id === 'rainbow');
    if (!rainbowSpecies) {
        console.warn('Rainbow Spirit species not found!');
        return;
    }
    
    // Create the Rainbow Spirit at the center of the screen
    const fish = new Fish(rainbowSpecies, false, width, height);
    fish.pos.x = width / 2;
    fish.pos.y = height / 2;
    fishes.push(fish);
    
    // Create a dramatic entrance effect
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            ripples.push(new Ripple(width / 2, height / 2));
        }, i * 100);
    }
    
    // Play sounds (dramatic entrance)
    sound.playFishSplash();
    setTimeout(() => sound.playFishSplash(), 200);
    setTimeout(() => sound.playFishSplash(), 400);
    
    // Show a special toast
    UI.showToast('🌈 A Rainbow Spirit has appeared!', 'sparkles', 5000);
    UI.updateFishCounts(fishes);
    
    console.log('🌈 Konami Code activated! Rainbow Spirit spawned!');
}


function checkGameOver() {
    const state = UI.getState();
    if (fishes.length === 0 && state.score < 100) {
        // Show a toast instead of blocking overlay
        UI.showToast('All spirits have departed. Tap Shop to summon more.', 'sparkles', 4000);
    }
}

function restartGame() {
    fishes = [];
    particles = [];
    ripples = [];
    deadCount = 0;
    
    // Reinitialize bubbles
    for(let i=0; i<20; i++) particles.push(new Bubble(width, height));
    
    UI.updateFishCounts(fishes);
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

            // Create a variable blur effect using a mask
            // 1. Create a temporary canvas for the full blurred version
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = width;
            blurCanvas.height = height;
            const blCtx = blurCanvas.getContext('2d');
            
            // Draw the image onto the blur canvas
            if (blCtx.filter !== undefined) {
                blCtx.filter = 'blur(7px)';
                blCtx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
            } else {
                blCtx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
                applyManualBlur(blCtx, width, height, 7);
            }

            // 2. Create a second temporary canvas for the lighter blur (3px)
            const lightBlurCanvas = document.createElement('canvas');
            lightBlurCanvas.width = width;
            lightBlurCanvas.height = height;
            const lbCtx = lightBlurCanvas.getContext('2d');

            if (lbCtx.filter !== undefined) {
                lbCtx.filter = 'blur(4px)';
                lbCtx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
            } else {
                lbCtx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
                applyManualBlur(lbCtx, width, height, 3);
            }

            // 3. Composite the gradient mask
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = width;
            maskCanvas.height = height;
            const mCtx = maskCanvas.getContext('2d');

            // Gradient: Opaque at top (shows heavy blur), Transparent at bottom (shows underlying light blur)
            const g = mCtx.createLinearGradient(0, 0, 0, height);
            g.addColorStop(0, 'rgba(0,0,0,1)');
            g.addColorStop(1, 'rgba(0,0,0,0)'); 
            mCtx.fillStyle = g;
            mCtx.fillRect(0, 0, width, height);

            // Mask the heavy blur
            blCtx.globalCompositeOperation = 'destination-in';
            blCtx.drawImage(maskCanvas, 0, 0);

            // 4. Final Composition into bgCache
            // No need to clear bgCache as it was just created and empty
            
            // Draw the light blur (base)
            bCtx.globalCompositeOperation = 'source-over';
            bCtx.drawImage(lightBlurCanvas, 0, 0);
            
            // Draw the masked heavy blur on top
            bCtx.drawImage(blurCanvas, 0, 0);
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
                 if (wCtx.filter !== undefined) {
                    wCtx.filter = 'blur(6px)';
                    wCtx.drawImage(img, pad/2, pad/2);
                 } else {
                    wCtx.drawImage(img, pad/2, pad/2);
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

    // Dark Blue Night Mask (20% opacity at peak night)
    // This darkens everything BEHIND the Rainbow Spirit
    if (world.nightFade > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 10, 40, ${world.nightFade * 0.4})`; // Max 40% darkness
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

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
        const state = UI.getState();
        UI.updateScore(state.score + amount);
    },
    showToast: UI.showToast,
    onBirth: (parent1Name, parent2Name, babyNames, speciesName) => {
        UI.addBirthEvent(parent1Name, parent2Name, babyNames, speciesName);
        UI.updateFishCounts(fishes);
    },
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
    // Get cycle duration from UI (handles time speed setting)
    const cycleDuration = UI.getCycleDuration();
    
    // Handle realtime mode (sync with device time)
    if (UI.getTimeSpeed() === 1) {
        const now = new Date();
        const secondsInDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        timeCycle = secondsInDay / 86400;
    } else if (cycleDuration === Infinity) {
        // Stopped - don't advance
    } else {
        // Normal time progression
        timeCycle += (dt * 1000) / cycleDuration;
    if (timeCycle >= 1) timeCycle = 0;
    }

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
        // Transition back to day behavior halfway through dawn phase
        isNight = true; // Stay in night mode during transition to Dawn for smoother sleep wake up
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
    
    // Determine night fade factor (0.0 to 1.0)
    // 0.0 = Day (Full visibility)
    // 1.0 = Peak Night (Maximum dimming)
    let nightFade = 0;
    if (phase === TC.dusk && nextPhase === TC.night) {
        // Dusk -> Night: 0 -> 1
        nightFade = t;
    } else if (phase === TC.night && nextPhase === TC.dawn) {
        // Night -> Dawn: 1 -> 0
        nightFade = 1 - t;
    } else if (phase === TC.night && nextPhase === TC.night) {
        // Full Night
        nightFade = 1.0;
    } else if (phase === TC.night) {
        // General night catch-all
        nightFade = 1.0;
    }
    
    currentColors.nightFade = nightFade;
}

function loop() {
    requestAnimationFrame(loop);
    frameCount++;

    let now = Date.now();
    let dt = (now - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Cap dt to prevent huge jumps
    lastTime = now;

    updateTimeCycle(dt);

    // FPS tracking
    fpsFrameCount++;
    const fpsNow = performance.now();
    if (fpsNow - fpsLastTime >= 1000) {
        currentFPS = fpsFrameCount;
        fpsFrameCount = 0;
        fpsLastTime = fpsNow;
        UI.updateDebugInfo(currentFPS, fishes.length);
    }

    // Auto Feed Logic (Dynamic Rate)
    if (UI.isAutoFeedEnabled()) {
        // Base rate: 0.1 pellets/sec. 
        // Scale up with population: +0.08 pellets/sec per fish
        // Average fish hunger cooldown is ~17s (random 5-30s).
        // 0.08 pellets/sec = 1 pellet every 12.5s per fish, providing a slight surplus.
        const rate = 0.1 + (fishes.length * 0.08); 
        const interval = 1000 / rate;

        if (now - lastAutoFeedTime > interval) {
            if (particles.length < 200) {
                particles.push(new Food(rand(50, width - 50), -10));
                // Occasional subtle sound for auto-feed (10% chance)
                if(Math.random() < 0.1) sound.playBloop(); 
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
    world.isTalkMode = UI.isTalkModeEnabled();
    world.isNight = isNight;
    world.nightFade = currentColors.nightFade || 0;
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
            UI.addDeathEvent(fish);
            fishes.splice(index, 1);
            UI.updateFishCounts(fishes);
        }
    });
    
    eatenFish.forEach(fish => {
        const index = fishes.indexOf(fish);
        if (index > -1) {
            sound.playDeathToll();
            fish.deathReason = 'was hunted';
            UI.addDeathEvent(fish);
            fishes.splice(index, 1);
            UI.updateFishCounts(fishes);
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

