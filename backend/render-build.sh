#!/usr/bin/env bash
set -o errexit

# This script installs Google Chrome (not Chromium)
# For most use cases, use Chromium instead (Option 1 in RENDER_CHROME_SETUP.md)
# This script is only needed if you specifically require Chrome's proprietary features

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

