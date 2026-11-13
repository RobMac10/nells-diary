# Nell’s Diary

An interactive exercise book of Nell’s Diary (Exhibit N from *Reopen the Record: Australian Histories*, Case 5: Who Fired First?).

Live site: https://robmac10.github.io/nells-diary/  
Repository: `RobMac10/nells-diary`

## Preview locally

```bash
python3 -m http.server 8765 --directory .
```

Then open http://127.0.0.1:8765/

## Content

The diary text is generated from the canonical source `nells_diary.py` by `build_data.py`. Do not edit `assets/data.js` by hand. After a source change, run:

```bash
python3 build_data.py
```

The school line, place headings (St Alipius School, Ballarat / Our tent, Eureka), Mrs Hayes’s notes, and spelling corrections are taken from that source. The cover uses Eugene von Guérard’s January 1854 sketch of the St Alipius chapel (State Library of Victoria, H12532; out of copyright).

## What the app does

- A page-turning exercise book, with swipe, arrow buttons, and keyboard (Left, Right, Home, End). Lined paper; an ink smudge where the last entry breaks off.
- Tappable red “AH” marks open Mrs Hayes’s questions. Answers are saved in `localStorage` on this device only.
- Tapping a spelling correction shows Nell’s original word and Mrs Hayes’s fix.
- The last page has a My finding box: Who fired first? Rebels, Soldiers, or We can’t know, and a reason. A link opens the Who Fired First? case. Answers stay on this device.
- The last page ends at the first shot, then offers “Who fired first? Open the case.” which opens the case file at https://robmac10.github.io/who-fired-first/#brief
- A collapsed “For teachers: what’s true?” panel sits under the book, not on the diary pages.
- Cedarville Cursive is the default hand; Kalam is the easy-read toggle.
- Keyboard access, alt text on the sketch, a service worker for offline-ish use, no tracking, and no author name in the app.

## Publishing

GitHub Pages serves this folder from the `main` branch, at the site root of the repository.
