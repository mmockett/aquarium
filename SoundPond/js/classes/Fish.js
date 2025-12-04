import { Vector, rand, distSq, callGemini } from '../utils.js';
import { CONFIG, FALLBACK_NAMES, FALLBACK_PHRASES } from '../config.js';

// Cache for fish images
const fishImageCache = new Map();
// Cache for fish parts
const fishPartsCache = new Map();
// Cache for fish configurations
const fishConfigCache = new Map();

function loadFishImage(imagePath) {
    if (fishImageCache.has(imagePath)) {
        return fishImageCache.get(imagePath);
    }
    const img = new Image();
    img.src = imagePath;
    fishImageCache.set(imagePath, img);
    return img;
}

async function loadFishConfig(basePath) {
    if (fishConfigCache.has(basePath)) {
        return fishConfigCache.get(basePath);
    }
    
    try {
        const response = await fetch(`${basePath}/config.json`);
        if (response.ok) {
            const config = await response.json();
            fishConfigCache.set(basePath, config);
            return config;
        }
    } catch (e) {
        console.warn(`Could not load config for ${basePath}:`, e);
    }
    
    // Return default config if file doesn't exist
    const defaultConfig = {
        body: { scale: 1.0 },
        tail: { x: -50, y: 0, pivotX: 0, pivotY: 0, scale: 1.0, flipY: false },
        dorsalFin: { x: 0, y: -50, pivotX: 0, pivotY: 0, scale: 1.0, flipY: false },
        pectoralFin1: { x: -50, y: -20, pivotX: 0, pivotY: 0, scale: 1.0, flipY: false },
        pectoralFin2: { x: 50, y: -20, pivotX: 0, pivotY: 0, scale: 1.0, flipY: false },
        pelvicFin1: { x: -20, y: 50, pivotX: 0, pivotY: 0, scale: 1.0, flipY: false },
        pelvicFin2: { x: 20, y: 50, pivotX: 0, pivotY: 0, scale: 1.0, flipY: false }
    };
    fishConfigCache.set(basePath, defaultConfig);
    return defaultConfig;
}

function loadFishParts(basePath) {
    if (fishPartsCache.has(basePath)) {
        return fishPartsCache.get(basePath);
    }
    
    const parts = {
        body: null,
        tail: null,
        dorsalFin: null,
        pectoralFin1: null,
        pectoralFin2: null,
        pelvicFin1: null,
        pelvicFin2: null,
        config: null // Will be loaded asynchronously
    };
    
    // Load all parts
    parts.body = loadFishImage(`${basePath}/Body.png`);
    parts.tail = loadFishImage(`${basePath}/Tail.png`);
    parts.dorsalFin = loadFishImage(`${basePath}/Fin.png`);
    parts.pectoralFin1 = loadFishImage(`${basePath}/Pectoral Fin 1.png`);
    parts.pectoralFin2 = loadFishImage(`${basePath}/Pectoral Fin 2.png`);
    parts.pelvicFin1 = loadFishImage(`${basePath}/Pelvic Fin 1.png`);
    parts.pelvicFin2 = loadFishImage(`${basePath}/Pelvic Fin 2.png`);
    
    // Load config asynchronously
    loadFishConfig(basePath).then(config => {
        parts.config = config;
        // Pre-calculate sort order once config is loaded
        parts.sortedKeys = [
            'pelvicFin1', 'pelvicFin2', 'body', 
            'pectoralFin1', 'pectoralFin2', 'tail', 'dorsalFin'
        ].sort((a, b) => {
            const zA = (config[a] || {}).zIndex || 0;
            const zB = (config[b] || {}).zIndex || 0;
            return zA - zB;
        });
    });
    
    fishPartsCache.set(basePath, parts);
    return parts;
}

export class Fish {
    constructor(type, isBorn = false, width, height, customName = null) {
        this.species = type;
        this.name = customName || "Spirit";
        this.skipNameGeneration = !!customName; // Skip generation if custom name provided 
        this.pos = new Vector(rand(100, width - 100), rand(100, height - 100));
        this.vel = new Vector(rand(-1, 1), rand(-1, 1));
        this.acc = new Vector(0, 0);
        this.angle = Math.random() * Math.PI * 2;
        
        this.size = type.size;
        // SoundPond: Reduce base speed significantly, especially for smaller fish
        // Smaller fish should be calmer and easier to click
        const baseSizeSpeedMod = Math.min(1.0, type.size / 15); // Smaller fish are slower
        this.maxSpeed = type.speed * 0.4 * (0.5 + baseSizeSpeedMod * 0.5); // 40% base, +up to 20% for larger fish
        this.maxForce = 0.05; // Reduced from 0.1 for smoother movement
        
        this.birthTime = Date.now();
        
        if (this.species.isPredator) {
            // Predators live 15-45 minutes (50% longer than before)
            this.lifespan = rand(15 * 60 * 1000, 45 * 60 * 1000);
        } else {
            this.lifespan = rand(60 * 60 * 1000, 24 * 60 * 60 * 1000); 
        }

        this.isDead = false;
        this.isEaten = false; 
        
        this.energy = 100; 
        this.maxEnergy = 100;
        this.lastAteTime = 0; 
        this.fullCooldown = 0; // Cooldown timer in ms

        this.digestionSlowdown = 1.0; 
        
        // Predators start with a 1-2 minute hunting cooldown (reduced from 2-3 min)
        // This lets them settle in and eat regular food before hunting
        this.huntingCooldown = this.species.isPredator ? rand(60 * 1000, 120 * 1000) : 0;

        this.tailAngle = 0;
        this.tailSpeed = 0.2;
        
        this.chatText = null;
        this.chatTimer = 0;
        this.isTalking = false;

        this.romanceTarget = null; 
        this.huntingTarget = null;
        this.tantrumTarget = null; 
        this.huntStartTime = 0; // Track when hunt started to prevent infinite chases

        this.aiOffset = Math.floor(Math.random() * 3);

        if (!isBorn) {
            this.birthTime -= 120 * 1000;
            this.lastReproductionTime = 0; 
        } else {
            this.lastReproductionTime = Date.now(); 
        }

        this.childrenCount = 0; // Track number of offspring
        this.facingLeft = this.vel.x < 0; // Track facing direction for smooth turns
        this.visualAngle = this.angle; // Decoupled visual rotation for smoothing
        this.isDrowsy = false; // Slower movement at night
        this.hasLoggedAdulthood = !isBorn; // Purchased fish start as adults, born fish need to grow

        this.generateName();
    }

