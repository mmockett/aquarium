// SoundCloud API Service
// Handles fetching data from SoundCloud API

import { soundCloudAuth } from './SoundCloudAuth.js';

class SoundCloudAPI {
    constructor() {
        this.cache = {
            followings: null,
            likes: null,
            lastFetch: null
        };
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.onProgress = null; // Callback for progress updates
    }
    
    // Set progress callback
    setProgressCallback(callback) {
        this.onProgress = callback;
    }
    
    // Report progress
    reportProgress(stage, current, total, message) {
        if (this.onProgress) {
            this.onProgress({ stage, current, total, message });
        }
    }

    // Check if cache is valid
    isCacheValid() {
        return this.cache.lastFetch && 
               (Date.now() - this.cache.lastFetch) < this.CACHE_DURATION;
    }

    // Fetch all pages of a paginated endpoint
    async fetchAllPages(endpoint, limit = 50, progressStage = 'fetching') {
        const results = [];
        let nextHref = null;
        let pageSize = Math.min(limit, 200); // API max is 200
        let pageCount = 0;
        
        try {
            // First request
            const firstUrl = `${endpoint}?limit=${pageSize}&linked_partitioning=true`;
            console.log(`Fetching page 1: ${firstUrl}`);
            let response = await soundCloudAuth.apiRequest(firstUrl);
            pageCount++;
            
            if (response.collection) {
                results.push(...response.collection);
                console.log(`Page ${pageCount}: got ${response.collection.length} items, total: ${results.length}`);
                this.reportProgress(progressStage, results.length, null, `${results.length} items...`);
            }
            
            nextHref = response.next_href;
            
            // Continue fetching until we have enough or no more pages
            while (nextHref && results.length < limit) {
                console.log(`Fetching page ${pageCount + 1}...`);
                response = await soundCloudAuth.apiRequest(nextHref);
                pageCount++;
                if (response.collection) {
                    results.push(...response.collection);
                    console.log(`Page ${pageCount}: got ${response.collection.length} items, total: ${results.length}`);
                    this.reportProgress(progressStage, results.length, null, `${results.length} items...`);
                }
                nextHref = response.next_href;
            }
            
            console.log(`Fetched ${results.length} total items from ${pageCount} pages`);
            return results.slice(0, limit);
        } catch (e) {
            console.error(`Failed to fetch ${endpoint}:`, e);
            throw e;
        }
    }

    // Fetch artists the user follows
    async getFollowings(limit = 50) {
        console.log('Fetching followings...');
        this.reportProgress('followings', 0, null, 'Fetching artists...');
        const followings = await this.fetchAllPages('/me/followings', limit, 'followings');
        console.log(`Fetched ${followings.length} followings`);
        return followings;
    }

    // Fetch tracks the user has liked
    async getLikedTracks(limit = 500) {
        console.log('Fetching liked tracks...');
        this.reportProgress('likes', 0, null, 'Fetching likes...');
        const likes = await this.fetchAllPages('/me/likes/tracks', limit, 'likes');
        console.log(`Fetched ${likes.length} liked tracks`);
        return likes;
    }

