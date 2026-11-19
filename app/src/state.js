// Vice Sunset Cover Lab — state: the cover's data, its six layouts, five colour
// grades, caption presets, undo history and session autosave. No DOM here, so
// the renderer and the editor both read the same single source of truth.
//
// A panel transform positions one photo inside one panel: x and y pan the
// photo as a fraction of the panel, zoom scales it, and the four numbers after
// it are the per-photo adjustments (brightness, contrast and saturation in
// percent around zero, blur in pixels).

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

export const LAYOUTS = [
  { id: 'hero', name: 'Full-bleed hero', blurb: 'One photo, edge to edge' },
  { id: 'hero3', name: 'Hero + three', blurb: 'Big hero, three below' },
  { id: 'grid4', name: 'Four-panel grid', blurb: 'Classic 2 × 2 poster' },
  { id: 'grid9', name: 'Nine-panel grid', blurb: 'Title in the centre cell' },
  { id: 'polaroid', name: 'Tilted snapshots', blurb: 'Polaroid prints on sunset' },
  { id: 'split', name: 'Split story', blurb: 'Tall photo, title block' },
];

export const GRADES = [
  {
    id: 'sunset', name: 'Vice Sunset', blurb: 'Pink dusk, gold light',
    stops: [[0, [26, 12, 46]], [0.35, [122, 32, 96]], [0.65, [232, 84, 66]], [1, [255, 196, 110]]],
    strength: 0.55, sky: ['#2b1040', '#c22e6e', '#ff7a3d', '#ffc46b'],
    title: ['#ffe259', '#ff7a3d', '#ff2e88'],
  },
  {
    id: 'neon', name: 'Neon Nights', blurb: 'Magenta and cyan glow',
    stops: [[0, [10, 8, 38]], [0.4, [64, 20, 120]], [0.7, [220, 40, 140]], [1, [120, 240, 255]]],
    strength: 0.6, sky: ['#0d0626', '#3b0f6e', '#c2188b', '#2dd4ff'],
    title: ['#7df9ff', '#ff5ed8', '#b388ff'],
  },
  {
    id: 'gold', name: 'Palm Gold', blurb: 'Warm amber afternoon',
    stops: [[0, [30, 20, 8]], [0.45, [120, 80, 20]], [0.75, [230, 170, 60]], [1, [255, 236, 170]]],
    strength: 0.5, sky: ['#3a2408', '#a05a14', '#e89b3c', '#ffe9a8'],
    title: ['#fff3b0', '#ffb347', '#e85d1f'],
  },
  {
    id: 'ocean', name: 'Ocean Drive', blurb: 'Teal water, pale sky',
    stops: [[0, [6, 24, 40]], [0.4, [16, 90, 110]], [0.7, [40, 170, 180]], [1, [190, 245, 230]]],
    strength: 0.5, sky: ['#07222e', '#0e5a6e', '#2bb3a3', '#bff5e6'],
    title: ['#aef3ff', '#38c6d9', '#f4a259'],
  },
  {
    id: 'mono', name: 'Mono Noir', blurb: 'Black-and-white film',
    stops: [[0, [0, 0, 0]], [0.5, [90, 90, 95]], [1, [255, 255, 255]]],
    strength: 0.75, sky: ['#111111', '#3a3a3a', '#8a8a8a', '#e8e8e8'],
    title: ['#ffffff', '#d9d9d9', '#8a8a8a'],
  },
];

export const FONTS = [
  { id: 'anton', name: 'Anton', family: "'Anton', sans-serif" },
  { id: 'pacifico', name: 'Pacifico script', family: "'Pacifico', cursive" },
  { id: 'sans', name: 'Bold system sans', family: "system-ui, sans-serif" },
];

export const PRESETS = [
  { name: 'Sunset Heist', title: 'VICE SUNSET', subtitle: 'Golden Hour Getaway', layout: 'hero3', grade: 'sunset', heat: 5, font: 'anton' },
  { name: 'Neon Nights', title: 'PALM COURT', subtitle: 'Neon Nights', layout: 'grid4', grade: 'neon', heat: 4, font: 'anton' },
  { name: 'Palm Gold', title: 'GOLDEN HOUR', subtitle: 'Ocean Drive', layout: 'split', grade: 'gold', heat: 5, font: 'anton' },
  { name: 'Mono Noir', title: 'NIGHT SHIFT', subtitle: 'Vice City After Dark', layout: 'hero', grade: 'mono', heat: 3, font: 'sans' },
  { name: 'Script Sunset', title: 'SUNSET BOULEVARD', subtitle: "Cruisin' the Coast", layout: 'polaroid', grade: 'sunset', heat: 4, font: 'pacifico' },
];

export const SAMPLE_PHOTOS = [
  { key: 'boulevard', name: 'Boulevard' },
  { key: 'pier', name: 'Pier' },
];

/** A fresh default panel transform. */
export function defaultPanel(photo = 0) {
  return { photo, x: 0, y: 0, zoom: 1, bright: 0, contrast: 0, sat: 0, blur: 0 };
}

