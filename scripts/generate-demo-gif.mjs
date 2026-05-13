#!/usr/bin/env node
/**
 * Generate .github/assets/jak-shield-demo.gif from jak-shield-demo.svg.
 *
 * The SVG is an animated demo with two reveal stages (0.6s and 1.4s). To
 * convert to GIF we sample N frames across the animation timeline. For each
 * frame, we mutate the SVG opacity values to their state at that moment,
 * render to PNG with @resvg/resvg-js, then feed the RGBA buffer to
 * gif-encoder-2.
 *
 * This is a pure-Node pipeline — no headless browser, no ffmpeg, no native
 * deps. The full render takes ~5 seconds.
 *
 * Usage:
 *   node scripts/generate-demo-gif.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SVG_PATH = resolve(REPO_ROOT, '.github/assets/jak-shield-demo.svg');
const OUT_PATH = resolve(REPO_ROOT, '.github/assets/jak-shield-demo.gif');

// Animation timeline:
//   t < 0.6s:    only the prompt is visible
//   0.6 ≤ t < 1.0: agent plan fades in (linear over 0.4s)
//   1.0 ≤ t < 1.4: agent plan fully visible, decision card still hidden
//   1.4 ≤ t < 1.9: decision card fades in (linear over 0.5s)
//   t ≥ 1.9:     final frame, all visible
//
// We render 25 frames across 3 seconds (120 ms per frame, ~8.3 fps). The
// last 1.1 seconds are the "hold" — same final frame repeated so viewers
// have time to read the decision before the GIF loops.
const TIMELINE_SECONDS = 3.0;
const FRAME_COUNT = 25;
const FRAME_DELAY_MS = Math.round((TIMELINE_SECONDS * 1000) / FRAME_COUNT); // 120

// Width/height — we scale down a bit for GIF size budget. GitHub renders
// images at native size in the README so 640×376 is plenty.
const WIDTH = 640;

const svgRaw = readFileSync(SVG_PATH, 'utf8');

/**
 * Build a frame-specific SVG by replacing the <animate> tags with static
 * opacity values matching the animation state at time `t`.
 */
function svgAtTime(t) {
  // Stage 1: agent's plan, begin 0.6s dur 0.4s
  const agentOpacity = clamp((t - 0.6) / 0.4, 0, 1);
  // Stage 2: decision card, begin 1.4s dur 0.5s
  const decisionOpacity = clamp((t - 1.4) / 0.5, 0, 1);

  let out = svgRaw;

  // Replace the agent's plan opacity + drop its animate tag.
  out = out.replace(
    /(<g transform="translate\(40, 140\)" opacity=")0(")/,
    `$1${agentOpacity.toFixed(3)}$2`,
  );
  // Replace the decision card opacity + drop its animate tag.
  out = out.replace(
    /(<g transform="translate\(40, 210\)" opacity=")0(")/,
    `$1${decisionOpacity.toFixed(3)}$2`,
  );
  // Strip the animate elements — otherwise they fight our static opacity.
  out = out.replace(/<animate\b[^/]*\/>/g, '');

  return out;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Render one frame of SVG to an RGBA Buffer.
 */
function renderFrame(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    background: '#0E1116',
  });
  const out = resvg.render();
  const pngBuffer = out.asPng();
  const png = PNG.sync.read(pngBuffer);
  return { width: png.width, height: png.height, data: png.data };
}

async function main() {
  console.log(`Rendering ${FRAME_COUNT} frames at ${WIDTH}px wide…`);

  // Render frame 0 first so we know the output dimensions.
  const frame0 = renderFrame(svgAtTime(0));
  const { width, height } = frame0;

  // GIFEncoder constructor: (width, height, algorithm, useOptimizer)
  const encoder = new GIFEncoder(width, height, 'octree', false);
  encoder.setDelay(FRAME_DELAY_MS);
  encoder.setRepeat(0); // loop forever
  encoder.start();
  encoder.addFrame(frame0.data);

  for (let i = 1; i < FRAME_COUNT; i++) {
    const t = (i / FRAME_COUNT) * TIMELINE_SECONDS;
    const frame = renderFrame(svgAtTime(t));
    encoder.addFrame(frame.data);
    process.stdout.write(`\r  frame ${i + 1}/${FRAME_COUNT}`);
  }
  encoder.finish();
  process.stdout.write('\n');

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, encoder.out.getData());
  const sizeKb = Math.round(encoder.out.getData().length / 1024);
  console.log(`Wrote ${OUT_PATH} (${width}×${height}, ${FRAME_COUNT} frames, ~${sizeKb} KB).`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
