const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { URL } = require('url');

// Parse CLI args (--port 8086, --open)
const args = process.argv.slice(2);
let cliPort = null;
let autoOpen = false;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    cliPort = Number(args[i + 1]);
    i++;
  } else if (args[i] === '--open' || args[i] === '-o') {
    autoOpen = true;
  }
}

const PORT = cliPort || Number(process.env.PORT) || 8086;
const HOST = process.env.HOST || '0.0.0.0';
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

function getLocalIPv4List() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    exec(`cmd /c start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    exec(`xdg-open "${url}"`);
  }
}

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
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server Error');
  }
});

server.listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log('====================================================');
  console.log('  КосмоЛаб (sim-kosmo) — сервер успешно запущен!');
  console.log(`  Локальный адрес:   ${localUrl}`);
  for (const ip of getLocalIPv4List()) {
    console.log(`  В локальной сети:  http://${ip}:${PORT}`);
  }
  console.log('  Для остановки нажмите Ctrl + C');
  console.log('====================================================');

  if (autoOpen) {
    openBrowser(localUrl);
  }
});
