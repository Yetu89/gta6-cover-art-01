// Neon Coast Cover Studio — presets: layouts, colour grades, export sizes, caption
// presets and fonts. Everything here is the studio's own design: no Rockstar Games
// logo, artwork or font. Fonts are Anton and Pacifico, both under the SIL Open Font
// License (their OFL texts sit beside them in app/fonts/).

/** Export sizes: the common post sizes this bounty asks for. */
export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  story: { label: 'Story 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

/** Caption fonts. Anton and Pacifico are files under app/fonts/; Bold is the system sans. */
export const TITLE_FONTS = {
  anton: { label: 'Anton (poster)', family: 'Anton, sans-serif' },
  pacifico: { label: 'Pacifico (neon script)', family: 'Pacifico, cursive' },
  bold: { label: 'Bold sans', family: '"Arial Black", "Helvetica Neue", sans-serif' },
};

/** One-click captions, all invented titles (no game characters or places). */
export const CAPTION_PRESETS = [
  'Sunset Heist',
  'Boulevard Queen',
  'Neon Coast',
  'Pier Pressure',
  'Night Shift',
  'Golden Hour',
];

/**
 * Colour grades. Each grade is a sunset / neon look built from a gradient-map
 * overlay (top colour to bottom colour, blended over the photo) plus a warm tint.
 * `overlay` is drawn with globalCompositeOperation 'overlay', `tint` with 'soft-light'.
 */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    overlay: ['#ff9a3d', '#ff2e88'],
    tint: '#ff7a3d',
    overlayAlpha: 0.55,
    tintAlpha: 0.28,
    swatch: 'linear-gradient(135deg,#ff9a3d,#ff2e88)',
  },
  neon: {
    label: 'Neon Nights',
    overlay: ['#22e6ff', '#ff2ec4'],
    tint: '#7a2eff',
    overlayAlpha: 0.6,
    tintAlpha: 0.3,
    swatch: 'linear-gradient(135deg,#22e6ff,#ff2ec4)',
  },
  gold: {
    label: 'Palm Gold',
    overlay: ['#ffd76a', '#ff7a1a'],
    tint: '#ffb347',
    overlayAlpha: 0.5,
    tintAlpha: 0.25,
    swatch: 'linear-gradient(135deg,#ffd76a,#ff7a1a)',
  },
  drive: {
    label: 'Ocean Drive',
    overlay: ['#37e0c8', '#2b6bff'],
    tint: '#2bb3ff',
    overlayAlpha: 0.55,
    tintAlpha: 0.28,
    swatch: 'linear-gradient(135deg,#37e0c8,#2b6bff)',
  },
  noir: {
    label: 'Mono Noir',
    overlay: ['#e8e8e8', '#111111'],
    tint: '#888888',
    overlayAlpha: 0.35,
    tintAlpha: 0.15,
    swatch: 'linear-gradient(135deg,#e8e8e8,#111111)',
  },
};

/**
 * Layouts. layoutPanels() returns the photo rectangles for a layout plus where the
 * title block goes, all in cover pixels for a cover of W x H. `photos` is how many
 * photo panels the layout fills; `title` is 'band' (a band drawn over the photos),
 * 'cell' (the centre cell of the grid) or 'block' (its own rectangle).
 */
export const LAYOUTS = {
  hero: { label: 'Full-bleed hero', photos: 1, title: 'band', hint: 'One photo, edge to edge' },
  hero3: { label: 'Hero + three', photos: 4, title: 'band', hint: 'Big hero, three below' },
  grid4: { label: 'Four-panel grid', photos: 4, title: 'band', hint: 'Classic 2 x 2 poster' },
  grid9: { label: 'Nine-panel grid', photos: 8, title: 'cell', hint: 'Title in the centre cell' },
  tilt: { label: 'Tilted snapshots', photos: 3, title: 'band', hint: 'Polaroids on a sunset' },
  split: { label: 'Split story', photos: 2, title: 'block', hint: 'Photo left, title right' },
};

/** Number of photo panels a layout uses. */
export function panelCount(layout) {
  return LAYOUTS[layout]?.photos ?? 1;
}

/**
 * Photo rectangles for a layout on a W x H cover. Returns { photos: [...rects],
 * title: rect|null, bg: 'photo'|'gradient' }. A rect is {x, y, w, h, rot?} in cover
 * pixels; `rot` is a tilt in radians for the snapshot layout.
 */
export function layoutPanels(layout, W, H) {
  const g = Math.max(6, Math.round(Math.min(W, H) * 0.012)); // white gutter
  switch (layout) {
    case 'hero':
      return {
        photos: [{ x: 0, y: 0, w: W, h: H }],
        title: { x: 0, y: H * 0.72, w: W, h: H * 0.28 },
        bg: 'photo',
      };
    case 'hero3': {
      const heroH = Math.round(H * 0.62);
      const rowH = H - heroH - g;
      const cw = Math.floor((W - 2 * g) / 3);
      return {
        photos: [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: heroH + g, w: cw, h: rowH },
          { x: cw + g, y: heroH + g, w: cw, h: rowH },
          { x: 2 * (cw + g), y: heroH + g, w: W - 2 * (cw + g), h: rowH },
        ],
        title: { x: 0, y: heroH - Math.round(H * 0.17), w: W, h: Math.round(H * 0.17) },
        bg: 'photo',
      };
    }
    case 'grid4': {
      const cw = Math.floor((W - g) / 2);
      const ch = Math.floor((H - g) / 2);
      return {
        photos: [
          { x: 0, y: 0, w: cw, h: ch },
          { x: cw + g, y: 0, w: W - cw - g, h: ch },
          { x: 0, y: ch + g, w: cw, h: H - ch - g },
          { x: cw + g, y: ch + g, w: W - cw - g, h: H - ch - g },
        ],
        title: { x: 0, y: H * 0.76, w: W, h: H * 0.24 },
        bg: 'photo',
      };
    }
    case 'grid9': {
      const cw = Math.floor((W - 2 * g) / 3);
      const ch = Math.floor((H - 2 * g) / 3);
      const photos = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // centre cell is the title block
          photos.push({
            x: c * (cw + g),
            y: r * (ch + g),
            w: c === 2 ? W - 2 * (cw + g) : cw,
            h: r === 2 ? H - 2 * (ch + g) : ch,
          });
        }
      }
      return {
        photos,
        title: { x: cw + g, y: ch + g, w: cw, h: ch },
        bg: 'photo',
      };
    }
    case 'tilt': {
      const pw = Math.round(W * 0.52);
      const ph = Math.round(H * 0.52);
      return {
        photos: [
          { x: Math.round(W * 0.06), y: Math.round(H * 0.06), w: pw, h: ph, rot: -0.1 },
          { x: Math.round(W * 0.42), y: Math.round(H * 0.1), w: pw, h: ph, rot: 0.08 },
          { x: Math.round(W * 0.24), y: Math.round(H * 0.34), w: pw, h: ph, rot: -0.03 },
        ],
        title: { x: 0, y: H * 0.8, w: W, h: H * 0.2 },
        bg: 'gradient',
      };
    }
    case 'split': {
      const lw = Math.round(W * 0.55);
      return {
        photos: [
          { x: 0, y: 0, w: lw, h: H },
          { x: lw + g, y: 0, w: W - lw - g, h: Math.round(H * 0.48) },
        ],
        title: { x: lw + g, y: Math.round(H * 0.48) + g, w: W - lw - g, h: H - Math.round(H * 0.48) - g },
        bg: 'photo',
      };
    }
    default:
      return layoutPanels('hero', W, H);
  }
}