    async generateName() {
        // Skip name generation if this fish has a custom name (e.g., artist fish or loaded from save)
        if (this.skipNameGeneration || this.isArtistFish) return;
        
        const prompt = `Generate a single, short, whimsical, Studio Ghibli-style name for a water spirit that looks like a ${this.species.name}. It should be unique and sound magical. Return ONLY the name, no other text.`;
        const newName = await callGemini(prompt);
        // Double-check flag hasn't been set while we were waiting
        if (this.skipNameGeneration || this.isArtistFish) return;
        if (newName) this.name = newName;
        else this.name = FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
    }

    formatAge(ageMs) {
        const seconds = Math.floor(ageMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            const remainingHours = hours % 24;
            return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
        } else if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        } else if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    async talk() {
        if (this.isTalking || this.isDead) return;
        this.isTalking = true;
        this.chatText = "...";
        const prompt = `Roleplay as a ${this.species.name} named ${this.name} in a magical Ghibli aquarium. Your personality is ${this.species.personality}. A human just waved at you. Respond with one very short, poetic, funny, or mystical sentence (max 10 words).`;
        const response = await callGemini(prompt);
        
        if (response) this.chatText = response;
        else {
            const phrases = FALLBACK_PHRASES[this.species.personality] || ["Bloop?", "Hello...", "Splosh."];
            this.chatText = phrases[Math.floor(Math.random() * phrases.length)];
        }
        this.chatTimer = 300;
        this.isTalking = false;
    }

    reproduce(mate, world) {
        const numOffspring = Math.floor(rand(1, 4)); 
        const spawnPos = new Vector((this.pos.x + mate.pos.x) / 2, (this.pos.y + mate.pos.y) / 2);
        
        world.showToast(`New Spirits! ${this.name} and ${mate.name} welcome ${numOffspring} babies.`, 'sparkles');
        world.sound.playBabyBorn(); 

        const babyNames = [];
        for (let i = 0; i < numOffspring; i++) {
            const child = new Fish(this.species, true, world.width, world.height);
            child.pos = new Vector(spawnPos.x + rand(-5,5), spawnPos.y + rand(-5,5)); 
            child.size = this.species.size * 0.2; 
            child.maxSpeed *= 1.5; 
            child.lastReproductionTime = world.now + rand(5 * 60 * 1000, 10 * 60 * 1000);
            world.fishes.push(child);
            babyNames.push(child.name);
            
            world.spawnParticles(spawnPos.x, spawnPos.y, 8, '#A4DDBB', 2);
        }

        // Record birth event
        if (world.onBirth) {
            world.onBirth(this.name, mate.name, babyNames, this.species.name);
        }

        const cooldown = rand(5 * 60 * 1000, 10 * 60 * 1000);
        this.lastReproductionTime = world.now + cooldown;
        mate.lastReproductionTime = world.now + cooldown;
        
        this.childrenCount += numOffspring;
        mate.childrenCount += numOffspring;

        this.romanceTarget = null;
        mate.romanceTarget = null;
    }

