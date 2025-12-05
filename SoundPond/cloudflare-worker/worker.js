/**
 * SoundCloud OAuth Token Proxy - Cloudflare Worker
 * 
 * This worker securely handles the OAuth token exchange by keeping 
 * the client_secret server-side. Deploy to Cloudflare Workers (free tier).
 * 
 * Setup:
 * 1. Go to https://dash.cloudflare.com/ and create a Workers account
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Add the CLIENT_SECRET as an environment variable (Settings > Variables)
 * 5. Deploy and note your worker URL (e.g., soundpond-auth.yourname.workers.dev)
 * 6. Update SOUNDCLOUD_CONFIG.tokenProxy in SoundCloudAuth.js with your worker URL
 */

// IMPORTANT: Set this as an environment variable in Cloudflare dashboard, NOT here!
// Settings > Variables > Add Variable > CLIENT_SECRET = your_secret_here

const SOUNDCLOUD_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';

// Allowed origins - your GitHub Pages URL and local dev
const ALLOWED_ORIGINS = [
  'https://mmockett.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Check origin
    const origin = request.headers.get('Origin');
    if (!isAllowedOrigin(origin)) {
      return new Response('Forbidden - Origin not allowed', { status: 403 });
    }

    const url = new URL(request.url);

    // Route: /token - Exchange authorization code for tokens
    if (url.pathname === '/token') {
      return handleTokenExchange(request, env, origin);
    }

    // Route: /refresh - Refresh an access token
    if (url.pathname === '/refresh') {
      return handleTokenRefresh(request, env, origin);
    }

    return new Response('Not found', { status: 404 });
  }
};

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function handleCORS(request) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

async function handleTokenExchange(request, env, origin) {
  try {
    const body = await request.formData();
    
    // Get the client secret from environment variable
    const clientSecret = env.CLIENT_SECRET;
    if (!clientSecret) {
      console.error('CLIENT_SECRET environment variable not set');
      return errorResponse('Server configuration error', 500, origin);
    }

    // Build the token request to SoundCloud
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: body.get('client_id'),
      client_secret: clientSecret,  // Added server-side!
      redirect_uri: body.get('redirect_uri'),
      code_verifier: body.get('code_verifier'),
      code: body.get('code')
    });

    // Forward to SoundCloud
    const response = await fetch(SOUNDCLOUD_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams
    });

    const responseText = await response.text();
    
    return new Response(responseText, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin
      }
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return errorResponse('Token exchange failed', 500, origin);
  }
}

async function handleTokenRefresh(request, env, origin) {
  try {
    const body = await request.formData();
    
    const clientSecret = env.CLIENT_SECRET;
    if (!clientSecret) {
      return errorResponse('Server configuration error', 500, origin);
    }

    // Build refresh token request
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: body.get('client_id'),
      client_secret: clientSecret,  // Some OAuth servers need this for refresh too
      refresh_token: body.get('refresh_token')
    });

    const response = await fetch(SOUNDCLOUD_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams
    });

    const responseText = await response.text();
    
    return new Response(responseText, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return errorResponse('Token refresh failed', 500, origin);
  }
}

function errorResponse(message, status, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || '*'
    }
  });
}

