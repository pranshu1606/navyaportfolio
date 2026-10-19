// Terrain, water, sky, city blocks, trees and embankment lights.
import * as THREE from 'three';
import {
  terrainHeight, riverX, halfW, leftBank, rightBank, smoothstep, fbm, rng, isIsland,
  CASTLE, GELLERT, PARLIAMENT, BASILICA, CORVINUS, MARKET, BRIDGE_Z,
} from './geo.js';

export const PALETTE = {
  fog: new THREE.Color(0x2a2340),
  skyTop: new THREE.Color(0x0b1026),
  skyMid: new THREE.Color(0x3a2b5c),
  horizon: new THREE.Color(0xf29a6b),
  water: new THREE.Color(0x0d2a3f),
  waterLight: new THREE.Color(0x3d6d8a),
};

// ---------------- Sky ----------------
export function createSky(sunDir, opts = {}) {
  const geo = new THREE.SphereGeometry(opts.radius || 2200, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: opts.top || PALETTE.skyTop },
      mid: { value: opts.mid || PALETTE.skyMid },
      horizon: { value: opts.horizon || PALETTE.horizon },
      sunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, sunDir;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.18, h));
        col = mix(col, top, smoothstep(0.15, 0.65, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.55, 0.3) * pow(s, 12.0) * 0.55;
        col += vec3(1.0, 0.8, 0.55) * pow(s, 300.0) * 2.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -1;
  return sky;
}

export function createStars() {
  const r = rng(7);
  const n = 1200;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2;
    const ph = Math.acos(0.25 + r() * 0.75);
    const R = 2000;
    pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = R * Math.cos(ph);
    pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 });
  return new THREE.Points(g, m);
}

