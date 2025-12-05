# Cloudflare Worker Setup for SoundCloud OAuth

This guide walks you through setting up a Cloudflare Worker to securely proxy your SoundCloud OAuth token exchanges. The client secret stays on the server, never exposed in your frontend code.

## Prerequisites

- A Cloudflare account (free tier works fine)
- Your SoundCloud API credentials

## Step 1: Create a Cloudflare Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Sign up for a free account if you don't have one

## Step 2: Create a New Worker

1. In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar
2. Click **Create Application**
3. Click **Create Worker**
4. Give it a name like `soundpond-auth`
5. Click **Deploy** (we'll add the code next)

## Step 3: Add the Worker Code

1. After deploying, click **Edit code**
2. Delete the default code
3. Copy the entire contents of `worker.js` from this folder
4. Paste it into the editor
5. **Important**: Update the `ALLOWED_ORIGINS` array with your actual GitHub Pages URL:
   ```javascript
   const ALLOWED_ORIGINS = [
     'https://YOUR_USERNAME.github.io',  // Your GitHub Pages
     'http://localhost:3000',             // Local dev
   ];
   ```
6. Click **Save and Deploy**

## Step 4: Add Your Client Secret as an Environment Variable

⚠️ **Never put the client secret directly in the code!**

1. Go to your Worker's **Settings** tab
2. Click **Variables** in the left menu
3. Under **Environment Variables**, click **Add variable**
4. Name: `CLIENT_SECRET`
5. Value: Your SoundCloud client secret
6. Click **Encrypt** (recommended for secrets)
7. Click **Save and Deploy**

## Step 5: Update Your Frontend

1. Note your Worker URL (e.g., `https://soundpond-auth.your-subdomain.workers.dev`)
2. Open `SoundPond/js/services/SoundCloudAuth.js`
3. Update the `tokenProxy` URL:
   ```javascript
   tokenProxy: 'https://soundpond-auth.your-subdomain.workers.dev',
   ```

## Step 6: Rotate Your Client Secret

Since your old secret was exposed in the repository:

1. Go to [SoundCloud Developer Portal](https://soundcloud.com/you/apps)
2. Find your app and regenerate the client secret
3. Update the `CLIENT_SECRET` environment variable in Cloudflare with the new secret

## Testing

1. Deploy your updated frontend to GitHub Pages
2. Try logging in with SoundCloud
3. Check the browser Network tab - token requests should go to your Worker URL
4. The Worker forwards to SoundCloud with the secret added server-side

## Troubleshooting

### "Forbidden - Origin not allowed"
Make sure your GitHub Pages URL is in the `ALLOWED_ORIGINS` array in the Worker code.

### "Server configuration error"  
The `CLIENT_SECRET` environment variable isn't set. Check Settings > Variables.

### CORS errors
Make sure your Worker is handling OPTIONS preflight requests (the provided code does this).

## Security Notes

- ✅ Client ID is safe in frontend code (designed for this)
- ✅ Client secret stays in Cloudflare Worker (never sent to browser)
- ✅ Origin checking prevents unauthorized sites from using your proxy
- ✅ HTTPS only (Cloudflare Workers use HTTPS by default)

## Free Tier Limits

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request

This is more than enough for a personal project's OAuth needs.

