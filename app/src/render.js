// Cover renderer: draws one GTA-style poster cover onto a canvas.
// Everything is drawn with the 2D canvas API from the app's own state:
// panels of photos, a gradient-map colour grade, film grain, a vignette,
// bold caption lettering and a star heat meter. No network, no library.

import { layoutRects, titlePanelIndex } from './layouts.js';

const imageCache = new Map();

export function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const done = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
  imageCache.set(src, done);
  return done;
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const data = g.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  noiseTile = c;
  return c;
}

function verticalGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  stops.forEach((colour, i) => g.addColorStop(i / Math.max(1, stops.length - 1), colour));
  return g;
}

function drawStar(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffc93d';
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = '#1a0b2e';
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
  }
}

function drawStars(ctx, cx, cy, size, count) {
  const gap = size * 2.5;
  const total = gap * 4;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, cx - total / 2 + i * gap, cy, size, i < count);
  }
}

// A font template: '{size}' is replaced with the fitted pixel size.
function titleFont(state) {
  if (state.font === 'pacifico') return '{size}px Pacifico, cursive';
  if (state.font === 'sans') return 'bold {size}px Arial Black, Arial, sans-serif';
  return '{size}px Anton, "Arial Narrow", sans-serif';
}

// Shrink the font and wrap the words until every line fits the width
// and the line count fits the zone. Never lets one long word overflow.
function fitLines(ctx, text, font, maxWidth, maxLines, startSize) {
  const words = String(text || 'VICE SUNSET').split(/\s+/).filter(Boolean);
  let size = startSize;
  let lines = [words.join(' ')];
  while (size > 12) {
    ctx.font = font.replace('{size}', size);
    const oneLine = words.join(' ');
    if (ctx.measureText(oneLine).width <= maxWidth) {
      lines = [oneLine];
      break;
    }
    if (maxLines === 1) { size -= 2; continue; }
    // Wrap words across lines.
    lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? line + ' ' + word : word;
      if (ctx.measureText(trial).width <= maxWidth || !line) line = trial;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    const fits = lines.length <= maxLines
      && lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (fits) break;
    size -= 2;
  }
  ctx.font = font.replace('{size}', size);
  return { lines, size };
}

// Geometry of one caption block at a given size: where the first title
// baseline, the subtitle baseline and the star row fall, and where the
// star row ends. The block is centred in the zone from its first glyph
// top to the bottom of the stars.
function titleGeometry(lines, size, zone) {
  const lineHeight = size * 1.02;
  const subSize = Math.max(14, size * 0.42);
  const starSize = Math.max(10, size * 0.17);
  const blockH = size * 0.82 + lines.length * lineHeight + subSize * 1.35 + starSize;
  const firstBaseline = zone.y + Math.max(0, (zone.h - blockH) / 2) + size * 0.82;
  const afterLines = firstBaseline + lines.length * lineHeight;
  const subBaseline = afterLines + subSize * 0.25;
  const starY = subBaseline + subSize * 1.1;
  return { lineHeight, subSize, starSize, blockH, firstBaseline, subBaseline, starY, starBottom: starY + starSize };
}

function paintTitleText(ctx, lines, size, font, zone, grade, subtitle, stars, maxWidth, maxLines) {
  // Shrink the whole caption until the star row fits inside the zone.
  let geo = titleGeometry(lines, size, zone);
  while (size > 12 && geo.starBottom > zone.y + zone.h - 4) {
    size = Math.floor(size * 0.92);
    const fitted = fitLines(ctx, lines.join(' '), font, maxWidth, maxLines, size);
    lines = fitted.lines;
    size = fitted.size;
    geo = titleGeometry(lines, size, zone);
  }
  const { lineHeight, subSize, starSize } = geo;
  let y = geo.firstBaseline;
  const cx = zone.x + zone.w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(0, y - size, 0, y + size * 0.2);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(1, grade.title[1]);
  lines.forEach((line) => {
    ctx.font = font.replace('{size}', size);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size / 14);
    ctx.strokeStyle = '#16081f';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeText(line, cx, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, y);
    y += lineHeight;
  });
  y += subSize * 0.25;
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.lineWidth = Math.max(2, subSize / 12);
  ctx.strokeStyle = 'rgba(20,5,30,0.85)';
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = subSize * 0.55;
  ctx.strokeText(subtitle, cx, y);
  ctx.fillStyle = grade.sub;
  ctx.fillText(subtitle, cx, y);
  ctx.shadowBlur = 0;
  y += subSize * 1.1;
  drawStars(ctx, cx, y, starSize, stars);
}

