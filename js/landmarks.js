// Hand-built, stylised Budapest landmarks.
import * as THREE from 'three';
import {
  terrainHeight, riverX, halfW, leftBank, rightBank, rng,
  CASTLE, GELLERT, PARLIAMENT, BASILICA, CORVINUS, MARKET, BRIDGE_Z, DECK_Y,
} from './geo.js';

// ---------- materials ----------
const glow = (hex, k = 3) => {
  const m = new THREE.MeshBasicMaterial({ color: hex });
  m.color.multiplyScalar(k);
  return m;
};

const M = {
  stone: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.8, emissive: 0xc28a45, emissiveIntensity: 0.45 }),
  stoneDim: new THREE.MeshStandardMaterial({ color: 0xcfc2a8, roughness: 0.9, emissive: 0x7a5a30, emissiveIntensity: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7, emissive: 0xb8a58a, emissiveIntensity: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0x9c3b2c, roughness: 0.7, emissive: 0x3a0e08, emissiveIntensity: 0.5 }),
  copper: new THREE.MeshStandardMaterial({ color: 0x5e8f7a, roughness: 0.6, metalness: 0.2, emissive: 0x16352a, emissiveIntensity: 0.6 }),
  slate: new THREE.MeshStandardMaterial({ color: 0x3c4150, roughness: 0.8 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.5, metalness: 0.6 }),
  libertyGreen: new THREE.MeshStandardMaterial({ color: 0x3f7a5c, roughness: 0.55, metalness: 0.35, emissive: 0x143d2a, emissiveIntensity: 0.6 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.9 }),
  bridgeYellow: new THREE.MeshStandardMaterial({ color: 0xc9b98f, roughness: 0.7, emissive: 0x5a4a26, emissiveIntensity: 0.4 }),
  gold: glow(0xffc46b, 2.2),
  bulb: glow(0xffe0a8, 4),
  beam: new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
};

