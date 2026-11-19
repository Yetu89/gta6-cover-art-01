// Colour grades and one-click caption presets for Vice Sunset Cover Lab.
// A grade is a sunset-style gradient wash painted over every photo with a
// soft-light overlay, plus the two colours the title lettering is filled with.

export const GRADES = {
  sunset: {
    id: 'sunset',
    name: 'Vice Sunset',
    blurb: 'Orange dusk, pink sky',
    wash: ['#ff9a3d', '#ff5e62', '#7b2ff7'],
    washAlpha: 0.30,
    tint: '#ff7e5f',
    tintAlpha: 0.10,
    title: ['#fff8d0', '#ffb347'],
    sub: '#ffffff',
    glow: '#ff5e62',
  },
  neon: {
    id: 'neon',
    name: 'Neon Nights',
    blurb: 'Pink and cyan night',
    wash: ['#ff2ea6', '#7b2ff7', '#00e5ff'],
    washAlpha: 0.34,
    tint: '#ff2ea6',
    tintAlpha: 0.10,
    title: ['#ffffff', '#7df9ff'],
    sub: '#ffe9fb',
    glow: '#ff2ea6',
  },
  gold: {
    id: 'gold',
    name: 'Palm Gold',
    blurb: 'Warm golden hour',
    wash: ['#f7b733', '#fc8a1a', '#b3541e'],
    washAlpha: 0.30,
    tint: '#ffc93d',
    tintAlpha: 0.12,
    title: ['#fffbe8', '#f7b733'],
    sub: '#fff3cf',
    glow: '#fc8a1a',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Drive',
    blurb: 'Teal water, blue sky',
    wash: ['#00f5a0', '#00c9ff', '#005bea'],
    washAlpha: 0.28,
    tint: '#00c9ff',
    tintAlpha: 0.10,
    title: ['#eafffb', '#7df9ff'],
    sub: '#ffffff',
    glow: '#00c9ff',
  },
  noir: {
    id: 'noir',
    name: 'Mono Noir',
    blurb: 'Black and white film',
    wash: ['#f2f2f2', '#8a8a8a', '#111111'],
    washAlpha: 0.22,
    tint: '#9a9a9a',
    tintAlpha: 0.08,
    title: ['#ffffff', '#c9c9c9'],
    sub: '#f2f2f2',
    glow: '#888888',
    mono: true,
  },
};

export const GRADE_ORDER = ['sunset', 'neon', 'gold', 'ocean', 'noir'];

// One-click captions. Each preset sets the title, subtitle, title font,
// heat stars, grade and layout in a single tap.
export const PRESETS = [
  { name: 'Vice Sunset', title: 'VICE SUNSET', subtitle: 'Golden Hour Getaway', font: 'anton', stars: 5, grade: 'sunset', layout: 'hero3' },
  { name: 'Neon Palms', title: 'NEON PALMS', subtitle: 'Midnight Drive', font: 'anton', stars: 4, grade: 'neon', layout: 'grid9' },
  { name: 'Golden Tide', title: 'GOLDEN TIDE', subtitle: 'Sunset Run', font: 'anton', stars: 5, grade: 'gold', layout: 'split' },
  { name: 'Palm Court', title: 'PALM COURT', subtitle: 'Neon Nights', font: 'pacifico', stars: 4, grade: 'neon', layout: 'grid4' },
  { name: 'Midnight Drive', title: 'MIDNIGHT DRIVE', subtitle: 'Vice City After Dark', font: 'anton', stars: 3, grade: 'neon', layout: 'hero' },
  { name: 'Sunset Run', title: 'SUNSET RUN', subtitle: 'Coast to Coast', font: 'sans', stars: 5, grade: 'sunset', layout: 'polaroids' },
];

// The three export sizes, in pixels.
export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];
