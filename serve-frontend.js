const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const root = path.join(__dirname, 'build');
const indexFile = path.join(root, 'index.html');

if (!fs.existsSync(indexFile)) {
  console.error('ConnectSphere build folder is missing. Run: npm run build');
  process.exit(1);
}

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
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  const cleanPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(root, cleanPath === '/' ? 'index.html' : cleanPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      filePath = indexFile;
    }

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(500);
        res.end('Unable to load frontend');
        return;
      }

      res.writeHead(200, {
        'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': filePath === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable'
      });
      res.end(data);
    });
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('Port ' + port + ' is already in use. Close the old frontend terminal or stop the process using port 3000.');
  } else {
    console.error(error.message || error);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log('ConnectSphere frontend ready at http://localhost:' + port);
  console.log('Keep this window open while using the frontend.');
});
