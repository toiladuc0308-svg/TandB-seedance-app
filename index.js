import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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
    pathRewrite: { '^/catbox-upload': '/user/api.php' },
    secure: false,
  })
);

// Serve production static assets from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback for Express 5
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
