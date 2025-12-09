# Environment Setup

This guide will help you set up a complete development environment for contributing to the AnkiLingoFlash browser extension.

## Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows (with WSL2 recommended)
- **Git**: For version control
- **Node.js**: Version 16 or higher (optional, for CSS optimization)
- **jq**: JSON processing utility (required for build process)

### Required Tools Installation

#### Git

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install git
```

**macOS**:
```bash
brew install git
```

**Windows**:
- Download and install from [git-scm.com](https://git-scm.com/)

#### jq (JSON Processor)

**Linux (Ubuntu/Debian)**:
```bash
sudo apt install jq
```

**macOS**:
```bash
brew install jq
```

**Windows**:
```bash
# Using Chocolatey
choco install jq

# Or using Scoop
scoop install jq
```

#### Node.js (Optional)

Node.js is only required if you want to use CSS optimization with PurgeCSS.

**Linux/macOS** (using nvm):
```bash
# Install nvm first
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js
nvm install 18
nvm use 18
```

**Windows**: Download from [nodejs.org](https://nodejs.org/)

## Project Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/pictoune/AnkiLingoFlash.git

# Navigate to the project directory
cd AnkiLingoFlash
```

### 2. Install Dependencies (Optional)

CSS optimization is optional but recommended for production builds:

```bash
npm install
```

This installs PurgeCSS for CSS optimization, which reduces the final CSS bundle size.

### 3. Verify Prerequisites

Check that all required tools are properly installed:

```bash
# Check Git
git --version

# Check jq
jq --version

# Check Node.js (if installed)
node --version
npm --version
```

## Browser Setup for Development

### Chrome/Chromium

1. **Enable Developer Mode**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" toggle in the top right

2. **Load Extension**:
   - Click "Load unpacked"
   - Select the `dist/chrome` directory (will be created after building)

### Firefox

1. **Enable Debug Mode**:
   - Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
   - This opens the extension debugging interface

2. **Load Temporary Add-on**:
   - Click "Load Temporary Add-on"
   - Select any file from the `dist/firefox` directory

### Microsoft Edge

1. **Enable Developer Mode**:
   - Open Edge and navigate to `edge://extensions/`
   - Enable "Developer mode" toggle

2. **Load Extension**:
   - Click "Load unpacked"
   - Select the `dist/edge` directory

## Building the Extension

### Initial Build

Run the build script to create browser-specific distributions:

```bash
./build.sh
```

This script will:
1. Create `dist/` directory with browser-specific subdirectories
2. Copy common files to each browser directory
3. Concatenate browser-specific and common scripts
4. Merge manifest files using `jq`

### Build Output Structure

```
dist/
├── chrome/
│   ├── manifest.json         # Merged manifest for Chrome
│   ├── background.js         # Combined background script
│   ├── popup.js             # Combined popup script
│   ├── content.js           # Content script
│   ├── popup.html           # Extension popup UI
│   ├── style.css            # Styles
│   ├── config.js            # Configuration
│   ├── icons/               # Extension icons
│   ├── franc/               # Language detection library
│   └── _locales/            # Internationalization
├── firefox/
│   └── [same structure as chrome]
└── edge/
    └── [same structure as chrome]
```

### Development Workflow

1. **Make Changes**: Edit files in `src/` directory
2. **Build**: Run `./build.sh` to update distributions
3. **Reload**: Reload extensions in browser developer mode
4. **Test**: Test functionality across browsers

## Anki Setup (Optional)

For testing Anki integration:

### 1. Install Anki

