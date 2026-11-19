// Vice Sunset Cover Lab — colour grades: a gradient map painted over every
// photo, plus film grain, a vignette and the sunset sky behind the tilted
// snapshot layout. A grade is a list of colour stops from shadow to highlight
// and a strength that blends the graded picture with the original.

import { drawPhotoCover, panelFilter } from './photos.js';

/** Looks a luminance value (0..255) up in a grade's stops. */
export function gradeColour(stops, lum) {
  const t = lum / 255;
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return stops[stops.length - 1][1].slice();
}

const tableCache = new Map();

/** A 256-entry lookup table for a grade's stops, cached by grade id. */
function gradeColourTable(stops) {
  const key = JSON.stringify(stops);
  if (!tableCache.has(key)) {
    const table = [];
    for (let lum = 0; lum < 256; lum += 1) table.push(gradeColour(stops, lum));
    tableCache.set(key, table);
  }
  return tableCache.get(key);
}

/**
 * Paints a grade over one panel's photo: the photo is drawn to a scratch
 * canvas at the panel's own pixel size, each pixel's luminance is mapped
 * through the grade's stops and blended with the original, and the result is
 * drawn back into the panel rectangle.
 */
export function paintGradedPhoto(ctx, photo, rect, transform, grade) {
  if (!photo) return;
  const w = Math.max(2, Math.round(rect.w));
  const h = Math.max(2, Math.round(rect.h));
  const scratch = paintGradedPhoto.scratch ?? document.createElement('canvas');
  paintGradedPhoto.scratch = scratch;
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d');
  sctx.save();
  sctx.filter = panelFilter(transform);
  drawPhotoCover(sctx, photo.img, { x: 0, y: 0, w, h }, transform);
  sctx.restore();
  const image = sctx.getImageData(0, 0, w, h);
  const data = image.data;
  const strength = grade.strength;
  const table = gradeColourTable(grade.stops);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    const mapped = table[lum];
    data[i] = Math.round(data[i] + (mapped[0] - data[i]) * strength);
    data[i + 1] = Math.round(data[i + 1] + (mapped[1] - data[i + 1]) * strength);
    data[i + 2] = Math.round(data[i + 2] + (mapped[2] - data[i + 2]) * strength);
  }
  sctx.putImageData(image, 0, 0);
  ctx.drawImage(scratch, rect.x, rect.y, rect.w, rect.h);
}

let noiseCanvas = null;

/** A small tile of random grey noise, made once and reused for the grain. */
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 140;
  noiseCanvas.height = 140;
  const nctx = noiseCanvas.getContext('2d');
  const image = nctx.createImageData(140, 140);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  nctx.putImageData(image, 0, 0);
  return noiseCanvas;
}

/** Film grain over the whole cover, faint so the photos stay clean. */
export function paintGrain(ctx, w, h, amount = 0.07) {
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** A soft darkening towards the corners, the poster's vignette. */
export function paintVignette(ctx, w, h, strength = 0.32) {
  const radius = Math.hypot(w, h) / 2;
  const grad = ctx.createRadialGradient(w / 2, h / 2, radius * 0.45, w / 2, h / 2, radius);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** The sunset sky behind the tilted snapshot layout, with a low sun. */
export function paintSky(ctx, w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const stops = grade.sky;
  stops.forEach((colour, i) => sky.addColorStop(i / (stops.length - 1), colour));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sunX = w * 0.72;
  const sunY = h * 0.34;
  const sunR = Math.min(w, h) * 0.16;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
  glow.addColorStop(0.35, 'rgba(255, 170, 90, 0.45)');
  glow.addColorStop(1, 'rgba(255, 120, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 8, 30, 0.55)';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

/** A vertical gradient fill for the caption, in the grade's colours. */
export function titleGradient(ctx, y, h, grade) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  const colours = grade.title;
  colours.forEach((colour, i) => grad.addColorStop(i / (colours.length - 1), colour));
  return grad;
}
