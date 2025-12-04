import { rand } from '../utils.js';

export class Bubble {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.reset();
        this.y = rand(height, height + 200);
    }
    reset() {
        this.x = rand(0, this.width);
        this.y = this.height + 10;
        this.size = rand(1, 4);
        this.speed = rand(0.5, 2);
        this.wobble = rand(0, Math.PI * 2);
    }
    update() {
        this.y -= this.speed;
        this.x += Math.sin(Date.now() * 0.002 + this.wobble) * 0.5;
        if (this.y < -10) this.reset();
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