    // Get artist fish data - combines followings with like counts
    async getArtistFishData(maxArtists = 10) {
        console.log('Building artist fish data...');
        this.reportProgress('start', 0, 3, 'Starting sync...');
        
        // Fetch followings first, then likes (sequential for better progress feedback)
        this.reportProgress('followings', 0, null, 'Fetching followed artists...');
        const followings = await this.getFollowings(10000);
        
        this.reportProgress('likes', 0, null, 'Fetching liked tracks...');
        const likedTracks = await this.getLikedTracks(10000);
        
        this.reportProgress('processing', 0, null, 'Processing data...');

        // Count likes per artist (by user ID)
        const likesPerArtist = new Map();
        
        for (const track of likedTracks) {
            // Handle both direct track objects and wrapped objects
            const trackData = track.track || track;
            if (trackData && trackData.user) {
                const artistId = trackData.user.id;
                const current = likesPerArtist.get(artistId) || {
                    count: 0,
                    tracks: [],
                    genres: {} // Track genre frequency
                };
                current.count++;
                current.tracks.push({
                    id: trackData.id,
                    title: trackData.title,
                    artwork_url: trackData.artwork_url,
                    genre: trackData.genre
                });
                // Count genre occurrences
                if (trackData.genre) {
                    const genre = trackData.genre.toLowerCase().trim();
                    if (genre) {
                        current.genres[genre] = (current.genres[genre] || 0) + 1;
                    }
                }
                likesPerArtist.set(artistId, current);
            }
        }

        console.log(`Found likes from ${likesPerArtist.size} unique artists`);

        // Build artist fish data
        const artistFish = followings.map(following => {
            // Handle wrapped objects
            const artist = following.user || following;
            const artistId = artist.id;
            const likeData = likesPerArtist.get(artistId) || { count: 0, tracks: [], genres: {} };
            
            // Determine primary genre from liked tracks
            const primaryGenre = this.getPrimaryGenre(likeData.genres);
            
            return {
                id: artistId,
                username: artist.username,
                fullName: artist.full_name || artist.username,
                avatarUrl: artist.avatar_url,
                permalinkUrl: artist.permalink_url,
                followersCount: artist.followers_count || 0,
                trackCount: artist.track_count || 0,
                
                // Engagement data
                likedTrackCount: likeData.count,
                likedTracks: likeData.tracks.slice(0, 5), // Keep top 5 for display
                genre: primaryGenre,
                allGenres: likeData.genres, // All genres with counts
                
                // Fish properties (species based on genre, size calculated later based on relative likes)
                fishSize: 1.0, // Placeholder, will be recalculated relative to max likes
                fishSpecies: this.assignSpecies(artist, likeData.count, primaryGenre)
            };
        });

        // Filter to only include artists with at least 1 liked track
        const artistsWithLikes = artistFish.filter(a => a.likedTrackCount > 0);
        
        // Sort by liked track count (most engaged first)
        artistsWithLikes.sort((a, b) => b.likedTrackCount - a.likedTrackCount);
        
        // Limit to maxArtists
        const finalArtists = artistsWithLikes.slice(0, maxArtists);
        
        // Calculate fish sizes relative to max likes (normalize to 0.4 - 1.0 range)
        const maxLikes = finalArtists.length > 0 ? finalArtists[0].likedTrackCount : 1;
        for (const artist of finalArtists) {
            artist.fishSize = this.calculateFishSize(artist.likedTrackCount, maxLikes);
        }

        // Calculate total likes from followed artists only
        const likesFromFollowed = artistsWithLikes.reduce((sum, a) => sum + a.likedTrackCount, 0);

        console.log('Artist fish data built:');
        console.log(`  - ${followings.length} followed artists`);
        console.log(`  - ${likedTracks.length} liked tracks`);
        console.log(`  - ${likesPerArtist.size} unique artists in likes`);
        console.log(`  - ${artistsWithLikes.length} followed artists with likes`);
        console.log(`  - ${likesFromFollowed} likes from followed artists`);
        console.log(`  - ${finalArtists.length} artists returned (max ${maxArtists})`);
        console.log(`  - Max likes: ${maxLikes} (used for size scaling)`);
        console.log('Top artists:');
        finalArtists.forEach(a => {
            const sizePercent = Math.round(a.fishSize * 100);
            console.log(`  ${a.username}: ${a.likedTrackCount} likes | ${sizePercent}% size | ${a.genre || 'unknown'}`);
        });

        // Return both artists and metadata
        return {
            artists: finalArtists,
            meta: {
                totalFollowing: followings.length,
                totalLikedTracks: likedTracks.length,
                followedWithLikes: artistsWithLikes.length,
                likesFromFollowed: likesFromFollowed
            }
        };
    }

    // Get the most common genre from genre counts
    getPrimaryGenre(genres) {
        if (!genres || Object.keys(genres).length === 0) return null;
        
        // Find genre with highest count
        let maxCount = 0;
        let primaryGenre = null;
        
        for (const [genre, count] of Object.entries(genres)) {
            if (count > maxCount) {
                maxCount = count;
                primaryGenre = genre;
            }
        }
        
        return primaryGenre;
    }

