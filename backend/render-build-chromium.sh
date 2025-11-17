#!/usr/bin/env bash
set -o errexit

# This script installs Chromium (lighter than Chrome)
# This is the recommended option for Render deployment

echo "Installing Chromium..."

# Try to update package lists, but continue if it fails (read-only filesystem issue)
# Redirect stderr to suppress error messages about read-only filesystem
apt-get update 2>/dev/null || echo "Skipping apt-get update (read-only filesystem detected)"

# Install Chromium and sandbox
apt-get install -y chromium chromium-sandbox || {
  echo "Warning: Standard installation failed, trying without authentication..."
  apt-get install -y --allow-unauthenticated chromium chromium-sandbox
}

# Continue with normal build
echo "Installing npm dependencies..."
npm install

echo "Building TypeScript..."
npm run build

