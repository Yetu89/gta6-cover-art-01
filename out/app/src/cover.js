// Neon Coast Cover Studio — cover engine. Draws the whole cover onto a 2D canvas
// at any size: photo panels with per-photo crop and grade, a halftone title block
// with bold poster lettering, a neon script subtitle, a heat-meter of stars, grain
// and a vignette. Pure canvas, no network, no library.

import { GRADES, layoutPanels } from './presets.js';

let grainTile = null;

/** Builds (once) a small tile of random monochrome noise used for film grain. */
function grainCanvas() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

/** Draws a five-pointed star path centred at (cx, cy) with outer radius r. */
function starPath(ctx, cx, cy, r) {
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draws the heat meter: `heat` of 5 stars filled gold, the rest dim outlines. */
export function drawHeatMeter(ctx, cx, cy, r, heat) {
  const gap = r * 2.4;
  const x0 = cx - (2 * gap);
  for (let i = 0; i < 5; i++) {
    starPath(ctx, x0 + i * gap, cy, r);
    if (i < heat) {
      ctx.fillStyle = '#ffd76a';
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = '#14101c';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
    }
  }
}

/**
 * Draws one photo into a rectangle with cover-fit cropping around a focal point,
 * the photo's own brightness/contrast/saturation/blur, and the cover grade's
 * gradient-map overlay. `photo` is {img, brightness, contrast, saturation, blur}.
 */
function drawGradedPhoto(ctx, photo, rect, grade, crop) {
  const { img } = photo;
  if (!img || !img.naturalWidth) return;
  const { x, y, w, h } = rect;
  ctx.save();
  if (rect.rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rect.rot);
    ctx.translate(-w / 2, -h / 2);
  } else {
    ctx.translate(x, y);
  }
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // Offscreen pass: crop + filter, so the grade overlay only touches this photo.
  const off = document.createElement('canvas');
  const scaleDown = Math.min(1, 1000 / Math.max(w, h));
  off.width = Math.max(2, Math.round(w * scaleDown));
  off.height = Math.max(2, Math.round(h * scaleDown));
  const octx = off.getContext('2d');
  const zoom = crop?.zoom ?? 1;
  const fit = Math.max(off.width / img.naturalWidth, off.height / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * fit;
  const dh = img.naturalHeight * fit;
  const ox = crop?.ox ?? 0.5;
  const oy = crop?.oy ?? 0.5;
  octx.filter = `brightness(${photo.brightness ?? 1}) contrast(${photo.contrast ?? 1}) ` +
    `saturate(${photo.saturation ?? 1}) blur(${photo.blur ?? 0}px)`;
  octx.drawImage(img, off.width * ox - dw / 2, off.height * oy - dh / 2, dw, dh);
  octx.filter = 'none';

  // Gradient-map grade: sunset / neon colours blended over the photo.
  const grad = octx.createLinearGradient(0, 0, off.width * 0.25, off.height);
  grad.addColorStop(0, grade.overlay[0]);
  grad.addColorStop(1, grade.overlay[1]);
  octx.globalCompositeOperation = 'overlay';
  octx.globalAlpha = grade.overlayAlpha;
  octx.fillStyle = grad;
  octx.fillRect(0, 0, off.width, off.height);
  octx.globalCompositeOperation = 'soft-light';
  octx.globalAlpha = grade.tintAlpha;
  octx.fillStyle = grade.tint;
  octx.fillRect(0, 0, off.width, off.height);
  octx.globalAlpha = 1;
  octx.globalCompositeOperation = 'source-over';

  ctx.drawImage(off, 0, 0, w, h);

  // White polaroid frame for tilted snapshots, thin dark keyline otherwise.
  if (rect.rot) {
    ctx.lineWidth = Math.max(2, w * 0.02);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(0, 0, w, h);
  } else {
    ctx.lineWidth = Math.max(1, w * 0.004);
    ctx.strokeStyle = 'rgba(20,16,28,0.55)';
    ctx.strokeRect(0, 0, w, h);
  }
  ctx.restore();
}

/** Halftone dots over a rectangle: rows of dots that grow toward the bottom. */
function drawHalftone(ctx, rect, colour, maxR) {
  const step = Math.max(10, maxR * 3.2);
  ctx.fillStyle = colour;
  for (let yy = rect.y + step / 2; yy < rect.y + rect.h; yy += step) {
    const t = (yy - rect.y) / rect.h; // 0 at top, 1 at bottom
    const r = Math.max(0.6, maxR * (0.35 + t * 0.9));
    for (let xx = rect.x + step / 2; xx < rect.x + rect.w; xx += step) {
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Fits a one-line title into a width: returns the largest font size that fits. */
function fitTitleSize(ctx, text, fontFamily, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${size}px ${fontFamily}`;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size = Math.floor(size * 0.94);
    ctx.font = `${size}px ${fontFamily}`;
  }
  return size;
}

/**
 * Draws the title block: a sunset gradient with halftone dots, the title in big
 * poster capitals (white with a dark outline and a warm gradient fill), the neon
 * script subtitle under it, and the heat meter. `rect` is the title rectangle.
 */
function drawTitleBlock(ctx, rect, state, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const bg = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  bg.addColorStop(0, grade.overlay[1]);
  bg.addColorStop(0.55, grade.overlay[0]);
  bg.addColorStop(1, '#1b1030');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  drawHalftone(ctx, { x, y, w, h: h * 0.55 }, 'rgba(255,255,255,0.16)', Math.max(2, h * 0.02));

  const title = (state.title || 'Neon Coast').trim().toUpperCase();
  const fontFamily = state.titleFont === 'pacifico'
    ? 'Pacifico, cursive'
    : state.titleFont === 'bold'
      ? '"Arial Black", sans-serif'
      : 'Anton, sans-serif';
  const pad = w * 0.04;
  const titleSize = fitTitleSize(ctx, title, fontFamily, Math.round(h * 0.42), w - pad * 2);
  const titleY = y + h * 0.46;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(x + w / 2, titleY);
  ctx.rotate(-0.02);
  ctx.font = `${titleSize}px ${fontFamily}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, titleSize * 0.13);
  ctx.strokeStyle = '#14101c';
  ctx.strokeText(title, 0, 0);
  const fill = ctx.createLinearGradient(0, -titleSize / 2, 0, titleSize / 2);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#ffe9a8');
  ctx.fillStyle = fill;
  ctx.fillText(title, 0, 0);
  ctx.restore();

  // Neon script subtitle with a glow, then the heat meter and a small credit line.
  const sub = (state.subtitle || '').trim();
  let subY = y + h * 0.72;
  if (sub) {
    const subSize = Math.round(h * 0.17);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = grade.overlay[1];
    ctx.shadowBlur = subSize * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, x + w / 2, subY);
    ctx.shadowBlur = 0;
    subY = y + h * 0.88;
  }
  drawHeatMeter(ctx, x + w / 2, subY, Math.max(5, h * 0.045), state.heat ?? 4);
  ctx.restore();
}

/** A scrim band title: the same lettering drawn over the photos with a dark fade. */
function drawTitleBand(ctx, rect, state, grade) {
  const { x, y, w, h } = rect;
  const scrim = ctx.createLinearGradient(0, y, 0, y + h);
  scrim.addColorStop(0, 'rgba(20,10,32,0)');
  scrim.addColorStop(1, 'rgba(20,10,32,0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y, w, h);

  const title = (state.title || 'Neon Coast').trim().toUpperCase();
  const fontFamily = state.titleFont === 'pacifico'
    ? 'Pacifico, cursive'
    : state.titleFont === 'bold'
      ? '"Arial Black", sans-serif'
      : 'Anton, sans-serif';
  const titleSize = fitTitleSize(ctx, title, fontFamily, Math.round(h * 0.62), w * 0.92);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(x + w / 2, y + h * 0.52);
  ctx.rotate(-0.015);
  ctx.font = `${titleSize}px ${fontFamily}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, titleSize * 0.12);
  ctx.strokeStyle = '#14101c';
  ctx.strokeText(title, 0, 0);
  const fill = ctx.createLinearGradient(0, -titleSize / 2, 0, titleSize / 2);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#ffe9a8');
  ctx.fillStyle = fill;
  ctx.fillText(title, 0, 0);
  ctx.restore();

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.round(h * 0.2);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = grade.overlay[1];
    ctx.shadowBlur = subSize;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, x + w / 2, y + h * 0.86);
    ctx.shadowBlur = 0;
  }
  drawHeatMeter(ctx, x + w * 0.86, y + h * 0.24, Math.max(4, h * 0.07), state.heat ?? 4);
}

/**
 * Renders the full cover for `state` onto `canvas` (the canvas is resized to the
 * export size first). `state.photos` are {img, ...adjust} and `state.panels` are
 * {photoId, zoom, ox, oy} per panel index. Returns the layout geometry used, so
 * the editor can map a click on the preview back to a panel.
 */
export function renderCover(canvas, state) {
  const { w: W, h: H } = state.size;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.grade] || GRADES.sunset;
  const geo = layoutPanels(state.layout, W, H);

  // Backdrop: deep violet, or a sunset gradient for the snapshot layout.
  if (geo.bg === 'gradient') {
    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, '#ff9a3d');
    bg.addColorStop(0.5, '#ff2e88');
    bg.addColorStop(1, '#2b1055');
    ctx.fillStyle = bg;
  } else {
    ctx.fillStyle = '#17102a';
  }
  ctx.fillRect(0, 0, W, H);

  const byId = new Map(state.photos.map((p) => [p.id, p]));
  const fallback = state.photos[0] || null;
  geo.photos.forEach((rect, i) => {
    const crop = state.panels[i] || { photoId: null, zoom: 1, ox: 0.5, oy: 0.65 };
    const photo = (crop.photoId && byId.get(crop.photoId)) || fallback;
    if (photo) drawGradedPhoto(ctx, photo, rect, grade, crop);
  });

  if (geo.title) {
    if (state.layout === 'grid9' || state.layout === 'split') {
      drawTitleBlock(ctx, geo.title, state, grade);
    } else {
      drawTitleBand(ctx, geo.title, state, grade);
    }
  }

  // Film grain, then a vignette to pull the eye to the middle.
  const grainAmount = state.grain ?? 0.6;
  if (grainAmount > 0) {
    const tile = grainCanvas();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.05 + grainAmount * 0.08;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette !== false) {
    const vig = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10,4,20,0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
  return geo;
}

/** The layout geometry for a state at a given pixel size (for click mapping). */
export function coverGeometry(state, W, H) {
  return layoutPanels(state.layout, W, H);
}
