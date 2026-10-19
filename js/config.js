// Photorealistic 3D mode — the same 3D city mesh you see in Google Earth.
//
// Paste ONE of these keys to switch the site from the stylised model to the real
// photorealistic Budapest (see README → "Photorealistic 3D"). Both are free to start.
//
//  • Google Maps Platform key with the "Map Tiles API" enabled
//    https://developers.google.com/maps/documentation/tile/get-api-key
//  • or a Cesium ion token (asset 2275207 = Google Photorealistic 3D Tiles)
//    https://ion.cesium.com/tokens
//
// The key is visible to visitors (that's normal for map keys), so restrict it to
// your site's domain in the Google Cloud / Cesium console.
export const GOOGLE_MAPS_API_KEY = 'AIzaSyDJJzqBZFmIgmftrs2b8J4NtVZ01joEwrc';
export const CESIUM_ION_TOKEN = '';

// For quick testing without editing this file you can also open the site with
// ?gkey=YOUR_GOOGLE_KEY or ?ion=YOUR_ION_TOKEN (remembered in this browser),
// and ?mode=model to force the stylised model.
export function resolveKeys() {
  const q = new URLSearchParams(location.search);
  const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
  let google = q.get('gkey') || GOOGLE_MAPS_API_KEY || read('nj.gkey');
  let ion = q.get('ion') || CESIUM_ION_TOKEN || read('nj.ion');
  if (q.get('gkey')) save('nj.gkey', google);
  if (q.get('ion')) save('nj.ion', ion);
  if (q.get('mode') === 'model') google = ion = '';
  return { google, ion };
}
