// Échappement HTML pour éviter l'injection XSS dans les templates serveur
// (bulletins, documents, rapports). Source unique — utilisé via Puppeteer
// donc une faille ici aurait des conséquences (SSRF/file://, etc.).
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
