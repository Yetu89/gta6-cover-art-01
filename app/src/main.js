// Vice Sunset Cover Lab — bootstrap: loads the samples, wires every control,
// keeps one undo history, autosaves the session, and exports the PNGs.
// The preview canvas is the export canvas: it is always drawn at the chosen
// post size, and CSS scales it down, so the preview is the exported file.
// The editor's selection outline is preview-only: exports and cover scenes
// are drawn without it.

import {
  SIZES, LAYOUTS, GRADES, FONTS, PRESETS, SAMPLE_PHOTOS,
  createState, defaultPanel, ensurePanels,
  snapshotState, applySnapshot, saveSession, loadSession,
} from './state.js';
import { loadSamplePhoto, loadUserFiles } from './photos.js';
import { drawCover, hitTestPanel, photoPanels } from './cover.js';
import {
  buildButtonGroup, markActive, buildStars, buildThumbs, buildSliders,
  bindCanvasPointer, bindFileInput,
} from './editor.js';
import { runShot } from './scenes.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const state = createState();
let photos = [];
let undoStack = [];
let redoStack = [];
let dragUndoPushed = false;
let sliderUndoPushed = false;

const photoKeys = () => photos.map((p) => p.key);
const snapshotNow = () => JSON.stringify(snapshotState(state, photoKeys()));

function setStatus(text) {
  statusEl.textContent = text;
}

/** Redraws the preview. Pass false for a clean export frame, no outline. */
function redraw(showSelection = true) {
  const inCoverScene = document.body.classList.contains('shot-cover');
  drawCover(canvas, state, photos, { showSelection: showSelection && !inCoverScene });
}

/** One undo step for the change about to happen; the redo stack clears. */
function pushUndo() {
  undoStack.push(snapshotNow());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function updateUndoButtons() {
  document.getElementById('undoBtn').disabled = undoStack.length === 0;
  document.getElementById('redoBtn').disabled = redoStack.length === 0;
}

function doUndo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotNow());
  applySnapshot(state, JSON.parse(undoStack.pop()), photos);
  syncControls();
  redraw();
  saveSoon();
  updateUndoButtons();
}

function doRedo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotNow());
  applySnapshot(state, JSON.parse(redoStack.pop()), photos);
  syncControls();
  redraw();
  saveSoon();
  updateUndoButtons();
}

let saveTimer = 0;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSession(state, photoKeys()), 300);
}

/** Reflects the state back into every control after a load, undo or redo. */
function syncControls() {
  ensurePanels(state, canvas.width, canvas.height);
  markActive(document.getElementById('layoutBtns'), state.layout);
  markActive(document.getElementById('gradeBtns'), state.grade);
  markActive(document.getElementById('fontBtns'), state.font);
  markActive(document.getElementById('sizeBtns'), state.size);
  buildStars(document.getElementById('heatStars'), state.heat, pickHeat);
  const selected = state.panels[state.selected];
  buildThumbs(document.getElementById('thumbs'), photos, selected?.photo ?? 0, pickThumb);
  document.getElementById('titleInput').value = state.title;
  document.getElementById('subtitleInput').value = state.subtitle;
  buildSliders(document.getElementById('panelSliders'), selected ?? defaultPanel(), sliderInput, () => {
    sliderUndoPushed = false;
    saveSoon();
  });
  document.body.dataset.theme = state.theme;
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? 'Light mode' : 'Dark mode';
}

function pickHeat(heat) {
  pushUndo();
  state.heat = heat;
  syncControls();
  redraw();
  saveSoon();
}

function pickThumb(index) {
  const panel = state.panels[state.selected];
  if (!panel || panel.photo === index) return;
  pushUndo();
  panel.photo = index;
  syncControls();
  redraw();
  saveSoon();
}

function sliderInput(key, value) {
  const panel = state.panels[state.selected];
  if (!panel) return;
  if (!sliderUndoPushed) {
    pushUndo();
    sliderUndoPushed = true;
  }
  panel[key] = value;
  redraw();
}

function applyPreset(preset) {
  pushUndo();
  state.title = preset.title;
  state.subtitle = preset.subtitle;
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.heat = preset.heat;
  state.font = preset.font;
  syncControls();
  redraw();
  saveSoon();
  setStatus(`Preset “${preset.name}” applied.`);
}

