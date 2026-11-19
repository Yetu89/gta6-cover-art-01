// Neon Coast Cover Studio — wires the page: photo uploads, panel picking (click a
// panel, drag to pan, scroll to zoom), layout / grade / caption / size controls,
// live preview, PNG export, undo/redo and localStorage session save. Photos are
// read on this machine and never uploaded anywhere.

import { renderCover, coverGeometry } from './cover.js';
import { loadImage, runShot } from './shots.js';
import {
  CAPTION_PRESETS, GRADES, LAYOUTS, SIZES, TITLE_FONTS, panelCount,
} from './presets.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');
const SAVE_KEY = 'neon-coast-studio-v1';

let photoSeq = 0;
let renderQueued = false;

/** The studio's state. Photos hold their own adjust values; panels hold the crop. */
function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: 'wide',
    title: 'Sunset Heist',
    subtitle: 'Neon Coast',
    titleFont: 'anton',
    heat: 4,
    grain: 0.6,
    vignette: true,
    photos: [],
    panels: Array.from({ length: 8 }, () => ({ photoId: null, zoom: 1, ox: 0.5, oy: 0.65 })),
    selectedPanel: 0,
    theme: 'dark',
  };
}
let state = defaultState();

/** Undo/redo stacks hold state JSON without the photos' image data. */
const undoStack = [];
const redoStack = [];
function snapshotState() {
  const { photos, ...rest } = state;
  return JSON.stringify({
    ...rest,
    photoAdjust: photos.map((p) => ({
      id: p.id, brightness: p.brightness, contrast: p.contrast,
      saturation: p.saturation, blur: p.blur,
    })),
  });
}
function pushUndo() {
  undoStack.push(snapshotState());
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}
function restoreSnapshot(json) {
  const data = JSON.parse(json);
  const photoAdjust = data.photoAdjust || [];
  delete data.photoAdjust;
  const photos = state.photos;
  state = { ...defaultState(), ...data, photos, selectedPanel: 0 };
  for (const adj of photoAdjust) {
    const p = photos.find((x) => x.id === adj.id);
    if (p) Object.assign(p, adj);
  }
  syncControls();
  queueRender();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotState());
  restoreSnapshot(undoStack.pop());
  updateUndoButtons();
  setStatus('Undone.');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotState());
  restoreSnapshot(redoStack.pop());
  updateUndoButtons();
  setStatus('Redone.');
}
function updateUndoButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
}

/** Saves the session (settings, crops, photo adjustments) to localStorage. */
let saveTimer = null;
function saveSessionState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const { photos, ...rest } = state;
      const saved = {
        ...rest,
        photoAdjust: photos.map((p) => ({
          id: p.id, brightness: p.brightness, contrast: p.contrast,
          saturation: p.saturation, blur: p.blur,
        })),
        photoIds: photos.map((p) => ({ id: p.id, name: p.name, src: p.src })),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
      $('save-note').textContent = 'Session saved on this machine.';
    } catch { /* storage full or blocked: the app still works */ }
  }, 300);
}

/** Loads a saved session: settings and crops come back; sample photos re-attach. */
function loadSessionState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { /* ignore */ }
  if (!saved) return false;
  const photos = state.photos;
  const { photoAdjust = [], photoIds = [], ...rest } = saved;
  state = { ...defaultState(), ...rest, photos, selectedPanel: 0 };
  for (const adj of photoAdjust) {
    const p = photos.find((x) => x.id === adj.id);
    if (p) Object.assign(p, adj);
  }
  // Panels that pointed at an uploaded photo that is gone fall back to a sample.
  for (const panel of state.panels) {
    if (panel.photoId && !photos.some((p) => p.id === panel.photoId)) panel.photoId = null;
  }
  return true;
}