function facadeTex(seed, { cols = 16, rows = 3, wall = '#eadcc0', win = '#3b3a40', lit = 0.6, arched = true } = {}) {
  const r = rng(seed);
  const W = 256, H = 64;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const em = document.createElement('canvas'); em.width = W; em.height = H;
  const g = cv.getContext('2d'), e = em.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const cw = W / cols, rh = H / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw + cw * 0.3, y = j * rh + rh * 0.2, w = cw * 0.4, h = rh * 0.62;
    const on = r() < lit;
    for (const [ctx, col] of [[g, win], [e, on ? '#ffcf8a' : '#000']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      if (arched) {
        ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2);
        ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h);
      } else ctx.rect(x, y, w, h);
      ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(em); emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function zsolnayTex() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const cols = ['#c4472f', '#e0b23c', '#2f6e5a', '#f2e6cf', '#2c4a7a'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = cols[(x + y * 2 + (x * y) % 3) % cols.length];
    g.beginPath();
    const cx = x * 16 + 8, cy = y * 16 + 8;
    g.moveTo(cx, cy - 8); g.lineTo(cx + 8, cy); g.lineTo(cx, cy + 8); g.lineTo(cx - 8, cy); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}

// ---------- primitive helpers ----------
function box(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cone(parent, r, h, mat, x = 0, y = 0, z = 0, seg = 8) {
  return cyl(parent, 0.001, r, h, mat, x, y, z, seg);
}
function dome(parent, r, sy, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  m.scale.y = sy;
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// Gable roof running along local x.
function gable(parent, len, w, h, mat, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function tube(parent, points, radius, mat, seg = 64) {
  const curve = new THREE.CatmullRomCurve3(points);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, 6, false), mat);
  m.castShadow = true;
  parent.add(m);
  return curve;
}
function strut(parent, a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(m);
  return m;
}
function instanced(geo, mat, positions, scaleFn) {
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => {
    const s = scaleFn ? scaleFn(i) : 1;
    m.makeScale(s, s, s); m.setPosition(p);
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

// ---------- Parliament ----------
function parliament() {
  const g = new THREE.Group();
  const tex = facadeTex(11, { cols: 40, rows: 3, lit: 0.75 });
  const facade = M.stone.clone();
  facade.map = tex.map; facade.emissiveMap = tex.emissiveMap; facade.emissive.set(0xffb766); facade.emissiveIntensity = 0.9;
  const L = 28;
  box(g, L, 3.2, 4, facade, 0, 0, 3.5);
  box(g, L - 2, 3.0, 4, facade, 0, 0, -3.5);
  box(g, 10, 3.6, 11, facade, 0, 0, 0);
  for (const sx of [-1, 1]) {
    box(g, 3.2, 4.2, 11.5, facade, sx * 12.4, 0, 0);
    // steep pavilion roofs
    const p = cone(g, 2.2, 2.6, M.red, sx * 12.4, 4.2, 2.6, 4); p.rotation.y = Math.PI / 4;
    const p2 = cone(g, 2.2, 2.6, M.red, sx * 12.4, 4.2, -2.6, 4); p2.rotation.y = Math.PI / 4;
    // inner flanking towers
    box(g, 1.4, 5.2, 1.4, M.stone, sx * 6.2, 0, 5);
    cone(g, 0.9, 2.2, M.red, sx * 6.2, 5.2, 5, 4).rotation.y = Math.PI / 4;
  }
  gable(g, L - 6, 4, 1.4, M.red, 0, 3.2, 3.5);
  gable(g, L - 8, 4, 1.2, M.red, 0, 3.0, -3.5);
  // Central dome
  cyl(g, 2.6, 2.8, 2.6, M.stone, 0, 3.6, 0, 24);
  dome(g, 2.8, 1.45, M.red, 0, 6.2, 0);
  cyl(g, 0.45, 0.55, 0.9, M.stone, 0, 10.1, 0, 8);
  cone(g, 0.45, 2.6, M.red, 0, 11, 0, 8);
  // ring of pinnacles around the drum
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cone(g, 0.18, 1.6, M.stone, Math.cos(a) * 2.9, 6.2, Math.sin(a) * 2.9, 5);
  }
  // pinnacles along the river facade
  const pins = [];
  for (let x = -L / 2 + 0.7; x <= L / 2 - 0.7; x += 1.25) {
    if (Math.abs(x) < 3) continue;
    pins.push(new THREE.Vector3(x, 3.2, 5.45));
    pins.push(new THREE.Vector3(x, 3.0, -5.45));
  }
  g.add(instanced(new THREE.ConeGeometry(0.13, 1.1, 5).translate(0, 0.55, 0), M.stone, pins));
  const y = terrainHeight(PARLIAMENT.x, PARLIAMENT.z);
  g.position.set(PARLIAMENT.x, y, PARLIAMENT.z);
  g.rotation.y = -Math.PI / 2; // local +z faces the river (west)
  return g;
}

// ---------- St. Stephen's Basilica ----------
function basilica() {
  const g = new THREE.Group();
  box(g, 12, 3.4, 7, M.stoneDim);
  box(g, 7, 3.4, 12, M.stoneDim);
  cyl(g, 2.4, 2.4, 2.4, M.stoneDim, 0, 3.4, 0, 24);
  dome(g, 2.5, 1.25, M.copper, 0, 5.8, 0);
  cyl(g, 0.5, 0.5, 1.2, M.stoneDim, 0, 8.8, 0, 8);
  cone(g, 0.3, 0.8, M.gold, 0, 10, 0, 8);
  for (const sz of [-1, 1]) {
    box(g, 1.8, 6.2, 1.8, M.stoneDim, -6.2, 0, sz * 2.8);
    dome(g, 0.9, 1.4, M.copper, -6.2, 6.2, sz * 2.8);
  }
  g.position.set(BASILICA.x, terrainHeight(BASILICA.x, BASILICA.z), BASILICA.z);
  return g;
}

// ---------- Castle Hill: palace, Matthias Church, Fisherman's Bastion ----------
function castleHill() {
  const g = new THREE.Group();
  const tex = facadeTex(21, { cols: 30, rows: 3, lit: 0.55, arched: false });
  const pal = M.stone.clone(); pal.map = tex.map; pal.emissiveMap = tex.emissiveMap; pal.emissive.set(0xffb766); pal.emissiveIntensity = 0.7;
  const pz = CASTLE.z + 26, px = CASTLE.x + 1;
  const py = terrainHeight(px, pz) - 0.3;
  const palace = new THREE.Group();
  box(palace, 7, 3.2, 26, pal, 0, 0, 0);
  box(palace, 13, 2.8, 5, pal, -2, 0, 9);
  box(palace, 13, 2.8, 5, pal, -2, 0, -9);
  gable(palace, 26, 7, 0.9, M.slate, 0, 3.2, 0).rotation.y = Math.PI / 2;
  cyl(palace, 2.2, 2.3, 1.8, pal, 0.5, 3.2, 0, 24);
  dome(palace, 2.3, 1.5, M.copper, 0.5, 5.0, 0);
  cyl(palace, 0.35, 0.35, 0.8, M.stone, 0.5, 8.4, 0, 8);
  cone(palace, 0.35, 1, M.copper, 0.5, 9.2, 0, 8);
  palace.position.set(px, py, pz);
  g.add(palace);

  // Matthias Church
  const cx = CASTLE.x + 1.5, cz = CASTLE.z - 2;
  const cy = terrainHeight(cx, cz) - 0.2;
  const ch = new THREE.Group();
  const roof = new THREE.MeshStandardMaterial({ map: zsolnayTex(), roughness: 0.6, emissive: 0x2a1a10, emissiveIntensity: 0.4 });
  box(ch, 3, 2.6, 7, M.white);
  gable(ch, 7, 3.2, 2, roof, 0, 2.6, 0).rotation.y = Math.PI / 2;
  box(ch, 1.4, 6, 1.4, M.white, 0.6, 0, 3.6);
  cone(ch, 0.9, 3.2, roof, 0.6, 6, 3.6, 8);
  ch.position.set(cx, cy, cz);
  g.add(ch);

  // Fisherman's Bastion — white walls with seven turrets, facing the river
  const bx = CASTLE.x + 9.5;
  for (let i = 0; i < 7; i++) {
    const z = CASTLE.z - 10 + i * 3.2;
    const y = terrainHeight(bx, z) - 0.6;
    cyl(g, 0.7, 0.8, 1.8, M.white, bx, y, z, 10);
    cone(g, 0.85, 1.4 + (i === 3 ? 0.8 : 0), M.white, bx, y + 1.8, z, 10);
    if (i < 6) box(g, 0.6, 1.2, 3.2, M.white, bx, y, z + 1.6);
  }
  return g;
}

// ---------- Gellért Hill: Liberty Statue & Citadella ----------
function gellert() {
  const g = new THREE.Group();
  const sx = GELLERT.x + 4, sz = GELLERT.z - 2;
  const y = terrainHeight(sx, sz) - 0.2;
  // stepped base and tall pedestal
  box(g, 2.4, 0.6, 2.4, M.white, sx, y, sz);
  box(g, 1.1, 3.2, 1.1, M.white, sx, y + 0.6, sz);
  box(g, 1.4, 0.3, 1.4, M.white, sx, y + 3.8, sz);
  // the figure: flowing dress, head, raised arms and the palm leaf overhead
  const figY = y + 4.1;
  cyl(g, 0.12, 0.34, 1.5, M.white, sx, figY, sz, 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.white);
  head.position.set(sx, figY + 1.62, sz);
  g.add(head);
  strut(g, new THREE.Vector3(sx, figY + 1.35, sz - 0.12), new THREE.Vector3(sx, figY + 2.05, sz - 0.35), 0.05, M.white);
  strut(g, new THREE.Vector3(sx, figY + 1.35, sz + 0.12), new THREE.Vector3(sx, figY + 2.05, sz + 0.35), 0.05, M.white);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), M.white);
  leaf.scale.set(0.16, 0.06, 1.15);
  leaf.position.set(sx, figY + 2.1, sz);
  g.add(leaf);
  // the Citadella fortress walls behind the statue
  const fx = GELLERT.x - 6, fz = GELLERT.z;
  const fy = terrainHeight(fx, fz) - 1.2;
  box(g, 6, 1.8, 16, M.stoneDim, fx, fy, fz);
  box(g, 3, 2.4, 3, M.stoneDim, fx, fy, fz - 7);
  box(g, 3, 2.4, 3, M.stoneDim, fx, fy, fz + 7);
  return { group: g, statueTop: new THREE.Vector3(sx, y + 5.6, sz) };
}

// ---------- Corvinus University main building (Fővám tér) ----------
function corvinus() {
  const g = new THREE.Group();
  const tex = facadeTex(31, { cols: 34, rows: 4, wall: '#e3c99a', lit: 0.8 });
  const mat = M.stone.clone();
  mat.color.set(0xf0d9ae); mat.map = tex.map; mat.emissiveMap = tex.emissiveMap; mat.emissive.set(0xffc27a); mat.emissiveIntensity = 1.0;
  const L = 30;
  box(g, 11, 3.6, L, mat);
  gable(g, L, 11, 1.6, M.slate, 0, 3.6, 0).rotation.y = Math.PI / 2;
  for (const s of [-1, 0, 1]) {
    box(g, 12, 4.4, 4, mat, 0, 0, s * (L / 2 - 2));
    gable(g, 12, 4, 1.4, M.slate, 0, 4.4, s * (L / 2 - 2));
  }
  const y = terrainHeight(CORVINUS.x, CORVINUS.z);
  g.position.set(CORVINUS.x, y, CORVINUS.z);

  // highlight: soft beacon & ring so visitors can spot it from above
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 7, 70, 32, 1, true), M.beam);
  beacon.position.set(0, 35, 0);
  g.add(beacon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 0.18, 6, 96), glow(0x9ad8ff, 2.5));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
  g.add(ring);
  g.userData.beacon = beacon;
  g.userData.ring = ring;
  return g;
}

