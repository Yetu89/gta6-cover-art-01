// Screenshot scene helpers: look a scene up by number and describe the
// four scenes the app can render on demand. The scene list itself lives
// in scenes.js.

import { SCENES, sceneFromUrl, scenePanels } from './scenes.js';

export { SCENES, sceneFromUrl, scenePanels };

export function sceneByNumber(n) {
  return SCENES[Number(n)] || null;
}

export function sceneList() {
  return Object.entries(SCENES).map(([n, s]) => ({
    scene: Number(n),
    mode: s.mode,
    w: s.w || null,
    h: s.h || null,
    title: s.state.title,
    layout: s.state.layout,
    grade: s.state.grade,
  }));
}
