// Editor: state, undo/redo, autosave, panel picking and dragging, photo
// controls, caption controls and PNG export. The preview canvas is redrawn
// from state on every change, so what you see is exactly what exports.

import { GRADES, GRADE_ORDER, PRESETS, EXPORT_SIZES } from './grades.js';
import { LAYOUTS, LAYOUT_ORDER, layoutRects } from './layouts.js';
import { drawCover, exportCover, loadImage } from './render.js';
import { SCENES, scenePanels, sceneFromUrl } from './scenes.js';

const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', src: 'samples/pier.jpg' },
];

const SAVE_KEY = 'vice-sunset-cover-lab-v1';
const PREVIEW = 1080;

function blankPanel(photo) {
  return { photo, ox: 0, oy: 0, zoom: 1, bright: 100, contrast: 100, sat: 100, blur: 0 };
}

function defaultPanels() {
  const ids = ['boulevard', 'pier', 'boulevard', 'pier', 'boulevard', 'pier', 'boulevard', 'pier', 'boulevard'];
  return ids.map((id) => blankPanel(id));
}

function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    title: 'VICE SUNSET',
    subtitle: 'Golden Hour Getaway',
    font: 'anton',
    stars: 5,
    panels: defaultPanels(),
    selected: 0,
    theme: 'dark',
  };
}

function el(id) { return document.getElementById(id); }