// ---------- Great Market Hall ----------
function marketHall() {
  const g = new THREE.Group();
  const tex = facadeTex(41, { cols: 12, rows: 2, wall: '#d8b89a', lit: 0.5 });
  const mat = M.stone.clone(); mat.map = tex.map; mat.emissiveMap = tex.emissiveMap;
  box(g, 20, 3, 10, mat);
  const roof = new THREE.MeshStandardMaterial({ map: zsolnayTex(), roughness: 0.6, emissive: 0x2a1a10, emissiveIntensity: 0.3 });
  gable(g, 20, 10.4, 3.4, roof, 0, 3, 0);
  box(g, 1.6, 5.5, 1.6, mat, -10, 0, -4);
  box(g, 1.6, 5.5, 1.6, mat, -10, 0, 4);
  gable(g, 1.2, 10, 3.2, roof, -10, 3.4, 0).rotation.y = 0;
  g.position.set(MARKET.x, terrainHeight(MARKET.x, MARKET.z), MARKET.z);
  return g;
}

// ---------- Bridges ----------
function spanInfo(z) {
  const rc = riverX(z), hw = halfW(z);
  return { rc, L: rc - hw, R: rc + hw };
}

function deck(g, x0, x1, z, width, mat = M.deck) {
  box(g, x1 - x0, 0.5, width, mat, (x0 + x1) / 2, DECK_Y - 0.5, z);
  // parapets
  box(g, x1 - x0, 0.45, 0.15, mat, (x0 + x1) / 2, DECK_Y, z - width / 2 + 0.08);
  box(g, x1 - x0, 0.45, 0.15, mat, (x0 + x1) / 2, DECK_Y, z + width / 2 - 0.08);
}

