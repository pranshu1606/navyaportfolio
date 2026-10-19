// Stylised, hand-built Budapest (used when no photorealistic-tiles key is configured).
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
import { frameKey } from './flight.js';

export function createModelWorld({ renderer, camera, isSmall }) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  camera.near = 0.1;
  camera.far = 5000;
  camera.updateProjectionMatrix();

  const scene = new THREE.Scene();
  scene.background = PALETTE.fog.clone();
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0019);

  // Budapest at golden/blue hour, sun setting behind the Buda hills
  const sunDir = new THREE.Vector3(-1, 0.07, 0.35).normalize();
  scene.add(new THREE.HemisphereLight(0x8d9be0, 0x3b2a2a, 0.75));
  const sun = new THREE.DirectionalLight(0xffa877, 2.2);
  sun.position.copy(sunDir).multiplyScalar(500);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6f7dff, 0.35);
  fill.position.set(300, 200, -200);
  scene.add(fill);

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

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.65, 0.55, 0.82));
  composer.addPass(new OutputPass());

  // Each keyframe is anchored to a section index ("a"); fractional anchors sit between sections.
  const cz = BRIDGE_Z.chain, cL = leftBank(cz), cR = rightBank(cz), cr = riverX(cz);
  const lz = BRIDGE_Z.liberty, lr = riverX(lz);
  const ez = BRIDGE_Z.elisabeth;
  const deckEye = DECK_Y + 1.35;
  const statue = landmarks.statueTop;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const F = (p, l, s) => frameKey(p, l, isSmall ? 0 : s);
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

  return {
    kind: 'model',
    scene,
    keys: KEYS,
    labels: landmarks.labels,
    labelRange: [9, 180],
    ready: Promise.resolve(),
    adjustCamera() {},
    update(t, dt) {
      water.material.uniforms.time.value = t;
      boats.userData.update(dt);
      landmarks.group.userData.update(t);
    },
    render() { composer.render(); },
    resize(w, h) { composer.setSize(w, h); },
    attributions() { return ''; },
    dispose() { composer.dispose(); scene.clear(); },
  };
}
