# Navya Joshi · Portfolio

A scroll-driven 3D portfolio. As you scroll, the camera flies across a stylised model of Budapest,
built in Three.js, and stops at a landmark for each section:

| # | Section    | Stop on the flight                       |
|---|------------|------------------------------------------|
| 0 | Hero       | Bird's-eye view over the Danube          |
| 1 | About      | Hungarian Parliament                     |
| 2 | Education  | Through the Széchenyi Chain Bridge       |
| 3 | Skills     | Buda Castle & Fisherman's Bastion        |
| 4 | CCTC       | Elisabeth Bridge                         |
| 5 | Projects   | Gellért Hill & the Liberty Statue        |
| 6 | Road ahead | Under the green Liberty Bridge           |
| 7 | Contact    | Corvinus University, Fővám tér           |

## Run locally

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight from disk won't work, because ES modules need to be served over HTTP.

## Deploy

It's a static site, so GitHub Pages works: **Settings → Pages → Deploy from branch → `main` / root**.
Three.js is vendored in `lib/three/`, so the site doesn't depend on a CDN.

## Editing content

All the text lives in `index.html`. Things to personalise:

- **Contact links**: the email (`navya.joshi@example.com`), LinkedIn and GitHub URLs are placeholders.
- **CCTC**: describe your actual role, events and contributions.
- **Projects**: the cards are starting points. Swap in real projects as you build them.
- **Coursework / skills**: update these to match your Corvinus curriculum and what you've learned.

## Code layout

- `js/geo.js`: geography (river course, hills, landmark coordinates, terrain height)
- `js/world.js`: sky, terrain, water shader, instanced city blocks, trees, boats, embankment lights
- `js/landmarks.js`: Parliament, Basilica, Castle Hill, Gellért Hill, Corvinus, Market Hall and the four bridges
- `js/main.js`: renderer, bloom, the camera flight path (`KEYS`) and the scroll and UI wiring

To change the flight, edit `KEYS` in `js/main.js`. Each keyframe has an anchor `a`, which is the section
index (fractions sit between sections), plus a camera position `p` and a look-at target `l`.
