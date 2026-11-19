// Cover facade: the one place the rest of the app asks for a finished
// cover. The drawing itself lives in render.js; this file only turns a
// rendered cover into the forms the editor and the test hook need.

import { drawCover, exportCover } from './render.js';

export { drawCover, exportCover };

// Render a cover and hand back a PNG data URL at the requested size.
export function coverDataURL(state, photosById, w, h) {
  const canvas = exportCover(state, photosById, w, h);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(''); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

// Render a cover into a canvas the caller already owns.
export function paintCoverInto(canvas, state, photosById, w, h, opts) {
  return drawCover(canvas, state, photosById, w, h, opts);
}
