// Vice Sunset Cover Lab — photos: loading pictures from the machine and
// drawing one into a panel. Photos are read on this machine and never sent
// anywhere: a picked file is shown through a local object URL, a sample
// through its file under app/samples/.

/** Loads an image from a URL and resolves once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Loads one of the built-in sample photos by key ('boulevard' or 'pier'). */
export async function loadSamplePhoto(key) {
  const img = await loadImage(`samples/${key}.jpg`);
  return { key, name: key === 'pier' ? 'Pier' : 'Boulevard', img, url: `samples/${key}.jpg` };
}

/** Turns picked files into photo records, keeping their local object URLs. */
export async function loadUserFiles(files) {
  const made = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      made.push({ key: `user-${Date.now()}-${made.length}`, name: file.name.replace(/\.[^.]+$/, ''), img, url });
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  return made;
}

/** The CSS filter string for one panel's adjustments. */
export function panelFilter(transform) {
  const parts = [
    `brightness(${100 + transform.bright}%)`,
    `contrast(${100 + transform.contrast}%)`,
    `saturate(${100 + transform.sat}%)`,
  ];
  if (transform.blur > 0) parts.push(`blur(${transform.blur}px)`);
  return parts.join(' ');
}

/**
 * Draws a photo into a rectangle, cover-fitting it (the rectangle is always
 * filled, the photo cropped at its edges) and then applying the panel's pan
 * and zoom. x and y pan as fractions of the rectangle; zoom scales about its
 * centre. The caller sets clipping and any filter first.
 */
export function drawPhotoCover(ctx, img, rect, transform) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * transform.zoom;
  const dw = iw * base;
  const dh = ih * base;
  const dx = rect.x + (rect.w - dw) / 2 + transform.x * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + transform.y * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Draws the photo for a panel onto a context, with its filter applied. */
export function paintPhoto(ctx, photo, rect, transform) {
  if (!photo) return;
  ctx.save();
  ctx.filter = panelFilter(transform);
  drawPhotoCover(ctx, photo.img, rect, transform);
  ctx.restore();
}
