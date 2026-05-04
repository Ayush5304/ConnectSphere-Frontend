const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const root = path.join(__dirname, 'build');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  const cleanPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(root, cleanPath === '/' ? 'index.html' : cleanPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      filePath = path.join(root, 'index.html');
    }

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(500);
        res.end('Unable to load frontend');
        return;
      }

      res.writeHead(200, {
        'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });
      res.end(data);
    });
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`ConnectSphere frontend ready at http://localhost:${port}`);
});
