import type { Browser, Page, PDFOptions } from 'puppeteer';

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
const MAX_CONCURRENT = 3;

let browser: Browser | null = null;
let pending = 0;
const queue: Array<() => void> = [];

async function acquirePage(): Promise<Page> {
  if (pending >= MAX_CONCURRENT) {
    await new Promise<void>(resolve => queue.push(resolve));
  }
  pending++;

  const b = await getBrowser();
  return b.newPage();
}

function releasePage(page: Page): void {
  page.close().catch(() => undefined);
  pending--;
  queue.shift()?.();
}

async function getBrowser(): Promise<Browser> {
  if (browser?.connected) return browser;

  const puppeteer = await import('puppeteer');
  browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: LAUNCH_ARGS,
  });

  browser.on('disconnected', () => {
    browser = null;
  });

  return browser;
}

// Met chaque `.a4-fit` à l'échelle (transform: scale) pour garantir
// « 1 bulletin = 1 page A4 ». La hauteur imprimable = 297mm - 2×10mm de
// marges = 277mm ≈ 1046px @96dpi.
//
// `data-zoom` (Paramètres → Bulletins, échelle de police) est l'agrandissement
// SOUHAITÉ ; l'échelle effective est plafonnée à « ce qui tient sur la page ».
// Historiquement l'agrandissement passait par CSS `zoom`, mais scrollHeight ne
// tient pas compte du zoom (Chromium moderne) : le contenu était mesuré « à
// 100 % », jugé OK, puis rendu 1,5× plus grand → bas de page tronqué (visible
// surtout sur les bulletins combinés, les plus hauts). Tout passe désormais
// par transform: scale, mesuré ici.
//
// `transform: scale(s)` change AUSSI la largeur → on donne au bloc une largeur
// locale de 100/s % (et un min-height local de H/s) pour qu'une fois mis à
// l'échelle il occupe exactement la page. Comme la largeur locale re-coule le
// texte, on itère jusqu'à convergence.
const FIT_A4_SCRIPT = `(() => {
  // 1046px = 277mm imprimables ; cible réduite de 8px : scrollHeight arrondit
  // à l'entier inférieur et l'échelle fractionnaire ré-arrondit au rendu — sans
  // cette marge, la dernière ligne (signatures) glissait sur une 2e page.
  var PRINTABLE_H = 1046;
  var TARGET_H = PRINTABLE_H - 8;
  document.querySelectorAll('.a4-page').forEach(function (el) {
    var fit = el.querySelector('.a4-fit');
    if (!fit) return;
    var desired = parseFloat(fit.getAttribute('data-zoom') || '1') || 1;
    // Mesure SANS plancher de hauteur : min-height gonflerait scrollHeight
    // (h = max(contenu, P/s)) et verrouillerait l'échelle à sa première
    // valeur basse — à 150 % le rendu sortait PLUS PETIT qu'à 100 %.
    fit.style.minHeight = '0';
    var s = desired;
    for (var i = 0; i < 5; i++) {
      fit.style.width = (100 / s) + '%';
      var next = Math.min(desired, TARGET_H / fit.scrollHeight);
      if (Math.abs(next - s) < 0.005) { s = next; break; }
      s = next;
    }
    // Clamp final : garantit h×s ≤ P à la largeur réellement appliquée
    // (élargir ne peut que réduire h, donc un seul clamp suffit).
    fit.style.width = (100 / s) + '%';
    var hf = fit.scrollHeight;
    if (hf * s > TARGET_H) {
      s = TARGET_H / hf;
      fit.style.width = (100 / s) + '%';
    }
    if (s === 1) {
      fit.style.width = '';
      fit.style.minHeight = '';
      return;
    }
    // Le plancher n'est appliqué qu'APRÈS le choix de l'échelle : il sert
    // uniquement à caler le pied de page en bas des bulletins aérés.
    fit.style.minHeight = (TARGET_H / s) + 'px';
    fit.style.transformOrigin = 'top left';
    fit.style.transform = 'scale(' + s + ')';
    el.style.height = PRINTABLE_H + 'px';
    el.style.overflow = 'hidden';
  });
})();`;

export async function renderPdfHtml(
  html: string,
  pdfOptions: PDFOptions,
  opts: { fitToA4?: boolean } = {},
): Promise<Buffer> {
  const page = await acquirePage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    if (opts.fitToA4) await page.evaluate(FIT_A4_SCRIPT);
    const pdf = await page.pdf(pdfOptions);
    return Buffer.from(pdf);
  } finally {
    releasePage(page);
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }
}

export async function checkBrowser(): Promise<'ok' | 'unavailable'> {
  try {
    await getBrowser();
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
