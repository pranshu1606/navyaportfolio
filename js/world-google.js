// Photorealistic Budapest: Google Photorealistic 3D Tiles (the Google Earth mesh),
// streamed with NASA-AMMOS 3DTilesRendererJS.
import * as THREE from 'three';
import {
  TilesRenderer, WGS84_ELLIPSOID, GoogleCloudAuthPlugin, CesiumIonAuthPlugin,
  TilesFadePlugin, TileCompressionPlugin, GLTFExtensionsPlugin, DRACOLoader,
} from '../lib/3d-tiles/tiles.bundle.js';
import { createSky } from './world.js';
import { frameKey } from './flight.js';

const D2R = Math.PI / 180;

// Local frame origin: on the Danube between the Chain Bridge and Elisabeth Bridge.
// Heights are metres above the river. The Danube in central Budapest sits ~96.5 m above
// sea level and the geoid is ~44.5 m above the WGS84 ellipsoid here; the exact water
// level is re-measured from the tiles once they load (see calibrate()).
const ORIGIN = { lat: 47.4955, lon: 19.0455 };
const RIVER_ELLIPSOID_HEIGHT = 141;

const HAZE = new THREE.Color(0xc9d2df);
const SKY = {
  top: new THREE.Color(0x163a7e),
  mid: new THREE.Color(0x5b84c4),
  horizon: HAZE,
};

// Landmarks (lat, lon) — from Wikipedia / the university's own address.
const P = {
  parliament: [47.5071, 19.0457],
  chain: [47.49889, 19.04361],
  chainPestTower: [47.49909, 19.04492],
  chainBudaTower: [47.49869, 19.0423],
  palace: [47.4962, 19.0396],
  bastion: [47.5022, 19.0348],
  basilica: [47.5009, 19.0539],
  elisabeth: [47.4911, 19.0497],
  statue: [47.48693, 19.04732],
  liberty: [47.4856, 19.055],
  corvinus: [47.4861, 19.0581],
  island: [47.5265, 19.049],
};

