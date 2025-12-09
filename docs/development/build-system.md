# Build System Guide

This document provides a comprehensive explanation of the AnkiLingoFlash build system, including the build script, manifest merging, and distribution package creation.

## Overview

The AnkiLingoFlash build system creates browser-specific extension packages from a shared codebase. It combines common functionality with browser-specific adaptations to produce three distinct extension packages: Chrome, Firefox, and Edge.

## Build Script Analysis

### Script Location and Purpose

**File**: `build.sh`
**Purpose**: Automated build process for all supported browsers
**Dependencies**: `jq` (JSON processor), standard Unix utilities

### Complete Build Script

```bash
#!/bin/bash

BROWSERS=("chrome" "firefox" "edge")

# Function to build the extension for a specific browser
build_for_browser() {
    local browser=$1
    local output_dir="dist/${browser}"

    echo -n "Building for ${browser}..."

    mkdir -p "${output_dir}"

    # Copy common files to the output directory
    cp -r _locales franc icons "${output_dir}/"
    cp src/common/popup.html "${output_dir}/"
    cp src/common/style.css "${output_dir}/"
    cp src/config.js "${output_dir}/"
    cp src/common/content.js "${output_dir}/"

    # Combine browser-specific and common background scripts
    cat src/browser-specific/${browser}/background.js >"${output_dir}/background.js"
    cat src/common/background_common.js >>"${output_dir}/background.js"

    # Combine browser-specific and common popup scripts
    cat src/browser-specific/${browser}/popup.js src/common/popup_common.js >"${output_dir}/popup.js"

    # Merge common and browser-specific manifest files
    jq -s '.[0] * .[1]' src/common/manifest_common.json src/browser-specific/${browser}/manifest.json >"${output_dir}/manifest.json"

    echo "Build for ${browser} completed!"
}

# Check if jq is installed, which is necessary for merging JSON files
if ! command -v jq &>/dev/null; then
    echo "jq could not be found. Please install it to continue."
    exit 1
fi

# Clean the distribution directory to ensure a fresh build
rm -rf dist

for browser in "${BROWSERS[@]}"; do
    build_for_browser $browser
done

echo "Build process completed for all browsers!"
```

## Build Process Breakdown

### 1. Initialization

```bash
BROWSERS=("chrome" "firefox" "edge")
```

**Purpose**: Defines the target browsers for the build process
**Modification**: Add new browsers to this array to support additional targets

### 2. Prerequisite Check

```bash
if ! command -v jq &>/dev/null; then
    echo "jq could not be found. Please install it to continue."
    exit 1
fi
```

**Purpose**: Verifies that `jq` is available for JSON manipulation
**Why `jq` is Required**: Merges manifest files while preserving proper JSON structure

### 3. Clean Build Directory

```bash
rm -rf dist
```

**Purpose**: Removes previous build artifacts to ensure clean builds
**Benefits**: Prevents conflicts from old files and ensures consistency

### 4. Browser-Specific Build Function

#### Directory Creation

```bash
mkdir -p "${output_dir}"
```

**Purpose**: Creates the distribution directory for the specific browser
**Structure**: `dist/{browser}/` (e.g., `dist/chrome/`)

#### Common Files Copy

```bash
# Copy shared assets
cp -r _locales franc icons "${output_dir}/"
cp src/common/popup.html "${output_dir}/"
cp src/common/style.css "${output_dir}/"
cp src/config.js "${output_dir}/"
cp src/common/content.js "${output_dir}/"
```

**Files Copied**:
- `_locales/`: Internationalization files for all supported languages
- `franc/`: Language detection library (vendored)
- `icons/`: Extension icons in various sizes
- `popup.html`: Extension popup HTML structure
- `style.css`: CSS styling for popup and UI components
- `config.js`: Configuration constants and settings
- `content.js`: Content script (runs on web pages)

#### Script Concatenation

**Background Script**:
```bash
cat src/browser-specific/${browser}/background.js >"${output_dir}/background.js"
cat src/common/background_common.js >>"${output_dir}/background.js"
```

**Popup Script**:
```bash
cat src/browser-specific/${browser}/popup.js src/common/popup_common.js >"${output_dir}/popup.js"
```

**Ordering Principle**:
1. Browser-specific code first (can override or set up browser-specific behavior)
2. Common code second (provides shared functionality)

#### Manifest Merging

```bash
jq -s '.[0] * .[1]' src/common/manifest_common.json src/browser-specific/${browser}/manifest.json >"${output_dir}/manifest.json"
```

**`jq` Merge Command Breakdown**:
- `-s`: Read all inputs into an array
- `.[0] * .[1]`: Merge the second object into the first (browser-specific overrides common)
- `> "${output_dir}/manifest.json"`: Output to the browser-specific manifest

## Directory Structure Analysis

### Source Structure

