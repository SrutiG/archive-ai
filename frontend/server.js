import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import history from 'connect-history-api-fallback';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');

// Use history API fallback middleware for SPA routing
// This rewrites all non-file requests to index.html
// Must come BEFORE static middleware
app.use(history({
  // Disable dot rule to allow files with dots (like .js, .css, .png)
  disableDotRule: true,
  // Only rewrite requests that accept HTML
  htmlAcceptHeaders: ['text/html', 'application/xhtml+xml']
}));

// Serve static files from the dist directory
// This must come AFTER history middleware
app.use(express.static(distPath, {
  maxAge: '1d', // Cache static assets for 1 day
  etag: true,
  lastModified: true,
}));

// Catch-all route to serve index.html for any remaining routes
// This is a backup in case history middleware doesn't catch something
// History middleware should handle most cases, but this ensures 100% coverage
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), {
    maxAge: 0,
    etag: false,
    lastModified: false,
  }, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
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
});

