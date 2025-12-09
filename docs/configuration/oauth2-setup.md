# OAuth2 Setup Guide

This guide provides detailed instructions for setting up Google OAuth2 authentication for the AnkiLingoFlash extension across all supported browsers.

## Overview

AnkiLingoFlash uses Google OAuth2 for user authentication and identity management. Each browser requires a specific OAuth2 configuration due to differences in how browser extensions handle authentication flows.

## Prerequisites

### Google Cloud Console Access

You'll need access to [Google Cloud Console](https://console.cloud.google.com/) with permissions to:
- Create OAuth2 client IDs
- Manage API credentials
- Configure consent screens

### Required APIs

Ensure the following APIs are enabled in your Google Cloud project:
- **Google Identity Platform** (authentication)
- **Google+ API** (user profile information)

## Google Cloud Console Setup

### 1. Create or Select a Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select an existing project or create a new one
3. Note your **Project ID** for later use

### 2. Configure OAuth2 Consent Screen

1. Navigate to `APIs & Services` → `OAuth consent screen`
2. Choose **External** user type
3. Fill in required fields:
   - **App name**: "AnkiLingoFlash"
   - **User support email**: Your email address
   - **Developer contact information**: Your email

4. **Scopes**: Add the following scopes:
   - `openid` - OpenID Connect authentication
   - `email` - User's email address
   - `profile` - User's basic profile information

5. **Test Users**: Add your Google account as a test user (while in development)

### 3. Enable Required APIs

1. Navigate to `APIs & Services` → `Library`
2. Search and enable:
   - **Google Identity Platform API**
   - **Google+ API** (deprecated but may be required)

## Browser-Specific OAuth2 Configuration

Each browser requires a different OAuth2 client type and configuration.

### Chrome Extension Setup

#### Create OAuth2 Client ID

1. Navigate to `APIs & Services` → `Credentials`
2. Click `Create Credentials` → `OAuth2 client ID`
3. Select **Chrome extension** as application type
4. **Extension ID**: Get this from your Chrome extension:
   - Load extension in Chrome developer mode
   - Go to `chrome://extensions/`
   - Find your extension and copy the Extension ID

#### Update Chrome Manifest

Update `src/browser-specific/chrome/manifest.json`:

```json
{
  "oauth2": {
    "client_id": "YOUR_CHROME_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

#### Chrome OAuth2 Flow

Chrome uses the `chrome.identity.getAuthToken()` API:

```javascript
// Chrome authentication implementation
chrome.identity.getAuthToken({ interactive: true }, function(token) {
  if (chrome.runtime.lastError) {
    console.error('Auth error:', chrome.runtime.lastError);
    return;
  }

  // Use token to fetch user info
  fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${token}`)
    .then(response => response.json())
    .then(userData => {
      // Handle user data
    });
});
```

### Firefox Extension Setup

#### Create OAuth2 Client ID

1. Navigate to `APIs & Services` → `Credentials`
2. Click `Create Credentials` → `OAuth2 client ID`
3. Select **Web application** as application type
4. **Authorized JavaScript origins**: Leave empty for extensions
5. **Authorized redirect URIs**: You'll add this after getting the extension ID

#### Get Firefox Extension ID

1. Load your extension in Firefox:
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on" and select any file from `dist/firefox/`
2. Note the extension ID (random UUID)

#### Add Redirect URI

Update your OAuth2 client configuration:
1. Go back to `APIs & Services` → `Credentials`
2. Edit your Firefox OAuth2 client
3. Add authorized redirect URI: `moz-extension://YOUR_EXTENSION_ID/`

#### Update Firefox Manifest

Update `src/browser-specific/firefox/manifest.json`:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "your-extension-id@your-domain.com"
    }
  },
  "background": {
    "scripts": ["background.js"],
    "type": "module"
  },
  "oauth2": {
    "client_id": "YOUR_FIREFOX_WEB_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  }
}
```

#### Firefox OAuth2 Flow

Firefox uses the `browser.identity.launchWebAuthFlow()` API:

```javascript
// Firefox authentication implementation
async function authenticateFirefox() {
  const redirectURL = browser.identity.getRedirectURL();
  const clientId = await getClientIdFromManifest();
  const scopes = ["openid", "email", "profile"];

  const authUrl = new URL("https://accounts.google.com/o/oauth2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("redirect_uri", redirectURL);
  authUrl.searchParams.set("scope", scopes.join(" "));

  return browser.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true
  });
}
```

### Microsoft Edge Extension Setup

#### Create OAuth2 Client ID

1. Navigate to `APIs & Services` → `Credentials`
2. Click `Create Credentials` → `OAuth2 client ID`
3. Select **Chrome extension** as application type (Edge uses Chrome extension APIs)
4. **Extension ID**: Get this from your Edge extension

#### Get Edge Extension ID

1. Load extension in Edge developer mode:
   - Go to `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select `dist/edge/`
