# Render Deployment with Puppeteer's Bundled Chromium

## Problem

Render's build environment doesn't have root permissions, so installing Chromium via `apt-get` fails with permission errors.

## Solution: Use Puppeteer's Bundled Chromium

Puppeteer can bundle its own Chromium browser, eliminating the need for system package installation.

## Setup

1. **Build Command** (in Render dashboard):
   ```bash
   npm install && npx puppeteer browsers install chrome && npm run build
   ```
   This installs the Chrome browser that Puppeteer needs.

2. **Start Command**: `npm start`

3. **Root Directory**: `backend`

4. **No Environment Variables Needed**: 
   - You can remove `CHROME_PATH` - Puppeteer handles everything automatically

## How It Works

- `puppeteer` (not `puppeteer-core`) can download Chrome browsers on demand
- The build command runs `npx puppeteer browsers install chrome` to download Chrome (~300MB)
- Chrome is cached in `/opt/render/project/.render/puppeteer-cache` for faster subsequent builds
- The code automatically detects Render and uses the correct cache directory
- Works on any platform (Render, local, etc.) without system Chrome installation

## Trade-offs

**Pros:**
- ✅ Works everywhere (no system dependencies)
- ✅ No permission issues
- ✅ Consistent browser version across environments
- ✅ Simplest deployment setup
- ✅ Browser cached in Render's persistent storage for faster rebuilds

**Cons:**
- ⚠️ First build downloads Chrome (~300MB, takes ~1-2 minutes)
- ⚠️ Subsequent builds are faster (uses cached browser)

## Migration from puppeteer-core

The code has been updated to use `puppeteer` instead of `puppeteer-core`. The bundled Chromium is automatically used - no configuration needed.

