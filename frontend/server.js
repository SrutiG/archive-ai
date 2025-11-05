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
app.use(express.static(distPath, {
  maxAge: '1d', // Cache static assets for 1 day
  etag: true,
  lastModified: true,
  index: false, // Don't automatically serve index.html
  fallthrough: true, // Continue to next middleware if file not found
}));

// Handle React Router - serve index.html for all non-API routes
// This catch-all handles all routes that don't match static files
// Use app.use to handle all HTTP methods (GET, POST, PUT, DELETE, etc.)
app.use((req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // Only handle GET requests for serving HTML (other methods shouldn't hit this)
  if (req.method !== 'GET') {
    return next();
  }

  // Skip requests for actual static files (they should have been served already)
  // But if they reach here, they don't exist, so return 404
  const fileExtension = path.extname(req.path);
  if (fileExtension && fileExtension !== '.html') {
    return res.status(404).send('File not found');
  }

  // Check if index.html exists before sending
  if (!existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    return res.status(404).send('Application not found');
  }

  // Set headers to prevent caching of index.html
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  
  // Serve index.html for all routes (React Router will handle routing)
  res.sendFile(indexPath, {
    maxAge: 0,
    etag: false,
    lastModified: false,
  }, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      if (!res.headersSent) {
        res.status(500).send('Error loading application');
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving static files from ${distPath}`);
  console.log(`Index file path: ${indexPath}`);
  console.log(`Index file exists: ${existsSync(indexPath)}`);
});

