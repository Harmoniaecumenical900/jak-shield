#!/usr/bin/env node
/**
 * Generate the GitHub social-preview PNG from the SVG banner.
 *
 * Output spec (GitHub's official):
 *   - 1280×640 px
 *   - PNG, JPG, or GIF
 *   - Max 1 MB
 *
 * Uses @resvg/resvg-js (pure Rust, no headless browser, no native binary
 * deps). If that isn't installed in this workspace, falls back to writing
 * an HTML file you can screenshot at the right size — no external service
 * needed either way.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SVG_PATH = resolve(REPO_ROOT, '.github/assets/jak-shield-banner.svg');
const PNG_PATH = resolve(REPO_ROOT, '.github/assets/social-preview.png');
const HTML_FALLBACK = resolve(REPO_ROOT, '.github/assets/social-preview.html');

if (!existsSync(SVG_PATH)) {
  console.error(`SVG banner not found at ${SVG_PATH}`);
  process.exit(1);
}

const svg = readFileSync(SVG_PATH, 'utf8');

// Extract the original SVG viewBox so we can scale it correctly into the
// 1280×640 social preview canvas.
const vbMatch = svg.match(/viewBox="([\d.\s-]+)"/);
const [vbX, vbY, vbW, vbH] = (vbMatch ? vbMatch[1] : '0 0 1280 640').trim().split(/\s+/).map(Number);

// Target inner banner area — leave 80 px margin top/bottom and centre.
const targetW = 1120;
const targetH = (vbH * targetW) / vbW;
const innerScale = targetH > 480 ? 480 / targetH : 1;
const drawW = targetW * innerScale;
const drawH = targetH * innerScale;
const drawX = (1280 - drawW) / 2;
const drawY = (640 - drawH) / 2 - 20; // small offset to leave room for footer

const innerSvg = svg
  .replace(/<\?xml[^>]*\?>/g, '')
  .replace(/<svg[^>]*>/, '<g>')
  .replace(/<\/svg>/, '</g>');

const wrappedSvg = svg.match(/viewBox="0 0 1280 640"/)
  ? svg
  : `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0f1e"/>
      <stop offset="100%" stop-color="#1a1f3a"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="640" fill="url(#bg)"/>
  <g transform="translate(${drawX} ${drawY}) scale(${drawW / vbW})">
    <g transform="translate(${-vbX} ${-vbY})">${innerSvg}</g>
  </g>
  <text x="640" y="600" font-family="ui-monospace, Consolas, Menlo, monospace" font-size="18" text-anchor="middle" fill="#7c93ff" opacity="0.85">
    github.com/inbharatai/jak-shield  ·  MIT  ·  MCP-native  ·  164 tests passing  ·  45/45 adversarial bench
  </text>
</svg>`;

mkdirSync(dirname(PNG_PATH), { recursive: true });

// Try resvg-js from the temp install first, then from local node_modules.
const candidates = ['/tmp/svgconv/node_modules/@resvg/resvg-js', '@resvg/resvg-js'];
let Resvg = null;
let lastErr = null;
for (const c of candidates) {
  try {
    ({ Resvg } = await import(c));
    break;
  } catch (e) {
    lastErr = e;
  }
}

if (!Resvg) {
  console.warn('@resvg/resvg-js not available — falling back to HTML.');
  console.warn('  reason:', lastErr?.message ?? 'unknown');
  writeFileSync(
    HTML_FALLBACK,
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>JAK Shield — social preview</title>
<style>
  html, body { margin: 0; padding: 0; background: #000; }
  .frame {
    width: 1280px; height: 640px; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #0a0f1e 0%, #1a1f3a 100%);
  }
  .frame svg { max-width: 90%; max-height: 70%; }
  .meta {
    position: absolute; left: 0; right: 0; bottom: 60px;
    color: #fff; font-family: system-ui, sans-serif; text-align: center;
  }
  .meta h2 { font-weight: 600; font-size: 32px; margin: 0; }
  .meta p { color: #7c93ff; font-family: ui-monospace, monospace; font-size: 20px; margin: 12px 0 0; }
</style></head>
<body>
  <div class="frame">${wrappedSvg}</div>
  <div class="meta">
    <h2>Universal security gateway for AI agents</h2>
    <p>github.com/inbharatai/jak-shield · MIT · MCP-native</p>
  </div>
</body></html>`,
    'utf8',
  );
  console.log(`Wrote HTML fallback to ${HTML_FALLBACK}`);
  console.log('To produce the PNG: open it in Chrome, set window to 1280×640, screenshot.');
  process.exit(0);
}

const resvg = new Resvg(wrappedSvg, {
  fitTo: { mode: 'width', value: 1280 },
  background: '#0a0f1e',
});
const pngData = resvg.render();
writeFileSync(PNG_PATH, pngData.asPng());
console.log(`Wrote ${PNG_PATH} (${pngData.width}×${pngData.height})`);
