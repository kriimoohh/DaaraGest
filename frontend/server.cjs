const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const distPath = path.join(__dirname, 'dist');

// Diagnostics au démarrage
console.log('PORT       :', PORT);
console.log('__dirname  :', __dirname);
console.log('dist path  :', distPath);
console.log('dist exists:', fs.existsSync(distPath));
console.log('index.html :', fs.existsSync(path.join(distPath, 'index.html')));

// Statique
app.use(express.static(distPath));

// SPA fallback
app.get('*', function (req, res) {
  var indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, function (err) {
    if (err) {
      console.error('sendFile error:', err.message);
      res.status(500).send('Build introuvable. Contactez l\'administrateur.');
    }
  });
});

// Error handler Express
app.use(function (err, req, res, next) {
  console.error('Express error:', err);
  res.status(500).send('Erreur interne');
});

// Ne pas crasher sur erreur non capturée
process.on('uncaughtException', function (err) {
  console.error('uncaughtException:', err);
});
process.on('unhandledRejection', function (err) {
  console.error('unhandledRejection:', err);
});

app.listen(PORT, '0.0.0.0', function () {
  console.log('Serveur prêt sur le port', PORT);
});
