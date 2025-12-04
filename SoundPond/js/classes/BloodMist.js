import { rand } from '../utils.js';

export class BloodMist {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.age = 0;
        this.maxAge = 600; // 10 seconds at 60fps
        this.particles = [];
        
        // Create a cluster of particles for the mist
        const count = 15;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                vx: rand(-0.2, 0.2),
                vy: rand(-0.2, 0.2),
                ox: rand(-10, 10), // Relative offset
                oy: rand(-10, 10),
                size: rand(10, 25),
                phase: rand(0, Math.PI * 2)
            });
        }
    }

    update() {
        this.age++;
        // Mist expands slowly and drifts
        for(let p of this.particles) {
            p.ox += p.vx;
            p.oy += p.vy;
            // Slight turbulent motion
            p.ox += Math.sin(this.age * 0.02 + p.phase) * 0.1;
        }
    }

    draw(ctx) {
        const lifePct = this.age / this.maxAge;
        const alpha = 1 - lifePct; // Linear fade out
        
        if (alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Blood mist should look like a cloud
        // Using standard blending for visibility
        
        for(let p of this.particles) {
            // Expand over time
            const currentSize = p.size + (this.age * 0.05);
            
            // Use radial gradient to simulate blur/mist softness
            const grad = ctx.createRadialGradient(p.ox, p.oy, 0, p.ox, p.oy, currentSize);
            grad.addColorStop(0, `rgba(220, 60, 60, ${alpha * 0.2})`); 
            grad.addColorStop(1, `rgba(220, 60, 60, 0)`);
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.ox, p.oy, currentSize, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
    
    get isDead() {
        return this.age >= this.maxAge;
    }
}