    computeBehaviors(world) {
        let sep = new Vector(0, 0);
        let ali = new Vector(0, 0);
        let coh = new Vector(0, 0);
        let sepCount = 0, aliCount = 0, cohCount = 0;
        this.isFleeing = false; // Reset flee state
        
        const desiredSeparationSq = (30 + this.size * 1.5)**2;  // More personal space for roomier schools
        const neighborDistSq = 150**2;  // Larger radius to find school-mates by genre
        
        let closestPrey = null;
        let closestPreyDistSq = Infinity;
        const huntRangeSq = 150**2;  // Reduced from 250 for smaller fish
        
        let fleeVector = new Vector(0, 0);
        const fleeRangeSq = 100**2;  // Reduced from 150 for smaller fish
        
        let nearestRival = null;
        let nearestRivalDistSq = Infinity;
        const tantrumRangeSq = 120**2;  // Reduced from 200 for smaller fish

        const amPredator = this.species.isPredator;
        const amPrey = !amPredator;

        // Hysteresis: Keep current hunting target if valid
        if (amPredator && this.huntingTarget) {
            if (!this.huntingTarget.isDead && Vector.distSq(this.pos, this.huntingTarget.pos) < huntRangeSq * 1.5) {
                closestPrey = this.huntingTarget;
                closestPreyDistSq = Vector.distSq(this.pos, this.huntingTarget.pos);
            }
        }

        const nearbyFish = world.spatialGrid.getNearby(this);

        for (let other of nearbyFish) {
            if (other === this || other.isDead) continue;
            
            let dSq = Vector.distSq(this.pos, other.pos);

            if (dSq < neighborDistSq) {
                // Separation: Ignore much smaller fish to prevent large fish from being pushed around
                const sizeRatio = other.size / this.size;
                if (sizeRatio > 0.5 || other.species.id === this.species.id) {
                    if (dSq < desiredSeparationSq) {
                        let diff = Vector.sub(this.pos, other.pos);
                        diff.normalize();
                        diff.div(Math.sqrt(dSq) || 0.1); 
                        sep.add(diff);
                        sepCount++;
                    }
                }
                
                // School with same species OR same genre (for artist fish)
                const sameSpecies = other.species.id === this.species.id;
                const sameGenre = this.isArtistFish && other.isArtistFish && 
                                  this.artistData?.genre && other.artistData?.genre &&
                                  this.artistData.genre === other.artistData.genre;
                
                if (sameSpecies || sameGenre) {
                     let alignVel = new Vector(other.vel.x, other.vel.y);
                     ali.add(alignVel);
                     aliCount++;
                     
                     let cohPos = new Vector(other.pos.x, other.pos.y);
                     coh.add(cohPos);
                     cohCount++;
                }
            }
            
            // Predator hunting logic
            if (amPredator) {
                // Predators hunt when hungry and not on cooldown
                // BUT: if starving (energy < 30), hunt regardless of cooldown to survive
                const isHungry = this.energy < 70;
                const isStarving = this.energy < 30;
                const canHunt = isHungry && (this.huntingCooldown <= 0 || isStarving);

                if (canHunt) {
                    // Check for rival predators first (territorial behavior)
                    if (other.species.isPredator && !other.isDead) {
                        if (dSq < tantrumRangeSq && dSq < nearestRivalDistSq) {
                            nearestRival = other;
                            nearestRivalDistSq = dSq;
                        }
                    } 
                    // Hunt smaller non-predator fish
                    else if (!other.species.isPredator && other.size < this.size * 0.8) {
                        // Switch target only if significantly closer (20% closer)
                        if (dSq < huntRangeSq && dSq < closestPreyDistSq * 0.8) {
                            closestPreyDistSq = dSq;
                            closestPrey = other;
                        }
                    }
                }
            }
            
            // Prey flee from predators - stronger response when closer
            if (amPrey && other.species.isPredator && !other.isDead) {
                if (dSq < fleeRangeSq) {
                    const dist = Math.sqrt(dSq);
                    let diff = Vector.sub(this.pos, other.pos);
                    diff.normalize();
                    // Stronger flee response when predator is closer
                    const urgency = 1 - (dist / Math.sqrt(fleeRangeSq));
                    diff.mult(1 + urgency * 2); // Up to 3x strength when very close
                    fleeVector.add(diff);
                    
                    // Mark as fleeing if predator is within dart range
                    const dartRangeSq = 60**2;  // Start darting when predator is close
                    if (dSq < dartRangeSq) {
                        this.isFleeing = true;
                    }
                }
            }
        }

        if (nearestRival) {
             this.tantrumTarget = nearestRival;
             let toRival = Vector.sub(nearestRival.pos, this.pos);
             toRival.normalize();
             let tangent = new Vector(-toRival.y, toRival.x); 
             tangent.mult(this.maxSpeed * 1.5);
             
             let steer = Vector.sub(tangent, this.vel);
             steer.limit(this.maxForce * 2);
             this.acc.add(steer);

             this.huntingTarget = null;
        } else {
             this.tantrumTarget = null;
             
             // Flocking weights - balanced for calm, cohesive schools
             if (sepCount > 0) {
                sep.div(sepCount); sep.normalize(); sep.mult(this.maxSpeed); sep.sub(this.vel); sep.limit(this.maxForce * 1.5);
                this.acc.add(sep.mult(1.0)); // Gentle separation
            }
            if (aliCount > 0) {
                ali.div(aliCount); ali.normalize(); ali.mult(this.maxSpeed); ali.sub(this.vel); ali.limit(this.maxForce);
                this.acc.add(ali.mult(1.2)); // Strong alignment for coordinated movement
            }
            if (cohCount > 0) {
                coh.div(cohCount);
                let desired = Vector.sub(coh, this.pos);
                desired.normalize(); desired.mult(this.maxSpeed);
                let steer = Vector.sub(desired, this.vel); steer.limit(this.maxForce);
                this.acc.add(steer.mult(1.5)); // Strong cohesion to keep schools tight
            }

            // Predator hunting - deliberate pursuit
            if (amPredator && closestPrey) {
                 // Start hunt timer if this is a new target
                 if (this.huntingTarget !== closestPrey) {
                     this.huntStartTime = world.now;
                     // Play dart sound when predator locks onto new prey
                     world.sound.playPredatorDart();
                 }
                 this.huntingTarget = closestPrey; 
                 
                 const distToPrey = Math.sqrt(closestPreyDistSq);
                 let desired = Vector.sub(closestPrey.pos, this.pos);
                 desired.normalize();
                 
                 // Predators accelerate as they get closer (more committed to the chase)
                 const proximity = 1 - Math.min(distToPrey / 150, 1.0);
                 const huntSpeed = this.maxSpeed * (1.0 + proximity * 0.5); // Up to 1.5x speed when close
                 desired.mult(huntSpeed);
                 
                 let steer = Vector.sub(desired, this.vel);
                 // Stronger steering when close to prey
                 steer.limit(this.maxForce * (1.5 + proximity));
                 this.acc.add(steer);
            }
        }

        // Apply flee behavior - prey escape from predators
        if (amPrey && (fleeVector.x !== 0 || fleeVector.y !== 0)) {
            // Fish can only flee effectively if they have some energy
            // Starving fish are too weak to flee fast
            const canFlee = this.energy > 20;
            
            if (canFlee) {
                this.isFleeing = true; // Mark as fleeing for burst speed
                fleeVector.normalize();
                fleeVector.mult(this.maxSpeed * 3.0); // Fast escape
                let steer = Vector.sub(fleeVector, this.vel);
                steer.limit(this.maxForce * 4.0); // Strong steering to escape
                this.acc.add(steer);
                
                // Spawn panic bubbles occasionally
                if (Math.random() < 0.15) {
                     world.spawnParticles(this.pos.x, this.pos.y, 1, '#fff', 1);
                }
            } else {
                // Weak flee - still try but slower
                fleeVector.normalize();
                fleeVector.mult(this.maxSpeed * 1.5);
                let steer = Vector.sub(fleeVector, this.vel);
                steer.limit(this.maxForce * 2.0);
                this.acc.add(steer);
            }
        }
    }

