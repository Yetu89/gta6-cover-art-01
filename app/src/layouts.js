// Panel geometry for the six cover layouts.
// Every layout is described in fractions of the cover width/height, so the
// same geometry drives the live preview and every export size.
// A panel is { x, y, w, h, kind, tilt } in fractions. kind 'photo' draws a
// photo; kind 'title' draws a gradient title block instead. tilt is a
// rotation in degrees (polaroid prints only). titleZone tells the renderer
// where the big caption goes: { x, y, w, h, align, maxLines } in fractions.

export const LAYOUTS = {
  hero: {
    id: 'hero',
    name: 'Full-bleed hero',
    blurb: 'One photo, edge to edge',
    panels: [{ x: 0, y: 0, w: 1, h: 1, kind: 'photo', tilt: 0 }],
    titleZone: { x: 0.05, y: 0.68, w: 0.9, h: 0.28, align: 'center', maxLines: 2 },
    band: true,
  },
  hero3: {
    id: 'hero3',
    name: 'Hero + three',
    blurb: 'Big hero, three below',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.62, kind: 'photo', tilt: 0 },
      { x: 0, y: 0.62, w: 1 / 3, h: 0.38, kind: 'photo', tilt: 0 },
      { x: 1 / 3, y: 0.62, w: 1 / 3, h: 0.38, kind: 'photo', tilt: 0 },
      { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38, kind: 'photo', tilt: 0 },
    ],
    titleZone: { x: 0.04, y: 0.40, w: 0.92, h: 0.20, align: 'center', maxLines: 1 },
    band: true,
  },
  grid4: {
    id: 'grid4',
    name: 'Four-panel grid',
    blurb: 'Classic 2 x 2 poster',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5, kind: 'photo', tilt: 0 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, kind: 'photo', tilt: 0 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, kind: 'photo', tilt: 0 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, kind: 'photo', tilt: 0 },
    ],
    titleZone: { x: 0.04, y: 0.70, w: 0.92, h: 0.26, align: 'center', maxLines: 2 },
    band: true,
  },
  grid9: {
    id: 'grid9',
    name: 'Nine-panel grid',
    blurb: 'Title in the centre cell',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, kind: 'title', tilt: 0 },
      { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
      { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3, kind: 'photo', tilt: 0 },
    ],
    titleZone: { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, align: 'center', maxLines: 3 },
    band: false,
  },
  polaroids: {
    id: 'polaroids',
    name: 'Tilted snapshots',
    blurb: 'Polaroid prints on sunset',
    panels: [
      { x: 0.06, y: 0.30, w: 0.28, h: 0.42, kind: 'photo', tilt: -6 },
      { x: 0.36, y: 0.26, w: 0.28, h: 0.46, kind: 'photo', tilt: 2 },
      { x: 0.66, y: 0.30, w: 0.28, h: 0.42, kind: 'photo', tilt: 6 },
    ],
    titleZone: { x: 0.05, y: 0.06, w: 0.9, h: 0.18, align: 'center', maxLines: 1 },
    band: false,
    sunsetBack: true,
  },
  split: {
    id: 'split',
    name: 'Split story',
    blurb: 'Tall photo, title block',
    panels: [
      { x: 0, y: 0, w: 0.55, h: 1, kind: 'photo', tilt: 0 },
      { x: 0.55, y: 0, w: 0.45, h: 0.5, kind: 'photo', tilt: 0 },
      { x: 0.55, y: 0.5, w: 0.45, h: 0.5, kind: 'title', tilt: 0 },
    ],
    titleZone: { x: 0.55, y: 0.5, w: 0.45, h: 0.5, align: 'center', maxLines: 3 },
    band: false,
  },
};

export const LAYOUT_ORDER = ['hero', 'hero3', 'grid4', 'grid9', 'polaroids', 'split'];

// Turn fractional geometry into pixel rectangles for a cover of W x H.
// gap is the dark gutter between panels, in pixels.
export function layoutRects(layoutId, W, H) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.hero3;
  const gap = Math.max(2, Math.round(Math.min(W, H) * 0.008));
  const panels = layout.panels.map((p) => ({
    x: Math.round(p.x * W) + (p.x > 0 ? gap / 2 : 0),
    y: Math.round(p.y * H) + (p.y > 0 ? gap / 2 : 0),
    w: Math.round(p.w * W) - (p.x > 0 ? gap / 2 : 0) - (p.x + p.w < 1 ? gap / 2 : 0),
    h: Math.round(p.h * H) - (p.y > 0 ? gap / 2 : 0) - (p.y + p.h < 1 ? gap / 2 : 0),
    kind: p.kind,
    tilt: p.tilt || 0,
  }));
  const z = layout.titleZone;
  const titleZone = {
    x: z.x * W, y: z.y * H, w: z.w * W, h: z.h * H,
    align: z.align, maxLines: z.maxLines,
  };
  return { panels, titleZone, layout };
}

// Which panel index holds the title block, or -1 when the title floats
// over the photos instead.
export function titlePanelIndex(layoutId) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.hero3;
  return layout.panels.findIndex((p) => p.kind === 'title');
}
