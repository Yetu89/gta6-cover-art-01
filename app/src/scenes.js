// Vice Sunset Cover Lab — screenshot scenes. A `?shot=` query sets the app
// up as one fixed scene instead of the empty editor, so the four screenshots
// are drawn by the app itself:
//
//   ?shot=cover  the cover alone, edge to edge, at its export size
//   ?shot=editor the editor in the browser, a sample photo loaded
//
// The other parameters pick the scene: layout, grade, size, photo (one sample
// for every panel), photos (a comma list cycled across the panels), title,
// subtitle, heat and font. window.__shotReady is set once the scene is fully
// painted, so a screenshot tool knows when to shoot.

/**
 * Applies one scene. hooks supplies the app's own pieces: loadSamples takes
 * sample keys and returns the loaded photo records, applyPatch merges a
 * partial state and redraws, and afterFonts runs a callback once the bundled
 * fonts are ready and a frame has painted.
 */
export async function runShot(query, hooks) {
  const shot = query.get('shot');
  if (!shot) return false;

  const patch = {};
  const layout = query.get('layout');
  if (layout) patch.layout = layout;
  const grade = query.get('grade');
  if (grade) patch.grade = grade;
  const size = query.get('size');
  if (size) patch.size = size;
  const title = query.get('title');
  if (title !== null) patch.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) patch.subtitle = subtitle;
  const heat = Number(query.get('heat'));
  if (Number.isInteger(heat) && heat >= 1 && heat <= 5) patch.heat = heat;
  const font = query.get('font');
  if (font) patch.font = font;

  const keys = [];
  const photosParam = query.get('photos');
  if (photosParam) keys.push(...photosParam.split(',').map((k) => k.trim()).filter(Boolean));
  const single = query.get('photo');
  if (single && !keys.length) keys.push(single);
  if (!keys.length) keys.push('pier');

  if (shot === 'cover') document.body.classList.add('shot-cover');

  const photos = await hooks.loadSamples(keys);
  hooks.applyPatch(patch, photos);
  await hooks.afterFonts();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
  return true;
}
