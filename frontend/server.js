import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// Serve static files from the dist directory
// Only serve actual files (JS, CSS, images, etc.), not routes
// Use a custom handler to check if file exists before serving
app.use((req, res, next) => {
  // Skip if this is a route (no file extension) - let catch-all handle it
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
  if (!hasExtension) {
    return next(); // Skip static middleware for routes
  }
  
  // For files with extensions, use static middleware
  express.static(distPath, {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true,
    lastModified: true,
    index: false, // Don't automatically serve index.html
    fallthrough: true, // Continue to next middleware if file not found
  })(req, res, next);
});

// Error handling middleware (must come before catch-all)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (!res.headersSent) {
    res.status(500).send('Internal server error');
  }
});

// Catch-all route: serve index.html for ALL routes
// This MUST be last - React Router will handle client-side routing
// Handle all HTTP methods (GET, POST, etc.) to ensure SPA routing works
app.all('*', (req, res, next) => {
  // Skip if this is an API request (should be handled by backend)
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip if this is a static asset request (should have been handled by static middleware)
  // Check if the request is for a file (has extension)
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
  if (hasExtension) {
    // This should have been handled by static middleware
    // If we reach here, the file doesn't exist - return 404
    return res.status(404).send('File not found');
  }
  
  // Log the request for debugging
  console.log(`[SPA Route] ${req.method} ${req.path} - serving index.html`);
  
  // Check if index.html exists
  if (!existsSync(indexPath)) {
    console.error(`[ERROR] index.html not found at: ${indexPath}`);
    return res.status(500).send('Application not found');
  }
  
  // Set headers to prevent caching of index.html
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'text/html; charset=utf-8',
  });
  
  // Serve index.html for all routes (React Router will handle routing)
  res.sendFile(indexPath, {
    maxAge: 0,
    etag: false,
    lastModified: false,
  }, (err) => {
    if (err) {
      console.error(`[ERROR] Failed to serve index.html for ${req.path}:`, err);
      if (!res.headersSent) {
        res.status(500).send('Error loading application');
      }
    } else {
      console.log(`[SUCCESS] Served index.html for ${req.path}`);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from ${distPath}`);
});

