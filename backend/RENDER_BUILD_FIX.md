# Render Build Fix for Read-Only File System Error

If you're getting this error:
```
E: List directory /var/lib/apt/lists/partial is missing. - Acquire (30: Read-only file system)
```

Or:
```
bash: line 1: sudo: command not found
```

## Solution 1: Use the Chromium build script (Recommended)

Use the `render-build-chromium.sh` script which handles errors gracefully:

1. In Render dashboard, set **Build Command** to: `bash render-build-chromium.sh`
2. The script will skip `apt-get update` if the filesystem is read-only
3. Set environment variable: `CHROME_PATH=/usr/bin/chromium`

**Note**: If you specifically need Chrome (not Chromium), use `bash render-build.sh` instead, but Chromium is recommended for most use cases.

## Solution 2: Skip apt-get update

Try installing without updating package lists:

```bash
apt-get install -y --allow-unauthenticated chromium chromium-sandbox && npm install && npm run build
```

## Solution 3: Install Chromium via npm (Most Reliable)

If apt-get continues to fail, use Puppeteer's bundled Chromium:

1. Install `puppeteer` (not `puppeteer-core`) in your `package.json`:
   ```bash
   npm install puppeteer
   ```

2. Update `backend/src/productSearch.ts` to use Puppeteer's bundled browser:
   - Change `import('puppeteer-core')` to `import('puppeteer')`
   - Remove the `executablePath` option (Puppeteer will use bundled Chromium)

3. Build command becomes simply: `npm install && npm run build`

4. No `CHROME_PATH` environment variable needed

**Note**: This will increase your `node_modules` size significantly (~300MB), but it's the most reliable option if system package installation fails.

## Recommended Approach

1. **First, try Solution 1** (build script) - it handles errors gracefully
2. **If that fails, try Solution 2** (skip update)
3. **If both fail, use Solution 3** (bundled Chromium) - this is guaranteed to work

