// SoundCloud OAuth 2.1 Authentication Service
// Uses PKCE for secure browser-based auth
// Client secret is kept server-side via Cloudflare Worker proxy

const SOUNDCLOUD_CONFIG = {
    clientId: 'EafoE3Bzwz0ZmO7q7wAzo2zHNROWY6jU',
    // clientSecret removed for security - now handled by Cloudflare Worker
    authUrl: 'https://secure.soundcloud.com/authorize',
    tokenUrl: 'https://secure.soundcloud.com/oauth/token',
    apiUrl: 'https://api.soundcloud.com',
    // Token proxy - Cloudflare Worker that holds the client_secret
    tokenProxy: 'https://soundpond-auth.mmockett.workers.dev',
    // Redirect URI will be set dynamically based on current origin
    get redirectUri() {
        return window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'callback.html';
    }
};

// Storage keys
const STORAGE_KEYS = {
    accessToken: 'soundpond_access_token',
    refreshToken: 'soundpond_refresh_token',
    tokenExpiry: 'soundpond_token_expiry',
    codeVerifier: 'soundpond_code_verifier',
    authState: 'soundpond_auth_state',
    user: 'soundpond_user'
};

class SoundCloudAuth {
    constructor() {
        this.accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
        this.refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
        this.tokenExpiry = localStorage.getItem(STORAGE_KEYS.tokenExpiry);
        this.user = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || 'null');
        this.onAuthChange = null; // Callback for auth state changes
    }

    // Check if user is authenticated
    isAuthenticated() {
        if (!this.accessToken) return false;
        
        // Check if token is expired
        if (this.tokenExpiry && Date.now() > parseInt(this.tokenExpiry)) {
            // Token expired, try to refresh
            this.refreshAccessToken();
            return false;
        }
        
        return true;
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // Generate random string for PKCE
    generateRandomString(length) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        const values = crypto.getRandomValues(new Uint8Array(length));
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    }

    // Generate PKCE code challenge from verifier
    async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        
        // Base64 URL encode
        const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // Start OAuth flow - redirect to SoundCloud
    async login() {
        // Generate PKCE values
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        const state = this.generateRandomString(32);

        // Store for callback
        sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
        sessionStorage.setItem(STORAGE_KEYS.authState, state);

        // Build authorization URL
        const params = new URLSearchParams({
            client_id: SOUNDCLOUD_CONFIG.clientId,
            redirect_uri: SOUNDCLOUD_CONFIG.redirectUri,
            response_type: 'code',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state: state,
            scope: 'non-expiring'
        });

        const authUrl = `${SOUNDCLOUD_CONFIG.authUrl}?${params.toString()}`;
        
        console.log('Redirecting to SoundCloud for authorization...');
        console.log('Redirect URI:', SOUNDCLOUD_CONFIG.redirectUri);
        
        // Redirect to SoundCloud
        window.location.href = authUrl;
    }

    // Handle OAuth callback
    async handleCallback(code, state) {
        // Verify state to prevent CSRF
        const storedState = sessionStorage.getItem(STORAGE_KEYS.authState);
        if (state !== storedState) {
            throw new Error('State mismatch - possible CSRF attack');
        }

        // Get stored code verifier
        const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);
        if (!codeVerifier) {
            throw new Error('Code verifier not found');
        }

        // Exchange code for token via secure proxy (client_secret added server-side)
        const formData = new FormData();
        formData.append('grant_type', 'authorization_code');
        formData.append('client_id', SOUNDCLOUD_CONFIG.clientId);
        formData.append('redirect_uri', SOUNDCLOUD_CONFIG.redirectUri);
        formData.append('code_verifier', codeVerifier);
        formData.append('code', code);

        const response = await fetch(`${SOUNDCLOUD_CONFIG.tokenProxy}/token`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorText = await response.text();
                console.error('Token exchange failed - Raw response:', errorText);
                try {
                    const error = JSON.parse(errorText);
                    errorMessage = error.error_description || error.error || error.message || errorText;
                } catch {
                    errorMessage = errorText || `HTTP ${response.status}`;
                }
            } catch (e) {
                console.error('Could not read error response:', e);
            }
            console.error('Token exchange failed:', errorMessage);
            console.error('Request details:', {
                url: SOUNDCLOUD_CONFIG.tokenUrl,
                redirectUri: SOUNDCLOUD_CONFIG.redirectUri,
                hasCode: !!code,
                hasCodeVerifier: !!codeVerifier
            });
            throw new Error(`Token exchange failed: ${errorMessage}`);
        }

        const tokenData = await response.json();
        
        // Store tokens
        this.accessToken = tokenData.access_token;
        this.refreshToken = tokenData.refresh_token;
        this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

        localStorage.setItem(STORAGE_KEYS.accessToken, this.accessToken);
        if (this.refreshToken) {
            localStorage.setItem(STORAGE_KEYS.refreshToken, this.refreshToken);
        }
        localStorage.setItem(STORAGE_KEYS.tokenExpiry, this.tokenExpiry.toString());

        // Clean up session storage
        sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
        sessionStorage.removeItem(STORAGE_KEYS.authState);

        // Fetch user info
        await this.fetchUser();

        // Notify listeners
        if (this.onAuthChange) {
            this.onAuthChange(true, this.user);
        }

        return true;
    }

    // Refresh access token
    async refreshAccessToken() {
        if (!this.refreshToken) {
            this.logout();
            return false;
        }

        try {
            // Use secure proxy for token refresh
            const formData = new FormData();
            formData.append('grant_type', 'refresh_token');
            formData.append('client_id', SOUNDCLOUD_CONFIG.clientId);
            formData.append('refresh_token', this.refreshToken);

            const response = await fetch(`${SOUNDCLOUD_CONFIG.tokenProxy}/refresh`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const tokenData = await response.json();
            
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token || this.refreshToken;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

            localStorage.setItem(STORAGE_KEYS.accessToken, this.accessToken);
            localStorage.setItem(STORAGE_KEYS.refreshToken, this.refreshToken);
            localStorage.setItem(STORAGE_KEYS.tokenExpiry, this.tokenExpiry.toString());

            return true;
        } catch (e) {
            console.error('Failed to refresh token:', e);
            this.logout();
            return false;
        }
    }

    // Fetch authenticated user info
    async fetchUser() {
        if (!this.accessToken) return null;

        try {
            const response = await fetch(`${SOUNDCLOUD_CONFIG.apiUrl}/me`, {
                headers: {
                    'Authorization': `OAuth ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user');
            }

            this.user = await response.json();
            localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(this.user));
            
            return this.user;
        } catch (e) {
            console.error('Failed to fetch user:', e);
            return null;
        }
    }

    // Log out
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.user = null;

        localStorage.removeItem(STORAGE_KEYS.accessToken);
        localStorage.removeItem(STORAGE_KEYS.refreshToken);
        localStorage.removeItem(STORAGE_KEYS.tokenExpiry);
        localStorage.removeItem(STORAGE_KEYS.user);

        if (this.onAuthChange) {
            this.onAuthChange(false, null);
        }
    }

    // Make authenticated API request
    async apiRequest(endpoint, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const url = endpoint.startsWith('http') 
            ? endpoint 
            : `${SOUNDCLOUD_CONFIG.apiUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `OAuth ${this.accessToken}`,
                'Accept': 'application/json',
                ...options.headers
            }
        });

        if (response.status === 401) {
            // Token might be expired, try to refresh
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                // Retry request with new token
                return this.apiRequest(endpoint, options);
            }
            throw new Error('Authentication expired');
        }

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return response.json();
    }

    // Get access token for widget/embed
    getAccessToken() {
        return this.accessToken;
    }

    // Get client ID for public requests
    getClientId() {
        return SOUNDCLOUD_CONFIG.clientId;
    }
}

// Export singleton instance
export const soundCloudAuth = new SoundCloudAuth();
export { SOUNDCLOUD_CONFIG };

