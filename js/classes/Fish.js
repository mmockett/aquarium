import { Vector, rand, distSq, callGemini } from '../utils.js';
import { CONFIG, FALLBACK_NAMES, FALLBACK_PHRASES } from '../config.js';

export class Fish {
    constructor(type, isBorn = false, width, height) {
        this.species = type;
        this.name = "Spirit"; 
        this.pos = new Vector(rand(100, width - 100), rand(100, height - 100));
        this.vel = new Vector(rand(-1, 1), rand(-1, 1));
        this.acc = new Vector(0, 0);
        this.angle = Math.random() * Math.PI * 2;
        
        this.maxSpeed = type.speed;
        this.maxForce = 0.1; 
        this.size = type.size;
        
        this.birthTime = Date.now();
        
        if (this.species.isPredator) {
            this.lifespan = rand(10 * 60 * 1000, 30 * 60 * 1000);
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
        
        this.huntingCooldown = this.species.isPredator ? rand(120 * 1000, 180 * 1000) : 0;

        this.tailAngle = 0;
        this.tailSpeed = 0.2;
        
        this.chatText = null;
        this.chatTimer = 0;
        this.isTalking = false;

        this.romanceTarget = null; 
        this.huntingTarget = null;
        this.tantrumTarget = null; 

        this.aiOffset = Math.floor(Math.random() * 3);

        if (!isBorn) {
            this.birthTime -= 120 * 1000;
            this.lastReproductionTime = 0; 
        } else {
            this.lastReproductionTime = Date.now(); 
        }

        this.childrenCount = 0; // Track number of offspring

        this.generateName();
    }

    async generateName() {
        const prompt = `Generate a single, short, whimsical, Studio Ghibli-style name for a water spirit that looks like a ${this.species.name}. It should be unique and sound magical. Return ONLY the name, no other text.`;
        const newName = await callGemini(prompt);
        if (newName) this.name = newName;
        else this.name = FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
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
        
        world.showToast(`New Spirits! ${this.name} and ${mate.name} welcome ${numOffspring} babies.`);
        world.sound.playChime(); 

        for (let i = 0; i < numOffspring; i++) {
            const child = new Fish(this.species, true, world.width, world.height);
            child.pos = new Vector(spawnPos.x + rand(-5,5), spawnPos.y + rand(-5,5)); 
            child.size = this.species.size * 0.2; 
            child.maxSpeed *= 1.5; 
            child.lastReproductionTime = Date.now() + rand(5 * 60 * 1000, 10 * 60 * 1000);
            world.fishes.push(child);
            
            for(let j=0; j<8; j++) {
                if(world.particles.length < 200) {
                    world.particles.push({
                        x: spawnPos.x, y: spawnPos.y,
                        vx: rand(-2,2), vy: rand(-2,2),
                        life: 1.0, color: '#A4DDBB' 
                    });
                }
            }
        }

        const cooldown = rand(5 * 60 * 1000, 10 * 60 * 1000);
        this.lastReproductionTime = Date.now() + cooldown;
        mate.lastReproductionTime = Date.now() + cooldown;
        
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
        
        const desiredSeparationSq = (40 + this.size)**2;
        const neighborDistSq = 100**2;
        
        let closestPrey = null;
        let closestPreyDistSq = Infinity;
        const huntRangeSq = 250**2;
        
        let fleeVector = new Vector(0, 0);
        const fleeRangeSq = 150**2;
        
        let nearestRival = null;
        let nearestRivalDistSq = Infinity;
        const tantrumRangeSq = 200**2;

        const amPredator = this.species.isPredator;
        const amPrey = !amPredator;

        const nearbyFish = world.spatialGrid.getNearby(this);

        for (let other of nearbyFish) {
            if (other === this || other.isDead) continue;
            
            let dSq = Vector.distSq(this.pos, other.pos);

            if (dSq < neighborDistSq) {
                if (dSq < desiredSeparationSq) {
                    let diff = Vector.sub(this.pos, other.pos);
                    diff.normalize();
                    diff.div(Math.sqrt(dSq) || 0.1); 
                    sep.add(diff);
                    sepCount++;
                }
                
                if (other.species.id === this.species.id) {
                     let alignVel = new Vector(other.vel.x, other.vel.y);
                     ali.add(alignVel);
                     aliCount++;
                     
                     let cohPos = new Vector(other.pos.x, other.pos.y);
                     coh.add(cohPos);
                     cohCount++;
                }
            }
            
            if (amPredator) {
                const isHungry = (Date.now() - this.lastAteTime) > this.huntingCooldown;

                if (isHungry) {
                    if (other.species.isPredator) {
                        if (dSq < tantrumRangeSq && dSq < nearestRivalDistSq) {
                            nearestRival = other;
                            nearestRivalDistSq = dSq;
                        }
                    } 
                    else if (other.size < this.size * 0.6) {
                        if (dSq < (this.size * 0.8)**2) {
                            if (dSq < closestPreyDistSq && dSq < huntRangeSq) {
                                closestPreyDistSq = dSq;
                                closestPrey = other;
                            }
                        } else if (dSq < huntRangeSq && dSq < closestPreyDistSq) {
                            closestPreyDistSq = dSq;
                            closestPrey = other;
                        }
                    }
                }
            }
            
            if (amPrey && other.species.isPredator) {
                if (dSq < fleeRangeSq) {
                    let diff = Vector.sub(this.pos, other.pos);
                    diff.normalize();
                    fleeVector.add(diff);
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
             
             if (sepCount > 0) {
                sep.div(sepCount); sep.normalize(); sep.mult(this.maxSpeed); sep.sub(this.vel); sep.limit(this.maxForce * 2.0);
                this.acc.add(sep.mult(1.5));
            }
            if (aliCount > 0) {
                ali.div(aliCount); ali.normalize(); ali.mult(this.maxSpeed); ali.sub(this.vel); ali.limit(this.maxForce);
                this.acc.add(ali.mult(1.0));
            }
            if (cohCount > 0) {
                coh.div(cohCount);
                let desired = Vector.sub(coh, this.pos);
                desired.normalize(); desired.mult(this.maxSpeed);
                let steer = Vector.sub(desired, this.vel); steer.limit(this.maxForce);
                this.acc.add(steer.mult(1.0));
            }

            if (amPredator && closestPrey) {
                 this.huntingTarget = closestPrey; 
                 let desired = Vector.sub(closestPrey.pos, this.pos);
                 desired.normalize();
                 desired.mult(this.maxSpeed * 1.2);
                 let steer = Vector.sub(desired, this.vel);
                 steer.limit(this.maxForce * 1.5);
                 this.acc.add(steer);
            }
        }

        if (amPrey && (fleeVector.x !== 0 || fleeVector.y !== 0)) {
            if (Date.now() - this.lastAteTime < 20000) {
                fleeVector.normalize();
                fleeVector.mult(this.maxSpeed * 2.0); 
                let steer = Vector.sub(fleeVector, this.vel);
                steer.limit(this.maxForce * 3.0);
                this.acc.add(steer);
                
                if (Math.random() < 0.2 && world.particles.length < 200) {
                     world.particles.push({
                        x: this.pos.x, y: this.pos.y,
                        vx: rand(-1,1), vy: rand(-1,1),
                        life: 0.5, color: '#fff'
                     });
                }
            }
        }
    }

    update(world, frameCount) {
        if (!this.isDead) {
            this.energy -= 0.006;
            if (this.digestionSlowdown < 1.0) this.digestionSlowdown += 0.002;
            
            // Decrement full cooldown
            if (this.fullCooldown > 0) {
                this.fullCooldown -= 16.6; // Approx 60fps frame time
            }

            if (frameCount % 60 === 0) {
                let mateChance = 0.02; 
                if (this.species.isPredator) mateChance = 0.002; 

                if (Math.random() < mateChance && world.fishes.length <= 50) {
                     const maturityAge = 60 * 1000;
                     const minCooldown = 5 * 60 * 1000;
                     
                     if (!this.romanceTarget && 
                         Date.now() - this.birthTime > maturityAge &&
                         Date.now() - this.lastReproductionTime > minCooldown && 
                         this.energy >= 80) {
                         
                         let potentialMate = world.fishes.find(other => 
                            other !== this && 
                            other.species.id === this.species.id && 
                            other.energy >= 80 && 
                            Date.now() - other.birthTime > maturityAge && 
                            Date.now() - other.lastReproductionTime > minCooldown &&
                            distSq(this.pos.x, this.pos.y, other.pos.x, other.pos.y) < 200**2 
                         );
                         if (potentialMate) this.romanceTarget = potentialMate;
                     }
                }
            }

            if (this.romanceTarget) {
                 if (this.romanceTarget.isDead || this.energy < 80 || Vector.distSq(this.pos, this.romanceTarget.pos) > 300**2) {
                     this.romanceTarget = null;
                 }
            }

            if (Date.now() - this.birthTime > this.lifespan || this.energy <= 0) {
                this.isDead = true;
                this.deathReason = this.energy <= 0 ? "Starved" : "Old Age";
            }
            if (Math.random() < 0.0000001) {
                this.isDead = true;
                this.deathReason = "Sudden Illness";
            }
        }

        if (this.species.isPredator && this.huntingTarget && !this.tantrumTarget) {
            if (this.huntingTarget.isDead || Vector.distSq(this.pos, this.huntingTarget.pos) > 400**2) {
                this.huntingTarget = null;
            } else if (Vector.distSq(this.pos, this.huntingTarget.pos) < (this.size * 0.8)**2) {
                this.huntingTarget.isDead = true;
                this.huntingTarget.deathReason = `Eaten by ${this.name}`;
                this.huntingTarget.isEaten = true;
                this.feed(world);
                world.sound.playBloop(0.5); 
                this.huntingTarget = null;
            }
        } else if (this.tantrumTarget) {
            this.huntingTarget = null;
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
        let searchRadSq = 300**2;

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
            this.seek(target);
        } else if (this.romanceTarget) {
            this.seek(this.romanceTarget.pos);
            if (distSq(this.pos.x, this.pos.y, this.romanceTarget.pos.x, this.romanceTarget.pos.y) < (this.size + this.romanceTarget.size)**2) {
                 this.reproduce(this.romanceTarget, world);
            }
        } else {
            if (frameCount % 3 === this.aiOffset) {
                this.computeBehaviors(world);
                this.wander(); 
                this.boundaries(world.width, world.height);
            }
        }

        this.vel.add(this.acc);
        
        let dToMouseSq = Vector.distSq(this.pos, world.mousePos);
        let speedMod = 1;
        
        if (world.isTalkMode && dToMouseSq < 150**2) {
            speedMod = 0.3;
        }

        let energyFactor = Math.max(0.2, this.energy / this.maxEnergy);
        speedMod *= energyFactor;
        speedMod *= this.digestionSlowdown;

        this.vel.limit(this.maxSpeed * (target ? 1.5 : 1) * speedMod);
        this.pos.add(this.vel);
        
        this.acc.mult(0); 

        if (this.pos.x < this.size) { this.pos.x = this.size; this.vel.x *= -0.8; }
        if (this.pos.x > world.width - this.size) { this.pos.x = world.width - this.size; this.vel.x *= -0.8; }
        if (this.pos.y < this.size) { this.pos.y = this.size; this.vel.y *= -0.8; }
        if (this.pos.y > world.height - this.size) { this.pos.y = world.height - this.size; this.vel.y *= -0.8; }
        
        let desiredAngle = Math.atan2(this.vel.y, this.vel.x);
        let diff = desiredAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * CONFIG.physics.turnSpeed;

        let speedPct = this.vel.mag() / (this.maxSpeed || 1);
        this.tailSpeed = 0.1 + (speedPct * 0.3);
        this.tailAngle += this.tailSpeed;

        return 'alive';
    }

    seek(target) {
        let desired = new Vector(target.x - this.pos.x, target.y - this.pos.y);
        desired.normalize();
        desired.mult(this.maxSpeed);
        let steer = Vector.sub(desired, this.vel);
        steer.limit(this.maxForce);
        this.acc.add(steer);
    }

    wander() {
        let wanderR = 50;
        let wanderD = 100;
        let circlePos = new Vector(this.vel.x, this.vel.y);
        circlePos.normalize();
        circlePos.mult(wanderD);
        circlePos.add(this.pos);
        let t = Date.now() * 0.001 + this.pos.x; 
        let h = Math.sin(t) * wanderR;
        let target = new Vector(circlePos.x + Math.cos(t)*20, circlePos.y + h);
        this.seek(target);
    }

    boundaries(width, height) {
        let margin = 100;
        let desired = null;
        if (this.pos.x < margin) desired = new Vector(this.maxSpeed, this.vel.y);
        else if (this.pos.x > width - margin) desired = new Vector(-this.maxSpeed, this.vel.y);
        if (this.pos.y < margin) desired = new Vector(this.vel.x, this.maxSpeed);
        else if (this.pos.y > height - margin) desired = new Vector(this.vel.x, -this.maxSpeed);
        if (desired) {
            desired.normalize();
            desired.mult(this.maxSpeed);
            let steer = Vector.sub(desired, this.vel);
            steer.limit(this.maxForce * 2);
            this.acc.add(steer);
        }
    }

    feed(world) {
        if (this.isDead) return;
        world.onScoreUpdate(15); 
        this.energy = Math.min(this.maxEnergy, this.energy + 30);
        this.digestionSlowdown = 0.5; 
        this.lastAteTime = Date.now(); 
        
        // Set a random cooldown between 5 and 30 seconds
        this.fullCooldown = rand(5000, 30000);

        const maxSize = this.species.size * 3.0; 
        if (this.size < maxSize) {
            this.size += 0.8; 
            this.maxSpeed = Math.max(this.species.speed * 0.5, this.maxSpeed - 0.02);
        }

        for(let i=0; i<5; i++) {
            if (world.particles.length < 200) {
                world.particles.push({
                    x: this.pos.x, y: this.pos.y,
                    vx: rand(-1,1), vy: rand(-1,1),
                    life: 1.0, color: '#fff'
                });
            }
        }
    }

    draw(ctx, isTalkMode, mousePos) {
        if (this.isDead && this.isEaten) return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Calculate if hovered
        let isHovered = false;
        if (isTalkMode && mousePos) {
            const dSq = distSq(this.pos.x, this.pos.y, mousePos.x, mousePos.y);
            if (dSq < (this.size + 20)**2) {
                isHovered = true;
            }
        }

        if (this.chatText && !this.isDead && this.size > 0) {
            ctx.save();
            ctx.translate(0, -this.size * 2 - 20);
            ctx.font = "16px 'Patrick Hand'";
            let metrics = ctx.measureText(this.chatText);
            let w = metrics.width + 20;
            let h = 30;
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.beginPath();
            ctx.roundRect(-w/2, -h/2, w, h, 10);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-5, h/2);
            ctx.lineTo(5, h/2);
            ctx.lineTo(0, h/2 + 6);
            ctx.fill();
            ctx.fillStyle = "#333";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.chatText, 0, 0);
            ctx.restore();
        }

        // Draw detailed stats on hover in Talk Mode
        if (isHovered && !this.isDead && this.size > 0) {
            ctx.save();
            // Position below the name
            ctx.translate(0, this.size + 40);
            
            // Hunger Status
            let hungerStatus = "Full";
            let hungerColor = "#4ADE80"; // Green
            if (this.energy < 30) {
                hungerStatus = "Starving";
                hungerColor = "#EF4444"; // Red
            } else if (this.energy < 70) {
                hungerStatus = "Hungry";
                hungerColor = "#FCD34D"; // Yellow
            }

            // Parent Status
            const parentStatus = this.childrenCount > 0 ? "Parent" : "";

            // Draw Background for stats
            const statsText = `${hungerStatus}${parentStatus ? ' • ' + parentStatus : ''}`;
            ctx.font = "bold 12px 'Patrick Hand'";
            const metrics = ctx.measureText(statsText);
            const bgW = metrics.width + 16;
            const bgH = 20;

            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.beginPath();
            ctx.roundRect(-bgW/2, -bgH/2, bgW, bgH, 10);
            ctx.fill();

            // Draw Text
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            if (parentStatus) {
                const fullWidth = metrics.width;
                const startX = -fullWidth / 2;
                
                ctx.textAlign = "left";
                ctx.fillStyle = hungerColor;
                ctx.fillText(hungerStatus, startX, 0);
                
                const hungerWidth = ctx.measureText(hungerStatus).width;
                
                ctx.fillStyle = "#fff";
                ctx.fillText(" • ", startX + hungerWidth, 0);
                
                const separatorWidth = ctx.measureText(" • ").width;
                
                ctx.fillStyle = "#60A5FA";
                ctx.fillText(parentStatus, startX + hungerWidth + separatorWidth, 0);
            } else {
                ctx.fillStyle = hungerColor;
                ctx.fillText(hungerStatus, 0, 0);
            }

            ctx.restore();
        }

        ctx.rotate(this.angle);

        let bodyColor = this.species.colorBody;
        let finColor = this.species.colorFin;

        if (this.isDead) {
            ctx.globalAlpha = 0.6;
            bodyColor = '#555'; // Manual grayscale
            finColor = '#333';
        } else if (this.species.id === 'rainbow') {
            const time = Date.now() * 0.002;
            const grad = ctx.createLinearGradient(-this.size, 0, this.size, 0);
            grad.addColorStop(0, `hsl(${(time * 50) % 360}, 100%, 50%)`);
            grad.addColorStop(1, `hsl(${(time * 50 + 180) % 360}, 100%, 50%)`);
            bodyColor = grad;
            finColor = `hsl(${(time * 50 + 90) % 360}, 100%, 70%)`;
        }

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.isDead) {
             ctx.strokeStyle = '#333';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(this.size*0.3, -this.size*0.3);
             ctx.lineTo(this.size*0.5, -this.size*0.1);
             ctx.moveTo(this.size*0.5, -this.size*0.3);
             ctx.lineTo(this.size*0.3, -this.size*0.1);
             ctx.stroke();
        } else {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(this.size * 0.4, -this.size * 0.2, this.size * 0.25, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(this.size * 0.5, -this.size * 0.2, this.size * 0.1, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.fillStyle = finColor;
        let tailWag = this.isDead ? 0 : Math.sin(this.tailAngle) * (this.size * 0.5);
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.8, 0);
        if (this.species.finType === 'flowing') {
            ctx.bezierCurveTo(-this.size * 1.5, tailWag, -this.size * 2.5, -this.size * 0.5 + tailWag, -this.size * 2.8, tailWag);
            ctx.bezierCurveTo(-this.size * 2.5, this.size * 0.5 + tailWag, -this.size * 1.5, tailWag, -this.size * 0.8, 0);
        } else {
            ctx.lineTo(-this.size * 1.8, -this.size * 0.6 + tailWag);
            ctx.lineTo(-this.size * 1.8, this.size * 0.6 + tailWag);
        }
        ctx.fill();

        ctx.fillStyle = finColor; 
        ctx.globalAlpha = this.isDead ? 0.4 : 0.8;
        ctx.beginPath();
        let finWag = this.isDead ? 0 : Math.cos(this.tailAngle) * 5;
        ctx.moveTo(0, this.size * 0.3);
        ctx.quadraticCurveTo(-this.size * 0.5, this.size + finWag, 0, this.size * 0.8);
        ctx.fill();

        if (this.species.finType !== 'simple') {
            ctx.beginPath();
            ctx.moveTo(0, -this.size * 0.5);
            ctx.quadraticCurveTo(-this.size, -this.size * 1.2, this.size * 0.2, -this.size * 0.5);
            ctx.fill();
        }

        if (isTalkMode && !this.isDead && this.size > 0) {
            ctx.rotate(-this.angle);
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.font = "bold 14px 'Patrick Hand'";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillText(this.name, 1, this.size + 21);
            ctx.fillStyle = "white";
            ctx.fillText(this.name, 0, this.size + 20);
        }

        ctx.restore();
    }
}

