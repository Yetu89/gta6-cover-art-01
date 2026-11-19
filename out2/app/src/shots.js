// Fixed scenes for screenshots: ?shot=cover draws one exported cover full-frame,
// ?shot=editor shows the editor with a sample photo loaded. `window.__shotReady`
// is set once the scene has painted, so a screenshot tool knows when to shoot.
// The cover scene is the app's own drawing of the exported cover, at the gate's
// largest size — exactly what the rules allow a screenshot to show.

import { SIZES } from './presets.js';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

/**
 * Runs a shot scene. `setup` is the app's own loader: it takes a sample name and a
 * caption, loads the photo and applies the scene, then calls `done`.
 */
export async function runShot(shot, query, setup) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'Neon Coast';
  const layout = query.get('layout') ?? 'hero3';
  const grade = query.get('grade') ?? 'sunset';
  const sizeKey = query.get('size') ?? 'wide';
  const size = SIZES[sizeKey] ?? SIZES.wide;
  await setup({ photo, caption, subtitle, layout, grade, size });
  markReady();
}
