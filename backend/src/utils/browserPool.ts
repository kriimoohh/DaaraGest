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
  var PRINTABLE_H = 1046;
  document.querySelectorAll('.a4-page').forEach(function (el) {
    var fit = el.querySelector('.a4-fit');
    if (!fit) return;
    var desired = parseFloat(fit.getAttribute('data-zoom') || '1') || 1;
    var s = desired;
    for (var i = 0; i < 4; i++) {
      fit.style.width = (100 / s) + '%';
      fit.style.minHeight = (PRINTABLE_H / s) + 'px';
      var h = fit.scrollHeight;
      var next = Math.min(desired, PRINTABLE_H / h);
      if (Math.abs(next - s) < 0.005) { s = next; break; }
      s = next;
    }
    if (s === 1) {
      fit.style.width = '';
      fit.style.minHeight = '';
      return;
    }
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
