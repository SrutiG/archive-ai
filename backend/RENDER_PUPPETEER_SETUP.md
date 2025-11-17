# Render Deployment with Puppeteer's Bundled Chromium

## Problem

Render's build environment doesn't have root permissions, so installing Chromium via `apt-get` fails with permission errors.

## Solution: Use Puppeteer's Bundled Chromium

Puppeteer can bundle its own Chromium browser, eliminating the need for system package installation.

## Setup

**IMPORTANT**: Set the environment variable FIRST, then build!

1. **Environment Variable** (set this BEFORE building):
   - Key: `PUPPETEER_CACHE_DIR`
   - Value: `/opt/render/project/.render/puppeteer-cache`
   - **This must be set in Render's dashboard before building**
   - This ensures Chrome is installed to persistent storage during build AND found at runtime

2. **Build Command** (in Render dashboard):
   ```bash
   npm install && npx puppeteer browsers install chrome && npm run build
   ```
   This installs the Chrome browser that Puppeteer needs.

3. **Start Command**: `npm start`

4. **Root Directory**: `backend`

5. **Remove old environment variable**:
   - You can remove `CHROME_PATH` - Puppeteer handles everything automatically

## How It Works

- `puppeteer` (not `puppeteer-core`) can download Chrome browsers on demand
- The `PUPPETEER_CACHE_DIR` environment variable tells Puppeteer where to install/cache Chrome
- During build, `npx puppeteer browsers install chrome` downloads Chrome (~300MB) to the cache directory
- At runtime, Puppeteer looks for Chrome in the same cache directory
- Chrome is cached in Render's persistent storage (`/opt/render/project/.render/puppeteer-cache`) so it persists across rebuilds
- Works on any platform (Render, local, etc.) without system Chrome installation

**Why the environment variable is required:**
- Without it, Chrome installs to `/opt/render/.cache/puppeteer` (temporary filesystem) during build
- But at runtime, the code might look in a different location, causing "Chrome not found" errors
- Setting `PUPPETEER_CACHE_DIR` ensures the same location is used for both build and runtime

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