export async function startEditor() {
  const scene = sceneFromUrl();
  const stage = el('stage');
  const photos = new Map();
  let userCount = 0;

  // ---- state ------------------------------------------------------------
  let state = defaultState();
  let restored = null;
  if (!scene) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch { /* a bad save never blocks the editor */ }
    if (restored && restored.panels && Array.isArray(restored.panels)) {
      state = { ...defaultState(), ...restored, panels: restored.panels.map((p) => ({ ...blankPanel('boulevard'), ...p })) };
    }
  }
  if (scene) {
    state = {
      ...defaultState(),
      ...scene.state,
      panels: scenePanels(scene.state.photos),
    };
    while (state.panels.length < 9) state.panels.push(blankPanel('boulevard'));
  }

  // ---- history (undo / redo) --------------------------------------------
  let history = [];
  let historyAt = -1;
  function snapshot() { return JSON.stringify(state); }
  function pushHistory() {
    history = history.slice(0, historyAt + 1);
    history.push(snapshot());
    if (history.length > 60) history.shift();
    historyAt = history.length - 1;
    syncUndoButtons();
  }
  function applySnapshot(json) {
    const parsed = JSON.parse(json);
    state = { ...defaultState(), ...parsed };
    document.body.dataset.theme = state.theme || 'dark';
    syncAllControls();
    render();
    saveSoon();
  }
  function undo() {
    if (historyAt <= 0) return;
    historyAt -= 1;
    applySnapshot(history[historyAt]);
    syncUndoButtons();
  }
  function redo() {
    if (historyAt >= history.length - 1) return;
    historyAt += 1;
    applySnapshot(history[historyAt]);
    syncUndoButtons();
  }
  function syncUndoButtons() {
    el('undoBtn').disabled = historyAt <= 0;
    el('redoBtn').disabled = historyAt >= history.length - 1;
  }

  // ---- autosave -----------------------------------------------------------
  let saveTimer = 0;
  function saveSoon() {
    if (scene) return; // screenshot scenes never overwrite the user's draft
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, snapshot()); } catch { /* storage full: draft stays in memory */ }
    }, 400);
  }

  // ---- photos ---------------------------------------------------------------
  async function loadPhoto(entry) {
    try {
      const img = await loadImage(entry.src);
      photos.set(entry.id, { ...entry, img });
    } catch {
      // A missing sample never blocks the editor; its panel draws a grade wash.
    }
  }
  await Promise.all(SAMPLES.map(loadPhoto));

  function photosById() {
    const out = {};
    photos.forEach((p, id) => { if (p.img) out[id] = p.img; });
    return out;
  }
  function stateForDraw() {
    return { ...state, gradeObj: GRADES[state.grade] || GRADES.sunset };
  }

  // ---- render ---------------------------------------------------------------
  let renderQueued = false;
  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (scene && scene.mode === 'cover') {
        drawCover(stage, stateForDraw(), photosById(), scene.w, scene.h);
      } else {
        drawCover(stage, stateForDraw(), photosById(), PREVIEW, PREVIEW, { selected: state.selected });
      }
      window.__coverReady = true;
    });
  }

  // ---- control builders -------------------------------------------------------
  function buildLayoutButtons() {
    const grid = el('layoutGrid');
    grid.innerHTML = '';
    LAYOUT_ORDER.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.layout = id;
      b.innerHTML = '';
      const name = document.createElement('span');
      name.textContent = LAYOUTS[id].name;
      const small = document.createElement('small');
      small.textContent = LAYOUTS[id].blurb;
      b.append(name, small);
      b.addEventListener('click', () => {
        if (state.layout === id) return;
        state.layout = id;
        state.selected = 0;
        pushHistory();
        syncAllControls();
        render();
        saveSoon();
      });
      grid.append(b);
    });
  }

  function buildGradeButtons() {
    const grid = el('gradeGrid');
    grid.innerHTML = '';
    GRADE_ORDER.forEach((id) => {
      const g = GRADES[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.grade = id;
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = `linear-gradient(90deg, ${g.wash.join(', ')})`;
      const name = document.createElement('span');
      name.textContent = g.name;
      const small = document.createElement('small');
      small.textContent = g.blurb;
      b.append(sw, name, small);
      b.addEventListener('click', () => {
        if (state.grade === id) return;
        state.grade = id;
        pushHistory();
        syncAllControls();
        render();
        saveSoon();
      });
      grid.append(b);
    });
  }

  function buildPresets() {
    const row = el('presetRow');
    row.innerHTML = '';
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.name;
      b.addEventListener('click', () => {
        state.title = p.title;
        state.subtitle = p.subtitle;
        state.font = p.font;
        state.stars = p.stars;
        state.grade = p.grade;
        state.layout = p.layout;
        state.selected = 0;
        pushHistory();
        syncAllControls();
        render();
        saveSoon();
      });
      row.append(b);
    });
  }

  function buildStars() {
    const row = el('starRow');
    row.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '★';
      b.setAttribute('aria-label', i + ' star' + (i > 1 ? 's' : ''));
      b.addEventListener('click', () => {
        state.stars = i;
        pushHistory();
        syncAllControls();
        render();
        saveSoon();
      });
      row.append(b);
    }
  }

  function buildExports() {
    const grid = el('exportGrid');
    grid.innerHTML = '';
    EXPORT_SIZES.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.label;
      b.addEventListener('click', () => exportOne(s));
      grid.append(b);
    });
  }

  function buildThumbs() {
    const row = el('thumbRow');
    row.innerHTML = '';
    const selectedPhoto = (state.panels[state.selected] || {}).photo;
    photos.forEach((p) => {
      const img = document.createElement('img');
      img.src = p.src;
      img.alt = p.name;
      img.title = p.name + ' — click to put in the selected panel';
      if (p.id === selectedPhoto) img.classList.add('active');
      if (p.user) img.classList.add('user');
      img.addEventListener('click', () => {
        state.panels[state.selected].photo = p.id;
        pushHistory();
        syncAllControls();
        render();
        saveSoon();
      });
      row.append(img);
    });
  }

  function syncAllControls() {
    document.querySelectorAll('#layoutGrid button').forEach((b) => {
      b.classList.toggle('active', b.dataset.layout === state.layout);
    });
    document.querySelectorAll('#gradeGrid button').forEach((b) => {
      b.classList.toggle('active', b.dataset.grade === state.grade);
    });
    document.querySelectorAll('#starRow button').forEach((b, i) => {
      b.classList.toggle('lit', i < state.stars);
    });
    el('titleInput').value = state.title;
    el('subtitleInput').value = state.subtitle;
    el('fontSelect').value = state.font;
    el('themeBtn').textContent = state.theme === 'dark' ? 'Light mode' : 'Dark mode';
    const panel = state.panels[state.selected] || blankPanel('boulevard');
    el('selectedLabel').textContent = `Panel ${state.selected + 1} selected — ${panel.photo}. Drag it to pan, scroll to zoom.`;
    el('zoomSlider').value = panel.zoom;
    el('brightSlider').value = panel.bright;
    el('contrastSlider').value = panel.contrast;
    el('satSlider').value = panel.sat;
    el('blurSlider').value = panel.blur;
    el('zoomVal').textContent = Number(panel.zoom).toFixed(2) + '×';
    el('brightVal').textContent = panel.bright + '%';
    el('contrastVal').textContent = panel.contrast + '%';
    el('satVal').textContent = panel.sat + '%';
    el('blurVal').textContent = panel.blur + 'px';
    buildThumbs();
  }

  // ---- caption inputs -------------------------------------------------------
  el('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); saveSoon(); });
  el('titleInput').addEventListener('change', () => pushHistory());
  el('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); saveSoon(); });
  el('subtitleInput').addEventListener('change', () => pushHistory());
  el('fontSelect').addEventListener('change', (e) => {
    state.font = e.target.value;
    pushHistory();
    render();
    saveSoon();
  });

  // ---- photo adjustments -----------------------------------------------------
  function bindSlider(id, key, format) {
    const input = el(id);
    input.addEventListener('input', () => {
      const panel = state.panels[state.selected];
      panel[key] = Number(input.value);
      render();
      saveSoon();
      syncAllControls();
    });
    input.addEventListener('change', () => pushHistory());
  }
  bindSlider('zoomSlider', 'zoom');
  bindSlider('brightSlider', 'bright');
  bindSlider('contrastSlider', 'contrast');
  bindSlider('satSlider', 'sat');
  bindSlider('blurSlider', 'blur');

  el('resetPhotoBtn').addEventListener('click', () => {
    const panel = state.panels[state.selected];
    const keep = panel.photo;
    state.panels[state.selected] = blankPanel(keep);
    pushHistory();
    syncAllControls();
    render();
    saveSoon();
  });

  el('fillAllBtn').addEventListener('click', () => {
    const photo = state.panels[state.selected].photo;
    state.panels.forEach((p) => { p.photo = photo; });
    pushHistory();
    syncAllControls();
    render();
    saveSoon();
  });

  // ---- photo upload -------------------------------------------------------------
  function addUserPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      userCount += 1;
      const entry = { id: 'user-' + userCount, name: file.name.replace(/\.[^.]+$/, ''), src: String(reader.result), user: true };
      await loadPhoto(entry);
      state.panels[state.selected].photo = entry.id;
      pushHistory();
      syncAllControls();
      render();
      saveSoon();
    };
    reader.readAsDataURL(file);
  }
  el('fileInput').addEventListener('change', (e) => {
    Array.from(e.target.files || []).forEach(addUserPhoto);
    e.target.value = '';
  });
  const zone = el('dropzone');
  ['dragover', 'dragenter'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.remove('over');
  }));
  zone.addEventListener('drop', (e) => {
    Array.from(e.dataTransfer.files || []).forEach(addUserPhoto);
  });
  el('dropzone').addEventListener('click', () => el('fileInput').click());

  // ---- canvas picking, panning, zooming -----------------------------------------
  function panelAt(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    const scaleX = PREVIEW / r.width;
    const scaleY = PREVIEW / r.height;
    const px = (clientX - r.left) * scaleX;
    const py = (clientY - r.top) * scaleY;
    const { panels } = layoutRects(state.layout, PREVIEW, PREVIEW);
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      if (p.kind !== 'photo') continue;
      if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return i;
    }
    return -1;
  }
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (scene && scene.mode === 'cover') return;
    const hit = panelAt(e.clientX, e.clientY);
    if (hit < 0) return;
    if (hit !== state.selected) {
      state.selected = hit;
      syncAllControls();
      render();
    }
    drag = { x: e.clientX, y: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy, moved: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = stage.getBoundingClientRect();
    const panel = state.panels[state.selected];
    const { panels } = layoutRects(state.layout, PREVIEW, PREVIEW);
    const rect = panels[state.selected];
    if (!rect) return;
    const dx = ((e.clientX - drag.x) / r.width) * (PREVIEW / rect.w);
    const dy = ((e.clientY - drag.y) / r.height) * (PREVIEW / rect.h);
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
    panel.ox = Math.max(-0.4, Math.min(0.4, drag.ox + dx));
    panel.oy = Math.max(-0.4, Math.min(0.4, drag.oy + dy));
    render();
    saveSoon();
  });
  stage.addEventListener('pointerup', () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
    syncAllControls();
  });
  stage.addEventListener('wheel', (e) => {
    if (scene && scene.mode === 'cover') return;
    e.preventDefault();
    const panel = state.panels[state.selected];
    panel.zoom = Math.max(1, Math.min(4, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
    render();
    saveSoon();
    syncAllControls();
  }, { passive: false });

  // ---- theme, undo, redo --------------------------------------------------------
  el('themeBtn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = state.theme;
    pushHistory();
    syncAllControls();
    saveSoon();
  });
  el('undoBtn').addEventListener('click', undo);
  el('redoBtn').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });

  // ---- export ---------------------------------------------------------------------
  function download(canvas, name) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve(true);
      }, 'image/png');
    });
  }
  async function exportOne(size) {
    el('exportStatus').textContent = `Exporting ${size.w} × ${size.h}…`;
    const canvas = exportCover(stateForDraw(), photosById(), size.w, size.h);
    const ok = await download(canvas, `vice-sunset-cover-${size.w}x${size.h}.png`);
    el('exportStatus').textContent = ok
      ? `Saved vice-sunset-cover-${size.w}x${size.h}.png (${size.w} × ${size.h}).`
      : 'Export failed in this browser — try again.';
    return ok;
  }
  el('exportAllBtn').addEventListener('click', async () => {
    for (const size of EXPORT_SIZES) {
      await exportOne(size);
      await new Promise((r) => setTimeout(r, 150));
    }
    el('exportStatus').textContent = 'All three sizes exported as PNG.';
  });

  // Test hook for the maker: returns a PNG data URL at any size.
  window.__exportPNG = async (w, h) => {
    const canvas = exportCover(stateForDraw(), photosById(), w, h);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(''); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  };
  window.__coverState = () => JSON.parse(snapshot());

  // ---- boot -------------------------------------------------------------------------
  document.body.dataset.theme = state.theme || 'dark';
  if (scene && scene.mode === 'cover') document.body.classList.add('scene-cover');
  buildLayoutButtons();
  buildGradeButtons();
  buildPresets();
  buildStars();
  buildExports();
  syncAllControls();
  pushHistory();
  try {
    await Promise.race([
      Promise.all([document.fonts.load('80px Anton'), document.fonts.load('60px Pacifico'), document.fonts.ready]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch { /* fall back to system fonts if a bundled font fails */ }
  render();
}
