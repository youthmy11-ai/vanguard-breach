// Solstice Foundry: original 3-lane tactical arena with golden-hour sky dome, Site A/B landmarks & waypoint graph.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextureSet } from './textures.js';

export const MAP_BOUNDS = { minX: -24, maxX: 24, minZ: -22, maxZ: 22 };

export const SITES = [
  { id: 'A', name: 'Reactor Bay', center: new THREE.Vector3(-15, 0.08, -6), radius: 2.7, color: PALETTE.siteA },
  { id: 'B', name: 'Container Dock', center: new THREE.Vector3(15, 0.08, -6), radius: 2.7, color: PALETTE.siteB },
];

export const TEAM_SPAWNS = {
  vanguard: [
    new THREE.Vector3(0, 0, 18.2),
    new THREE.Vector3(-4.2, 0, 18.6),
    new THREE.Vector3(4.2, 0, 18.6),
    new THREE.Vector3(-8.0, 0, 17.5),
  ],
  obsidian: [
    new THREE.Vector3(0, 0, -18.2),
    new THREE.Vector3(-4.2, 0, -18.6),
    new THREE.Vector3(4.2, 0, -18.6),
    new THREE.Vector3(8.5, 0, -17.5),
  ],
};

export const WAYPOINTS = [
  { id: 0, pos: new THREE.Vector3(0, 0, 16.5), links: [1, 2, 3] },
  { id: 1, pos: new THREE.Vector3(-14.5, 0, 15.5), links: [0, 4] },
  { id: 2, pos: new THREE.Vector3(0, 0, 9.0), links: [0, 5, 6] },
  { id: 3, pos: new THREE.Vector3(14.5, 0, 15.5), links: [0, 7] },
  { id: 4, pos: new THREE.Vector3(-15.0, 0, 4.5), links: [1, 8, 9] },
  { id: 5, pos: new THREE.Vector3(-3.6, 0, 0.2), links: [2, 8, 10] },
  { id: 6, pos: new THREE.Vector3(3.6, 0, 0.2), links: [2, 10, 11] },
  { id: 7, pos: new THREE.Vector3(15.0, 0, 4.5), links: [3, 11, 12] },
  { id: 8, pos: new THREE.Vector3(-14.8, 0, -5.8), links: [4, 5, 9, 13] },
  { id: 9, pos: new THREE.Vector3(-18.2, 0, -1.0), links: [4, 8] },
  { id: 10, pos: new THREE.Vector3(0, 0, -11.5), links: [5, 6, 13, 14] },
  { id: 11, pos: new THREE.Vector3(11.5, 0, -0.5), links: [6, 7, 12] },
  { id: 12, pos: new THREE.Vector3(15.2, 0, -6.0), links: [7, 11, 14] },
  { id: 13, pos: new THREE.Vector3(-13.5, 0, -16.5), links: [8, 10, 15] },
  { id: 14, pos: new THREE.Vector3(13.5, 0, -16.5), links: [10, 12, 15] },
  { id: 15, pos: new THREE.Vector3(0, 0, -17.8), links: [13, 14] },
];