function downloadPng(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function canvasBlob() {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function exportSize(sizeId) {
  const previous = state.size;
  state.size = sizeId;
  redraw(false);
  const blob = await canvasBlob();
  if (!blob) {
    setStatus('Export failed — the canvas was empty.');
    state.size = previous;
    redraw();
    return null;
  }
  const size = SIZES[sizeId];
  downloadPng(blob, `vice-sunset-${size.w}x${size.h}.png`);
  setStatus(`Saved vice-sunset-${size.w}x${size.h}.png (${Math.round(blob.size / 1024)} KiB).`);
  state.size = previous;
  redraw();
  return blob;
}

async function exportAll() {
  for (const sizeId of Object.keys(SIZES)) {
    await exportSize(sizeId);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  setStatus('Saved all three sizes: 1080 × 1080, 1080 × 1350 and 1920 × 1080.');
}

function buildControls() {
  buildButtonGroup(document.getElementById('layoutBtns'), LAYOUTS, state.layout, (id) => {
    if (id === state.layout) return;
    pushUndo();
    state.layout = id;
    syncControls();
    redraw();
    saveSoon();
  });
  buildButtonGroup(document.getElementById('gradeBtns'), GRADES, state.grade, (id) => {
    if (id === state.grade) return;
    pushUndo();
    state.grade = id;
    syncControls();
    redraw();
    saveSoon();
  });
  buildButtonGroup(document.getElementById('fontBtns'), FONTS, state.font, (id) => {
    if (id === state.font) return;
    pushUndo();
    state.font = id;
    syncControls();
    redraw();
    saveSoon();
  });
  buildButtonGroup(document.getElementById('sizeBtns'),
    Object.entries(SIZES).map(([id, s]) => ({ id, name: s.label })),
    state.size, (id) => {
      if (id === state.size) return;
      pushUndo();
      state.size = id;
      syncControls();
      redraw();
      saveSoon();
    });
  const presetBox = document.getElementById('presetBtns');
  for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = preset.name;
    button.addEventListener('click', () => applyPreset(preset));
    presetBox.appendChild(button);
  }

  document.getElementById('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    redraw();
    saveSoon();
  });
  document.getElementById('titleInput').addEventListener('change', pushUndo);
  document.getElementById('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    redraw();
    saveSoon();
  });
  document.getElementById('subtitleInput').addEventListener('change', pushUndo);

  document.getElementById('fillAllBtn').addEventListener('click', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    pushUndo();
    const photo = panel.photo;
    state.panels.forEach((p) => { p.photo = photo; });
    syncControls();
    redraw();
    saveSoon();
    setStatus('Every panel now shows the same photo.');
  });

  document.getElementById('exportBtn').addEventListener('click', () => exportSize(state.size));
  document.getElementById('exportAllBtn').addEventListener('click', exportAll);
  document.getElementById('undoBtn').addEventListener('click', doUndo);
  document.getElementById('redoBtn').addEventListener('click', doRedo);
  document.getElementById('themeBtn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    syncControls();
    saveSoon();
  });

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      doUndo();
    } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault();
      doRedo();
    }
  });

  bindCanvasPointer(canvas, {
    hitTest: (x, y) => hitTestPanel(state, canvas.width, canvas.height, x, y),
    select: (i) => {
      if (state.selected === i) return;
      state.selected = i;
      syncControls();
      redraw();
    },
    pan: (dxFrac, dyFrac) => {
      const panel = state.panels[state.selected];
      if (!panel) return;
      if (!dragUndoPushed) {
        pushUndo();
        dragUndoPushed = true;
      }
      const rect = photoPanels(state, canvas.width, canvas.height)[state.selected];
      panel.x = Math.max(-0.6, Math.min(0.6, panel.x + (dxFrac * canvas.width) / rect.w));
      panel.y = Math.max(-0.6, Math.min(0.6, panel.y + (dyFrac * canvas.height) / rect.h));
      redraw();
    },
    settled: () => {
      dragUndoPushed = false;
      saveSoon();
    },
    zoom: (factor) => {
      const panel = state.panels[state.selected];
      if (!panel) return;
      if (!dragUndoPushed) {
        pushUndo();
        dragUndoPushed = true;
        setTimeout(() => { dragUndoPushed = false; }, 900);
      }
      panel.zoom = Math.max(0.6, Math.min(4, panel.zoom * factor));
      syncControls();
      redraw();
      saveSoon();
    },
  });

  bindFileInput(document.getElementById('photoInput'), async (files) => {
    const added = await loadUserFiles(files);
    if (!added.length) {
      setStatus('No usable photos in that drop.');
      return;
    }
    photos.push(...added);
    const panel = state.panels[state.selected];
    if (panel) panel.photo = photos.length - added.length;
    syncControls();
    redraw();
    saveSoon();
    setStatus(`Added ${added.length} photo${added.length > 1 ? 's' : ''} — the selected panel shows the first.`);
  });
}

const fontsReady = (async () => {
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch {
    // The bundled fonts failed to load; the canvas falls back to system type.
  }
})();

async function boot() {
  buildControls();
  photos = [];
  for (const sample of SAMPLE_PHOTOS) {
    try {
      photos.push(await loadSamplePhoto(sample.key));
    } catch {
      // A missing sample leaves the other one standing.
    }
  }
  const saved = loadSession();
  if (saved) {
    try {
      applySnapshot(state, saved, photos);
    } catch {
      // A corrupt save is ignored; the defaults stand.
    }
  }
  syncControls();
  redraw();
  updateUndoButtons();
  await fontsReady;
  redraw();

  const query = new URLSearchParams(location.search);
  if (query.get('shot')) {
    await runShot(query, {
      loadSamples: async (keys) => {
        const loaded = [];
        for (const key of keys) {
          let found = photos.find((p) => p.key === key);
          if (!found) {
            try {
              found = await loadSamplePhoto(key);
              photos.push(found);
            } catch {
              found = photos[0];
            }
          }
          if (found) loaded.push(found);
        }
        return loaded.length ? loaded : photos;
      },
      applyPatch: (patch, scenePhotos) => {
        Object.assign(state, patch);
        ensurePanels(state, canvas.width, canvas.height);
        state.panels.forEach((panel, i) => {
          panel.photo = scenePhotos.length ? i % scenePhotos.length : 0;
        });
        photos = scenePhotos;
        syncControls();
        redraw();
      },
      afterFonts: async () => {
        await fontsReady;
        redraw();
      },
    });
  }
}

boot();