export function createGoogleWorld({ renderer, camera, isSmall, keys, onFatal }) {
  const scene = new THREE.Scene();
  scene.background = HAZE.clone();
  scene.fog = new THREE.FogExp2(HAZE, 0.00012);

  // The tiles are unlit photogrammetry; show their colours as captured.
  renderer.toneMapping = THREE.NoToneMapping;
  camera.near = 1;
  camera.far = 80000;
  camera.updateProjectionMatrix();

  const sunDir = new THREE.Vector3(-1, 0.12, 0.45).normalize();
  const sky = createSky(sunDir, { ...SKY, radius: 30000, sunGlow: 0.25, horizonLift: 0.07 });
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.0));

  // ---- tiles ----
  const tiles = new TilesRenderer();
  if (keys.google) {
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: keys.google, autoRefreshToken: true }));
  } else {
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: keys.ion, assetId: '2275207', autoRefreshToken: true }));
  }
  const draco = new DRACOLoader().setDecoderPath(new URL('../lib/three/draco/', import.meta.url).href);
  tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  tiles.registerPlugin(new TileCompressionPlugin());
  tiles.registerPlugin(new TilesFadePlugin());
  tiles.errorTarget = isSmall ? 18 : 10; // lower = sharper
  tiles.lruCache.maxSize = isSmall ? 1200 : 3000;
  tiles.lruCache.minSize = isSmall ? 600 : 1500;

  // Place Budapest at the origin with +x east, +y up, +z south (same axes as the stylised model).
  const enu = WGS84_ELLIPSOID.getEastNorthUpFrame(ORIGIN.lat * D2R, ORIGIN.lon * D2R, RIVER_ELLIPSOID_HEIGHT, new THREE.Matrix4());
  const toLocal = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(enu.clone().invert());
  tiles.group.matrixAutoUpdate = false;
  tiles.group.matrix.copy(toLocal);
  tiles.group.updateMatrixWorld(true);
  scene.add(tiles.group);
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);

  const geo = (lat, lon, h = 0) =>
    WGS84_ELLIPSOID.getCartographicToPosition(lat * D2R, lon * D2R, RIVER_ELLIPSOID_HEIGHT + h, new THREE.Vector3()).applyMatrix4(toLocal);
  const G = ([lat, lon], h) => geo(lat, lon, h);

  // ---- flight path (heights in metres above the river) ----
  const F = (p, l, s) => frameKey(p, l, isSmall ? 0 : s);
  const KEYS = [
    { a: 0, ...F(geo(47.541, 19.064, 1500), geo(47.493, 19.046, 0)) },
    { a: 0.5, ...F(geo(47.523, 19.06, 540), G(P.parliament, 30)) },
    { a: 1, ...F(geo(47.5058, 19.0406, 70), geo(47.5073, 19.0462, 40), 0.18) },
    { a: 1.45, ...F(geo(47.503, 19.0427, 75), G(P.chain, 20)) },
    { a: 1.8, ...F(geo(47.5008, 19.0452, 38), G(P.chainPestTower, 28)) },
    { a: 2, ...F(geo(47.5001, 19.048, 30), geo(47.4986, 19.0405, 28), -0.14) },
    { a: 2.2, p: G(P.chainPestTower, 64), l: G(P.chainBudaTower, 44) },
    { a: 2.45, p: G(P.chain, 26), l: G(P.chainBudaTower, 34) },
    { a: 2.75, p: geo(47.4985, 19.041, 72), l: G(P.palace, 70) },
    { a: 3, ...F(geo(47.4958, 19.0432, 105), geo(47.4962, 19.0394, 75), 0.2) },
    { a: 3.5, ...F(geo(47.4935, 19.045, 210), G(P.elisabeth, 20)) },
    { a: 4, ...F(geo(47.4938, 19.0478, 60), G(P.elisabeth, 18), -0.1) },
    { a: 4.5, ...F(geo(47.4895, 19.0535, 175), G(P.statue, 140)) },
    { a: 5, ...F(geo(47.4859, 19.0494, 165), G(P.statue, 145), 0.2) },
    { a: 5.5, ...F(geo(47.4878, 19.053, 150), G(P.liberty, 15)) },
    { a: 6, ...F(geo(47.488, 19.0528, 46), G(P.liberty, 20), -0.14) },
    { a: 6.4, p: G(P.liberty, 52), l: geo(47.484, 19.0585, 20) },
    { a: 7, ...F(geo(47.4842, 19.056, 88), G(P.corvinus, 20), 0.12) },
  ];

  const labels = [
    { name: 'Hungarian Parliament', pos: G(P.parliament, 110) },
    { name: 'Széchenyi Chain Bridge', pos: G(P.chain, 62) },
    { name: 'Buda Castle', pos: G(P.palace, 135) },
    { name: "Fisherman's Bastion", pos: G(P.bastion, 110) },
    { name: "St. Stephen's Basilica", pos: G(P.basilica, 115) },
    { name: 'Elisabeth Bridge', pos: G(P.elisabeth, 60) },
    { name: 'Liberty Statue · Gellért Hill', pos: G(P.statue, 185) },
    { name: 'Liberty Bridge', pos: G(P.liberty, 62) },
    { name: 'Corvinus University', pos: G(P.corvinus, 70), accent: true },
    { name: 'Margaret Island', pos: G(P.island, 40) },
  ];

  // Soft beacon over Corvinus so the destination reads from the air.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 16, 420, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beacon.position.copy(G(P.corvinus, 210));
  scene.add(beacon);

  // ---- ground clearance & water-level calibration ----
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  let lift = 0, liftTarget = 0, frameNo = 0;
  let waterOffset = 0, calibrated = false;
  const waterProbe = geo(47.4975, 19.044, 0);

  function groundAt(x, z) {
    ray.set(new THREE.Vector3(x, 3000, z), down);
    ray.far = 6000;
    const hit = ray.intersectObject(tiles.group, true)[0];
    return hit ? hit.point.y : null;
  }

  function calibrate() {
    const y = groundAt(waterProbe.x, waterProbe.z);
    if (y !== null && Math.abs(y) < 40) {
      waterOffset = y;
      calibrated = true;
    }
  }

  // ---- loading / errors ----
  let ready = false;
  const readyPromise = new Promise((resolve) => {
    tiles.addEventListener('tiles-load-end', () => { if (!ready) { ready = true; resolve(); } });
    setTimeout(() => { if (!ready) { ready = true; resolve(); } }, 15000);
  });
  let rootOk = false;
  tiles.addEventListener('load-root-tileset', () => { rootOk = true; });
  tiles.addEventListener('load-error', (e) => {
    if (!rootOk) onFatal?.(e.error || new Error('Could not load the photorealistic tiles'));
  });

  return {
    kind: 'google',
    scene,
    keys: KEYS,
    labels,
    labelRange: [60, 2600],
    ready: readyPromise,
    // Adjust the camera after it is placed on the flight path.
    adjustCamera(cam, look) {
      cam.y += waterOffset; look.y += waterOffset;
      if (++frameNo % 5 === 0) {
        if (!calibrated && frameNo > 30) calibrate();
        const g = groundAt(cam.x, cam.z);
        liftTarget = g !== null ? Math.max(0, g + 14 - cam.y) : 0;
      }
      lift += (liftTarget - lift) * 0.15;
      cam.y += lift; look.y += lift * 0.5;
    },
    update(t) {
      sky.position.copy(camera.position);
      beacon.material.opacity = 0.07 + Math.sin(t * 1.5) * 0.025;
      const h = Math.max(1, camera.position.y - waterOffset);
      camera.near = THREE.MathUtils.clamp(h * 0.02, 0.5, 20);
      camera.updateProjectionMatrix();
      tiles.setResolutionFromRenderer(camera, renderer);
      camera.updateMatrixWorld();
      tiles.update();
    },
    render() { renderer.render(scene, camera); },
    attributions() {
      return tiles.getAttributions().map((a) => a.value).filter((v) => typeof v === 'string').join(' ');
    },
    dispose() { tiles.dispose(); scene.clear(); },
  };
}
