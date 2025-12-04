export class Ripple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1;
        this.maxRadius = 60;
        this.opacity = 0.6;
        this.speed = 1.5;
    }
    update() {
        this.radius += this.speed;
        this.opacity -= 0.01;
    }
    draw(ctx) {
        if(this.opacity <= 0) return;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.lineWidth = 2;
        ctx.ellipse(this.x, this.y, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

