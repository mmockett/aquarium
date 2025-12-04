// SoundCloud Player Service
// Handles fetching and playing tracks using SoundCloud Widget API

import { soundCloudAuth } from './SoundCloudAuth.js';

class SoundCloudPlayer {
    constructor() {
        this.widget = null;
        this.iframe = null;
        this.currentTrack = null;
        this.isPlaying = false;
        this.onTrackChange = null;
        this.onPlayStateChange = null;
        this.artistTracksCache = new Map(); // Cache artist tracks
    }

    // Initialize the player (create hidden iframe)
    init() {
        if (this.iframe) return;
        
        // Create container for player UI
        this.createPlayerUI();
        
        console.log('SoundCloud Player initialized');
    }

    // Create the player UI
    createPlayerUI() {
        // Create player container
        const container = document.createElement('div');
        container.id = 'scPlayerContainer';
        container.className = 'sc-player-container';
        container.innerHTML = `
            <div class="sc-player-content">
                <img id="scPlayerArtwork" class="sc-player-artwork" src="" alt="">
                <div class="sc-player-info">
                    <div class="sc-player-title" id="scPlayerTitle">Not Playing</div>
                    <div class="sc-player-artist" id="scPlayerArtist"></div>
                </div>
                <div class="sc-player-controls">
                    <button id="scPlayerPlayPause" class="sc-player-btn">
                        <i data-lucide="play" class="icon-sm" id="scPlayerIcon"></i>
                    </button>
                    <button id="scPlayerClose" class="sc-player-btn sc-player-close">
                        <i data-lucide="x" class="icon-sm"></i>
                    </button>
                </div>
            </div>
            <iframe id="scWidgetIframe" 
                    width="100%" 
                    height="0" 
                    scrolling="no" 
                    frameborder="no"
                    allow="autoplay"
                    style="display:none;">
            </iframe>
        `;
        document.body.appendChild(container);

        // Set up event listeners
        document.getElementById('scPlayerPlayPause').addEventListener('click', () => this.togglePlay());
        document.getElementById('scPlayerClose').addEventListener('click', () => this.hide());
        
        this.iframe = document.getElementById('scWidgetIframe');
    }

    // Fetch latest track for an artist
    async getLatestTrack(artistId) {
        // Check cache first
        if (this.artistTracksCache.has(artistId)) {
            const cached = this.artistTracksCache.get(artistId);
            if (Date.now() - cached.time < 5 * 60 * 1000) { // 5 min cache
                return cached.track;
            }
        }

        try {
            const response = await soundCloudAuth.apiRequest(
                `/users/${artistId}/tracks?limit=1&linked_partitioning=false`
            );
            
            const tracks = response.collection || response;
            const latestTrack = tracks[0] || null;
            
            // Cache result
            this.artistTracksCache.set(artistId, {
                track: latestTrack,
                time: Date.now()
            });
            
            return latestTrack;
        } catch (e) {
            console.error('Failed to fetch artist tracks:', e);
            return null;
        }
    }

    // Play a track
    async playTrack(track) {
        if (!track || !track.permalink_url) {
            console.error('Invalid track');
            return false;
        }

        this.init();
        this.currentTrack = track;
        
        // Update UI
        this.updatePlayerUI(track);
        this.show();

        // Load track in widget
        const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(track.permalink_url)}&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&show_playcount=false&show_user=false&hide_related=true&visual=false&callback=true`;
        
        this.iframe.src = widgetUrl;
        
        // Initialize widget API once loaded
        this.iframe.onload = () => {
            if (window.SC && window.SC.Widget) {
                this.widget = SC.Widget(this.iframe);
                
                this.widget.bind(SC.Widget.Events.READY, () => {
                    this.widget.play();
                    this.isPlaying = true;
                    this.updatePlayButton();
                });
                
                this.widget.bind(SC.Widget.Events.PLAY, () => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                });
                
                this.widget.bind(SC.Widget.Events.PAUSE, () => {
                    this.isPlaying = false;
                    this.updatePlayButton();
                });
                
                this.widget.bind(SC.Widget.Events.FINISH, () => {
                    this.isPlaying = false;
                    this.updatePlayButton();
                });
            }
        };

        return true;
    }

    // Play latest track from an artist
    async playArtistLatest(artistId, artistName) {
        const track = await this.getLatestTrack(artistId);
        
        if (!track) {
            console.warn(`No tracks found for artist ${artistName}`);
            return false;
        }

        console.log(`Playing: ${track.title} by ${artistName}`);
        return this.playTrack(track);
    }

    // Update player UI
    updatePlayerUI(track) {
        const artwork = document.getElementById('scPlayerArtwork');
        const title = document.getElementById('scPlayerTitle');
        const artist = document.getElementById('scPlayerArtist');
        
        if (artwork) {
            // Use larger artwork if available
            const artworkUrl = track.artwork_url 
                ? track.artwork_url.replace('-large', '-t300x300')
                : 'assets/app/Icon.png';
            artwork.src = artworkUrl;
        }
        if (title) title.textContent = track.title || 'Unknown Track';
        if (artist) artist.textContent = track.user?.username || '';
    }

    // Update play/pause button
    updatePlayButton() {
        const icon = document.getElementById('scPlayerIcon');
        if (icon) {
            icon.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
            // Refresh lucide icons
            if (window.lucide) lucide.createIcons();
        }
    }

    // Toggle play/pause
    togglePlay() {
        if (!this.widget) return;
        
        if (this.isPlaying) {
            this.widget.pause();
        } else {
            this.widget.play();
        }
    }

    // Show player
    show() {
        const container = document.getElementById('scPlayerContainer');
        if (container) container.classList.add('show');
    }

    // Hide player
    hide() {
        const container = document.getElementById('scPlayerContainer');
        if (container) container.classList.remove('show');
        
        if (this.widget) {
            this.widget.pause();
        }
        this.isPlaying = false;
        this.updatePlayButton();
    }

    // Check if player is visible
    isVisible() {
        const container = document.getElementById('scPlayerContainer');
        return container && container.classList.contains('show');
    }
}

// Export singleton
export const soundCloudPlayer = new SoundCloudPlayer();