// Széchenyi Chain Bridge — the iron chain suspension bridge the camera flies through.
function chainBridge() {
  const g = new THREE.Group();
  const z = BRIDGE_Z.chain;
  const { rc, L, R } = spanInfo(z);
  const tL = L + 5, tR = R - 5;
  const W = 4.6;
  deck(g, L - 7, R + 7, z, W);
  const bulbs = [];
  const chainZ = 2.4;
  for (const tx of [tL, tR]) {
    // pier in the river
    box(g, 4.5, DECK_Y + 2.5, 8.4, M.stoneDim, tx, -2.5, z);
    // the triumphal-arch tower
    for (const s of [-1, 1]) {
      box(g, 2.6, 4.4, 1.5, M.stone, tx, DECK_Y - 0.5, z + s * 2.45);
      box(g, 2.9, 0.5, 1.7, M.stone, tx, DECK_Y + 3.9, z + s * 2.45);
    }
    box(g, 2.6, 1.6, 6.4, M.stone, tx, DECK_Y + 3.0, z); // lintel (opening ≈ 3.4 × 3)
    box(g, 3.0, 0.4, 6.8, M.stone, tx, DECK_Y + 4.6, z); // cornice
    box(g, 1.6, 0.5, 1.6, M.stone, tx, DECK_Y + 5.0, z);
  }
  // abutments & stone lions
  for (const [ax, dir] of [[L - 6, -1], [R + 6, 1]]) {
    box(g, 4, 1.4, 8, M.stoneDim, ax + dir * 1, DECK_Y - 1.4, z);
    for (const s of [-1, 1]) {
      box(g, 1.6, 0.9, 0.7, M.stoneDim, ax - dir * 0.6, DECK_Y, z + s * 3.4);
      box(g, 0.6, 0.6, 0.7, M.stoneDim, ax - dir * 1.3, DECK_Y + 0.6, z + s * 3.4);
    }
  }
  // chains
  const top = DECK_Y + 4.2, mid = DECK_Y + 0.9, anc = DECK_Y + 0.1;
  const half = (tR - tL) / 2;
  const chainY = (x) => {
    if (x < tL) return anc + (top - anc) * ((x - (L - 6)) / (tL - (L - 6))) ** 1.25;
    if (x > tR) return anc + (top - anc) * (((R + 6) - x) / ((R + 6) - tR)) ** 1.25;
    const t = (x - rc) / half;
    return mid + (top - mid) * t * t;
  };
  const hangerGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 4).translate(0, 0.5, 0);
  const hangers = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let x = L - 6; x <= R + 6.001; x += 1) pts.push(new THREE.Vector3(x, chainY(x), z + s * chainZ));
    tube(g, pts, 0.15, M.iron, 160);
    for (let x = tL + 1.2; x < tR - 0.6; x += 1.2) {
      hangers.push({ x, y: DECK_Y, z: z + s * chainZ, h: chainY(x) - DECK_Y });
    }
    for (let x = L - 5; x <= R + 5; x += 1.1) bulbs.push(new THREE.Vector3(x, chainY(x) + 0.22, z + s * chainZ));
  }
  const hm = new THREE.InstancedMesh(hangerGeo, M.iron, hangers.length);
  const m = new THREE.Matrix4();
  hangers.forEach((h, i) => { m.makeScale(1, h.h, 1); m.setPosition(h.x, h.y, h.z); hm.setMatrixAt(i, m); });
  g.add(hm);
  g.add(instanced(new THREE.SphereGeometry(0.12, 6, 4), M.bulb, bulbs));
  return g;
}

