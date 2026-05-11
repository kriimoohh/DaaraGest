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

export async function renderPdfHtml(html: string, pdfOptions: PDFOptions): Promise<Buffer> {
  const page = await acquirePage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
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
