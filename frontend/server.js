import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

// Servir les fichiers statiques du build Vite
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback — toutes les routes renvoient index.html (React Router)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend DaaraGest sur le port ${PORT}`);
});