export function createFoundryMap(scene) {
  const tex = createTextureSet();
  const group = new THREE.Group();
  scene.add(group);

  // Golden-hour industrial sky dome
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(92, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false }),
  );
  scene.add(skyDome);

  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.86, metalness: 0.06 }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.62, metalness: 0.36 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.5, metalness: 0.55 }),
    concrete: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.concreteDark), roughness: 0.85, metalness: 0.08 }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.78, metalness: 0.05 }),
    amber: new THREE.MeshStandardMaterial({ map: tex.containerAmber, roughness: 0.54, metalness: 0.4 }),
    teal: new THREE.MeshStandardMaterial({ map: tex.containerTeal, roughness: 0.54, metalness: 0.4 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.68, metalness: 0.22 }),
    siteA: new THREE.MeshStandardMaterial({ map: tex.siteA, emissive: new THREE.Color(PALETTE.siteA), emissiveIntensity: 0.45 }),
    siteB: new THREE.MeshStandardMaterial({ map: tex.siteB, emissive: new THREE.Color(PALETTE.siteB), emissiveIntensity: 0.45 }),
    glowA: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.siteA), emissive: new THREE.Color(PALETTE.siteA), emissiveIntensity: 1.6 }),
    glowB: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.siteB), emissive: new THREE.Color(PALETTE.siteB), emissiveIntensity: 1.6 }),
  };

  const colliders = [];
  const shootables = [];
  const radarBoxes = [];

  function addBox(w, h, d, x, y, z, matKey, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[matKey]);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.shadow !== false;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (options.collide !== false) colliders.push(new THREE.Box3().setFromObject(mesh));
    if (options.shoot !== false) shootables.push(mesh);
    if (options.radar !== false && y + h * 0.5 > 0.3) radarBoxes.push({ x, z, w, d, h });
    return mesh;
  }

  // Ground & perimeter walls
  addBox(49, 0.4, 45, 0, -0.2, 0, 'floor', { shadow: false, radar: false });
  addBox(1.0, 6.0, 45, -24.5, 3.0, 0, 'wall');
  addBox(1.0, 6.0, 45, 24.5, 3.0, 0, 'wall');
  addBox(49, 6.0, 1.0, 0, 3.0, -22.5, 'wall');
  addBox(49, 6.0, 1.0, 0, 3.0, 22.5, 'wall');

  // Lane dividers (West & East)
  addBox(1.8, 4.4, 11.0, -8.5, 2.2, 7.5, 'wall');
  addBox(1.8, 4.4, 9.5, -8.5, 2.2, -7.75, 'wall');
  addBox(1.8, 4.4, 10.0, 8.5, 2.2, 8.0, 'wall');
  addBox(1.8, 4.4, 11.0, 8.5, 2.2, -7.5, 'wall');

  // Mid Archway & gantry
  addBox(1.4, 3.6, 1.6, -6.6, 1.8, -1.0, 'darkSteel');
  addBox(1.4, 3.6, 1.6, 6.6, 1.8, -1.0, 'darkSteel');
  addBox(15.2, 1.4, 2.2, 0, 4.3, -1.0, 'darkSteel', { radar: false });
  addBox(15.2, 0.25, 2.3, 0, 3.55, -1.0, 'amber', { radar: false });

  for (const zBeam of [-15, -7, 7, 15]) {
    addBox(48, 0.42, 0.65, 0, 5.75, zBeam, 'darkSteel', { collide: false, shoot: false, radar: false });
  }

  // Mid Courtyard cover
  addBox(2.4, 1.25, 1.4, 0, 0.625, 4.2, 'crate');
  addBox(1.8, 2.8, 1.8, 0, 1.4, -7.2, 'darkSteel');
  addBox(1.6, 1.0, 1.4, -4.0, 0.5, -3.6, 'crate');
  addBox(1.6, 1.0, 1.4, 4.0, 0.5, -3.6, 'crate');
  addBox(2.2, 1.1, 1.2, -3.6, 0.55, 12.0, 'concrete');
  addBox(2.2, 1.1, 1.2, 3.6, 0.55, 12.0, 'concrete');
  addBox(2.8, 1.1, 1.2, 0, 0.55, -13.6, 'concrete');

  // West Lane & Site A Reactor Bay
  addBox(2.6, 1.1, 1.4, -15.5, 0.55, 9.2, 'crate');
  addBox(1.6, 3.0, 1.6, -12.6, 1.5, 2.2, 'darkSteel');
  addBox(1.8, 1.35, 1.8, -11.6, 0.675, -5.4, 'crate');
  addBox(2.4, 2.2, 1.8, -18.2, 1.1, -8.6, 'teal');
  addBox(2.2, 0.55, 1.4, -20.5, 0.275, -3.0, 'crate');
  addBox(2.2, 1.1, 2.6, -20.5, 0.55, -5.0, 'crate');

  // Reactor Core Monument behind Site A
  addBox(2.6, 4.0, 2.6, -15.0, 2.0, -12.0, 'darkSteel');
  addBox(1.2, 2.9, 1.2, -15.0, 1.9, -10.55, 'glowA', { collide: false, radar: false });
  addBox(3.4, 0.35, 3.4, -15.0, 4.15, -12.0, 'amber', { collide: false, radar: false });

  // East Lane & Site B Container Dock
  addBox(2.5, 2.5, 4.4, 15.0, 1.25, 8.2, 'amber');
  addBox(2.4, 2.5, 3.4, 12.8, 1.25, -2.5, 'teal');
  addBox(2.0, 1.1, 1.2, 17.4, 0.55, -11.2, 'crate');
  addBox(2.4, 0.55, 1.3, 19.6, 0.275, -4.4, 'crate');
  addBox(2.4, 1.15, 3.0, 19.6, 0.575, -6.55, 'amber');
  addBox(1.3, 1.3, 1.3, 19.6, 1.8, -7.2, 'crate');

  // Bomb Site Pads & Decals
  for (const site of SITES) {
    addBox(3.6, 0.08, 3.6, site.center.x, 0.04, site.center.z, 'hazard', { collide: false, shoot: false, radar: false });
    const glowKey = site.id === 'A' ? 'glowA' : 'glowB';
    addBox(2.8, 0.04, 0.16, site.center.x, 0.09, site.center.z - 1.4, glowKey, { collide: false, shoot: false, radar: false });
    addBox(2.8, 0.04, 0.16, site.center.x, 0.09, site.center.z + 1.4, glowKey, { collide: false, shoot: false, radar: false });
    const decalMat = site.id === 'A' ? mats.siteA : mats.siteB;
    const signX = site.id === 'A' ? -9.45 : 9.45;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 1.4), decalMat);
    sign.position.set(signX, 2.45, -6.0);
    group.add(sign);
  }

  // Resonance Bomb Core 3D Model
  const bombCore = new THREE.Group();
  const coreBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.24, 0.4),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), metalness: 0.72, roughness: 0.3 }),
  );
  coreBase.position.y = 0.12;
  const coreRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.34, 12),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), metalness: 0.5, roughness: 0.35 }),
  );
  coreRing.position.y = 0.32;
  const coreBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }),
  );
  coreBeacon.position.y = 0.54;
  const bombLight = new THREE.PointLight(new THREE.Color(PALETTE.obsidian), 0, 11);
  bombLight.position.y = 0.8;
  bombCore.add(coreBase, coreRing, coreBeacon, bombLight);
  bombCore.visible = false;
  scene.add(bombCore);

  // Golden-hour crisp outdoor lighting with balanced shadow lift
  const hemi = new THREE.HemisphereLight(new THREE.Color('#c3daf4'), new THREE.Color('#6b5e52'), 1.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 2.55);
  sun.position.set(18, 28, 16);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.far = 76;
  sun.shadow.bias = -0.00045;
  scene.add(sun, sun.target);

  const rim = new THREE.DirectionalLight(new THREE.Color('#8bb8ea'), 0.85);
  rim.position.set(-16, 14, -18);
  scene.add(rim);

  const siteALight = new THREE.PointLight(new THREE.Color(PALETTE.siteA), 6.5, 18);
  siteALight.position.set(-15, 3.4, -6);
  const siteBLight = new THREE.PointLight(new THREE.Color(PALETTE.siteB), 6.5, 18);
  siteBLight.position.set(15, 3.4, -6);
  scene.add(siteALight, siteBLight);

  return {
    colliders,
    shootables,
    radarBoxes,
    group,
    bombCore,
    coreBeacon,
    bombLight,
    setBombPlanted(siteId) {
      if (!siteId) {
        bombCore.visible = false;
        bombLight.intensity = 0;
        return;
      }
      const site = SITES.find((s) => s.id === siteId) ?? SITES[0];
      bombCore.position.set(site.center.x, 0.08, site.center.z);
      bombCore.visible = true;
      bombLight.intensity = 6;
    },
    pulseBomb(time, urgency) {
      if (!bombCore.visible) return;
      const pulse = Math.sin(time * (4 + urgency * 18)) > 0.2 ? 1 : 0.2;
      bombLight.intensity = 3 + pulse * 8;
      coreBeacon.scale.setScalar(0.9 + pulse * 0.45);
    },
  };
}