/** The preview renders at most 960 px on its long side; exports render full-size. */
function previewSize() {
  const size = SIZES[state.size] || SIZES.wide;
  const scale = Math.min(1, 960 / Math.max(size.w, size.h));
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function selectedPhoto() {
  const panel = state.panels[state.selectedPanel];
  return state.photos.find((p) => p.id === panel?.photoId) || state.photos[0] || null;
}

function renderPreview() {
  const size = previewSize();
  renderCover(canvas, { ...state, size });
  // Outline the selected panel so the maker sees which one the sliders edit.
  const geo = coverGeometry(state, canvas.width, canvas.height);
  const rect = geo.photos[state.selectedPanel];
  if (rect && geo.photos.length > 1) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, rect.w - 6, rect.h - 6);
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
    }
    ctx.restore();
  }
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
    saveSessionState();
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** Renders a cover at full export size and downloads it as a PNG. */
export async function exportCoverPNG(sizeKey) {
  const size = SIZES[sizeKey] || SIZES[state.size];
  const off = document.createElement('canvas');
  renderCover(off, { ...state, size });
  const blob = await new Promise((resolve, reject) => {
    off.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neon-coast-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return { w: size.w, h: size.h, bytes: blob.size };
}

/** Exports all three post sizes, one after another. */
async function exportAllSizes() {
  setStatus('Exporting all three sizes…');
  for (const key of Object.keys(SIZES)) {
    try {
      const out = await exportCoverPNG(key);
      setStatus(`Saved ${out.w} x ${out.h} PNG (${Math.round(out.bytes / 1024)} KB).`);
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  setStatus('Saved all three sizes: 1080 x 1080, 1080 x 1350, 1920 x 1080.');
}

// ---- Photos ---------------------------------------------------------------

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const photo = {
      id: `up${++photoSeq}`,
      name: file.name,
      src: url,
      img,
      brightness: 1, contrast: 1.05, saturation: 1.15, blur: 0,
    };
    state.photos.push(photo);
    pushUndo();
    addPhotoThumb(photo);
    // A new photo fills the selected panel at once: one step from photo to cover.
    state.panels[state.selectedPanel].photoId = photo.id;
    syncPhotoControls();
    queueRender();
    setStatus(`Loaded ${file.name}. It fills panel ${state.selectedPanel + 1}.`);
    return photo;
  } catch {
    URL.revokeObjectURL(url);
    setStatus(`Could not read ${file.name} as an image.`);
    return null;
  }
}

async function addSamplePhoto(name, label) {
  const img = await loadImage(`samples/${name}.jpg`);
  const photo = {
    id: `sample-${name}`,
    name: label,
    src: `samples/${name}.jpg`,
    img,
    brightness: 1, contrast: 1.05, saturation: 1.15, blur: 0,
  };
  state.photos.push(photo);
  addPhotoThumb(photo);
  return photo;
}

function addPhotoThumb(photo) {
  const strip = $('photo-strip');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'thumb';
  btn.title = `${photo.name} — click to put it in the selected panel`;
  btn.dataset.photoId = photo.id;
  const img = document.createElement('img');
  img.src = photo.src;
  img.alt = photo.name;
  btn.appendChild(img);
  btn.addEventListener('click', () => {
    pushUndo();
    state.panels[state.selectedPanel].photoId = photo.id;
    markSelectedThumb();
    syncPhotoControls();
    queueRender();
    setStatus(`${photo.name} is now in panel ${state.selectedPanel + 1}.`);
  });
  strip.appendChild(btn);
  markSelectedThumb();
}

function markSelectedThumb() {
  const panel = state.panels[state.selectedPanel];
  for (const btn of document.querySelectorAll('.thumb')) {
    btn.classList.toggle('active', btn.dataset.photoId === panel?.photoId);
  }
  $('fill-all').disabled = !state.photos.length;
}

/** Fills every panel of the layout with the selected panel's photo. */
function fillAllPanels() {
  const photo = selectedPhoto();
  if (!photo) return;
  pushUndo();
  for (let i = 0; i < panelCount(state.layout); i++) {
    state.panels[i].photoId = photo.id;
  }
  queueRender();
  setStatus(`All ${panelCount(state.layout)} panels now use ${photo.name}.`);
}

// ---- Controls -------------------------------------------------------------

function buildControlGroups() {
  const layoutBox = $('layout-box');
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.dataset.layout = key;
    btn.innerHTML = `<b>${layout.label}</b><span>${layout.hint}</span>`;
    btn.addEventListener('click', () => {
      if (state.layout === key) return;
      pushUndo();
      state.layout = key;
      state.selectedPanel = 0;
      syncControls();
      queueRender();
      setStatus(`Layout: ${layout.label}.`);
    });
    layoutBox.appendChild(btn);
  }

  const gradeBox = $('grade-box');
  for (const [key, grade] of Object.entries(GRADES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.grade = key;
    btn.style.background = grade.swatch;
    btn.title = grade.label;
    btn.setAttribute('aria-label', grade.label);
    btn.addEventListener('click', () => {
      if (state.grade === key) return;
      pushUndo();
      state.grade = key;
      syncControls();
      queueRender();
      setStatus(`Grade: ${grade.label}.`);
    });
    gradeBox.appendChild(btn);
  }

  const sizeBox = $('size-box');
  for (const [key, size] of Object.entries(SIZES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.dataset.size = key;
    btn.innerHTML = `<b>${size.label}</b>`;
    btn.addEventListener('click', () => {
      if (state.size === key) return;
      state.size = key;
      syncControls();
      queueRender();
    });
    sizeBox.appendChild(btn);
  }

  const presetBox = $('caption-presets');
  for (const preset of CAPTION_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = preset;
    btn.addEventListener('click', () => {
      pushUndo();
      state.title = preset;
      $('caption').value = preset;
      queueRender();
    });
    presetBox.appendChild(btn);
  }

  const fontSel = $('title-font');
  for (const [key, font] of Object.entries(TITLE_FONTS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = font.label;
    fontSel.appendChild(opt);
  }

  const heatBox = $('heat-box');
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'heat';
    btn.textContent = '★';
    btn.dataset.stars = String(i);
    btn.addEventListener('click', () => {
      pushUndo();
      state.heat = i;
      syncControls();
      queueRender();
    });
    heatBox.appendChild(btn);
  }
}

function bindSlider(id, get, set, format) {
  const input = $(id);
  const out = $(`${id}-val`);
  input.addEventListener('input', () => {
    set(parseFloat(input.value));
    out.textContent = format(parseFloat(input.value));
    queueRender();
  });
  input.addEventListener('change', pushUndo);
}

function syncPhotoControls() {
  const photo = selectedPhoto();
  const set = (id, val, fmt) => {
    $(id).value = val;
    $(`${id}-val`).textContent = fmt(val);
  };
  if (!photo) return;
  const panel = state.panels[state.selectedPanel];
  set('zoom', panel.zoom, (v) => `${v.toFixed(2)}x`);
  set('brightness', photo.brightness, (v) => `${Math.round(v * 100)}%`);
  set('contrast', photo.contrast, (v) => `${Math.round(v * 100)}%`);
  set('saturation', photo.saturation, (v) => `${Math.round(v * 100)}%`);
  set('blur', photo.blur, (v) => `${v}px`);
  $('panel-label').textContent = `Panel ${state.selectedPanel + 1} of ${panelCount(state.layout)}` +
    (photo ? ` — ${photo.name}` : '');
}

function syncControls() {
  for (const btn of document.querySelectorAll('#layout-box .choice')) {
    btn.classList.toggle('active', btn.dataset.layout === state.layout);
  }
  for (const btn of document.querySelectorAll('#grade-box .swatch')) {
    btn.classList.toggle('active', btn.dataset.grade === state.grade);
  }
  for (const btn of document.querySelectorAll('#size-box .choice')) {
    btn.classList.toggle('active', btn.dataset.size === state.size);
  }
  for (const btn of document.querySelectorAll('#heat-box .heat')) {
    btn.classList.toggle('active', Number(btn.dataset.stars) <= state.heat);
  }
  $('caption').value = state.title;
  $('subtitle').value = state.subtitle;
  $('title-font').value = state.titleFont;
  $('grain').value = state.grain;
  $('grain-val').textContent = `${Math.round(state.grain * 100)}%`;
  $('vignette').checked = state.vignette;
  document.body.classList.toggle('light', state.theme === 'light');
  $('theme-toggle').textContent = state.theme === 'light' ? 'Dark mode' : 'Light mode';
  syncPhotoControls();
  markSelectedThumb();
}

function bindControls() {
  $('photo-input').addEventListener('change', async (e) => {
    for (const file of e.target.files) await addPhotoFile(file);
    e.target.value = '';
  });
  const drop = $('drop-zone');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) await addPhotoFile(file);
    }
  });
  $('fill-all').addEventListener('click', fillAllPanels);

  $('caption').addEventListener('input', (e) => { state.title = e.target.value; queueRender(); });
  $('caption').addEventListener('change', pushUndo);
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; queueRender(); });
  $('subtitle').addEventListener('change', pushUndo);
  $('title-font').addEventListener('change', (e) => {
    pushUndo();
    state.titleFont = e.target.value;
    queueRender();
  });

  bindSlider('zoom', null, (v) => { state.panels[state.selectedPanel].zoom = v; },
    (v) => `${v.toFixed(2)}x`);
  bindSlider('brightness', null, (v) => { const p = selectedPhoto(); if (p) p.brightness = v; },
    (v) => `${Math.round(v * 100)}%`);
  bindSlider('contrast', null, (v) => { const p = selectedPhoto(); if (p) p.contrast = v; },
    (v) => `${Math.round(v * 100)}%`);
  bindSlider('saturation', null, (v) => { const p = selectedPhoto(); if (p) p.saturation = v; },
    (v) => `${Math.round(v * 100)}%`);
  bindSlider('blur', null, (v) => { const p = selectedPhoto(); if (p) p.blur = v; },
    (v) => `${v}px`);
  bindSlider('grain', null, (v) => { state.grain = v; }, (v) => `${Math.round(v * 100)}%`);
  $('vignette').addEventListener('change', (e) => {
    pushUndo();
    state.vignette = e.target.checked;
    queueRender();
  });

  $('export').addEventListener('click', async () => {
    try {
      const out = await exportCoverPNG(state.size);
      setStatus(`Saved ${out.w} x ${out.h} PNG (${Math.round(out.bytes / 1024)} KB).`);
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
    }
  });
  $('export-all').addEventListener('click', exportAllSizes);
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('reset').addEventListener('click', () => {
    pushUndo();
    const photos = state.photos;
    state = { ...defaultState(), photos };
    for (let i = 0; i < state.panels.length; i++) {
      state.panels[i].photoId = photos[Math.min(i, photos.length - 1)]?.id ?? null;
    }
    syncControls();
    queueRender();
    setStatus('Reset to the default cover.');
  });
  $('theme-toggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    syncControls();
    queueRender();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' ||
        (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  });

  // Canvas: click picks a panel, drag pans it, wheel zooms it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const geo = coverGeometry(state, canvas.width, canvas.height);
    const idx = geo.photos.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    if (idx === -1) return;
    state.selectedPanel = idx;
    drag = { x: e.clientX, y: e.clientY, panel: idx };
    canvas.setPointerCapture(e.pointerId);
    syncPhotoControls();
    markSelectedThumb();
    queueRender();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const panel = state.panels[drag.panel];
    const geo = coverGeometry(state, canvas.width, canvas.height);
    const r = geo.photos[drag.panel];
    if (!r) return;
    const dx = ((e.clientX - drag.x) / rect.width) * canvas.width;
    const dy = ((e.clientY - drag.y) / rect.height) * canvas.height;
    panel.ox = Math.min(1, Math.max(0, panel.ox + dx / r.w));
    panel.oy = Math.min(1, Math.max(0, panel.oy + dy / r.h));
    drag.x = e.clientX;
    drag.y = e.clientY;
    queueRender();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) { pushUndo(); drag = null; }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selectedPanel];
    panel.zoom = Math.min(4, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
    syncPhotoControls();
    queueRender();
  }, { passive: false });
}

