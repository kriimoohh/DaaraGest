'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
var ROOT = path.join(__dirname, 'dist');

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

http.createServer(function (req, res) {
  var url = req.url.split('?')[0];
  var file = path.join(ROOT, url);

  // SPA fallback si le fichier n'existe pas
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html');
  }

  var contentType = MIME[path.extname(file)] || 'application/octet-stream';

  fs.readFile(file, function (err, data) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Erreur serveur: ' + err.message);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'max-age=31536000',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', function () {
  console.log('DaaraGest frontend - port ' + PORT);
  console.log('Dist:', ROOT, '| exists:', fs.existsSync(ROOT));
});
