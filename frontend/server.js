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

// Handle React Router - serve index.html for all GET requests that don't match static files
// This catch-all MUST be last and use app.get('*') to catch all routes
// Express static middleware with fallthrough:true will call next() if file not found,
// allowing this catch-all to handle routes like /outfits, /wardrobe, etc.
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
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
      console.error('Request path:', req.path);
      console.error('Index path:', indexPath);
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