function drawHalftone(ctx, x, y, w, h, colour, alpha) {
  const step = Math.max(10, w / 16);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  for (let row = 0; row * step < h; row++) {
    for (let col = 0; col * step < w; col++) {
      const r = Math.max(1, step * 0.16 * (1 + 0.5 * Math.sin(row * 0.9 + col * 0.6)));
      ctx.beginPath();
      ctx.arc(x + col * step + step / 2, y + row * step + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSunsetBack(ctx, W, H, grade) {
  ctx.fillStyle = verticalGradient(ctx, 0, 0, W, H, grade.wash);
  ctx.fillRect(0, 0, W, H);
  const sunR = Math.min(W, H) * 0.16;
  const sunX = W * 0.5;
  const sunY = H * 0.42;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, 'rgba(255,240,180,0.9)');
  glow.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
  ctx.fillStyle = 'rgba(20,8,30,0.16)';
  for (let i = 0; i < 5; i++) {
    const bandY = H * (0.62 + i * 0.07);
    ctx.fillRect(0, bandY, W, Math.max(2, H * 0.008));
  }
  drawHalftone(ctx, 0, 0, W, H * 0.3, '#ffffff', 0.10);
}

function drawPhotoInto(ctx, img, rect, panel, grade) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
  const dw = iw * base;
  const dh = ih * base;
  const dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const mono = grade.mono ? ' grayscale(1)' : '';
  ctx.filter = `brightness(${(panel.bright ?? 100) / 100}) contrast(${(panel.contrast ?? 100) / 100}) saturate(${(panel.sat ?? 100) / 100}) blur(${panel.blur ?? 0}px)${mono}`;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = verticalGradient(ctx, rect.x, rect.y, rect.w, rect.h, grade.wash);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPhotoPlaceholder(ctx, rect, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = verticalGradient(ctx, rect.x, rect.y, rect.w, rect.h, grade.wash);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// Draw one cover onto canvas at W x H. photosById maps photo ids to loaded
// HTMLImageElements. opts.selected draws the editor selection outline;
// exports leave it off.
export function drawCover(canvas, state, photosById, W, H, opts = {}) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  const { panels, titleZone, layout } = layoutRects(state.layout, W, H);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, W, H);
  if (layout.sunsetBack) drawSunsetBack(ctx, W, H, state.gradeObj);

  panels.forEach((rect, i) => {
    const panel = state.panels[i] || {};
    if (rect.kind === 'title') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.fillStyle = verticalGradient(ctx, rect.x, rect.y, rect.w, rect.h, state.gradeObj.wash);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      drawHalftone(ctx, rect.x, rect.y, rect.w, rect.h, '#ffffff', 0.22);
      ctx.restore();
      return;
    }
    const img = photosById[panel.photo];
    if (rect.tilt) {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const frame = Math.max(6, W * 0.012);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rect.tilt * Math.PI) / 180);
      ctx.fillStyle = '#fdf6ec';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = W * 0.02;
      ctx.shadowOffsetY = H * 0.008;
      ctx.fillRect(-rect.w / 2 - frame, -rect.h / 2 - frame, rect.w + frame * 2, rect.h + frame * 2 + frame * 2.2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      const inner = { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h };
      if (img) drawPhotoInto(ctx, img, inner, panel, state.gradeObj);
      else drawPhotoPlaceholder(ctx, inner, state.gradeObj);
      ctx.restore();
      return;
    }
    if (img) drawPhotoInto(ctx, img, rect, panel, state.gradeObj);
    else drawPhotoPlaceholder(ctx, rect, state.gradeObj);
  });

  // Caption: inside the title block when the layout has one, else a dark
  // band over the photos so the lettering always reads.
  if (layout.band) {
    const band = ctx.createLinearGradient(0, titleZone.y - titleZone.h * 0.25, 0, titleZone.y + titleZone.h);
    band.addColorStop(0, 'rgba(10,4,20,0)');
    band.addColorStop(0.35, 'rgba(10,4,20,0.55)');
    band.addColorStop(1, 'rgba(10,4,20,0.78)');
    ctx.fillStyle = band;
    ctx.fillRect(0, titleZone.y - titleZone.h * 0.25, W, titleZone.h * 1.25);
  }
  const titleIndex = titlePanelIndex(state.layout);
  const zone = titleIndex >= 0
    ? { x: panels[titleIndex].x, y: panels[titleIndex].y, w: panels[titleIndex].w, h: panels[titleIndex].h, align: 'center', maxLines: titleZone.maxLines }
    : titleZone;
  const pad = zone.w * 0.06;
  const startSize = zone.h * (zone.maxLines > 1 ? 0.30 : 0.52);
  const font = titleFont(state);
  const fitted = fitLines(ctx, state.title, font, zone.w - pad * 2, zone.maxLines, startSize);
  paintTitleText(ctx, fitted.lines, fitted.size, font, zone, state.gradeObj, state.subtitle || '', state.stars, zone.w - pad * 2, zone.maxLines);

  // Vignette and film grain over the whole cover.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(8,3,16,0)');
  vig.addColorStop(1, 'rgba(8,3,16,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Thin poster frame.
  ctx.strokeStyle = 'rgba(10,4,20,0.9)';
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  if (opts.selected != null && panels[opts.selected]) {
    const r = panels[opts.selected];
    ctx.save();
    ctx.setLineDash([Math.max(8, W * 0.012), Math.max(6, W * 0.008)]);
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.strokeStyle = '#ffc93d';
    if (r.tilt) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate((r.tilt * Math.PI) / 180);
      ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
    } else {
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }
  return canvas;
}

// Render a cover off-screen and hand back the canvas for export.
export function exportCover(state, photosById, w, h) {
  const canvas = document.createElement('canvas');
  drawCover(canvas, state, photosById, w, h);
  return canvas;
}
