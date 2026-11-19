// Vice Sunset Cover Lab — the cover renderer. drawCover paints one finished
// poster onto a canvas at its export size: the layout's panels, each photo
// graded, the caption lettering, the heat stars, grain and vignette. The
// preview in the editor is the same drawing at the same size, scaled by CSS,
// so what is seen is what is exported.
//
// Panels are counted by photo only: a layout's title cell (the nine-panel
// grid's centre) is not a photo panel, so the n-th photo panel always pairs
// with state.panels[n], whatever sits between the panels.
//
// The caption block budgets its height: title, subtitle and stars are sized
// from the box and centred in it, so nothing ever runs past the box's edge.

import { SIZES, layoutPanels, ensurePanels, gradeById, fontById } from './state.js';
import { paintGradedPhoto, paintGrain, paintVignette, paintSky, titleGradient } from './grades.js';

/** Only the panels that hold a photo, in reading order. */
export function photoPanels(state, w, h) {
  return layoutPanels(state.layout, w, h).filter((p) => p.kind === 'photo');
}

/** Shrink a font until the text fits maxWidth, returning the size used. */
export function fitFont(ctx, text, family, weight, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Draws the heat meter: filled stars for the heat, outlines for the rest. */
export function drawStars(ctx, cx, y, size, heat) {
  const gap = size * 0.28;
  const total = 5 * size + 4 * gap;
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px system-ui, sans-serif`;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < heat ? '#ffc93c' : 'rgba(255, 255, 255, 0.35)';
    ctx.shadowColor = i < heat ? 'rgba(255, 180, 40, 0.9)' : 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = i < heat ? size * 0.5 : 0;
    ctx.fillText('★', x, y);
    x += size + gap;
  }
  ctx.shadowBlur = 0;
}

/**
 * Draws the title, the neon-script subtitle and the heat stars inside a box,
 * centred. The title is filled with the grade's gradient and outlined in dark
 * ink; the subtitle glows in Pacifico pink. Every line is sized from the box
 * height and the whole block is centred, so the stars never spill out.
 */
export function drawCaptionBlock(ctx, state, grade, box) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const font = fontById(state.font);
  const cx = box.x + box.w / 2;
  const titleSize = title
    ? fitFont(ctx, title, font.family, state.font === 'sans' ? '800' : '400', box.w * 0.96, box.h * 0.44)
    : 0;
  const subtitleSize = subtitle
    ? fitFont(ctx, subtitle, "'Pacifico', cursive", '400', box.w * 0.9, box.h * 0.2)
    : 0;
  const starSize = Math.max(12, box.h * 0.085);
  const total = titleSize * 1.05 + subtitleSize * 1.45 + starSize * 1.5;
  let cursor = box.y + Math.max(0, (box.h - total) / 2);
  if (title) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.font = `${state.font === 'sans' ? '800' : '400'} ${titleSize}px ${font.family}`;
    ctx.strokeStyle = 'rgba(24, 6, 32, 0.9)';
    ctx.lineWidth = Math.max(2, titleSize * 0.09);
    ctx.fillStyle = titleGradient(ctx, cursor, titleSize, grade);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = titleSize * 0.18;
    ctx.shadowOffsetY = titleSize * 0.05;
    ctx.strokeText(title, cx, cursor + titleSize);
    ctx.fillText(title, cx, cursor + titleSize);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    cursor += titleSize * 1.05;
  }
  if (subtitle) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${subtitleSize}px 'Pacifico', cursive`;
    ctx.fillStyle = '#ffd7ef';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subtitleSize * 0.55;
    ctx.fillText(subtitle, cx, cursor + subtitleSize);
    ctx.shadowBlur = 0;
    cursor += subtitleSize * 1.45;
  }
  drawStars(ctx, cx, cursor + starSize * 0.75, starSize, state.heat);
}

