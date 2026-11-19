// Screenshot scenes: ?scene=1..4 renders a finished cover or the editor
// with a fixed state, so the four screenshots are drawn by the app itself.
// Scene 1: exported wide cover (hero + three, sunset).
// Scene 2: the editor in the browser with a sample photo loaded (four-panel
// grid, neon grade).
// Scene 3: exported square cover (nine-panel grid, neon).
// Scene 4: exported story cover (split layout, gold grade).

export const SCENES = {
  1: {
    mode: 'cover', w: 1920, h: 1080,
    state: {
      layout: 'hero3', grade: 'sunset',
      title: 'VICE SUNSET', subtitle: 'Golden Hour Getaway',
      font: 'anton', stars: 5,
      photos: ['pier', 'boulevard', 'pier', 'boulevard'],
    },
  },
  2: {
    mode: 'editor',
    state: {
      layout: 'grid4', grade: 'neon',
      title: 'PALM COURT', subtitle: 'Neon Nights',
      font: 'anton', stars: 4,
      photos: ['boulevard', 'pier', 'boulevard', 'pier'],
    },
  },
  3: {
    mode: 'cover', w: 1080, h: 1080,
    state: {
      layout: 'grid9', grade: 'neon',
      title: 'NEON PALMS', subtitle: 'Midnight Drive',
      font: 'anton', stars: 4,
      photos: ['boulevard', 'pier', 'boulevard', 'pier', 'boulevard', 'pier', 'boulevard', 'pier', 'boulevard'],
    },
  },
  4: {
    mode: 'cover', w: 1080, h: 1350,
    state: {
      layout: 'split', grade: 'gold',
      title: 'GOLDEN TIDE', subtitle: 'Sunset Run',
      font: 'anton', stars: 5,
      photos: ['pier', 'boulevard'],
    },
  },
};

// Build the full panel list for a scene: each panel gets its photo id and
// the default crop (centred, unzoomed, no adjustments).
export function scenePanels(photoIds) {
  return photoIds.map((photo) => ({
    photo, ox: 0, oy: 0, zoom: 1,
    bright: 100, contrast: 100, sat: 100, blur: 0,
  }));
}

export function sceneFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const n = Number(params.get('scene') || params.get('shot') || 0);
  return SCENES[n] || null;
}