Download and install from [ankiweb.net](https://apps.ankiweb.net/)

### 2. Install AnkiConnect

1. Open Anki
2. Go to `Tools` → `Add-ons` → `Get Add-ons...`
3. Enter code: `2055492159`
4. Restart Anki
5. Verify AnkiConnect is running by accessing `http://localhost:8765`

### 3. Test Connection

```bash
# Test AnkiConnect API
curl -X POST http://127.0.0.1:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "version",
    "version": 6
  }'
```

## Google OAuth2 Development Setup

For testing authentication features:

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API and Google Identity Platform

### 2. Create OAuth2 Credentials

#### Chrome Extension

1. Go to `APIs & Services` → `Credentials`
2. Click `Create Credentials` → `OAuth2 client ID`
3. Select `Chrome extension` as application type
4. For Extension ID: Use your Chrome extension ID (from `chrome://extensions/`)
5. Add the extension ID to the authorized origins

#### Firefox/Edge

1. Create `Web application` OAuth2 client ID
2. Add authorized redirect URIs:
   - Firefox: `moz-extension://<extension-id>/`
   - Edge: `ms-extension://<extension-id>/`

### 3. Update Manifest Files

Add your client ID to the appropriate manifest files:

**Chrome** (`src/browser-specific/chrome/manifest.json`):
```json
{
  "oauth2": {
    "client_id": "YOUR_CHROME_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

**Firefox** (`src/browser-specific/firefox/manifest.json`):
```json
{
  "oauth2": {
    "client_id": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

## Development Tools

### Browser Developer Tools

#### Chrome DevTools
- **Extension Pages**: Access via `chrome://extensions/` → "Details" → "Extension options"
- **Content Scripts**: Use regular DevTools on web pages
- **Background Scripts**: `chrome://extensions/` → "Details" → "background page"

#### Firefox Developer Tools
- **Extension Debugger**: `about:debugging#/runtime/this-firefox`
- **Content Scripts**: Regular Firefox Developer Tools
- **Background Scripts**: Available in extension debugger

#### Edge DevTools
- Similar to Chrome DevTools
- Access via `edge://extensions/` → "Details" → "background page"

### VS Code Extensions (Recommended)

- **ESLint**: For code quality checking
- **Prettier**: For code formatting
- **GitLens**: For enhanced Git functionality
- **Thunder Client**: For API testing
- **JavaScript (ES6) code snippets**: For faster development

## Testing Configuration

### Manual Testing Workflow

1. **Functionality Testing**:
   ```bash
   # Build and load in all browsers
   ./build.sh

   # Test basic functionality:
   # - Extension popup opens
   # - Context menu appears
   # - Authentication flow works
   ```

2. **Cross-Browser Testing**:
   - Test each target browser separately
   - Verify browser-specific features work
   - Check UI consistency across browsers

3. **Integration Testing**:
   - Test AnkiConnect integration
   - Verify AI API calls work
   - Test OAuth2 authentication flow

### Test Environment Variables

For development, you can set environment variables:

```bash
# Optional: Set environment variables for testing
export ANKILINGO_DEBUG=true
export ANKILINGO_ENV=development
```

## Common Issues and Solutions

### Build Issues

**Error: `jq: command not found`**
```bash
# Install jq
sudo apt install jq  # Linux
brew install jq     # macOS
```

**Error: Permission denied on build.sh**
```bash
# Make build script executable
chmod +x build.sh
```

### Browser Extension Loading Issues

**Chrome: "Manifest file is missing or unreadable"**
- Verify `dist/chrome/manifest.json` exists
- Check JSON syntax in manifest files
- Run `./build.sh` to rebuild

**Firefox: "Extension could not be verified"**
- Check manifest permissions
- Verify content security policies
- Ensure all required files are present

**Edge: Loading fails**
- Clear browser cache
- Check Windows file permissions
- Verify Edge-specific manifest properties

### AnkiConnect Issues

**Connection refused error**
- Ensure Anki is running
- Verify AnkiConnect is installed and enabled
- Check if port 8765 is accessible

### OAuth2 Issues

**Redirect URI mismatch**
- Verify redirect URIs in Google Cloud Console
- Check manifest client IDs
- Ensure extension ID is correct for Chrome

## Development Best Practices

### Code Organization

- Keep browser-specific code minimal
- Use common files for shared functionality
- Follow the established file naming conventions
- Maintain consistent code style across files

### Testing Strategy

- Test in all target browsers before committing
- Verify Anki integration works
- Test authentication flow
- Check error handling and edge cases

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### Debugging Tips

- Use browser developer tools extensively
- Check console logs for error messages
- Test with network throttling enabled
- Use the provided debugging guides for complex issues

## Next Steps

After setting up your development environment:

1. Read the [Architecture Overview](../architecture/overview.md) to understand the system design
2. Review the [Contribution Workflow](../development/contribution-workflow.md) for development processes
3. Check the [Multi-Browser Pattern](../architecture/multi-browser-pattern.md) for understanding browser-specific code
4. Start with your first contribution following the [First Contribution Guide](first-contribution.md)

For additional help or questions:
- Check the [Troubleshooting Guide](../troubleshooting/common-development-issues.md)
- Review existing GitHub issues
- Join the project discussions (if available)