    update(world, frameCount) {
        if (!this.isDead) {
            // SoundPond: No energy drain - fish don't need to be fed
            // Energy stays at max for artist fish
            if (this.digestionSlowdown < 1.0) this.digestionSlowdown += 0.002;
            
            // Decrement full cooldown
            if (this.fullCooldown > 0) {
                this.fullCooldown -= 16.6; // Approx 60fps frame time
            }
            
            // Decrement hunting cooldown for predators
            if (this.species.isPredator && this.huntingCooldown > 0) {
                this.huntingCooldown -= 16.6;
            }

            // Check mating logic more frequently (every 120 frames ~ 2 seconds) and increase range
            if (frameCount % 120 === 0) {
                let mateChance = 0.05; 
                if (this.species.isPredator) mateChance = 0.005; 

                if (Math.random() < mateChance && world.fishes.length <= 50) {
                     const maturityAge = 60 * 1000;
                     const minCooldown = 5 * 60 * 1000;
                     
                     if (!this.romanceTarget && 
                         world.now - this.birthTime > maturityAge &&
                         world.now - this.lastReproductionTime > minCooldown && 
                         this.energy >= 80) {
                         
                         // Optimized: Use spatial grid for mate finding
                         // Increased search radius for larger tanks
                         const nearby = world.spatialGrid.getNearby(this);
                         let potentialMate = nearby.find(other => 
                            other !== this && 
                            other.species.id === this.species.id && 
                            other.energy >= 80 && 
                            world.now - other.birthTime > maturityAge && 
                            world.now - other.lastReproductionTime > minCooldown &&
                            distSq(this.pos.x, this.pos.y, other.pos.x, other.pos.y) < 150**2  // Reduced from 300 for smaller fish 
                         );
                         if (potentialMate) this.romanceTarget = potentialMate;
                     }
                }
            }

            if (this.romanceTarget) {
                 if (this.romanceTarget.isDead || this.energy < 80 || Vector.distSq(this.pos, this.romanceTarget.pos) > 150**2) {  // Reduced from 300
                     this.romanceTarget = null;
                 }
            }

            // Fish can only die of old age (no starvation in SoundPond)
            if (world.now - this.birthTime > this.lifespan) {
                this.isDead = true;
                this.deathReason = "Old Age";
            }
            if (Math.random() < 0.0000001) {
                this.isDead = true;
                this.deathReason = "Sudden Illness";
            }
        }

        if (this.species.isPredator && this.huntingTarget && !this.tantrumTarget) {
            // Safety check: ensure hunting target still exists and has valid position
            if (!this.huntingTarget.pos || this.huntingTarget.isDead) {
                this.huntingTarget = null;
                this.huntStartTime = 0;
            } else {
                const distToPreySq = Vector.distSq(this.pos, this.huntingTarget.pos);
                // Give up if prey is too far or chase has gone on too long (10 seconds)
                if (distToPreySq > 200**2 || (world.now - this.huntStartTime > 10000)) {  // Reduced from 400
                    this.huntingTarget = null;
                    this.huntStartTime = 0;
                } 
                // Catch prey - use combined sizes for more reliable catching
                else if (distToPreySq < (this.size + this.huntingTarget.size)**2) {
                this.huntingTarget.isDead = true;
                this.huntingTarget.deathReason = `Eaten by ${this.name}`;
                this.huntingTarget.isEaten = true;
                    this.feed(world, true); // true = ate prey 
                    // Long cooldown after eating prey (2-5 minutes)
                    this.huntingCooldown = rand(120 * 1000, 300 * 1000);
                this.huntingTarget = null;
                    this.huntStartTime = 0;
                }
            }
        } else if (this.tantrumTarget) {
            this.huntingTarget = null;
            this.huntStartTime = 0;
        }

        if (this.isDead) {
            if (this.isEaten) return 'eaten'; 
            this.vel.x *= 0.9; 
            this.vel.y = -1.5; 
            let targetAngle = Math.PI;
            this.angle += (targetAngle - this.angle) * 0.02;
            this.pos.add(this.vel);
            if (this.pos.y < -50) return 'gone';
            return 'alive';
        }

        if (this.chatTimer > 0 && !this.isTalking) {
            this.chatTimer--;
            if (this.chatTimer <= 0) this.chatText = null;
        }

        let target = null;
        let closestDistSq = Infinity;
        let closestFood = null;
        let searchRadSq = 150**2;  // Reduced from 300 for smaller fish

        if (!this.tantrumTarget && this.fullCooldown <= 0) {
            for (let f of world.foodList) {
                if (!f.eaten) {
                    let dSq = Vector.distSq(this.pos, f.pos);
                    if (dSq < searchRadSq && dSq < closestDistSq) {
                        closestDistSq = dSq;
                        closestFood = f;
                    }
                }
            }
        }

        if (closestFood) {
            target = closestFood.pos;
            let eatDist = this.size + 5;
            if (closestDistSq < eatDist*eatDist) {
                closestFood.eaten = true;
                this.feed(world);
            }
        }

        if (target) {
            this.seek(target, 2.5); // Burst speed for food
        } else if (this.romanceTarget) {
            this.seek(this.romanceTarget.pos);
            if (distSq(this.pos.x, this.pos.y, this.romanceTarget.pos.x, this.romanceTarget.pos.y) < (this.size + this.romanceTarget.size)**2) {
                 this.reproduce(this.romanceTarget, world);
            }
        } else {
            // Only compute complex behaviors every 5 frames instead of 3
            if (frameCount % 5 === this.aiOffset) {
                // Night time - fish are "drowsy" but still move (unless actively doing something)
                const isUrgent = target || this.isFleeing || this.huntingTarget || this.tantrumTarget || this.romanceTarget;
                this.isDrowsy = world.isNight && !this.species.isPredator && !isUrgent;

                this.computeBehaviors(world);
                    this.wander(world);
                this.boundaries(world.width, world.height);
            }
        }

        this.vel.add(this.acc);
        
        let dToMouseSq = Vector.distSq(this.pos, world.mousePos);
        let speedMod = 1;
        
        // Slow down near cursor so user can click on fish to play music
        // Fish gradually slow as cursor approaches, stop completely when very close
        const cursorSlowRadius = 80; // Start slowing at 80px
        const cursorStopRadius = 30; // Stop completely at 30px
        const dToMouse = Math.sqrt(dToMouseSq);
        
        if (dToMouse < cursorStopRadius) {
            // Very close - fish stops to allow clicking
            speedMod = 0.05;
        } else if (dToMouse < cursorSlowRadius) {
            // Gradual slowdown as cursor approaches
            const slowFactor = (dToMouse - cursorStopRadius) / (cursorSlowRadius - cursorStopRadius);
            speedMod *= Math.max(0.1, slowFactor);
        }
        
        // Additional slowdown in talk mode
        if (world.isTalkMode && dToMouseSq < 150**2) {
            speedMod *= 0.3;
        }

        let energyFactor = Math.max(0.2, this.energy / this.maxEnergy);
        speedMod *= energyFactor;
        speedMod *= this.digestionSlowdown;

        // Predators are slower when not hungry (energy >= 70) - they cruise lazily
        // This makes them less frantic and more menacing
        if (this.species.isPredator && this.energy >= 70 && !this.huntingTarget) {
            speedMod *= 0.4; // 40% speed when full/not hunting
        }

        // Night time: move at 30% speed unless doing something urgent
        const isUrgentNow = target || this.isFleeing || this.huntingTarget || this.tantrumTarget;
        if (this.isDrowsy && !isUrgentNow) {
            speedMod *= 0.3; // 30% speed at night
        }

        // Allow burst speed for Urgent behaviors (Feeding, Fleeing, Hunting, Fighting)
        let burst = 1.0;
        if (this.isFleeing) {
            burst = 2.5; // Prey flee fast
        } else if (this.huntingTarget) {
            burst = 2.0; // Predators dart when hunting
        } else if (isUrgentNow) {
            burst = 1.8; // Other urgent actions
        }

        this.vel.limit(this.maxSpeed * burst * speedMod);
        this.pos.add(this.vel);
        
        this.acc.mult(0); 

        if (this.pos.x < this.size) { this.pos.x = this.size; this.vel.x *= -0.8; }
        if (this.pos.x > world.width - this.size) { this.pos.x = world.width - this.size; this.vel.x *= -0.8; }
        if (this.pos.y < this.size) { this.pos.y = this.size; this.vel.y *= -0.8; }
        if (this.pos.y > world.height - this.size) { this.pos.y = world.height - this.size; this.vel.y *= -0.8; }
        
        // Always face direction of movement
        let desiredAngle = Math.atan2(this.vel.y, this.vel.x);
        let diff = desiredAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Slower turns for larger fish to prevent "shaky" look
        const turnSpeedMod = Math.max(0.2, 8 / this.size);  // Adjusted from 15 for smaller fish 
        this.angle += diff * CONFIG.physics.turnSpeed * turnSpeedMod;

        let speedPct = this.vel.mag() / (this.maxSpeed || 1);
        // Scale wiggle frequency by size (larger fish = slower beat)
        const sizeFreqMod = Math.max(1, this.size / 10);  // Adjusted from /20 for smaller fish
        this.tailSpeed = (0.1 + (speedPct * 0.3)) / Math.sqrt(sizeFreqMod);
        this.tailAngle += this.tailSpeed;

        return 'alive';
    }