    // Calculate fish size relative to max likes
    // Size ranges from 0.8 (minimum) to 1.8 (maximum) - bigger fish!
    // The artist with most likes = 1.8x, others scaled proportionally
    calculateFishSize(likeCount, maxLikes = 1) {
        if (maxLikes <= 0) maxLikes = 1;
        
        // Calculate ratio (0 to 1)
        const ratio = likeCount / maxLikes;
        
        // Scale to range 0.8 to 1.8
        // Bigger fish are easier to see and click
        const minSize = 0.8;
        const maxSize = 1.8;
        
        return minSize + (ratio * (maxSize - minSize));
    }

    // Assign a fish species based on genre (primary) and engagement (secondary)
    assignSpecies(artist, likeCount, genre = null) {
        // Genre is the PRIMARY determinant of species
        if (genre) {
            const genreLower = genre.toLowerCase();
            
            // Electronic/Dance/House/Techno → Starbit (glowing, energetic)
            if (genreLower.includes('electronic') || genreLower.includes('house') || 
                genreLower.includes('techno') || genreLower.includes('edm') ||
                genreLower.includes('dance') || genreLower.includes('trance') ||
                genreLower.includes('dubstep') || genreLower.includes('drum')) {
                return 'starbit';
            }
            
            // Ambient/Chill/Lo-fi/Experimental → Kodama (mystical, calm)
            if (genreLower.includes('ambient') || genreLower.includes('chill') || 
                genreLower.includes('lo-fi') || genreLower.includes('lofi') ||
                genreLower.includes('experimental') || genreLower.includes('drone') ||
                genreLower.includes('meditation') || genreLower.includes('sleep')) {
                return 'kodama';
            }
            
            // Hip-hop/Rap/Trap/R&B → Basic (classic, smooth)
            if (genreLower.includes('hip') || genreLower.includes('rap') || 
                genreLower.includes('trap') || genreLower.includes('r&b') ||
                genreLower.includes('rnb') || genreLower.includes('beats')) {
                return 'basic';
            }
            
            // Rock/Metal/Punk → Lord (powerful, dramatic)
            if (genreLower.includes('rock') || genreLower.includes('metal') || 
                genreLower.includes('punk') || genreLower.includes('grunge') ||
                genreLower.includes('hardcore')) {
                return 'lord';
            }
            
            // Folk/Acoustic/Singer-songwriter → Forest (natural, organic)
            if (genreLower.includes('folk') || genreLower.includes('acoustic') || 
                genreLower.includes('singer') || genreLower.includes('songwriter') ||
                genreLower.includes('indie') || genreLower.includes('country')) {
                return 'forest';
            }
            
            // Classical/Jazz/Soul → Sun (elegant, sophisticated)
            if (genreLower.includes('classical') || genreLower.includes('jazz') || 
                genreLower.includes('soul') || genreLower.includes('blues') ||
                genreLower.includes('orchestra') || genreLower.includes('piano')) {
                return 'sun';
            }
            
            // Pop/World/Latin → Rainbow (colorful, universal)
            if (genreLower.includes('pop') || genreLower.includes('world') || 
                genreLower.includes('latin') || genreLower.includes('reggae') ||
                genreLower.includes('afro') || genreLower.includes('global')) {
                return 'rainbow';
            }
        }
        
        // If no genre match, use engagement level as fallback
        if (likeCount >= 30) return 'rainbow';
        if (likeCount >= 20) return 'sun';
        if (likeCount >= 10) return 'lord';
        if (likeCount >= 5) return 'forest';
        
        // Default - variety based on hash of name
        const hash = artist.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const species = ['basic', 'starbit', 'kodama'];
        return species[hash % species.length];
    }

    // Get a specific artist's data
    async getArtist(artistId) {
        try {
            return await soundCloudAuth.apiRequest(`/users/${artistId}`);
        } catch (e) {
            console.error('Failed to fetch artist:', e);
            return null;
        }
    }

    // Search for tracks
    async searchTracks(query, limit = 20) {
        try {
            const results = await soundCloudAuth.apiRequest(
                `/tracks?q=${encodeURIComponent(query)}&limit=${limit}&access=playable`
            );
            return results.collection || results;
        } catch (e) {
            console.error('Search failed:', e);
            return [];
        }
    }
}

// Export singleton
export const soundCloudAPI = new SoundCloudAPI();

