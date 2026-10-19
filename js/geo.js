// Shared geography for the stylised Budapest model.
// Units: 1 unit ≈ 10 m. +x = east (Pest), −x = west (Buda), +z = south.
// The Danube runs roughly north → south through the middle of the map.

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z) {
  let f = 0, amp = 0.5, fr = 1;
  for (let i = 0; i < 4; i++) {
    f += amp * vnoise(x * fr, z * fr);
    amp *= 0.5;
    fr *= 2;
  }
  return f;
}

// Seeded RNG so the city looks the same on every visit.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- The river ----
export function riverX(z) {
  return 9 * Math.sin(z * 0.0055 + 0.4) - 4;
}

// The Danube widens around Margaret Island.
export function halfW(z) {
  return 20 + 13 * Math.exp(-(((z + 345) / 95) ** 2));
}

export const leftBank = (z) => riverX(z) - halfW(z);
export const rightBank = (z) => riverX(z) + halfW(z);

// ---- Landmark anchor points ----
export const BRIDGE_Z = {
  margaret: -235,
  chain: -10,
  elisabeth: 75,
  liberty: 170,
};

export const ISLAND = { z0: -440, z1: -255 };

const castleZ = -45;
export const CASTLE = { x: leftBank(castleZ) - 30, z: castleZ, h: 13, rx: 15, rz: 60 };
const gZ = 128;
export const GELLERT = { x: leftBank(gZ) - 32, z: gZ, h: 25, r: 40 };

export const PARLIAMENT = { x: rightBank(-125) + 14, z: -125 };
export const BASILICA = { x: rightBank(-30) + 62, z: -30 };
export const CORVINUS = { x: rightBank(192) + 10, z: 192 };
export const MARKET = { x: rightBank(165) + 30, z: 160 };

const BANK_Y = 1.2;
export const DECK_Y = 3.2;

function islandMask(x, z) {
  if (z < ISLAND.z0 || z > ISLAND.z1) return 0;
  const t = (z - (ISLAND.z0 + ISLAND.z1) / 2) / ((ISLAND.z1 - ISLAND.z0) / 2);
  const w = 11 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - 0.25 * t);
  const d = Math.abs(x - riverX(z));
  return 1 - smoothstep(w - 1.5, w + 0.5, d);
}

// Hill height on the Buda side (before blending with the riverbank).
function budaHills(x, z, distFromBank) {
  let hill = 0;
  // Castle Hill: long flat-topped plateau
  const ex = (x - CASTLE.x) / CASTLE.rx, ez = (z - CASTLE.z) / CASTLE.rz;
  const e = ex * ex + ez * ez;
  hill += CASTLE.h * (1 - smoothstep(0.55, 1.35, e));
  // Gellért Hill: round, steep towards the river
  const gx = (x - GELLERT.x) / GELLERT.r, gz = (z - GELLERT.z) / GELLERT.r;
  hill += GELLERT.h * Math.exp(-(gx * gx + gz * gz) * 1.7);
  // Rolling Buda hills further west
  const far = smoothstep(40, 160, distFromBank);
  hill += far * (8 + fbm(x * 0.012, z * 0.012) * 26);
  hill += fbm(x * 0.05, z * 0.05) * 1.5 * smoothstep(5, 30, distFromBank);
  return hill;
}

export function terrainHeight(x, z) {
  const rc = riverX(z), hw = halfW(z);
  const d = x - rc;
  const ad = Math.abs(d);
  const land = smoothstep(hw - 0.5, hw + 1.2, ad);
  let h = -3 * (1 - land) + BANK_Y * land;
  const isl = islandMask(x, z);
  if (isl > 0) h = h * (1 - isl) + 0.9 * isl;
  if (d < 0) {
    const dist = ad - hw;
    const w = smoothstep(2, 10, dist);
    h += budaHills(x, z, dist) * w;
  } else {
    h += fbm(x * 0.03, z * 0.03) * 0.3 * land;
  }
  return h;
}

export function isIsland(x, z) {
  return islandMask(x, z) > 0.9;
}