// Liberty (Szabadság) Bridge — green iron cantilever bridge in front of Corvinus.
function libertyBridge() {
  const g = new THREE.Group();
  const z = BRIDGE_Z.liberty;
  const { rc, L, R } = spanInfo(z);
  const pL = L + 9, pR = R - 9;
  deck(g, L - 3, R + 3, z, 4.6, M.libertyGreen);
  const topY = (x) => {
    const lo = DECK_Y + 0.4, hi = DECK_Y + 4.6, md = DECK_Y + 1.0;
    if (x < pL) return lo + (hi - lo) * Math.sin(((x - (L - 3)) / (pL - (L - 3))) * Math.PI / 2) ** 2;
    if (x > pR) return lo + (hi - lo) * Math.sin((((R + 3) - x) / ((R + 3) - pR)) * Math.PI / 2) ** 2;
    const t = (x - rc) / ((pR - pL) / 2);
    return md + (hi - md) * t * t;
  };
  for (const s of [-1, 1]) {
    const zz = z + s * 2.25;
    const pts = [];
    for (let x = L - 3; x <= R + 3.001; x += 0.8) pts.push(new THREE.Vector3(x, topY(x), zz));
    tube(g, pts, 0.14, M.libertyGreen, 140);
    // lattice diagonals
    let up = true;
    for (let x = L - 2; x < R + 2; x += 1.3) {
      const a = new THREE.Vector3(x, DECK_Y, zz);
      const b = new THREE.Vector3(x + 1.3, topY(x + 1.3), zz);
      if (up) strut(g, a, b, 0.05, M.libertyGreen);
      else strut(g, new THREE.Vector3(x, topY(x), zz), new THREE.Vector3(x + 1.3, DECK_Y, zz), 0.05, M.libertyGreen);
      strut(g, new THREE.Vector3(x, DECK_Y, zz), new THREE.Vector3(x, topY(x), zz), 0.045, M.libertyGreen);
      up = !up;
    }
  }
  for (const px of [pL, pR]) {
    box(g, 3.4, DECK_Y + 2.4, 7.4, M.stoneDim, px, -2.5, z);
    for (const s of [-1, 1]) {
      cyl(g, 0.22, 0.28, 3.4, M.libertyGreen, px, DECK_Y, z + s * 2.25, 8);
      cyl(g, 0.3, 0.3, 0.3, M.libertyGreen, px, DECK_Y + 5.0, z + s * 2.25, 8);
      // turul birds atop the portal
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), M.gold);
      t.position.set(px, DECK_Y + 5.6, z + s * 2.25);
      t.scale.set(1, 0.8, 1.6);
      g.add(t);
    }
    box(g, 0.3, 0.3, 4.8, M.libertyGreen, px, DECK_Y + 4.6, z);
  }
  return g;
}