```
src/
├── common/                           # Shared functionality
│   ├── content.js                   # 1,631 lines - Main content script
│   ├── background_common.js         # 1,177 lines - Background script logic
│   ├── popup_common.js              # 1,066 lines - Popup interface logic
│   ├── popup.html                   # Extension popup HTML
│   ├── style.css                    # UI styling
│   └── manifest_common.json         # Common manifest properties
├── browser-specific/                # Browser adaptations
│   ├── chrome/
│   │   ├── background.js            # 70 lines - Chrome OAuth2
│   │   ├── popup.js                 # 31 lines - Chrome popup integration
│   │   └── manifest.json            # Chrome-specific manifest
│   ├── firefox/
│   │   ├── background.js            # 90 lines - Firefox OAuth2
│   │   ├── popup.js                 # 103 lines - Firefox popup handling
│   │   └── manifest.json            # Firefox manifest + gecko settings
│   └── edge/
│       ├── background.js            # 90 lines - Edge adaptations
│       ├── popup.js                 # 59 lines - Edge popup integration
│       └── manifest.json            # Edge manifest configuration
└── config.js                        # Global configuration
```

### Distribution Structure (After Build)

```
dist/
├── chrome/                          # Chrome extension package
│   ├── manifest.json                # Merged manifest for Chrome
│   ├── background.js                # Combined background script (1,247 lines)
│   ├── popup.js                     # Combined popup script (1,097 lines)
│   ├── content.js                   # Content script (1,631 lines)
│   ├── popup.html                   # Extension popup UI
│   ├── style.css                    # Complete styling
│   ├── config.js                    # Configuration
│   ├── icons/                       # All extension icons
│   ├── franc/                       # Language detection library
│   └── _locales/                    # Internationalization files
├── firefox/                         # Firefox extension package
│   └── [same structure as chrome]
└── edge/                            # Edge extension package
    └── [same structure as chrome]
```

## Manifest Merging Strategy

### Common Manifest (`manifest_common.json`)

Contains shared properties across all browsers:

