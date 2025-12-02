export class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isEnabled = true; // Sound enabled by default
        
        // Audio buffers (loaded from MP3 files)
        this.buffers = {};
        
        // Ambient audio
        this.ambienceNode = null;
        this.ambienceGain = null;
        
        // Throttling
        this.lastPlayTime = {};
        
        // Sound file paths
        this.soundFiles = {
            ocean: 'assets/sounds/Ocean noise.mp3',
            fishSplash: 'assets/sounds/Fish adding to water.mp3',
            babyBorn: 'assets/sounds/Baby born.mp3',
            predatorDart: 'assets/sounds/Predator darting.mp3'
        };
        
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

    async init() {
        if (this.ctx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isEnabled ? 0.6 : 0.0;
        this.masterGain.connect(this.ctx.destination);
        
        // Load all sound files
        await this.loadSounds();
        
        // Start ambient ocean sound
        this.startAmbience();
    }

    async loadSounds() {
        const loadPromises = Object.entries(this.soundFiles).map(async ([name, path]) => {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.warn(`Failed to load sound: ${name}`, e);
            }
        });
        
        await Promise.all(loadPromises);
    }

    startAmbience() {
        if (this.ambienceNode || !this.buffers.ocean) return;
        
        // Create gain node for ambient volume control
        this.ambienceGain = this.ctx.createGain();
        this.ambienceGain.gain.value = 0.4; // Ambient at 40% of master
        this.ambienceGain.connect(this.masterGain);
        
        // Create and start looping ocean sound
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.ocean;
        source.loop = true;
        source.connect(this.ambienceGain);
        source.start();
        
        this.ambienceNode = source;
    }

    stopAmbience() {
        if (this.ambienceNode) {
            this.ambienceNode.stop();
            this.ambienceNode = null;
        }
    }

    playSound(bufferName, volume = 1.0, throttleMs = 50) {
        if (!this.isEnabled || !this.ctx || !this.buffers[bufferName]) return;

        // Per-sound throttle
        const now = Date.now();
        if (this.lastPlayTime[bufferName] && now - this.lastPlayTime[bufferName] < throttleMs) {
            return;
        }
        this.lastPlayTime[bufferName] = now;

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[bufferName];

        const gain = this.ctx.createGain();
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(this.masterGain);
        source.start();
    }

    // === Public Sound Methods ===
    
    // Play when fish is purchased/added to aquarium
    playFishSplash() {
        this.playSound('fishSplash', 0.7, 100);
    }
    
    // Play when a baby is born
    playBabyBorn() {
        this.playSound('babyBorn', 0.3, 100); // 50% volume as per Swift version
    }
    
    // Play when predator darts at prey
    playPredatorDart() {
        this.playSound('predatorDart', 0.5, 200);
    }
    
    // Legacy methods for compatibility - map to new sounds
    playChime() {
        this.playFishSplash();
    }
    
    playBloop(pitch = 1.0) {
        // For food drops, use a quieter fish splash or skip
        // This was used for food drops - we can keep it silent or use a subtle sound
        this.playSound('fishSplash', 0.2, 100);
    }
    
    playDeathToll() {
        // No death sound file provided - keep silent for now
        // Could add a subtle sound later
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.savePreference();
        
        if (!this.ctx) {
            if (enabled) this.init();
            return;
        }
        
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Fade in/out over 0.5 seconds
        const targetVolume = enabled ? 0.6 : 0.0;
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