// Elisabeth Bridge — slim white single-span suspension bridge.
function elisabethBridge() {
  const g = new THREE.Group();
  const z = BRIDGE_Z.elisabeth;
  const { rc, L, R } = spanInfo(z);
  const pL = L + 1, pR = R - 1;
  deck(g, L - 8, R + 8, z, 5.4, M.white);
  const top = DECK_Y + 4.4, mid = DECK_Y + 0.6;
  const cy = (x) => {
    if (x < pL) return DECK_Y + 0.2 + (top - DECK_Y - 0.2) * ((x - (L - 8)) / (pL - (L - 8)));
    if (x > pR) return DECK_Y + 0.2 + (top - DECK_Y - 0.2) * (((R + 8) - x) / ((R + 8) - pR));
    const t = (x - rc) / ((pR - pL) / 2);
    return mid + (top - mid) * t * t;
  };
  const bulbs = [];
  for (const s of [-1, 1]) {
    const zz = z + s * 2.6;
    const pts = [];
    for (let x = L - 8; x <= R + 8.001; x += 1) pts.push(new THREE.Vector3(x, cy(x), zz));
    tube(g, pts, 0.1, M.white, 120);
    for (let x = pL + 1.2; x < pR - 0.6; x += 1.6) strut(g, new THREE.Vector3(x, DECK_Y, zz), new THREE.Vector3(x, cy(x), zz), 0.03, M.white);
    for (let x = L - 7; x <= R + 7; x += 2.2) bulbs.push(new THREE.Vector3(x, cy(x) + 0.15, zz));
  }
  for (const px of [pL, pR]) {
    for (const s of [-1, 1]) box(g, 0.7, 4.6, 0.7, M.white, px, DECK_Y - 0.2, z + s * 2.6);
    box(g, 0.7, 0.5, 5.9, M.white, px, DECK_Y + 4.1, z);
  }
  g.add(instanced(new THREE.SphereGeometry(0.1, 6, 4), glow(0xdfefff, 4), bulbs));
  return g;
}