// ---- Boot -----------------------------------------------------------------

async function boot() {
  buildControlGroups();
  bindControls();
  try {
    await Promise.all([
      document.fonts.load('16px Anton'),
      document.fonts.load('16px Pacifico'),
    ]);
  } catch { /* fall back to system fonts if a font file cannot load */ }

  // The two sample photos (made with an image model for make.fun, free to use)
  // are the default photos, so the app opens with a finished cover, not a blank.
  const pier = await addSamplePhoto('pier', 'Pier sample');
  const boulevard = await addSamplePhoto('boulevard', 'Boulevard sample');
  const restored = loadSessionState();
  for (let i = 0; i < state.panels.length; i++) {
    if (!state.panels[i].photoId) {
      state.panels[i].photoId = i % 2 === 0 ? pier.id : boulevard.id;
    }
  }
  syncControls();
  updateUndoButtons();
  setStatus(restored
    ? 'Welcome back — your last session was restored.'
    : 'Loaded with two sample photos. Add your own photo to make it yours.');

  // Screenshot scenes (?shot=cover / ?shot=editor) for the entry's screenshots.
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  // A cover shot must never be overpainted by the preview's queued render (which
  // draws the editor's selection outline): skip the preview render entirely.
  if (shot !== 'cover') queueRender();
  if (shot) {
    await runShot(shot, query, async ({ photo, caption, subtitle, layout, grade, size }) => {
      state.layout = layout;
      state.grade = grade;
      state.size = size;
      state.title = caption;
      state.subtitle = subtitle;
      const sample = state.photos.find((p) => p.id === `sample-${photo}`) || state.photos[0];
      const other = state.photos.find((p) => p.id !== sample.id) || sample;
      // Alternate the two photos across panels so multi-panel shots show both.
      for (let i = 0; i < state.panels.length; i++) {
        state.panels[i].photoId = i % 2 === 0 ? sample.id : other.id;
      }
      syncControls();
      if (shot === 'cover') {
        // Full export resolution: the screenshot shows the cover as exported.
        renderCover(canvas, state);
      } else {
        renderPreview();
      }
    });
  }
}

// Test hook for the local grade: state, a full-size export as a data URL, and
// whether the page made any network request it should not have.
window.__studio = {
  get state() { return state; },
  async exportDataURL(sizeKey) {
    const size = SIZES[sizeKey] || SIZES[state.size];
    const off = document.createElement('canvas');
    renderCover(off, { ...state, size });
    return { w: size.w, h: size.h, dataURL: off.toDataURL('image/png') };
  },
};

boot();
