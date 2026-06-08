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

// Réduit (transform: scale) chaque `.a4-fit` dont le contenu dépasse la hauteur
// imprimable d'une page A4, pour garantir « 1 bulletin = 1 page ». La hauteur
// imprimable = 297mm - 2×10mm de marges = 277mm ≈ 1046px @96dpi.
const FIT_A4_SCRIPT = `(() => {
  var PRINTABLE_H = 1046;
  document.querySelectorAll('.a4-page').forEach(function (el) {
    var fit = el.querySelector('.a4-fit');
    if (!fit) return;
    var h = fit.scrollHeight;
    if (h > PRINTABLE_H) {
      var s = PRINTABLE_H / h;
      fit.style.transformOrigin = 'top left';
      fit.style.transform = 'scale(' + s + ')';
      el.style.height = PRINTABLE_H + 'px';
      el.style.overflow = 'hidden';
    }
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
