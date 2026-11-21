// Renders public/icons/icon.svg into the PNG sizes the web manifest and iOS need.
// Usage: node scripts/generate-icons.mjs   (requires Playwright's Chromium)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const iconsDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
const svg = readFileSync(`${iconsDir}icon.svg`, 'utf8');
const BACKGROUND = '#1f6f63';

/** Maskable icons keep content inside the central 80% "safe zone", so pad and fill the corners. */
const outputs = [
  { file: 'icon-192.png', size: 192, padding: 0, square: false },
  { file: 'icon-512.png', size: 512, padding: 0, square: false },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.1, square: true },
  { file: 'apple-touch-icon.png', size: 180, padding: 0, square: true },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, padding, square } of outputs) {
    const inner = Math.round(size * (1 - padding * 2));
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${square ? BACKGROUND : 'transparent'}">
        <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
      </body></html>`,
    );
    await page.screenshot({ path: `${iconsDir}${file}`, omitBackground: !square });
  }
} finally {
  await browser.close();
}
