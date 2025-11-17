# Setting Up Chromium Locally

The scraper prefers Chromium over Chrome for better performance. Here's how to set it up on macOS.

## Option 1: Install Chromium via Homebrew (macOS Monterey+ only)

**Note**: Chromium via Homebrew is deprecated and requires macOS Monterey (12.0) or newer. If you're on an older macOS version, use Option 2.

1. **Install Chromium**:
   ```bash
   brew install --cask chromium
   ```

2. **Verify installation**:
   ```bash
   ls -la /Applications/Chromium.app/Contents/MacOS/Chromium
   ```

3. **Set environment variable** (optional, but recommended):
   Add to your `backend/.env` file:
   ```
   CHROME_PATH=/Applications/Chromium.app/Contents/MacOS/Chromium
   ```

## Option 2: Download Chromium Manually (Recommended for older macOS)

1. **Download Chromium for macOS**:
   - **Easiest**: Download from [Chromium.org](https://www.chromium.org/getting-involved/download-chromium)
   - **Or use snapshots**: Visit https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html
     - Find the latest macOS build (look for `mac` in the path)
     - Download `chrome-mac.zip`
   - **Or use Ungoogled Chromium** (privacy-focused): https://github.com/ungoogled-software/ungoogled-chromium-macos/releases

2. **Extract and install**:
   ```bash
   # Extract the zip file
   unzip chrome-mac.zip
   
   # Move to Applications (if it's a .app bundle)
   # Or note the path to the Chromium executable
   ```

3. **Set environment variable**:
   Add to your `backend/.env` file:
   ```
   CHROME_PATH=/path/to/chromium/Chromium.app/Contents/MacOS/Chromium
   ```
   
   Or if you extracted to a folder:
   ```
   CHROME_PATH=/path/to/chrome-mac/Chromium.app/Contents/MacOS/Chromium
   ```

## Option 3: Use Chrome (Fallback)

If you can't install Chromium, Chrome will work fine. The scraper will automatically use Chrome if Chromium isn't found. Chrome is already installed at:
```
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

The scraper will detect and use it automatically.

## Option 4: Use Environment Variable to Override

If Chromium is installed in a non-standard location, you can set the `CHROME_PATH` environment variable:

**In your `backend/.env` file:**
```
CHROME_PATH=/path/to/your/chromium/executable
```

**Or export it in your shell:**
```bash
export CHROME_PATH=/Applications/Chromium.app/Contents/MacOS/Chromium
```

## Verify It's Working

The scraper will automatically detect and use Chromium if it's available. You'll see in the logs:
```
[ProductScrape] Found browser via which: /Applications/Chromium.app/Contents/MacOS/Chromium
```

Or if using the environment variable:
```
[ProductScrape] Found Chrome at: /Applications/Chromium.app/Contents/MacOS/Chromium
```

## Current Browser Detection Order

The scraper checks in this order (stops at first match):
1. `/usr/bin/chromium` (Linux)
2. `/usr/bin/chromium-browser` (Linux)
3. `/usr/bin/google-chrome` (Linux)
4. `/usr/bin/google-chrome-stable` (Linux)
5. `/Applications/Chromium.app/Contents/MacOS/Chromium` (macOS)
6. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (macOS)
7. `CHROME_PATH` environment variable
8. `which chromium || which chromium-browser || which google-chrome` (system PATH)

Since Chromium is checked first, if it's installed, it will be used automatically!

