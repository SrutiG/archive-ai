# Chrome/Chromium Setup for Render Deployment

The product scraper uses Puppeteer to render JavaScript-heavy pages (like Banana Republic). For this to work on Render, you need to install Chrome or Chromium.

**Recommendation: Use Chromium** - It's lighter, faster to install, and has all the features needed for web scraping.

## Option 1: Using Chromium (Recommended)

Simplest and fastest option. Add this to your **Build Command** in Render dashboard:

```bash
apt-get update && apt-get install -y chromium chromium-sandbox && npm install && npm run build
```

Set environment variable:
```
CHROME_PATH=/usr/bin/chromium
```

**Why Chromium?**
- ✅ Smaller download (~50MB vs ~100MB+)
- ✅ Faster installation
- ✅ Lower memory usage
- ✅ All Puppeteer features available
- ✅ No proprietary codecs needed for scraping

## Option 2: Build Script with Chrome

Create a `render-build.sh` file in your `backend/` directory:

```bash
#!/usr/bin/env bash
set -o errexit

STORAGE_DIR=/opt/render/project/.render

# Install Chrome dependencies
echo "Installing Chrome dependencies..."
apt-get update
apt-get install -y \
  libglib2.0-0 \
  libnss3 \
  libfontconfig1 \
  libfreetype6 \
  libappindicator1 \
  libxss1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libgbm1 \
  libxcursor1 \
  libxrandr2 \
  libxcomposite1 \
  libxdamage1 \
  libxtst6 \
  libpango-1.0-0 \
  libcairo2 \
  libdbus-1-3 \
  libpulse0 \
  libatspi2.0-0 \
  libgtk-3-0 \
  libxkbcommon0 \
  wget \
  unzip

# Download and install Chrome
if [[ ! -d $STORAGE_DIR/chrome ]]; then
  echo "Downloading Chrome..."
  mkdir -p $STORAGE_DIR/chrome
  cd $STORAGE_DIR/chrome
  wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x ./google-chrome-stable_current_amd64.deb $STORAGE_DIR/chrome
  rm ./google-chrome-stable_current_amd64.deb
  cd $HOME/project/src/backend
else
  echo "Using cached Chrome"
fi

# Add Chrome to PATH
export PATH="${PATH}:$STORAGE_DIR/chrome/opt/google/chrome"

# Set Chrome path for Puppeteer
export CHROME_PATH="$STORAGE_DIR/chrome/opt/google/chrome/google-chrome"

# Continue with normal build
echo "Installing npm dependencies..."
npm install

echo "Building TypeScript..."
npm run build
```

Then in Render dashboard:
1. Go to your service settings
2. Set **Build Command** to: `bash render-build.sh`
3. Set **Start Command** to: `npm start`
4. Add environment variable: `CHROME_PATH=/opt/render/project/.render/chrome/opt/google/chrome/google-chrome`

## Option 3: Inline Build Command with Chrome

If you need Chrome specifically (e.g., for proprietary codecs), add this directly to your **Build Command** in Render dashboard:

```bash
apt-get update && apt-get install -y libglib2.0-0 libnss3 libfontconfig1 libfreetype6 libappindicator1 libxss1 libasound2 libatk-bridge2.0-0 libdrm2 libgbm1 libxcursor1 libxrandr2 libxcomposite1 libxdamage1 libxtst6 libpango-1.0-0 libcairo2 libdbus-1-3 libpulse0 libatspi2.0-0 libgtk-3-0 libxkbcommon0 wget unzip && mkdir -p /opt/render/project/.render/chrome && cd /opt/render/project/.render/chrome && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && dpkg -x ./google-chrome-stable_current_amd64.deb /opt/render/project/.render/chrome && rm ./google-chrome-stable_current_amd64.deb && cd $HOME/project/src/backend && npm install && npm run build
```

And set environment variable:
```
CHROME_PATH=/opt/render/project/.render/chrome/opt/google/chrome/google-chrome
```

**When to use Chrome instead of Chromium:**
- If you need proprietary codecs (H.264, AAC, MP3) - unlikely for scraping
- If you need Google services integration - not needed for headless automation

## Testing Locally

On macOS, Chrome should be at:
```
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

The scraper will automatically detect it.

## Render Dashboard Setup

1. **Create a new Web Service** in Render
2. **Connect your repository**
3. **Configure:**
   - **Environment**: `Node`
   - **Build Command**: Use Option 1 (Chromium) or `bash render-build.sh` (Chrome)
   - **Start Command**: `npm start`
   - **Root Directory**: `backend`
4. **Add Environment Variable:**
   - Key: `CHROME_PATH`
   - Value: `/usr/bin/chromium` (for Chromium) or `/opt/render/project/.render/chrome/opt/google/chrome/google-chrome` (for Chrome)
5. **Deploy!**

## Notes

- **For most use cases, Chromium (Option 1) is recommended** - it's simpler and faster
- Chrome build script caches Chrome in `/opt/render/project/.render/chrome` to speed up subsequent builds
- The browser will be available at the path specified in `CHROME_PATH` environment variable
- The scraper automatically detects the browser using the `CHROME_PATH` environment variable
- Both Chrome and Chromium work identically for Puppeteer web scraping