    seek(target, speedMult = 1.0) {
        let desired = new Vector(target.x - this.pos.x, target.y - this.pos.y);
        desired.normalize();
        desired.mult(this.maxSpeed * speedMult);
        let steer = Vector.sub(desired, this.vel);
        steer.limit(this.maxForce);
        this.acc.add(steer);
    }

    wander(world) {
        let wanderR = 30;  // Reduced from 50 for smaller fish
        let wanderD = 100;
        let circlePos = new Vector(this.vel.x, this.vel.y);
        circlePos.normalize();
        circlePos.mult(wanderD);
        circlePos.add(this.pos);
        let t = world.now * 0.001 + this.pos.x; 
        let h = Math.sin(t) * wanderR;
        let target = new Vector(circlePos.x + Math.cos(t)*20, circlePos.y + h);
        this.seek(target);
    }

    boundaries(width, height) {
        // Soft margin where fish start turning, hard margin where they must turn
        const softMargin = 80;
        const hardMargin = 30;
        
        let steerX = 0;
        let steerY = 0;
        
        // Calculate wall proximity and steering strength
        // The closer to the wall, the stronger the steering
        if (this.pos.x < softMargin) {
            const urgency = 1 - (this.pos.x - hardMargin) / (softMargin - hardMargin);
            steerX = Math.max(0, urgency) * this.maxSpeed;
        } else if (this.pos.x > width - softMargin) {
            const urgency = 1 - ((width - this.pos.x) - hardMargin) / (softMargin - hardMargin);
            steerX = -Math.max(0, urgency) * this.maxSpeed;
        }
        
        if (this.pos.y < softMargin) {
            const urgency = 1 - (this.pos.y - hardMargin) / (softMargin - hardMargin);
            steerY = Math.max(0, urgency) * this.maxSpeed;
        } else if (this.pos.y > height - softMargin) {
            const urgency = 1 - ((height - this.pos.y) - hardMargin) / (softMargin - hardMargin);
            steerY = -Math.max(0, urgency) * this.maxSpeed;
        }
        
        if (steerX !== 0 || steerY !== 0) {
            let desired = new Vector(
                this.vel.x + steerX,
                this.vel.y + steerY
            );
            desired.normalize();
            desired.mult(this.maxSpeed);
            let steer = Vector.sub(desired, this.vel);
            // Stronger steering force near walls
            const maxUrgency = Math.max(Math.abs(steerX), Math.abs(steerY)) / this.maxSpeed;
            steer.limit(this.maxForce * (2 + maxUrgency * 3));
            this.acc.add(steer);
        }
    }

