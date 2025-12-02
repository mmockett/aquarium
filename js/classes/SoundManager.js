export class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isEnabled = true; // Sound enabled by default
        
        // Buffers
        this.buffers = {
            bloop: null,
            chime: null,
            death: null,
            ambience: null
        };
        
        this.ambienceNode = null;
        this.lastPlayTime = 0;
        
        // Load saved preference
        this.loadPreference();
    }

    loadPreference() {
        try {
            const saved = localStorage.getItem('spiritAquarium_soundEnabled');
            if (saved !== null) {
                this.isEnabled = saved === 'true';
            }
        } catch (e) {
            console.warn('Failed to load sound preference:', e);
        }
    }

    savePreference() {
        try {
            localStorage.setItem('spiritAquarium_soundEnabled', this.isEnabled.toString());
        } catch (e) {
            console.warn('Failed to save sound preference:', e);
        }
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isEnabled ? 0.4 : 0.0;
        this.masterGain.connect(this.ctx.destination);
        
        // Generate all sound buffers once
        this.generateBuffers();
        
        this.startAmbience();
    }

    generateBuffers() {
        const sr = this.ctx.sampleRate;
        
        // 1. Bloop Buffer (Sine sweep)
        const bloopLen = 0.15;
        const bloopBuf = this.ctx.createBuffer(1, bloopLen * sr, sr);
        const bData = bloopBuf.getChannelData(0);
        for(let i=0; i<bData.length; i++) {
            const t = i / sr;
            // Frequency sweep down
            const freq = 600 - (t * 3000); 
            // Envelope
            const env = 1 - (t / bloopLen);
            bData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
        }
        this.buffers.bloop = bloopBuf;

        // 2. Chime Buffer (Simple chord)
        const chimeLen = 1.5;
        const chimeBuf = this.ctx.createBuffer(1, chimeLen * sr, sr);
        const cData = chimeBuf.getChannelData(0);
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        for(let i=0; i<cData.length; i++) {
            let sample = 0;
            const t = i / sr;
            freqs.forEach((f, idx) => {
                // Staggered entry
                if(t > idx * 0.05) {
                    sample += Math.sin(2 * Math.PI * f * t) * 0.1;
                }
            });
            // Exp decay
            cData[i] = sample * Math.exp(-3 * t);
        }
        this.buffers.chime = chimeBuf;

        // 3. Ambience Buffer (Brown Noise Loop - 2 seconds)
        const ambLen = 2.0;
        const ambBuf = this.ctx.createBuffer(1, ambLen * sr, sr);
        const aData = ambBuf.getChannelData(0);
        let lastOut = 0;
        for(let i=0; i<aData.length; i++) {
            const white = Math.random() * 2 - 1;
            aData[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = aData[i];
            aData[i] *= 3.5; 
        }
        this.buffers.ambience = ambBuf;
        
        // 4. Death Toll (Low Rumble)
        const dLen = 1.0;
        const dBuf = this.ctx.createBuffer(1, dLen * sr, sr);
        const dData = dBuf.getChannelData(0);
        for(let i=0; i<dData.length; i++) {
            const t = i/sr;
            // Low frequency with noise
            dData[i] = (Math.sin(2 * Math.PI * 60 * t) + (Math.random()*0.2)) * (1 - t/dLen);
        }
        this.buffers.death = dBuf;
    }

    startAmbience() {
        if(this.ambienceNode) return;
        
        // Lowpass Filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.buffers.ambience;
        noise.loop = true;
        
        noise.connect(filter);
        filter.connect(this.masterGain);
        noise.start();
        this.ambienceNode = noise;
    }

    playSound(bufferName, rate = 1.0, volume = 1.0) {
        if (!this.isEnabled || !this.ctx) return;

        // Global throttle: Max 1 sound per 50ms
        const now = Date.now();
        if (now - this.lastPlayTime < 50) return;
        this.lastPlayTime = now;

        const buf = this.buffers[bufferName];
        if (!buf) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buf;
        source.playbackRate.value = rate;

        const gain = this.ctx.createGain();
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(this.masterGain);
        source.start();
    }

    playBloop(pitch = 1.0) { this.playSound('bloop', pitch, 0.3); }
    playChime() { this.playSound('chime', 1.0, 0.4); }
    playDeathToll() { this.playSound('death', 1.0, 0.5); }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.savePreference();
        
        if (!this.ctx) {
            if (enabled) this.init();
            return;
        }
        
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        // Fade in/out over 0.5 seconds
        const targetVolume = enabled ? 0.4 : 0.0;
        this.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.15);
    }

    toggle() {
        this.setEnabled(!this.isEnabled);
        return this.isEnabled;
    }

    // Auto-start sound on first user interaction (required by browsers)
    autoStart() {
        if (!this.ctx) {
            this.init();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
}
