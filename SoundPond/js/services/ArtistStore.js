// Artist Store - Manages artist fish data and persistence
// Bridges SoundCloud data with the aquarium fish system

import { soundCloudAPI } from './SoundCloudAPI.js';
import { soundCloudAuth } from './SoundCloudAuth.js';

const STORAGE_KEY = 'soundpond_artists';

class ArtistStore {
    constructor() {
        this.artists = new Map(); // artistId -> artist data
        this.lastSync = null;
        this.meta = null; // Metadata from last sync (totals)
        this.onArtistsLoaded = null; // Callback when artists are loaded
        this.loadFromStorage();
    }

    // Load cached artists from localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                this.artists = new Map(data.artists || []);
                this.lastSync = data.lastSync;
                this.meta = data.meta || null;
                console.log(`Loaded ${this.artists.size} artists from storage`);
            }
        } catch (e) {
            console.warn('Failed to load artist store:', e);
        }
    }

    // Save artists to localStorage
    saveToStorage() {
        try {
            const data = {
                artists: Array.from(this.artists.entries()),
                lastSync: this.lastSync,
                meta: this.meta
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save artist store:', e);
        }
    }

    // Sync artists from SoundCloud
    async syncFromSoundCloud(maxArtists = 10) {
        if (!soundCloudAuth.isAuthenticated()) {
            console.log('Not authenticated, skipping sync');
            return [];
        }

        console.log('Syncing artists from SoundCloud...');
        
        try {
            const result = await soundCloudAPI.getArtistFishData(maxArtists);
            
            // Handle both old format (array) and new format ({artists, meta})
            let artistData, meta;
            if (Array.isArray(result)) {
                // Old format - just an array
                artistData = result;
                meta = null;
            } else if (result && result.artists) {
                // New format - object with artists and meta
                artistData = result.artists;
                meta = result.meta;
            } else {
                console.error('Unexpected result format:', result);
                artistData = [];
                meta = null;
            }
            
            // Store metadata
            this.meta = meta;
            
            // Update store
            for (const artist of artistData) {
                const existing = this.artists.get(artist.id);
                
                // Merge with existing data (preserve in-app play counts)
                this.artists.set(artist.id, {
                    ...artist,
                    inAppPlays: existing?.inAppPlays || 0,
                    lastPlayed: existing?.lastPlayed || null,
                    addedAt: existing?.addedAt || Date.now(),
                    // Recalculate size including in-app plays
                    totalEngagement: artist.likedTrackCount + (existing?.inAppPlays || 0)
                });
            }
            
            this.lastSync = Date.now();
            this.saveToStorage();
            
            console.log(`Synced ${artistData.length} artists`);
            
            // Notify listeners
            if (this.onArtistsLoaded) {
                this.onArtistsLoaded(this.getArtistList());
            }
            
            return this.getArtistList();
        } catch (e) {
            console.error('Failed to sync artists:', e);
            throw e;
        }
    }

    // Get all artists as array (sorted by engagement)
    getArtistList() {
        return Array.from(this.artists.values())
            .sort((a, b) => (b.totalEngagement || b.likedTrackCount) - (a.totalEngagement || a.likedTrackCount));
    }

    // Get a specific artist
    getArtist(artistId) {
        return this.artists.get(artistId);
    }

    // Record an in-app play for an artist
    recordPlay(artistId) {
        const artist = this.artists.get(artistId);
        if (artist) {
            artist.inAppPlays = (artist.inAppPlays || 0) + 1;
            artist.lastPlayed = Date.now();
            artist.totalEngagement = artist.likedTrackCount + artist.inAppPlays;
            
            // Recalculate fish size with in-app plays bonus
            const totalLikes = artist.likedTrackCount + Math.floor(artist.inAppPlays / 2);
            artist.fishSize = soundCloudAPI.calculateFishSize(totalLikes);
            
            this.saveToStorage();
            return artist;
        }
        return null;
    }

    // Check if we have any artists
    hasArtists() {
        return this.artists.size > 0;
    }

    // Clear all data
    clear() {
        this.artists.clear();
        this.lastSync = null;
        localStorage.removeItem(STORAGE_KEY);
    }

    // Get stats
    getStats() {
        const artists = this.getArtistList();
        return {
            // From metadata (all data)
            totalFollowing: this.meta?.totalFollowing || 0,
            totalLikedTracks: this.meta?.totalLikedTracks || 0,
            // Filtered data (followed with likes)
            followedWithLikes: this.meta?.followedWithLikes || artists.length,
            likesFromFollowed: this.meta?.likesFromFollowed || artists.reduce((sum, a) => sum + (a.likedTrackCount || 0), 0),
            // Legacy/additional
            totalArtists: artists.length,
            totalLikes: artists.reduce((sum, a) => sum + (a.likedTrackCount || 0), 0),
            totalInAppPlays: artists.reduce((sum, a) => sum + (a.inAppPlays || 0), 0),
            lastSync: this.lastSync,
            topArtist: artists[0] || null
        };
    }
}

// Export singleton
export const artistStore = new ArtistStore();

