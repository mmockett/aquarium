import { SoundManager } from './classes/SoundManager.js';
import { SpatialHash, Vector, rand, distSq } from './utils.js';
import { Fish } from './classes/Fish.js';
import { Food } from './classes/Food.js';
import { Bubble } from './classes/Bubble.js';
import { Ripple } from './classes/Ripple.js';
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
let isTalkMode = false;
let isAutoFeed = false;
let autoFeedTimer = null;
let mousePos = { x: -9999, y: -9999 };
let deadCount = 0;
let idleTimer = null;
let frameCount = 0;

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
    });

    // Attach UI Event Listeners
    document.getElementById('autoFeedBtn').addEventListener('click', toggleAutoFeed);
    document.getElementById('talkBtn').addEventListener('click', toggleTalkMode);
    document.getElementById('soundToggleBtn').addEventListener('click', () => sound.toggle());
    document.getElementById('uiToggleBtn').addEventListener('click', toggleUI);
    document.querySelector('.help-btn').addEventListener('click', UI.toggleHelp);
    document.querySelector('.close-help').addEventListener('click', UI.toggleHelp);
    document.querySelector('.restart-btn').addEventListener('click', restartGame);


    fishes.push(new Fish(SPECIES[0], false, width, height));
    for(let i=0; i<20; i++) particles.push(new Bubble(width, height));

    initShop();
    loop();
    
    setInterval(() => {
        score += fishes.length;
        UI.updateScore(score);
    }, 3000);

    resetIdleTimer();
}

function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    const el = document.getElementById('idlePrompt');
    if(el) el.style.opacity = 0;
    
    idleTimer = setTimeout(() => {
        if(el) el.style.opacity = 1;
    }, 60000);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
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
    } else {
        btn.classList.remove('active');
        btn.innerText = "✨ Talk to Spirits";
        document.body.style.cursor = "default";
    }
}

function toggleAutoFeed() {
    isAutoFeed = !isAutoFeed;
    const btn = document.getElementById('autoFeedBtn');
    sound.playBloop(0.8);
    
    if (isAutoFeed) {
        btn.classList.add('active');
        btn.innerText = "🍂 Auto Feed: ON";
        
        autoFeedTimer = setInterval(() => {
            if (particles.length < 200) {
                particles.push(new Food(rand(50, width - 50), -10));
                if(Math.random() < 0.1) sound.playBloop(2.0); 
            }
        }, 2000);
    } else {
        btn.classList.remove('active');
        btn.innerText = "🍂 Auto Feed: OFF";
        clearInterval(autoFeedTimer);
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

            const canvas = document.createElement('canvas');
            canvas.width = 60;
            canvas.height = 40;
            canvas.className = 'fish-preview-canvas';
            canvas.id = `preview-${s.id}`;
            
            el.appendChild(canvas);
            
            const nameEl = document.createElement('div');
            nameEl.className = 'fish-name';
            nameEl.innerText = s.name;
            el.appendChild(nameEl);
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

function renderShopIcons() {
    SPECIES.forEach(s => {
        // Only render preview if unlocked
        if (unlockedSpecies.has(s.id)) {
            const canvas = document.getElementById(`preview-${s.id}`);
            if (!canvas) return; 
            
            const pCtx = canvas.getContext('2d');
            
            // Create a dummy fish just for drawing
            const dummy = new Fish(s, false, 100, 100);
            dummy.pos.x = 30;
            dummy.pos.y = 20;
            dummy.size = Math.min(s.size, 15); 
            dummy.angle = 0;
            
            pCtx.clearRect(0, 0, 60, 40);
            dummy.draw(pCtx, false);
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
        
        ripples.push(new Ripple(width/2, height/2));
    }
}

function updateShopUI() {
    SPECIES.forEach(s => {
        const el = document.getElementById(`shop-item-${s.id}`);
        if (score >= s.cost) {
            el.classList.remove('locked');
            el.classList.add('affordable');
        } else {
            el.classList.add('locked');
            el.classList.remove('affordable');
        }
    });
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
    // Keep the title
    while (list.children.length > 1) {
        list.removeChild(list.lastChild);
    }
    
    fishes.push(new Fish(SPECIES[0], false, width, height));
    
    document.getElementById('restartOverlay').classList.remove('show');
    
    updateShopUI();
}

function drawBackground() {
    let grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, CONFIG.colors.waterTop);
    grad.addColorStop(1, CONFIG.colors.waterBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = CONFIG.colors.caustic;
    let time = Date.now() * 0.0005;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        let x = (width * 0.2 * i) + Math.sin(time + i) * 50;
        ctx.moveTo(x - 100, height);
        ctx.lineTo(x + 300, 0);
        ctx.lineTo(x + 500, 0);
        ctx.lineTo(x + 300, height);
        ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width * 0.8, height);
    ctx.lineTo(width * 0.2, height);
    ctx.fill();
    ctx.restore();
}

function loop() {
    requestAnimationFrame(loop);
    frameCount++;

    let now = Date.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    spatialGrid.clear();
    for(let f of fishes) {
        if(!f.isDead) spatialGrid.add(f);
    }

    ctx.clearRect(0, 0, width, height);
    drawBackground();

    let foodItems = particles.filter(p => p instanceof Food);
    
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

    // World context to pass to Fish update
    const world = {
        width, height,
        spatialGrid,
        foodList: foodItems,
        fishes: fishes, // Reference to the array
        particles, // Reference to the array
        sound,
        isTalkMode,
        mousePos,
        onScoreUpdate: (amount) => {
            score += amount;
            UI.updateScore(score);
            updateShopUI();
        },
        showToast: UI.showToast
    };

    fishes.forEach(fish => {
        let status = fish.update(world, frameCount); 
        fish.draw(ctx, isTalkMode, mousePos);
        
        if (status === 'gone') {
            deadFish.push(fish);
        } else if (status === 'eaten') {
            eatenFish.push(fish);
            
            for(let i=0; i<15; i++) { 
                if(particles.length < 200) {
                    particles.push({
                        x: fish.pos.x, y: fish.pos.y,
                        vx: rand(-3,3), vy: rand(-3,3),
                        life: 1.0, color: '#E74C3C' 
                    });
                }
            }
        }
    });

    deadFish.forEach(fish => {
        const index = fishes.indexOf(fish);
        if (index > -1) {
            sound.playDeathToll();
            UI.addToGraveyard(fish, ++deadCount);
            fishes.splice(index, 1);
        }
    });
    
    eatenFish.forEach(fish => {
        const index = fishes.indexOf(fish);
        if (index > -1) {
            sound.playDeathToll();
            UI.addToGraveyard(fish, ++deadCount); 
            fishes.splice(index, 1);
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

