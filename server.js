const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.cosmolab': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  try {
    const parsed = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(parsed.pathname);

    if (pathname === '/' || pathname === '/lab' || pathname === '/lab.html') {
      pathname = '/index.html';
    }

    const safePath = path.normalize(path.join(ROOT, pathname));
    if (!safePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA routes
        const indexPath = path.join(ROOT, 'index.html');
        fs.readFile(indexPath, (readErr, data) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(data);
        });
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      fs.readFile(safePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Internal Server Error');
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      });
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CosmoLab server listening on http://${HOST}:${PORT}`);
});