```json
{
  "manifest_version": 3,
  "name": "AnkiLingoFlash",
  "version": "0.5.1",
  "description": "A browser extension for automated Anki flashcard creation",
  "permissions": [
    "contextMenus",
    "activeTab",
    "tabs",
    "storage",
    "identity",
    "scripting",
    "alarms"
  ],
  "host_permissions": [
    "http://localhost/*",
    "https://api.openai.com/*",
    "https://anki-lingo-flash.piriouvictor.workers.dev/*",
    "https://accounts.google.com/*",
    "https://*/*",
    "https://generativelanguage.googleapis.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "AnkiLingoFlash",
    "default_icon": {
      "16": "icons/icon_16.png",
      "48": "icons/icon_48.png",
      "128": "icons/icon_128.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "http://*/*",
        "https://*/*",
        "file://*/*"
      ],
      "js": ["content.js"],
      "css": []
    }
  ],
  "web_accessible_resources": [{
    "resources": ["franc/*"],
    "matches": ["<all_urls>"]
  }],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Browser-Specific Manifests

**Chrome** (`src/browser-specific/chrome/manifest.json`):
```json
{
  "oauth2": {
    "client_id": "CHROME_CLIENT_ID.apps.googleusercontent.com",
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

**Firefox** (`src/browser-specific/firefox/manifest.json`):
```json
{
  "oauth2": {
    "client_id": "FIREFOX_WEB_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "support@ankilingoflash.com",
      "strict_min_version": "109.0"
    }
  },
  "background": {
    "scripts": ["background.js"],
    "type": "module"
  }
}
```

**Edge** (`src/browser-specific/edge/manifest.json`):
```json
{
  "oauth2": {
    "client_id": "EDGE_CLIENT_ID.apps.googleusercontent.com",
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

## Build Optimization

### CSS Optimization (Optional)

The project includes PurgeCSS for CSS optimization:

**Installation**:
```bash
npm install
```

**Usage**:
```bash
# Optional: Optimize CSS for production builds
npx purgecss --css src/common/style.css --content src/common/popup.html --output dist/optimized.css
```

**Benefits**:
- Reduces CSS bundle size
- Removes unused styles
- Improves extension load performance

### File Size Analysis

**Typical Build Output Sizes**:
```
dist/
├── chrome/ (≈2.5MB)
│   ├── content.js: ~80KB (uncompressed)
│   ├── background.js: ~60KB (uncompressed)
│   ├── popup.js: ~50KB (uncompressed)
│   ├── style.css: ~15KB
│   ├── franc/: ~400KB (language detection library)
│   └── icons/: ~100KB
├── firefox/ (≈2.5MB) - Similar to Chrome
└── edge/ (≈2.5MB) - Similar to Chrome
```

## Build Process Commands

### Standard Build

```bash
# Build for all browsers
./build.sh

# Output:
# Building for chrome...Build for chrome completed!
# Building for firefox...Build for firefox completed!
# Building for edge...Build for edge completed!
# Build process completed for all browsers!
```

### Development Build

```bash
# Clean build for development
rm -rf dist
./build.sh

# Verify build
ls -la dist/
```

### Build Validation

```bash
# Validate manifest JSON files
for browser in chrome firefox edge; do
    echo "Validating $browser manifest..."
    jq empty "dist/$browser/manifest.json" && echo "✅ Valid" || echo "❌ Invalid"
done

# Check required files exist
for browser in chrome firefox edge; do
    echo "Checking $browser files..."
    ls dist/$browser/manifest.json
    ls dist/$browser/background.js
    ls dist/$browser/popup.js
    ls dist/$browser/content.js
done
```

## Troubleshooting Build Issues

### Common Problems

**1. `jq: command not found`**
```bash
# Solution: Install jq
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq

# Windows
choco install jq
```

**2. Permission denied on build.sh**
```bash
# Solution: Make script executable
chmod +x build.sh
```

**3. Source files not found**
```bash
# Check directory structure
ls -la src/
ls -la src/common/
ls -la src/browser-specific/

# Verify files exist
find src -name "*.js" -o -name "*.json" -o -name "*.html"
```

**4. Manifest merge errors**
```bash
# Debug jq merge
jq -s '.[0] * .[1]' src/common/manifest_common.json src/browser-specific/chrome/manifest.json | jq .

# Check JSON syntax
cat src/common/manifest_common.json | jq .
cat src/browser-specific/chrome/manifest.json | jq .
```

### Build Debugging

**Verbose Build Script**:
```bash
#!/bin/bash
set -x  # Enable debug mode
set -e  # Exit on error

# Rest of build script...
```

**Step-by-Step Build**:
```bash
# Manual build steps for debugging
BROWSER="chrome"
OUTPUT_DIR="dist/${BROWSER}"

# Create directory
mkdir -p "$OUTPUT_DIR"
echo "Created directory: $OUTPUT_DIR"

# Copy common files
echo "Copying common files..."
cp -v _locales franc icons "$OUTPUT_DIR/"
cp -v src/common/popup.html "$OUTPUT_DIR/"
cp -v src/common/style.css "$OUTPUT_DIR/"
cp -v src/config.js "$OUTPUT_DIR/"
cp -v src/common/content.js "$OUTPUT_DIR/"

# Concatenate scripts
echo "Concatenating scripts..."
cat src/browser-specific/$BROWSER/background.js > "$OUTPUT_DIR/background.js"
cat src/common/background_common.js >> "$OUTPUT_DIR/background.js"

cat src/browser-specific/$BROWSER/popup.js src/common/popup_common.js > "$OUTPUT_DIR/popup.js"

# Merge manifests
echo "Merging manifests..."
jq -s '.[0] * .[1]' src/common/manifest_common.json src/browser-specific/$BROWSER/manifest.json > "$OUTPUT_DIR/manifest.json"

echo "Manual build completed for $BROWSER"
```

## Extending the Build System

### Adding a New Browser

To add support for a new browser (e.g., Safari):

1. **Update Browser List**:
   ```bash
   BROWSERS=("chrome" "firefox" "edge" "safari")
   ```

2. **Create Browser Directory**:
   ```bash
   mkdir -p src/browser-specific/safari
   ```

3. **Create Browser-Specific Files**:
   ```bash
   # src/browser-specific/safari/background.js
   # src/browser-specific/safari/popup.js
   # src/browser-specific/safari/manifest.json
   ```

4. **Add Safari-Specific Logic**:
   - Implement Safari Web Extensions API differences
   - Handle Safari-specific manifest properties
   - Adapt OAuth2 flow for Safari

### Build Enhancements

**Parallel Builds**:
```bash
# Build browsers in parallel (advanced)
for browser in "${BROWSERS[@]}"; do
    build_for_browser $browser &
done
wait  # Wait for all background jobs to complete
```

**Incremental Builds**:
```bash
# Only rebuild if sources changed
if [ "src/common/" -nt "dist/chrome/" ] || [ "src/browser-specific/chrome/" -nt "dist/chrome/" ]; then
    build_for_browser chrome
fi
```

**Build Validation**:
```bash
# Add validation after build
validate_build() {
    local browser=$1
    local dir="dist/$browser"

    # Check required files
    local required_files=("manifest.json" "background.js" "popup.js" "content.js" "popup.html")
    for file in "${required_files[@]}"; do
        if [ ! -f "$dir/$file" ]; then
            echo "❌ Missing $file in $browser build"
            return 1
        fi
    done

    # Validate JSON
    if ! jq empty "$dir/manifest.json"; then
        echo "❌ Invalid manifest.json in $browser build"
        return 1
    fi

    echo "✅ $browser build validated"
    return 0
}
```

This build system provides a robust, automated approach to creating browser-specific extensions from a shared codebase, ensuring consistency while accommodating browser-specific requirements.