const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', function(_req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', function() {
  console.log('Frontend DaaraGest sur le port ' + PORT);
});