// Margaret Bridge — stone-coloured arch bridge near the island's southern tip.
function margaretBridge() {
  const g = new THREE.Group();
  const z = BRIDGE_Z.margaret;
  const { L, R } = spanInfo(z);
  deck(g, L - 3, R + 3, z, 5.2, M.bridgeYellow);
  const piers = 4;
  const span = (R - L) / (piers + 1);
  for (let i = 0; i <= piers + 1; i++) {
    const px = L + i * span;
    if (i > 0 && i <= piers) box(g, 1.6, DECK_Y + 2.6, 6, M.bridgeYellow, px, -2.6, z);
    if (i <= piers) {
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const t = k / 12;
          pts.push(new THREE.Vector3(px + t * span, DECK_Y - 0.5 - (1 - Math.sin(t * Math.PI)) * 2.8, z + s * 2.2));
        }
        tube(g, pts, 0.28, M.bridgeYellow, 24);
      }
    }
  }
  return g;
}

export function createLandmarks() {
  const group = new THREE.Group();
  const gel = gellert();
  const corv = corvinus();
  group.add(parliament(), basilica(), castleHill(), gel.group, corv, marketHall(),
    chainBridge(), libertyBridge(), elisabethBridge(), margaretBridge());

  const labels = [
    { name: 'Hungarian Parliament', pos: new THREE.Vector3(PARLIAMENT.x, 15, PARLIAMENT.z) },
    { name: 'Széchenyi Chain Bridge', pos: new THREE.Vector3(riverX(BRIDGE_Z.chain), DECK_Y + 7, BRIDGE_Z.chain) },
    { name: 'Buda Castle', pos: new THREE.Vector3(CASTLE.x, CASTLE.h + 12, CASTLE.z + 26) },
    { name: "Fisherman's Bastion", pos: new THREE.Vector3(CASTLE.x + 9.5, CASTLE.h + 5, CASTLE.z - 1) },
    { name: "St. Stephen's Basilica", pos: new THREE.Vector3(BASILICA.x, 13, BASILICA.z) },
    { name: 'Elisabeth Bridge', pos: new THREE.Vector3(riverX(BRIDGE_Z.elisabeth), DECK_Y + 6.5, BRIDGE_Z.elisabeth) },
    { name: 'Liberty Statue · Gellért Hill', pos: gel.statueTop.clone().add(new THREE.Vector3(0, 2.5, 0)) },
    { name: 'Liberty Bridge', pos: new THREE.Vector3(riverX(BRIDGE_Z.liberty), DECK_Y + 7.5, BRIDGE_Z.liberty) },
    { name: 'Corvinus University', pos: new THREE.Vector3(CORVINUS.x, 9, CORVINUS.z), accent: true },
    { name: 'Great Market Hall', pos: new THREE.Vector3(MARKET.x, 9, MARKET.z) },
    { name: 'Margaret Island', pos: new THREE.Vector3(riverX(-350), 6, -350) },
  ];

  group.userData.update = (t) => {
    corv.userData.beacon.material.opacity = 0.12 + Math.sin(t * 1.5) * 0.04;
    corv.userData.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.03);
  };
  return { group, labels, statueTop: gel.statueTop };
}
