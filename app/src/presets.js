// Caption preset helpers: look a preset up by name and apply one to a
// cover state object. The preset list itself lives in grades.js.

import { PRESETS } from './grades.js';

export { PRESETS };

export function presetByName(name) {
  return PRESETS.find((p) => p.name.toLowerCase() === String(name).toLowerCase()) || null;
}

export function applyPreset(state, preset) {
  if (!preset) return state;
  return {
    ...state,
    title: preset.title,
    subtitle: preset.subtitle,
    font: preset.font,
    stars: preset.stars,
    grade: preset.grade,
    layout: preset.layout,
    selected: 0,
  };
}

export function presetNames() {
  return PRESETS.map((p) => p.name);
}
