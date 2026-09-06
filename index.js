import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// Ensure dist exists; if missing, build it immediately
if (!fs.existsSync(indexPath)) {
  console.log('[Setup] dist/index.html not found. Running npm run build...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (err) {
    console.error('[Setup] Error running build fallback:', err);
  }
}

// Proxy for Gommo API
app.use(
  '/gommo-api',
  createProxyMiddleware({
    target: 'https://api.gommo.net/api/apps/go-mmo',
    changeOrigin: true,
    pathRewrite: { '^/gommo-api': '' },
    secure: false,
    headers: {
      Origin: 'https://79ai.net',
      Referer: 'https://79ai.net/',
    },
  })
);

// Proxy for Catbox Upload
app.use(
  '/catbox-upload',
  createProxyMiddleware({
    target: 'https://catbox.moe',
    changeOrigin: true,
    pathRewrite: () => '/user/api.php',
    secure: false,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
);

// Proxy for Litterbox Upload (fallback up to 1GB)
app.use(
  '/litterbox-upload',
  createProxyMiddleware({
    target: 'https://litterbox.catbox.moe',
    changeOrigin: true,
    pathRewrite: () => '/resources/internals/api.php',
    secure: false,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
);

// Serve production static assets from dist
app.use(express.static(distPath));

// SPA fallback
app.use((req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Application build in progress or dist/index.html missing. Please rebuild.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
