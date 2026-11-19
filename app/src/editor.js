// Vice Sunset Cover Lab — the editor: buttons, sliders, thumbnails, canvas
// pointer work (click to select a panel, drag to pan, scroll to zoom) and
// file picking. It only talks to the page through the callbacks main.js
// passes in, so the cover state stays in one place.

import { hitTestPanel } from './cover.js';

/** Builds a row of toggle buttons; onPick receives the picked item's id. */
export function buildButtonGroup(container, items, currentId, onPick) {
  container.textContent = '';
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = item.id;
    button.innerHTML = '';
    button.appendChild(document.createTextNode(item.name));
    if (item.blurb) {
      const small = document.createElement('small');
      small.textContent = item.blurb;
      button.appendChild(small);
    }
    if (item.id === currentId) button.classList.add('active');
    button.addEventListener('click', () => onPick(item.id));
    container.appendChild(button);
  }
}

/** Marks the button matching currentId as active inside a group. */
export function markActive(container, currentId) {
  for (const button of container.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.id === currentId);
  }
}

/** The five heat stars; onPick receives the new heat, 1 to 5. */
export function buildStars(container, heat, onPick) {
  container.textContent = '';
  for (let i = 1; i <= 5; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '★';
    button.classList.toggle('lit', i <= heat);
    button.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
    button.addEventListener('click', () => onPick(i));
    container.appendChild(button);
  }
}

/** Rebuilds the photo thumbnails; onPick receives the photo's index. */
export function buildThumbs(container, photos, activeIndex, onPick) {
  container.textContent = '';
  photos.forEach((photo, i) => {
    const thumb = document.createElement('img');
    thumb.className = `thumb${i === activeIndex ? ' active' : ''}`;
    thumb.src = photo.url;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    thumb.addEventListener('click', () => onPick(i));
    container.appendChild(thumb);
  });
}

const SLIDERS = [
  { key: 'zoom', label: 'Zoom', min: 0.6, max: 4, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'bright', label: 'Brightness', min: -60, max: 60, step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}` },
  { key: 'contrast', label: 'Contrast', min: -60, max: 60, step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}` },
  { key: 'sat', label: 'Saturation', min: -80, max: 80, step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}` },
  { key: 'blur', label: 'Blur', min: 0, max: 8, step: 0.5, format: (v) => `${v}px` },
];

/**
 * Builds the sliders for the selected panel's transform. onInput fires on
 * every drag (redraw live), onSettled fires when the drag ends (one undo step).
 */
export function buildSliders(container, transform, onInput, onSettled) {
  container.textContent = '';
  for (const spec of SLIDERS) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const label = document.createElement('label');
    label.textContent = spec.label;
    label.htmlFor = `slider-${spec.key}`;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `slider-${spec.key}`;
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(transform[spec.key]);
    const out = document.createElement('output');
    out.textContent = spec.format(transform[spec.key]);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      out.textContent = spec.format(value);
      onInput(spec.key, value);
    });
    input.addEventListener('change', () => onSettled());
    row.append(label, input, out);
    container.appendChild(row);
  }
}

/**
 * Pointer work on the preview canvas: click selects a panel, dragging pans
 * the selected photo, the wheel zooms it. All coordinates are converted from
 * screen pixels to canvas pixels through the canvas's own size.
 */
export function bindCanvasPointer(canvas, hooks) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = false;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      scale: canvas.width / rect.width,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const { x, y } = toCanvas(event);
    const hit = hooks.hitTest(x, y);
    if (hit === -1) return;
    hooks.select(hit);
    dragging = true;
    moved = false;
    lastX = x;
    lastY = y;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const { x, y } = toCanvas(event);
    const dx = x - lastX;
    const dy = y - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) moved = true;
    lastX = x;
    lastY = y;
    if (moved) hooks.pan(dx / canvas.width, dy / canvas.height);
  });

  canvas.addEventListener('pointerup', () => {
    if (dragging && moved) hooks.settled();
    dragging = false;
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const { x, y } = toCanvas(event);
    const hit = hooks.hitTest(x, y);
    if (hit === -1) return;
    hooks.select(hit);
    hooks.zoom(Math.exp(-event.deltaY * 0.0012));
  }, { passive: false });
}

/** File picking and drag-and-drop onto the page; onFiles receives File[]. */
export function bindFileInput(input, onFiles) {
  input.addEventListener('change', () => {
    if (input.files.length) onFiles([...input.files]);
    input.value = '';
  });
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  });
}

export { hitTestPanel };
