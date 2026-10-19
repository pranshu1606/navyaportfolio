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
| 6 | Road ahead | The green Liberty Bridge                 |
| 7 | Contact    | Corvinus University, Fővám tér           |

## Photorealistic 3D (Google Earth mesh)

The site has two 3D worlds and picks one automatically:

- **Photorealistic Budapest.** This is Google's Photorealistic 3D Tiles, the same textured 3D city
  you see in Google Earth and Google Maps 3D, streamed live with
  [3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS). The flight path uses real
  coordinates (Parliament, Chain Bridge, Buda Castle, Elisabeth Bridge, Liberty Statue, Liberty Bridge,
  Corvinus at Fővám tér 8).
- **Stylised model.** The hand-built model. It's used when no key is set, or when the tiles fail to load.

To switch on the photorealistic city, get **one** of these keys and paste it into `js/config.js`:

1. **Google Maps Platform key**: create a project at <https://console.cloud.google.com>, enable
   **Map Tiles API**, then create an API key. Billing must be enabled on the project. Check Google's
   pricing for the free monthly allowance.
2. **Cesium ion token**: sign up free at <https://ion.cesium.com>, add the asset
   *Google Photorealistic 3D Tiles* (id 2275207) from the Asset Depot, then copy a token.

Then **restrict the key to your domain** (HTTP referrer restriction), because visitors can see it.

To try a key without editing files, open `http://localhost:8000/?gkey=YOUR_KEY` (or `?ion=YOUR_TOKEN`).
Use `?mode=model` to force the stylised model.

Google's terms require the map attributions to stay visible. The site shows them in the bottom-right corner.

## Run locally

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight from disk won't work, because ES modules need to be served over HTTP.

## Deploy

It's a static site, so GitHub Pages works: **Settings → Pages → Deploy from branch → `main` / root**.
All libraries are vendored in `lib/`, so the site doesn't depend on a CDN.

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
- `js/world-google.js`: photorealistic tiles world, its real-coordinate flight path and labels
- `js/world-model.js`: stylised world setup, bloom and its flight path
- `js/main.js`: picks the world and handles the scroll-driven camera, labels and UI
- `js/config.js`: API keys for the photorealistic mode
- `lib/`: vendored three.js r185, Draco decoder and a bundled 3DTilesRendererJS (MIT/Apache licences included)

To change a flight, edit `KEYS` in `js/world-google.js` or `js/world-model.js`. Each keyframe has an
anchor `a`, which is the section index (fractions sit between sections), plus a camera position `p` and
a look-at target `l`. In the photorealistic world these are `geo(lat, lon, metresAboveRiver)` calls.