/** The cover's starting state. */
export function createState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: 'square',
    title: 'VICE SUNSET',
    subtitle: 'Golden Hour Getaway',
    font: 'anton',
    heat: 5,
    panels: [defaultPanel(1), defaultPanel(0), defaultPanel(1), defaultPanel(0)],
    selected: 0,
    theme: 'dark',
  };
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

export function fontById(id) {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

/**
 * Panel rectangles for a layout at a canvas of w by h. Each entry is a
 * rectangle in pixels with a kind: 'photo' holds a picture, 'title' holds the
 * caption block (the nine-panel grid's centre cell). Polaroid panels carry a
 * tilt in degrees and a white frame; the renderer draws the frame.
 */
export function layoutPanels(layoutId, w, h) {
  const gap = Math.max(4, Math.round(Math.min(w, h) * 0.012));
  const inset = (x, y, pw, ph) => ({ x: x + gap / 2, y: y + gap / 2, w: pw - gap, h: ph - gap, kind: 'photo', tilt: 0, frame: false });
  const third = w / 3;
  const half = w / 2;
  switch (layoutId) {
    case 'hero':
      return [{ x: 0, y: 0, w, h, kind: 'photo', tilt: 0, frame: false }];
    case 'hero3': {
      const heroH = h * 0.62;
      return [
        inset(0, 0, w, heroH),
        inset(0, heroH, third, h - heroH),
        inset(third, heroH, third, h - heroH),
        inset(third * 2, heroH, third, h - heroH),
      ];
    }
    case 'grid4':
      return [
        inset(0, 0, half, h / 2),
        inset(half, 0, half, h / 2),
        inset(0, h / 2, half, h / 2),
        inset(half, h / 2, half, h / 2),
      ];
    case 'grid9': {
      const cells = [];
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          if (row === 1 && col === 1) {
            cells.push({ x: col * third + gap / 2, y: row * (h / 3) + gap / 2, w: third - gap, h: h / 3 - gap, kind: 'title', tilt: 0, frame: false });
          } else {
            cells.push(inset(col * third, row * (h / 3), third, h / 3));
          }
        }
      }
      return cells;
    }
    case 'polaroid': {
      const pw = w * 0.3;
      const ph = h * 0.52;
      const top = h * 0.16;
      return [
        { x: w * 0.06, y: top, w: pw, h: ph, kind: 'photo', tilt: -6, frame: true },
        { x: w * 0.35, y: top + h * 0.03, w: pw, h: ph, kind: 'photo', tilt: 3, frame: true },
        { x: w * 0.64, y: top - h * 0.01, w: pw, h: ph, kind: 'photo', tilt: -3, frame: true },
      ];
    }
    case 'split': {
      if (h >= w) {
        const topH = h * 0.52;
        return [
          inset(0, 0, w, topH),
          inset(0, topH, half, h - topH),
          inset(half, topH, half, h - topH),
        ];
      }
      const leftW = w * 0.55;
      return [
        inset(0, 0, leftW, h),
        inset(leftW, 0, w - leftW, h / 2),
        inset(leftW, h / 2, w - leftW, h / 2),
      ];
    }
    default:
      return [{ x: 0, y: 0, w, h, kind: 'photo', tilt: 0, frame: false }];
  }
}

/** How many photo panels a layout has at this canvas size. */
export function photoPanelCount(layoutId, w, h) {
  return layoutPanels(layoutId, w, h).filter((p) => p.kind === 'photo').length;
}

/**
 * Grows or shrinks state.panels to match the layout, keeping each kept
 * panel's transform and photo. New panels start on the first photo.
 */
export function ensurePanels(state, w, h) {
  const count = photoPanelCount(state.layout, w, h);
  while (state.panels.length < count) state.panels.push(defaultPanel(0));
  state.panels.length = count;
  if (state.selected >= count) state.selected = 0;
}

/** A plain snapshot of everything undo and autosave need. */
export function snapshotState(state, photoKeys) {
  return {
    layout: state.layout,
    grade: state.grade,
    size: state.size,
    title: state.title,
    subtitle: state.subtitle,
    font: state.font,
    heat: state.heat,
    panels: state.panels.map((p) => ({ ...p })),
    photoKeys: photoKeys.slice(),
  };
}

/** Restores a snapshot; photoKeys are resolved against the photos on hand. */
export function applySnapshot(state, snap, photos) {
  state.layout = snap.layout;
  state.grade = snap.grade;
  state.size = snap.size;
  state.title = snap.title;
  state.subtitle = snap.subtitle;
  state.font = snap.font;
  state.heat = snap.heat;
  state.panels = snap.panels.map((p) => ({ ...p }));
  if (Array.isArray(snap.photoKeys)) {
    state.panels.forEach((panel, i) => {
      const key = snap.photoKeys[panel.photo] ?? snap.photoKeys[0];
      const idx = photos.findIndex((ph) => ph.key === key);
      panel.photo = idx === -1 ? 0 : idx;
    });
  }
  if (state.selected >= state.panels.length) state.selected = 0;
}

const SESSION_KEY = 'vice-sunset-cover-lab-v1';

/** Saves the session (settings and sample-photo choices) in this browser. */
export function saveSession(state, photoKeys) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshotState(state, photoKeys)));
  } catch {
    // Private mode or a full store: the cover still works, it just is not saved.
  }
}

/** Loads the saved session, or null when there is none. */
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
