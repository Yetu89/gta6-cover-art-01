# Neon Coast Cover Studio — Make GTA 6 Cover Art (gta6-cover-art-01)

An offline web app that turns a person's photo and a caption into GTA 6-style
cover art, exported as a PNG to share. No upload, no account, no network request.

## What it does

- **Any photo:** upload your own photos (or use the two built-in samples), fill
  several panels with one photo or several. Click a panel to select it, drag to
  pan, scroll (or the Zoom slider) to zoom, and adjust brightness, contrast,
  saturation and blur per photo.
- **Six layouts:** full-bleed hero, hero + three, four-panel grid, nine-panel
  grid with the title in the centre cell, tilted snapshots (polaroids on a
  sunset), split story.
- **Five grades:** Vice Sunset, Neon Nights, Palm Gold, Ocean Drive, Mono Noir —
  gradient-map colour grades painted over every photo, plus film grain and a
  vignette.
- **Caption:** editable title and neon-script subtitle, three title fonts
  (Anton, Pacifico, bold sans), six one-click caption presets, and a 1–5 star
  heat meter on the cover.
- **Export:** PNG in 1080 x 1080, 1080 x 1350 and 1920 x 1080, one at a time or
  all three at once.
- **Polish:** live preview, dark/light editor theme, undo/redo (Ctrl+Z / Ctrl+Y),
  session auto-save to localStorage, responsive layout, loads in under 3 seconds.

## Originality

All art, lettering and code are the maker's own. Fonts are Anton and Pacifico
under the SIL Open Font License (texts in `app/fonts/`). No Rockstar Games logo,
wordmark, official artwork, character or font. The two sample photos
(`app/samples/`) were made with an image model for make.fun and are free to use.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no install. `app/index.html` opens in desktop Chrome and works
with no network request: every script, image and font it loads is a file under
`app/`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to
the output directory and writes `dossier.json` with the vendored make.fun
library (`vendor/makefun-app.ts`, the kit's copy, unchanged).

## Screenshots

`shots.json` lists the four scenes; each is the app's own `?shot=` scene:

1. `1-cover.jpg` — exported 1920 x 1080 cover (hero + three, Vice Sunset)
2. `2-editor.jpg` — the editor in the browser with a sample photo loaded
3. `3-cover-square.jpg` — exported 1080 x 1080 cover (nine-panel grid, Neon Nights)
4. `4-cover-story.jpg` — exported 1080 x 1350 cover (split story, Palm Gold)
