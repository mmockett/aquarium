export const rand = (min, max) => Math.random() * (max - min) + min;

export const distSq = (x1, y1, x2, y2) => (x2 - x1)**2 + (y2 - y1)**2;
export const dist = (x1, y1, x2, y2) => Math.sqrt(distSq(x1, y1, x2, y2));

export class Vector {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n) { this.x *= n; this.y *= n; return this; }
    div(n) { if(n!==0) { this.x /= n; this.y /= n; } return this; }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    magSq() { return this.x * this.x + this.y * this.y; }
    normalize() {
        let m = this.mag();
        if (m !== 0) this.mult(1/m);
        return this;
    }
    limit(max) {
        if (this.magSq() > max * max) {
            this.normalize();
            this.mult(max);
        }
        return this;
    }
    static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
    static distSq(v1, v2) {
        let dx = v1.x - v2.x;
        let dy = v1.y - v2.y;
        return dx*dx + dy*dy;
    }
}

export class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    getKey(x, y) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    clear() {
        this.grid.clear();
    }

    add(client) {
        const key = this.getKey(client.pos.x, client.pos.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key).push(client);
    }

    getNearby(client) {
        const keys = [];
        const cx = Math.floor(client.pos.x / this.cellSize);
        const cy = Math.floor(client.pos.y / this.cellSize);

        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let y = cy - 1; y <= cy + 1; y++) {
                keys.push(`${x},${y}`);
            }
        }

        let results = [];
        for (let key of keys) {
            if (this.grid.has(key)) {
                results = results.concat(this.grid.get(key));
            }
        }
        return results;
    }
}

// --- Gemini API Integration ---
const apiKey = ""; // Injected by environment

export async function callGemini(prompt) {
    if (!apiKey) return null; 

    const delays = [1000, 2000, 4000];
    
    for (let attempt = 0; attempt <= 2; attempt++) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        } catch (e) {
            console.warn("Gemini API attempt failed, using fallback later.");
            await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
    }
    return null;
}

// Simple Box Blur for legacy support (iOS < 16 etc)
// Based on Quasimondo's StackBlur (simplified)
export function applyManualBlur(ctx, width, height, radius) {
    if (radius < 1) return;
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    
    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            let count = 0;
            
            for (let k = -radius; k <= radius; k++) {
                const px = Math.min(width - 1, Math.max(0, x + k));
                const idx = (y * width + px) * 4;
                r += pixels[idx];
                g += pixels[idx + 1];
                b += pixels[idx + 2];
                a += pixels[idx + 3];
                count++;
            }
            
            const idx = (y * width + x) * 4;
            pixels[idx] = r / count;
            pixels[idx + 1] = g / count;
            pixels[idx + 2] = b / count;
            pixels[idx + 3] = a / count;
        }
    }
    
    // Vertical pass
    const temp = new Uint8ClampedArray(pixels);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let r = 0, g = 0, b = 0, a = 0;
            let count = 0;
            
            for (let k = -radius; k <= radius; k++) {
                const py = Math.min(height - 1, Math.max(0, y + k));
                const idx = (py * width + x) * 4;
                r += temp[idx];
                g += temp[idx + 1];
                b += temp[idx + 2];
                a += temp[idx + 3];
                count++;
            }
            
            const idx = (y * width + x) * 4;
            pixels[idx] = r / count;
            pixels[idx + 1] = g / count;
            pixels[idx + 2] = b / count;
            pixels[idx + 3] = a / count;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

