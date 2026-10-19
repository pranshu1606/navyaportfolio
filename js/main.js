import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  riverX, leftBank, rightBank, CASTLE, GELLERT, PARLIAMENT, CORVINUS, BRIDGE_Z, DECK_Y,
} from './geo.js';
import {
  PALETTE, createSky, createStars, createTerrain, createWater, createBuildings, createTrees, createBankLights, createBoats,
} from './world.js';
import { createLandmarks } from './landmarks.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

if (!webglAvailable()) {
  document.body.classList.add('no-webgl');
  loader.classList.add('done');
} else {
  // Let the loader paint before the (synchronous) city generation starts.
  requestAnimationFrame(() => setTimeout(init, 30));
}

function init() {
  const isSmall = window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.25 : 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = PALETTE.fog.clone();
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0019);

  const camera = new THREE.PerspectiveCamera(isSmall ? 62 : 50, window.innerWidth / window.innerHeight, 0.1, 5000);

  // ---- Lights: Budapest at golden/blue hour, sun setting behind the Buda hills ----
  const sunDir = new THREE.Vector3(-1, 0.07, 0.35).normalize();
  scene.add(new THREE.HemisphereLight(0x8d9be0, 0x3b2a2a, 0.75));
  const sun = new THREE.DirectionalLight(0xffa877, 2.2);
  sun.position.copy(sunDir).multiplyScalar(500);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6f7dff, 0.35);
  fill.position.set(300, 200, -200);
  scene.add(fill);

  // ---- World ----
  scene.add(createSky(sunDir));
  scene.add(createStars());
  scene.add(createTerrain());
  const water = createWater();
  water.material.uniforms.fogDensity.value = scene.fog.density;
  scene.add(water);
  scene.add(createBuildings());
  scene.add(createTrees());
  scene.add(createBankLights());
  const boats = createBoats();
  scene.add(boats);
  const landmarks = createLandmarks();
  scene.add(landmarks.group);

  // ---- Post-processing ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.65, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- Camera flight path ----
  // Each keyframe is anchored to a section index ("a"); fractional anchors sit between sections.
  const cz = BRIDGE_Z.chain, cL = leftBank(cz), cR = rightBank(cz), cr = riverX(cz);
  const lz = BRIDGE_Z.liberty, lr = riverX(lz);
  const ez = BRIDGE_Z.elisabeth;
  const deckEye = DECK_Y + 1.35;
  const statue = landmarks.statueTop;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Nudge the look target sideways so the subject sits beside the text panel
  // (s > 0 puts the subject right of centre). Disabled on phones, where panels sit at the bottom.
  const F = (p, l, s = 0) => {
    if (isSmall || !s) return { p, l };
    const f = l.clone().sub(p);
    const right = new THREE.Vector3(-f.z, 0, f.x).normalize();
    return { p, l: l.clone().addScaledVector(right, -s * f.length() * 0.9) };
  };
  const KEYS = [
    { a: 0, ...F(V(250, 230, -470), V(-20, 0, 0)) },
    { a: 0.5, ...F(V(150, 95, -270), V(PARLIAMENT.x - 10, 4, PARLIAMENT.z)) },
    { a: 1, ...F(V(leftBank(-100) + 8, 13, -96), V(PARLIAMENT.x - 6, 6, PARLIAMENT.z - 6)) },
    { a: 1.45, ...F(V(riverX(-55) + 6, 12, -55), V(cr, DECK_Y + 2, cz)) },
    { a: 1.8, ...F(V(cR + 36, 11, cz - 10), V(cR, deckEye, cz)) },
    { a: 2, ...F(V(cR + 24, deckEye + 2.6, cz + 9), V(cr, deckEye + 1.5, cz), -0.18) },
    { a: 2.2, p: V(cR + 3, deckEye, cz), l: V(cL - 10, deckEye, cz) },
    { a: 2.45, p: V(cr, deckEye, cz), l: V(cL - 10, deckEye + 0.4, cz) },
    { a: 2.75, p: V(cL - 10, deckEye + 3, cz + 2), l: V(CASTLE.x, CASTLE.h + 3, cz - 20) },
    { a: 3, ...F(V(cL + 8, 26, cz + 34), V(CASTLE.x + 2, CASTLE.h + 2, CASTLE.z + 4), 0.26) },
    { a: 3.5, ...F(V(CASTLE.x + 48, 46, 15), V(riverX(ez), 2, ez + 10)) },
    { a: 4, ...F(V(riverX(30) + 12, 16, 32), V(riverX(ez) - 6, 4, ez + 12), -0.05) },
    { a: 4.5, ...F(V(GELLERT.x + 55, 36, 92), V(GELLERT.x, 24, GELLERT.z)) },
    { a: 5, ...F(V(statue.x + 19, statue.y + 3.5, statue.z - 16), V(statue.x, statue.y - 1.5, statue.z), 0.24) },
    { a: 5.5, ...F(V(GELLERT.x + 34, 42, GELLERT.z + 20), V(lr, 3, lz + 2)) },
    { a: 6, ...F(V(riverX(136) + 4, 8, 136), V(lr, 3.2, lz + 6), -0.16) },
    { a: 6.4, p: V(lr, 1.9, lz), l: V(riverX(lz + 30), 2.2, lz + 30) },
    { a: 7, ...F(V(riverX(222) - 10, 12, 224), V(CORVINUS.x - 2, 3.5, CORVINUS.z - 2), 0.12) },
  ];
  const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.l), false, 'centripetal');

  const sections = [...document.querySelectorAll('.stop')];
  let anchors = [];
  function measure() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    anchors = sections.map((s) => Math.min(max, Math.max(0, s.offsetTop + (s.offsetHeight - window.innerHeight) / 2)));
  }
  measure();

  function scrollToKey(y) {
    // scroll px -> fractional section index -> fractional keyframe index
    let si = 0;
    if (y <= anchors[0]) si = 0;
    else if (y >= anchors[anchors.length - 1]) si = anchors.length - 1;
    else {
      for (let i = 0; i < anchors.length - 1; i++) {
        if (y >= anchors[i] && y <= anchors[i + 1]) {
          si = i + (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
          break;
        }
      }
    }
    for (let k = 0; k < KEYS.length - 1; k++) {
      if (si >= KEYS[k].a && si <= KEYS[k + 1].a) return { si, k: k + (si - KEYS[k].a) / (KEYS[k + 1].a - KEYS[k].a) };
    }
    return { si, k: KEYS.length - 1 };
  }

  let target = scrollToKey(window.scrollY).k;
  let current = target;
  let sectionFloat = 0;
  const camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  // ---- Floating landmark labels ----
  const labelLayer = document.getElementById('labels');
  const labels = landmarks.labels.map((l) => {
    const el = document.createElement('div');
    el.className = 'map-label' + (l.accent ? ' accent' : '');
    el.textContent = l.name;
    labelLayer.appendChild(el);
    return { ...l, el };
  });

  // ---- UI wiring ----
  const rail = [...document.querySelectorAll('.rail a')];
  const navLinks = [...document.querySelectorAll('[data-goto]')];
  const place = document.getElementById('place-name');
  const coords = document.getElementById('place-coords');
  const bar = document.getElementById('progress-bar');
  navLinks.forEach((a) => a.addEventListener('click', (e) => {
    const i = +a.dataset.goto;
    if (Number.isNaN(i)) return;
    e.preventDefault();
    window.scrollTo({ top: anchors[i], behavior: reduceMotion ? 'auto' : 'smooth' });
  }));

  function onScroll() {
    const r = scrollToKey(window.scrollY);
    target = r.k;
    sectionFloat = r.si;
    const active = Math.round(r.si);
    sections.forEach((s, i) => s.classList.toggle('active', i === active));
    rail.forEach((a, i) => a.classList.toggle('active', i === active));
    const s = sections[active];
    if (place.textContent !== s.dataset.place) {
      place.textContent = s.dataset.place;
      coords.textContent = s.dataset.coords;
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleY(${max > 0 ? window.scrollY / max : 0})`;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // gentle parallax from the pointer
  const pointer = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    measure();
    onScroll();
  });

  const clock = new THREE.Clock();
  const smoothPointer = new THREE.Vector2();
  function frame() {
    const rawDt = Math.min(clock.getDelta(), 1);
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;

    current += (target - current) * (1 - Math.exp(-rawDt * (reduceMotion ? 20 : 3.2)));
    const u = THREE.MathUtils.clamp(current / (KEYS.length - 1), 0, 1);
    posCurve.getPoint(u, camera.position);
    lookCurve.getPoint(u, camLook);

    // subtle drift so the scene breathes even when the visitor stops scrolling
    if (!reduceMotion) {
      smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 2));
      const height = Math.max(1, camera.position.y);
      const sway = Math.min(1, height / 30);
      camera.position.x += Math.sin(t * 0.25) * 0.6 * sway;
      camera.position.y += Math.sin(t * 0.4) * 0.25 * sway;
      camLook.x += smoothPointer.x * 6 * sway;
      camLook.y -= smoothPointer.y * 3 * sway;
    }
    camera.lookAt(camLook);

    water.material.uniforms.time.value = t;
    boats.userData.update(dt);
    landmarks.group.userData.update(t);

    // labels
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of labels) {
      tmp.copy(l.pos).project(camera);
      const dist = camera.position.distanceTo(l.pos);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && dist < 180 && dist > 9;
      if (!visible) { l.el.style.opacity = 0; continue; }
      const fade = Math.min(1, (180 - dist) / 60) * Math.min(1, (dist - 9) / 12);
      l.el.style.opacity = fade.toFixed(2);
      l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -100%)`;
    }

    composer.render();
    requestAnimationFrame(frame);
  }

  frame();
  document.body.classList.add('ready');
  setTimeout(() => loader.classList.add('done'), 250);
  window.__scene = { scene, camera, KEYS }; // handy for debugging in the console
}
