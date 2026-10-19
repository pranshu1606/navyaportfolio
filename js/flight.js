import * as THREE from 'three';

// Nudge a look target sideways so the subject sits beside the text panel
// (s > 0 puts the subject right of centre).
export function frameKey(p, l, s = 0) {
  if (!s) return { p, l };
  const f = l.clone().sub(p);
  const right = new THREE.Vector3(-f.z, 0, f.x).normalize();
  return { p, l: l.clone().addScaledVector(right, -s * f.length() * 0.9) };
}

export function buildCurves(keys) {
  return {
    pos: new THREE.CatmullRomCurve3(keys.map((k) => k.p), false, 'centripetal'),
    look: new THREE.CatmullRomCurve3(keys.map((k) => k.l), false, 'centripetal'),
  };
}