    feed(world, atePrey = false) {
        if (this.isDead) return;
        
        // Predators get more points and energy for catching prey
        const scoreBonus = atePrey ? 50 : 15;
        const energyBonus = atePrey ? 60 : 30;
        
        world.onScoreUpdate(scoreBonus); 
        this.energy = Math.min(this.maxEnergy, this.energy + energyBonus);
        this.digestionSlowdown = 0.5; 
        this.lastAteTime = world.now; 
        
        // Set a random cooldown between 5 and 30 seconds (for regular food)
        // Predators get longer cooldown set separately when catching prey
        if (!atePrey) {
        this.fullCooldown = rand(5000, 30000);
        }

        const maxSize = this.species.size * 3.0;
        const adultSize = this.species.size; // Base species size = adult
        const wasNotAdult = this.size < adultSize;
        
        if (this.size < maxSize) {
            // Predators grow more from eating prey
            const growthAmount = atePrey ? 1.5 : 0.8;
            this.size += growthAmount; 
            this.maxSpeed = Math.max(this.species.speed * 0.5, this.maxSpeed - 0.02);
            
            // Log "grew up" event when fish reaches adult size for the first time
            if (wasNotAdult && this.size >= adultSize && !this.hasLoggedAdulthood) {
                this.hasLoggedAdulthood = true;
                if (world.onGrewUp) {
                    world.onGrewUp(this.name, this.species.name);
                }
            }
        }

        // Different particle effects
        if (atePrey) {
            world.spawnParticles(this.pos.x, this.pos.y, 10, '#E74C3C', 2); // Red particles for prey
        } else {
        world.spawnParticles(this.pos.x, this.pos.y, 5, '#fff', 1);
        }
    }