2. Copy the Extension ID

#### Update Edge Manifest

Update `src/browser-specific/edge/manifest.json`:

```json
{
  "oauth2": {
    "client_id": "YOUR_EDGE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

#### Edge OAuth2 Flow

Edge uses Chrome-compatible APIs:

```javascript
// Edge authentication (same as Chrome)
chrome.identity.getAuthToken({ interactive: true }, function(token) {
  // Handle authentication like Chrome
});
```

## Backend OAuth2 Configuration

### Update Cloudflare Workers

Your backend worker needs to handle OAuth2 redirects:

```javascript
// In worker.js - already implemented
async function handleOAuthRedirect(request) {
  const url = new URL(request.url);
  const fragmentParams = new URLSearchParams(url.hash.slice(1));
  const token = fragmentParams.get('access_token');

  if (token) {
    return new Response(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({token: "${token}"}, "*");
            } else {
              // For Firefox, we need to use browser.runtime.sendMessage
              browser.runtime.sendMessage({action: "auth_success", token: "${token}"});
            }
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
```

## Testing OAuth2 Setup

### 1. Build and Load Extensions

```bash
# Build all browsers
./build.sh

# Load extensions:
# Chrome: chrome://extensions/ → Load unpacked → dist/chrome
# Firefox: about:debugging → Load Temporary Add-on → dist/firefox
# Edge: edge://extensions/ → Load unpacked → dist/edge
```

### 2. Test Authentication Flow

**Chrome Test**:
1. Open extension popup
2. Click "Sign in with Google"
3. Verify Google OAuth2 consent screen appears
4. Complete authentication
5. Check if extension shows authenticated state

**Firefox Test**:
1. Open extension popup
2. Click "Sign in with Google"
3. Verify redirect URL works correctly
4. Complete authentication
5. Check if extension shows authenticated state

**Edge Test**:
1. Same process as Chrome
2. Verify authentication completes successfully

### 3. Debugging Common Issues

**Chrome Issues**:
- **Invalid Extension ID**: Ensure extension ID matches OAuth2 client
- **Invalid Client ID**: Check Chrome manifest client_id is correct
- **Scope Issues**: Verify required scopes are in OAuth2 consent screen

**Firefox Issues**:
- **Redirect URI Mismatch**: Ensure `moz-extension://ID/` matches OAuth2 configuration
- **Invalid Web Client**: Use Web application client type, not Chrome extension
- **Extension ID Changes**: Temporary add-ons get new IDs each time

**Edge Issues**:
- **Extension ID Mismatch**: Verify Edge extension ID matches OAuth2 client
- **Manifest Issues**: Ensure Edge-specific manifest properties are correct

## Environment-Specific Configuration

### Development Environment

**Test Users**:
- Add your development accounts to OAuth2 test users
- Use development Google Cloud project
- Enable verbose logging for debugging

**Debug Configuration**:
```javascript
// Enable debug logging in development
const DEBUG = true;
const OAUTH_DEBUG = true;

if (OAUTH_DEBUG) {
  console.log('OAuth2 Debug - Client ID:', clientId);
  console.log('OAuth2 Debug - Redirect URL:', redirectURL);
}
```

### Production Environment

**Production OAuth2 Client**:
- Create separate OAuth2 clients for production
- Remove test user restrictions
- Set up proper domain verification
- Configure production consent screen

**Security Considerations**:
- Use HTTPS for all redirect URIs
- Implement proper token storage and expiration
- Add error handling for authentication failures
- Consider rate limiting for authentication requests

## Security Best Practices

### Client ID Management

**Never Commit Client IDs**:
```bash
# Add to .gitignore
src/browser-specific/*/manifest.json
```

**Use Environment Variables**:
```javascript
// In build script or during development
const CLIENT_ID = process.env.CHROME_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
```

### Token Storage

**Secure Storage**:
- Use browser's secure storage APIs
- Implement token expiration handling
- Store tokens with minimal required permissions
- Clear tokens on logout

**Example Secure Storage**:
```javascript
// Store token securely
chrome.storage.local.set({
  authToken: token,
  tokenExpiry: Date.now() + (3600 * 1000) // 1 hour
});

// Retrieve and validate token
chrome.storage.local.get(['authToken', 'tokenExpiry'], (result) => {
  if (result.tokenExpiry < Date.now()) {
    // Token expired
    clearAuthToken();
    return;
  }
  // Use valid token
});
```

### Error Handling

**Common OAuth2 Errors**:
```javascript
function handleOAuth2Error(error) {
  switch (error.error) {
    case 'access_denied':
      console.log('User denied access');
      break;
    case 'invalid_client':
      console.error('Invalid client ID configuration');
      break;
    case 'redirect_uri_mismatch':
      console.error('Redirect URI mismatch in OAuth2 configuration');
      break;
    default:
      console.error('OAuth2 error:', error);
  }
}
```

## Maintenance and Updates

### Regular Tasks

- **Review OAuth2 Configuration**: Quarterly review of client settings
- **Update Scopes**: Remove unused scopes, add required ones
- **Rotate Client IDs**: Consider security rotation of client IDs
- **Monitor Usage**: Check OAuth2 usage in Google Cloud Console

### When Changing Extension ID

1. Update OAuth2 client configuration with new extension ID
2. Update manifest files with new client ID
3. Test authentication flow with new configuration
4. Update any documentation referencing the old ID

### Browser Store Submissions

**Chrome Web Store**:
- Use production OAuth2 client
- Ensure extension ID is final (temporary IDs change)
- Test OAuth2 flow in published extension

**Firefox Add-ons**:
- Use production OAuth2 web client
- Set permanent extension ID in manifest
- Test with signed extension

**Microsoft Store**:
- Similar to Chrome Web Store process
- Ensure Edge-specific configuration is correct

## Troubleshooting Guide

### Common Error Messages

**"Invalid client"**:
- Check client ID in manifest matches Google Cloud Console
- Verify client type (Chrome extension vs Web application)

**"Redirect URI mismatch"**:
- Ensure redirect URI matches extension URL exactly
- For Firefox, check that `moz-extension://ID/` is added

**"Access denied"**:
- User denied access - normal behavior
- Check if user account is added to test users (in development)

**"Invalid token"**:
- Token may have expired
- Check token storage and retrieval logic
- Verify token format and structure

### Debugging Tools

**Browser Developer Tools**:
```javascript
// In browser console during authentication
console.log('Extension ID:', chrome.runtime.id);
console.log('Manifest:', chrome.runtime.getManifest());

// Check OAuth2 configuration
fetch('https://www.googleapis.com/oauth2/v2/certs')
  .then(response => response.json())
  .then(console.log);
```

**Google Cloud Console**:
- OAuth2 consent screen status
- Credential usage and errors
- API usage statistics
- Test user management

This OAuth2 setup guide covers the complete authentication configuration for all supported browsers, ensuring secure and reliable user authentication for the AnkiLingoFlash extension.