import * as THREE from 'three';
import { resolveKeys } from './config.js';
import { buildCurves } from './flight.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const credits = document.getElementById('credits');
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
  // Let the loader paint before the scene is built.
  requestAnimationFrame(() => setTimeout(init, 30));
}

async function init() {
  const isSmall = window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.25 : 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const camera = new THREE.PerspectiveCamera(isSmall ? 62 : 50, window.innerWidth / window.innerHeight, 0.1, 5000);

  const labelLayer = document.getElementById('labels');
  let labels = [];
  function onWorldChanged() {
    curves = buildCurves(world.keys);
    document.body.dataset.world = world.kind;
    labelLayer.replaceChildren();
    labels = world.labels.map((l) => {
      const el = document.createElement('div');
      el.className = 'map-label' + (l.accent ? ' accent' : '');
      el.textContent = l.name;
      labelLayer.appendChild(el);
      return { ...l, el };
    });
  }
  // ---- choose the world: photorealistic tiles when a key is configured ----
  let world, curves;
  async function useModel() {
    loaderText.textContent = 'Building Budapest';
    const { createModelWorld } = await import('./world-model.js');
    world = createModelWorld({ renderer, camera, isSmall });
    onWorldChanged();
  }
  const keys = resolveKeys();
  if (keys.google || keys.ion) {
    loaderText.textContent = 'Streaming photorealistic Budapest';
    try {
      const { createGoogleWorld } = await import('./world-google.js');
      world = createGoogleWorld({
        renderer, camera, isSmall, keys,
        onFatal: (err) => {
          console.warn('Photorealistic tiles unavailable, using the stylised model instead.', err);
          if (world?.kind !== 'google') return;
          world.dispose();
          world = null;
          useModel();
        },
      });
    } catch (err) {
      console.warn(err);
      await useModel();
    }
  } else {
    await useModel();
  }

  if (world.kind === 'google') onWorldChanged();

  // ---- scroll → flight position ----
  const sections = [...document.querySelectorAll('.stop')];
  let anchors = [];
  function measure() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    anchors = sections.map((s) => Math.min(max, Math.max(0, s.offsetTop + (s.offsetHeight - window.innerHeight) / 2)));
  }
  measure();

  function scrollToKey(y) {
    // scroll px -> fractional section index -> fractional keyframe index
    const KEYS = world.keys;
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
  const camLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();

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
    world.resize?.(window.innerWidth, window.innerHeight);
    measure();
    onScroll();
  });

  const timer = new THREE.Timer();
  const smoothPointer = new THREE.Vector2();
  let creditsTimer = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!world) return;
    timer.update();
    const rawDt = Math.min(timer.getDelta(), 1);
    const dt = Math.min(rawDt, 0.05);
    const t = timer.getElapsed();
    const scale = world.kind === 'google' ? 8 : 1; // metres vs. model units

    current += (target - current) * (1 - Math.exp(-rawDt * (reduceMotion ? 20 : 3.2)));
    const u = THREE.MathUtils.clamp(current / (world.keys.length - 1), 0, 1);
    curves.pos.getPoint(u, camera.position);
    curves.look.getPoint(u, camLook);
    world.adjustCamera(camera.position, camLook);

    // subtle drift so the scene breathes even when the visitor stops scrolling
    if (!reduceMotion) {
      smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 2));
      const sway = Math.min(1, camera.position.y / (30 * scale)) * scale;
      camera.position.x += Math.sin(t * 0.25) * 0.6 * sway;
      camera.position.y += Math.sin(t * 0.4) * 0.25 * sway;
      camLook.x += smoothPointer.x * 6 * sway;
      camLook.y -= smoothPointer.y * 3 * sway;
    }
    camera.lookAt(camLook);
    world.update(t, dt);

    // labels
    const [near, far] = world.labelRange;
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of labels) {
      tmp.copy(l.pos).project(camera);
      const dist = camera.position.distanceTo(l.pos);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && dist < far && dist > near;
      if (!visible) { l.el.style.opacity = 0; continue; }
      const fade = Math.min(1, (far - dist) / (far / 3)) * Math.min(1, (dist - near) / (near * 1.3));
      l.el.style.opacity = fade.toFixed(2);
      l.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -100%)`;
    }

    if ((creditsTimer -= rawDt) <= 0) {
      creditsTimer = 1;
      const text = world.attributions();
      credits.hidden = !text;
      if (text) credits.textContent = `Google · ${text}`;
    }

    world.render();
  }

  frame();
  // wait for whichever world ends up active (the tiles may fall back to the model)
  for (let w = world; ; w = world) { await w.ready; if (w === world) break; }
  document.body.classList.add('ready');
  setTimeout(() => loader.classList.add('done'), 250);
  window.__scene = { get world() { return world; }, camera };
}