    draw(ctx, world) {
        if (this.isDead && this.isEaten) return;

        // --- 1. Draw UI Elements (Upright, No Rotation) ---
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Calculate if hovered
        let isHovered = false;
        if (world.isTalkMode && world.mousePos) {
            const dSq = distSq(this.pos.x, this.pos.y, world.mousePos.x, world.mousePos.y);
            if (dSq < (this.size + 10)**2) {  // Reduced padding from 20 for smaller fish
                isHovered = true;
            }
        }

        // Draw Chat Bubble
        if (this.chatText && !this.isDead && this.size > 0) {
            ctx.save();
            ctx.translate(0, -this.size * 2 - 20);
            ctx.font = "500 14px 'Inter', -apple-system, sans-serif";
            let metrics = ctx.measureText(this.chatText);
            let w = metrics.width + 24;
            let h = 32;
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.beginPath();
            ctx.roundRect(-w/2, -h/2, w, h, 12);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-5, h/2);
            ctx.lineTo(5, h/2);
            ctx.lineTo(0, h/2 + 6);
            ctx.fill();
            ctx.fillStyle = "#1a1a1a";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.chatText, 0, 0);
            ctx.restore();
        }

        // Draw Extra Stats on Hover (Parent status, species info)
        if (isHovered && !this.isDead && this.size > 0) {
            ctx.save();
            ctx.translate(0, this.size + 50);
            
            // Build stats text
            const stats = [];
            if (this.childrenCount > 0) {
                stats.push(`${this.childrenCount} offspring`);
            }
            if (this.species.isPredator) {
                stats.push("Predator");
            }

            // Only show if there's something to display
            if (stats.length > 0) {
                const statsText = stats.join(' • ');
                ctx.font = "500 10px 'Inter', -apple-system, sans-serif";
            const metrics = ctx.measureText(statsText);
            const bgW = metrics.width + 16;
            const bgH = 20;

            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.beginPath();
            ctx.roundRect(-bgW/2, -bgH/2, bgW, bgH, 10);
            ctx.fill();

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.fillText(statsText, 0, 0);
            }
            ctx.restore();
        }

        // Draw Name on hover (simple version) or full info in talk mode
        const isMouseHovered = world.hoveredFish === this;
        const showFullInfo = world.isTalkMode && !this.isDead && this.size > 0;
        const showHoverName = isMouseHovered && !this.isDead && this.size > 0;
        
        if (showHoverName && !showFullInfo) {
            // Simple hover: just show name (and genre for artist fish)
            ctx.font = "600 13px 'Inter', -apple-system, sans-serif";
            ctx.textAlign = "center";
            
            // Draw name with shadow
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillText(this.name, 1, this.size + 16);
            ctx.fillStyle = "white";
            ctx.fillText(this.name, 0, this.size + 15);
            
            // Show genre for artist fish
            if (this.isArtistFish && this.artistData?.genre) {
                ctx.font = "500 11px 'Inter', -apple-system, sans-serif";
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                ctx.fillText(this.artistData.genre, 1, this.size + 31);
                ctx.fillStyle = "rgba(255, 85, 0, 0.9)"; // SoundCloud orange
                ctx.fillText(this.artistData.genre, 0, this.size + 30);
            }
        }
        
        if (showFullInfo) {
            // Full info mode (talk mode): show name, age, hunger, and genre
            const ageMs = world.now - this.birthTime;
            const ageText = this.formatAge(ageMs);
            
            // Calculate hunger status
            let hungerStatus = "Full";
            let hungerColor = "#34C759"; // green
            if (this.energy < 30) {
                hungerStatus = "Starving";
                hungerColor = "#FF375F"; // pink/red
            } else if (this.energy < 70) {
                hungerStatus = "Hungry";
                hungerColor = "#FFD60A"; // yellow
            }
            
            const nameAndAge = `${this.name} • ${ageText}`;
            
            ctx.font = "600 12px 'Inter', -apple-system, sans-serif";
            ctx.textAlign = "center";
            
            // Line 1: Name • Age (with shadow)
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillText(nameAndAge, 1, this.size + 16);
            ctx.fillStyle = "white";
            ctx.fillText(nameAndAge, 0, this.size + 15);
            
            // Line 2: Hunger status (for all fish)
            ctx.font = "600 11px 'Inter', -apple-system, sans-serif";
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillText(hungerStatus, 1, this.size + 31);
                ctx.fillStyle = hungerColor;
            ctx.fillText(hungerStatus, 0, this.size + 30);
            
            // Line 3: Genre (for artist fish only)
            if (this.isArtistFish && this.artistData?.genre) {
                ctx.font = "500 10px 'Inter', -apple-system, sans-serif";
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                ctx.fillText(this.artistData.genre, 1, this.size + 45);
                ctx.fillStyle = "rgba(255, 85, 0, 0.9)"; // SoundCloud orange
                ctx.fillText(this.artistData.genre, 0, this.size + 44);
            }
            }
            ctx.restore();


        // --- 2. Draw Fish (Rotated) ---
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // Smoothly interpolate visual angle towards physics angle
        // Handle wrap-around
        let diff = this.angle - this.visualAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // Smoothing factor: Lower = smoother/slower. 
        // Scale by size: Large fish (30) get 0.05, Small fish (5) get 0.3
        const smoothFactor = Math.max(0.05, 1.5 / this.size);
        this.visualAngle += diff * smoothFactor;

        // Update facing direction with hysteresis based on visualAngle to prevent jitter
        // Standard angle 0 is Right. PI is Left.
        // We want to flip Y if the fish is facing Left (Left Hemisphere: PI/2 to 3PI/2)
        // Use absolute angle relative to 0 (Right)
        let normalizedAngle = this.visualAngle;
        while (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
        while (normalizedAngle >= Math.PI * 2) normalizedAngle -= Math.PI * 2;
        
        const isLeftHemisphere = normalizedAngle > Math.PI / 2 && normalizedAngle < 3 * Math.PI / 2;
        
        // Add hysteresis at the vertical boundary
        const buffer = 0.2;
        if (isLeftHemisphere) {
             if (normalizedAngle > Math.PI / 2 + buffer && normalizedAngle < 3 * Math.PI / 2 - buffer) {
                 this.facingLeft = true;
             }
        } else {
             // Right hemisphere
             // Check if we are safely inside right hemisphere
             if (normalizedAngle < Math.PI / 2 - buffer || normalizedAngle > 3 * Math.PI / 2 + buffer) {
                 this.facingLeft = false;
             }
        }

        // Rotate to visual angle
        ctx.rotate(this.visualAngle);
        
        // If facing left, flip Y axis to keep belly down
        // (Since we rotated, "Down" is relative to the fish's belly)
        if (this.facingLeft) {
            ctx.scale(1, -1);
        }

        // Always use image-based drawing now
        this.drawImageBased(ctx, world);
        
        ctx.restore();
    }

    drawImageBased(ctx, world) {
        // Load fish parts (assuming imagePath is the base folder path)
        const parts = loadFishParts(this.species.imagePath);
        
        // Check if body is loaded (use body as indicator)
        if (!parts.body || !parts.body.complete || parts.body.naturalWidth === 0) {
            // Fallback if images fail to load (just don't draw or draw placeholder rect)
            return;
        }

        // Get config (use cached or default)
        // NOTE: x/y are relative to image center. pivotX/Y are relative to image center.
        // Scale logic: baseScale fits the body to this.size. 
        // Config scale is relative to that base.
        const config = parts.config || {
            body: { x: 0, y: 0, scale: 1.0, zIndex: 3, flipY: false, pivotX: 0, pivotY: 0 },
            tail: { x: 88, y: -4, scale: 1.0, zIndex: 5, flipY: false, pivotX: -40, pivotY: 0 },
            dorsalFin: { x: 13, y: -34, scale: 1.0, zIndex: 7, flipY: false, pivotX: 0, pivotY: 30 },
            pectoralFin1: { x: -16, y: 26, scale: 1.0, zIndex: 4, flipY: false, pivotX: 15, pivotY: -10 },
            pectoralFin2: { x: 20, y: 20, scale: 1.0, zIndex: 4, flipY: false, pivotX: 15, pivotY: -10 },
            pelvicFin1: { x: -30, y: 34, scale: 1.0, zIndex: 1, flipY: false, pivotX: 10, pivotY: -10 },
            pelvicFin2: { x: 10, y: 39, scale: 1.0, zIndex: 2, flipY: false, pivotX: 10, pivotY: -10 }
        };

        // Apply night dimming (alpha reduction)
        // Rainbow Spirit stays fully visible (alpha 1.0)
        // Others fade down to 0.8 opacity at peak night
        let targetAlpha = 1.0;
        if (this.species.id !== 'rainbow' && !this.isDead) {
            // Interpolate from 1.0 down to 0.8 based on nightFade (0 to 1)
            targetAlpha = 1.0 - (world.nightFade * 0.2); 
        }

        if (this.isDead) {
            ctx.globalAlpha = 0.6;
        } else {
            ctx.globalAlpha = targetAlpha;
        }

        // Rainbow Glow Effect moved to render after fish parts (in front)

        // Fix orientation: The source images face Left, but standard angle 0 is Right.
        // Flip horizontally so the fish faces the direction of movement.
        ctx.scale(-1, 1);

        const bodyWidth = parts.body.width;
        const bodyHeight = parts.body.height;
        // Base scale: fit the body width/height into the fish size diameter
        // this.size is radius. So diameter is size*2.
        // We scale such that the body fits within size*2.
        // For larger fish (River Lord), we might need to adjust this or ensure config scaling handles it.
        // If River Lord is 4x bigger, this.size is larger, so baseScale increases.
        // Shakiness might be due to sub-pixel rendering of very large scaled images or pivot alignment.
        
        const baseScale = (this.size * 2) / Math.max(bodyWidth, bodyHeight);

        // Calculate animation values (in radians)
        // Scale amplitude by size: Larger fish = Smaller amplitude to look heavier
        // Standard amplitude is 0.2 / 0.1. For River Lord (30), we want maybe 50% of that.
        // Small fish (5) -> factor 1. Large (30) -> factor 2 or 3.
        const ampScale = Math.max(1, this.size / 10);  // Adjusted from /20 for smaller fish
        
        const tailWag = this.isDead ? 0 : Math.sin(this.tailAngle) * (0.2 / Math.sqrt(ampScale)); 
        const finWag = this.isDead ? 0 : Math.cos(this.tailAngle) * (0.1 / Math.sqrt(ampScale)); 

        // Helper to draw a part
        const drawPart = (key, rotation) => {
            const partImg = parts[key];
            const partConfig = config[key];
            
            if (!partImg || !partImg.complete || !partConfig) return;
            
            const scale = baseScale * (partConfig.scale || 1.0);
            const flipY = partConfig.flipY ? -1 : 1;
            
            ctx.save();
            // Move to position relative to center
            ctx.translate(partConfig.x * baseScale, partConfig.y * baseScale);
            
            // Move to pivot point
            ctx.translate(partConfig.pivotX * baseScale, partConfig.pivotY * baseScale);
            
            // Rotate
            ctx.rotate(rotation);
            
            // Move back from pivot point
            ctx.translate(-partConfig.pivotX * baseScale, -partConfig.pivotY * baseScale);
            
            // Flip if needed
            if (partConfig.flipY) {
                ctx.scale(1, -1);
            }

            // Draw image centered at 0,0 (which is now the position set by translate)
            // We assume the config x/y are the center of the image relative to fish center
            ctx.drawImage(
                partImg,
                -partImg.width * scale / 2, 
                -partImg.height * scale / 2,
                partImg.width * scale, 
                partImg.height * scale
            );
            
            ctx.restore();
        };

        // Use pre-sorted keys if available, otherwise default order (or just wait for config)
        const keys = parts.sortedKeys || [
            'pelvicFin1', 'pelvicFin2', 'body', 
            'pectoralFin1', 'pectoralFin2', 'tail', 'dorsalFin'
        ];

        // Draw all parts in order
        for (const key of keys) {
            let rot = 0;
            
            // Skip parts that don't have a config or image to prevent drawing errors
            if (!config[key] || !parts[key]) continue;

            // General logic for rotation based on part type
            if (key === 'tail') rot = tailWag;
            else if (key === 'body') rot = 0;
            // Fin logic: 'Fin 1' usually left/top, 'Fin 2' usually right/bottom
            // For River Lord/Spirit: 
            // Pectoral1/Pelvic2 -> finWag
            // Pectoral2/Pelvic1 -> -finWag
            // Dorsal -> finWag
            else if (key === 'pectoralFin1' || key === 'pelvicFin2' || key === 'dorsalFin') rot = finWag;
            else if (key === 'pectoralFin2' || key === 'pelvicFin1') rot = -finWag;
            else rot = 0;

            drawPart(key, rot);
        }

        // Rainbow Glow Effect - Optimized (Radial Gradient)
        // Rendered IN FRONT of the fish
        if (this.species.id === 'rainbow' && !this.isDead) {
            const time = world.now * 0.002;
            const hue = (time * 50) % 360;
            
            ctx.save();
            ctx.globalCompositeOperation = 'screen'; 
            
            const glowRadius = this.size * 3; 
            const grad = ctx.createRadialGradient(0, 0, this.size * 0.1, 0, 0, glowRadius);
            
            grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.2)`); 
            grad.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }

        ctx.globalAlpha = 1.0;
    }
}