/** A dark scrim fading up from the bottom of a rectangle, for legible type. */
function paintScrim(ctx, rect, strength = 0.72) {
  const grad = ctx.createLinearGradient(0, rect.y + rect.h * 0.3, 0, rect.y + rect.h);
  grad.addColorStop(0, 'rgba(12, 4, 22, 0)');
  grad.addColorStop(1, `rgba(12, 4, 22, ${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** The photo area inside a panel: the full panel, or the frame's inset. */
function photoRectFor(panel) {
  if (!panel.frame) return panel;
  const side = panel.w * 0.055;
  return { x: panel.x + side, y: panel.y + side, w: panel.w - side * 2, h: panel.h - side * 1.4 - panel.h * 0.1 };
}

/**
 * Draws the whole cover. photos is the array of loaded photo records;
 * state.panels[i].photo picks which one fills photo panel i. opts.forExport
 * is accepted for callers that distinguish export from preview; the drawing
 * is identical either way. opts.showSelection draws the editor's outline.
 */
export function drawCover(canvas, state, photos, opts = {}) {
  const size = SIZES[state.size] ?? SIZES.square;
  canvas.width = size.w;
  canvas.height = size.h;
  const w = size.w;
  const h = size.h;
  const ctx = canvas.getContext('2d');
  const grade = gradeById(state.grade);
  ensurePanels(state, w, h);
  const panels = layoutPanels(state.layout, w, h);
  const photosOnly = photoPanels(state, w, h);

  ctx.fillStyle = '#14091f';
  ctx.fillRect(0, 0, w, h);
  if (state.layout === 'polaroid') paintSky(ctx, w, h, grade);

  let photoIndex = 0;
  panels.forEach((panel) => {
    if (panel.kind !== 'photo') return;
    const transform = state.panels[photoIndex];
    photoIndex += 1;
    const photo = photos[transform.photo] ?? photos[0] ?? null;
    ctx.save();
    if (panel.tilt) {
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate((panel.tilt * Math.PI) / 180);
      ctx.translate(-panel.w / 2, -panel.h / 2);
    }
    if (panel.frame) {
      ctx.fillStyle = '#fdf6ec';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.012;
      ctx.fillRect(0, 0, panel.w, panel.h);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    const drawRect = photoRectFor(panel);
    ctx.save();
    ctx.beginPath();
    ctx.rect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
    ctx.clip();
    if (photo) paintGradedPhoto(ctx, photo, drawRect, transform, grade);
    ctx.restore();
    ctx.strokeStyle = 'rgba(20, 8, 28, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(1, w * 0.0012);
    ctx.strokeRect(drawRect.x + 2, drawRect.y + 2, drawRect.w - 4, drawRect.h - 4);
    ctx.restore();
  });

  // The caption: where it sits depends on the layout.
  if (state.layout === 'grid9') {
    const titleCell = panels.find((p) => p.kind === 'title');
    if (titleCell) {
      ctx.fillStyle = 'rgba(18, 7, 30, 0.94)';
      ctx.fillRect(titleCell.x, titleCell.y, titleCell.w, titleCell.h);
      ctx.strokeStyle = 'rgba(255, 210, 90, 0.7)';
      ctx.lineWidth = Math.max(2, w * 0.003);
      ctx.strokeRect(titleCell.x + 6, titleCell.y + 6, titleCell.w - 12, titleCell.h - 12);
      drawCaptionBlock(ctx, state, grade, {
        x: titleCell.x + titleCell.w * 0.08,
        y: titleCell.y + titleCell.h * 0.16,
        w: titleCell.w * 0.84,
        h: titleCell.h * 0.68,
      });
    }
  } else if (state.layout === 'polaroid') {
    drawCaptionBlock(ctx, state, grade, { x: w * 0.08, y: h * 0.74, w: w * 0.84, h: h * 0.2 });
  } else if (state.layout === 'hero') {
    paintScrim(ctx, { x: 0, y: h * 0.55, w, h: h * 0.45 });
    drawCaptionBlock(ctx, state, grade, { x: w * 0.06, y: h * 0.66, w: w * 0.88, h: h * 0.28 });
  } else if (state.layout === 'hero3') {
    const hero = photosOnly[0];
    paintScrim(ctx, { x: hero.x, y: hero.y + hero.h * 0.52, w: hero.w, h: hero.h * 0.48 });
    drawCaptionBlock(ctx, state, grade, { x: hero.x + hero.w * 0.05, y: hero.y + hero.h * 0.56, w: hero.w * 0.9, h: hero.h * 0.4 });
  } else if (state.layout === 'grid4') {
    paintScrim(ctx, { x: 0, y: h * 0.62, w, h: h * 0.38 });
    drawCaptionBlock(ctx, state, grade, { x: w * 0.06, y: h * 0.68, w: w * 0.88, h: h * 0.26 });
  } else if (state.layout === 'split') {
    if (h >= w) {
      const top = photosOnly[0];
      paintScrim(ctx, { x: top.x, y: top.y + top.h * 0.5, w: top.w, h: top.h * 0.5 });
      drawCaptionBlock(ctx, state, grade, { x: top.x + top.w * 0.05, y: top.y + top.h * 0.52, w: top.w * 0.9, h: top.h * 0.44 });
    } else {
      const left = photosOnly[0];
      paintScrim(ctx, { x: left.x, y: left.y + left.h * 0.55, w: left.w, h: left.h * 0.45 });
      drawCaptionBlock(ctx, state, grade, { x: left.x + left.w * 0.05, y: left.y + left.h * 0.6, w: left.w * 0.9, h: left.h * 0.36 });
    }
  }

  paintGrain(ctx, w, h, 0.07);
  paintVignette(ctx, w, h, 0.3);

  if (opts.showSelection && state.selected >= 0) {
    const panel = photosOnly[state.selected];
    if (panel) {
      ctx.save();
      ctx.setLineDash([Math.max(8, w * 0.012), Math.max(6, w * 0.008)]);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(3, w * 0.005);
      ctx.strokeRect(panel.x + 2, panel.y + 2, panel.w - 4, panel.h - 4);
      ctx.restore();
    }
  }
  return { w, h };
}

/**
 * Which photo panel, if any, sits under canvas point (px, py). The answer
 * is the photo panel's ordinal, matching state.panels, not its place in the
 * full panel list.
 */
export function hitTestPanel(state, w, h, px, py) {
  const list = photoPanels(state, w, h);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
  }
  return -1;
}
