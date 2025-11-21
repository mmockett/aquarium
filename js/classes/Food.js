import { Vector, rand } from '../utils.js';
import { CONFIG } from '../config.js';

export class Food {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.acc = new Vector(0, CONFIG.physics.foodGravity * 0.1);
        this.size = 4;
        this.eaten = false;
        
        this.wobbleSpeed = rand(0.002, 0.005);
        this.wobbleDist = rand(0.2, 0.6);
        this.timeOffset = rand(0, 1000);
    }
    update(height) {
        this.vel.add(this.acc);
        this.vel.mult(0.95); 
        this.pos.add(this.vel);
        
        this.pos.x += Math.sin(Date.now() * this.wobbleSpeed + this.timeOffset) * this.wobbleDist;
        
        if (this.pos.y > height) this.eaten = true; 
    }
    draw(ctx) {
        ctx.fillStyle = CONFIG.colors.food;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