// ---------------- Terrain ----------------
export function createTerrain() {
  const size = 1600, seg = 400;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const urban = new THREE.Color(0x6b6058);
  const park = new THREE.Color(0x3d5a3a);
  const forest = new THREE.Color(0x2b4430);
  const stone = new THREE.Color(0x9a8f80);
  const bed = new THREE.Color(0x1d2a2e);
  const bankCol = new THREE.Color(0xb0a28c);

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = terrainHeight(x, z);
    p.setY(i, y);
    const d = x - riverX(z), hw = halfW(z), ad = Math.abs(d);
    const n = fbm(x * 0.04, z * 0.04);
    if (y < 0) c.copy(bed);
    else if (isIsland(x, z)) c.copy(park).lerp(forest, n);
    else if (ad < hw + 5) c.copy(bankCol);
    else if (d > 0) c.copy(urban).lerp(stone, n * 0.4);
    else {
      // Buda: greener with altitude, stone on Castle Hill
      const ex = (x - CASTLE.x) / CASTLE.rx, ez = (z - CASTLE.z) / CASTLE.rz;
      const onCastle = ex * ex + ez * ez < 0.9;
      const gx = (x - GELLERT.x) / GELLERT.r, gz = (z - GELLERT.z) / GELLERT.r;
      const onGellert = gx * gx + gz * gz < 1.1;
      if (onCastle) c.copy(stone);
      else if (onGellert) c.copy(forest).lerp(park, n * 0.6);
      else c.copy(urban).lerp(park, smoothstep(4, 18, y) * 0.8 + n * 0.25);
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------- Water ----------------
export function createWater() {
  const geo = new THREE.PlaneGeometry(1600, 1600, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      time: { value: 0 },
      deep: { value: PALETTE.water },
      light: { value: PALETTE.waterLight },
      glow: { value: PALETTE.horizon },
      fogColor: { value: PALETTE.fog },
      fogDensity: { value: 0.0026 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time, fogDensity;
      uniform vec3 deep, light, glow, fogColor;
      varying vec3 vWorld;
      varying float vDist;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main() {
        vec2 p = vWorld.xz;
        // flowing ripples (river flows +z)
        float r = n(p * vec2(0.35, 0.12) + vec2(0.0, -time * 0.35));
        r += 0.5 * n(p * vec2(0.9, 0.3) + vec2(time * 0.1, -time * 0.8));
        r /= 1.5;
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(viewDir.y, 0.0), 4.0) * 0.75;
        vec3 col = mix(deep, light, r * 0.35 + fres * 0.45);
        col += glow * fres * 0.35;
        float spark = smoothstep(0.82, 0.98, r) * 0.6;
        col += vec3(1.0, 0.8, 0.55) * spark * fres;
        float fog = 1.0 - exp(-fogDensity * fogDensity * vDist * vDist);
        gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------------- Buildings ----------------
function windowTexture(seed) {
  const r = rng(seed);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  const em = document.createElement('canvas');
  em.width = 128; em.height = 64;
  const e = em.getContext('2d');
  g.fillStyle = '#e8ddcc'; g.fillRect(0, 0, 128, 64);
  e.fillStyle = '#000'; e.fillRect(0, 0, 128, 64);
  // cornice line
  g.fillStyle = '#cbbda6'; g.fillRect(0, 0, 128, 4);
  const cols = 8, rows = 4;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = 4 + i * 15.5, y = 8 + j * 14;
      const lit = r() < 0.42;
      g.fillStyle = lit ? '#5a4630' : '#3a3f48';
      g.fillRect(x, y, 8, 9);
      if (lit) {
        const warm = 180 + Math.floor(r() * 60);
        e.fillStyle = `rgb(255,${warm},${Math.floor(warm * 0.55)})`;
        e.fillRect(x + 1, y + 1, 6, 7);
      }
    }
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(em);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

// Areas where generic blocks should not be placed (landmarks get their own models).
const EXCLUDE = [
  { x: PARLIAMENT.x + 4, z: PARLIAMENT.z, r: 26 },
  { x: BASILICA.x, z: BASILICA.z, r: 14 },
  { x: CORVINUS.x + 2, z: CORVINUS.z, r: 20 },
  { x: MARKET.x, z: MARKET.z, r: 14 },
  { x: rightBank(BRIDGE_Z.chain) + 14, z: BRIDGE_Z.chain, r: 14 }, // Széchenyi tér
  { x: rightBank(BRIDGE_Z.liberty) + 12, z: BRIDGE_Z.liberty, r: 10 }, // Fővám tér
  { x: rightBank(BRIDGE_Z.elisabeth) + 10, z: BRIDGE_Z.elisabeth, r: 10 },
];

function excluded(x, z) {
  for (const e of EXCLUDE) if ((x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r) return true;
  // keep bridge approaches clear
  for (const bz of Object.values(BRIDGE_Z)) if (Math.abs(z - bz) < 4.5 && Math.abs(x - riverX(z)) < halfW(z) + 30) return true;
  return false;
}

export function createBuildings() {
  const r = rng(42);
  const items = [];
  const BLOCK = 12, STREET = 3.2;

  // Pest — dense grid of 19th-century blocks, ~25–30 m tall
  for (let z = -620; z < 520; z += BLOCK) {
    const bank = rightBank(z);
    for (let x = bank + 8; x < 520; x += BLOCK) {
      const cx = x + BLOCK / 2, cz = z + BLOCK / 2;
      if (cx - rightBank(cz) < 7) continue;
      if (excluded(cx, cz)) continue;
      const distRiver = cx - bank;
      const fall = smoothstep(380, 520, distRiver);
      if (r() < 0.04 + fall * 0.6) continue; // little parks & thinning at edges
      const w = BLOCK - STREET;
      // perimeter block: split into 1–3 buildings
      const split = r() < 0.5 ? 1 : r() < 0.6 ? 2 : 3;
      for (let s = 0; s < split; s++) {
        const sw = w / split;
        const bx = cx - w / 2 + sw * (s + 0.5);
        const h = 2.2 + r() * 1.4 + (r() < 0.04 ? 2.5 : 0) - smoothstep(150, 400, distRiver) * 0.6;
        items.push({ x: bx, z: cz + (r() - 0.5) * 0.6, w: sw - 0.25, d: w - r() * 1.2, h, y: terrainHeight(bx, cz), tint: 0.82 + r() * 0.2, hue: r() });
      }
    }
  }

  // Castle district: small dense houses on the plateau
  for (let i = 0; i < 1400; i++) {
    const x = CASTLE.x + (r() - 0.5) * CASTLE.rx * 1.5;
    const z = CASTLE.z + (r() - 0.5) * CASTLE.rz * 1.7;
    const ex = (x - CASTLE.x) / CASTLE.rx, ez = (z - CASTLE.z) / CASTLE.rz;
    const e = ex * ex + ez * ez;
    if (e > 0.42) continue;
    if (z > CASTLE.z + 10) continue; // palace area at the south end
    if (Math.abs(z - (CASTLE.z)) < 9 && Math.abs(x - CASTLE.x) < 9) continue; // Matthias Church square
    items.push({ x, z, w: 1.6 + r() * 1.4, d: 1.6 + r() * 1.4, h: 1.2 + r() * 0.8, y: terrainHeight(x, z) - 0.2, tint: 0.9 + r() * 0.1, hue: r(), rot: (r() - 0.5) * 0.3 });
  }

  // Buda: houses scattered on the lower slopes
  for (let i = 0; i < 9000; i++) {
    const z = -620 + r() * 1140;
    const x = leftBank(z) - 8 - r() * 420;
    if (excluded(x, z)) continue;
    const ex = (x - CASTLE.x) / CASTLE.rx, ez = (z - CASTLE.z) / CASTLE.rz;
    if (ex * ex + ez * ez < 1.6) continue;
    const gx = (x - GELLERT.x) / GELLERT.r, gz = (z - GELLERT.z) / GELLERT.r;
    if (gx * gx + gz * gz < 1.3) continue;
    const y = terrainHeight(x, z);
    const slope = Math.abs(terrainHeight(x + 2, z) - y) + Math.abs(terrainHeight(x, z + 2) - y);
    if (slope > 1.4) continue;
    const near = 1 - smoothstep(30, 300, leftBank(z) - x);
    if (r() > 0.25 + near * 0.6) continue;
    const big = near > 0.7 && r() < 0.6;
    items.push({ x, z, w: big ? 5 + r() * 4 : 1.6 + r() * 1.6, d: big ? 5 + r() * 4 : 1.6 + r() * 1.6, h: big ? 1.8 + r() * 1.2 : 0.9 + r() * 0.8, y: y - 0.2, tint: 0.85 + r() * 0.15, hue: r(), rot: (r() - 0.5) * 0.6 });
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const tex = windowTexture(3);
  const wall = new THREE.MeshStandardMaterial({
    map: tex.map, emissiveMap: tex.emissiveMap, emissive: 0xffc58a, emissiveIntensity: 1.6, roughness: 0.9,
  });
  const roof = new THREE.MeshStandardMaterial({ color: 0x8a5a48, roughness: 0.85 });
  const mesh = new THREE.InstancedMesh(geo, [wall, wall, roof, roof, wall, wall], items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const tints = [0xfff1dc, 0xf5e3c8, 0xe9d9c9, 0xfbe7d5, 0xe6dfd3, 0xf3d9c4];
  items.forEach((b, i) => {
    q.setFromAxisAngle(up, b.rot || 0);
    m.compose(pos.set(b.x, b.y, b.z), q, sc.set(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
    col.set(tints[Math.floor(b.hue * tints.length)]).multiplyScalar(b.tint);
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------- Trees ----------------
export function createTrees() {
  const r = rng(99);
  const pts = [];
  const add = (x, z, s = 1) => {
    const y = terrainHeight(x, z);
    if (y < 0.5) return;
    pts.push({ x, y, z, s: s * (0.7 + r() * 0.7) });
  };
  // Gellért Hill forest
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * GELLERT.r * 1.05;
    const x = GELLERT.x + Math.cos(a) * d, z = GELLERT.z + Math.sin(a) * d;
    if (x > leftBank(z) - 3) continue;
    if (d < 7) continue; // summit plaza
    add(x, z, 1.2);
  }
  // Margaret Island
  for (let i = 0; i < 1200; i++) {
    const z = -430 + r() * 170, x = riverX(z) + (r() - 0.5) * 22;
    if (isIsland(x, z)) add(x, z, 1.1);
  }
  // Castle Hill slopes
  for (let i = 0; i < 1500; i++) {
    const a = r() * Math.PI * 2, ring = 0.72 + r() * 0.5;
    const x = CASTLE.x + Math.cos(a) * CASTLE.rx * ring, z = CASTLE.z + Math.sin(a) * CASTLE.rz * ring;
    if (x > leftBank(z) - 4) continue;
    add(x, z, 0.9);
  }
  // Buda hills scatter
  for (let i = 0; i < 7000; i++) {
    const z = -620 + r() * 1140;
    const x = leftBank(z) - 60 - r() * 400;
    const y = terrainHeight(x, z);
    if (y > 9 && r() < 0.8) add(x, z, 1.3);
  }
  // Pest avenue trees along the embankment
  for (let z = -600; z < 500; z += 3.5) {
    const x = rightBank(z) + 5.5;
    const nearBridge = Object.values(BRIDGE_Z).some((bz) => Math.abs(z - bz) < 9);
    if (!excluded(x, z) && !nearBridge) add(x, z, 0.6);
  }

  const geo = new THREE.IcosahedronGeometry(1, 0);
  geo.translate(0, 1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3f6b3f, roughness: 1, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  pts.forEach((p, i) => {
    m.makeScale(p.s * 1.2, p.s * 1.5, p.s * 1.2);
    m.setPosition(p.x, p.y - 0.3, p.z);
    mesh.setMatrixAt(i, m);
    col.setHSL(0.27 + r() * 0.08, 0.35 + r() * 0.2, 0.18 + r() * 0.1);
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true;
  return mesh;
}

// ---------------- Embankment street lights ----------------
export function createBankLights() {
  const pts = [];
  for (let z = -620; z < 520; z += 4) {
    let skip = false;
    for (const bz of Object.values(BRIDGE_Z)) if (Math.abs(z - bz) < 3) skip = true;
    if (skip) continue;
    pts.push([leftBank(z) - 1.4, 1.9, z], [rightBank(z) + 1.4, 1.9, z]);
  }
  const geo = new THREE.SphereGeometry(0.16, 6, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  mat.color.multiplyScalar(3);
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const m = new THREE.Matrix4();
  pts.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); mesh.setMatrixAt(i, m); });
  return mesh;
}

// ---------------- Boats ----------------
export function createBoats() {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.6 });
  const cabin = new THREE.MeshStandardMaterial({ color: 0x1f2a3a, emissive: 0xffd28a, emissiveIntensity: 0.9 });
  const boats = [];
  const r = rng(5);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group();
    const L = 5 + r() * 4;
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, L), hull);
    h.position.y = 0.3;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, L * 0.6), cabin);
    c.position.y = 0.9;
    b.add(h, c);
    group.add(b);
    boats.push({ mesh: b, z: -500 + r() * 900, lane: (r() < 0.5 ? -1 : 1) * (5 + r() * 8), speed: (r() < 0.5 ? 1 : -1) * (3 + r() * 4) });
  }
  group.userData.update = (dt) => {
    for (const b of boats) {
      b.z += b.speed * dt;
      if (b.z > 520) b.z = -600;
      if (b.z < -600) b.z = 520;
      // steer clear of Margaret Island
      let lane = b.lane;
      if (b.z > -450 && b.z < -245) lane = Math.sign(lane) * 21;
      b.mesh.position.set(riverX(b.z) + lane, 0, b.z);
      b.mesh.rotation.y = b.speed > 0 ? 0 : Math.PI;
    }
  };
  group.userData.update(0);
  return group;
}
