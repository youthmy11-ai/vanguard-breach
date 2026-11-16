// Solstice Foundry: 3-lane sunset arena, terracotta/steel walls, stencil signs, outside skyline & zone map.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextureSet } from './textures.js';

export const MAP_BOUNDS = { minX: -24, maxX: 24, minZ: -22, maxZ: 22 };

export const SITES = [
  { id: 'A', name: 'Reactor Bay', center: new THREE.Vector3(-15, 0.08, -6), radius: 2.7, color: PALETTE.siteA },
  { id: 'B', name: 'Container Dock', center: new THREE.Vector3(15, 0.08, -6), radius: 2.7, color: PALETTE.siteB },
];

export function getSiteById(id) {
  for (let i = 0; i < SITES.length; i += 1) if (SITES[i].id === id) return SITES[i];
  return null;
}

export function getZoneName(x, z) {
  if (z >= 12.5 && Math.abs(x) <= 10.5) return 'VANGUARD BASE';
  if (z <= -12.5 && Math.abs(x) <= 10.5) return 'OBSIDIAN BASE';
  if (x <= -8.5) return z <= 4.5 ? 'REACTOR BAY (A)' : 'WEST LANE';
  if (x >= 8.5) return z <= 4.5 ? 'CONTAINER DOCK (B)' : 'EAST LANE';
  if (z > 10.5) return 'VANGUARD BASE';
  if (z < -11.5) return 'OBSIDIAN BASE';
  return 'MID ARCHWAY';
}

const v3 = (x, z) => new THREE.Vector3(x, 0, z);
export const TEAM_SPAWNS = {
  vanguard: [v3(0, 18.2), v3(-4.2, 18.6), v3(4.2, 18.6), v3(-8, 17.5)],
  obsidian: [v3(0, -18.2), v3(-4.2, -18.6), v3(4.2, -18.6), v3(8.5, -17.5)],
};

export const WAYPOINTS = [
  [0, 16.5, [1, 2, 3]], [-14.5, 15.5, [0, 4]], [0, 9.0, [0, 5, 6]], [14.5, 15.5, [0, 7]],
  [-15.0, 4.5, [1, 8, 9]], [-3.6, 0.2, [2, 8, 10]], [3.6, 0.2, [2, 10, 11]], [15.0, 4.5, [3, 11, 12]],
  [-14.8, -5.8, [4, 5, 9, 13]], [-18.2, -1.0, [4, 8]], [0, -11.5, [5, 6, 13, 14]], [11.5, -0.5, [6, 7, 12]],
  [15.2, -6.0, [7, 11, 14]], [-13.5, -16.5, [8, 10, 15]], [13.5, -16.5, [10, 12, 15]], [0, -17.8, [13, 14]],
].map(([x, z, links], id) => ({ id, pos: v3(x, z), links }));

// Arena layout tuples: [w, h, d, x, y, z, matKey, flags (1=noShadow, 2=noCollide, 4=noShoot, 8=noRadar)]
const ARENA_BOXES = [
  [49, 0.4, 45, 0, -0.2, 0, 'floor', 9],
  [1, 5.6, 45, -24.5, 2.8, 0, 'brick'], [1, 5.6, 45, 24.5, 2.8, 0, 'brick'],
  [49, 5.6, 1, 0, 2.8, -22.5, 'brick'], [49, 5.6, 1, 0, 2.8, 22.5, 'brick'],
  [1.8, 4.4, 11, -8.5, 2.2, 7.5, 'wall'], [1.8, 4.4, 9.5, -8.5, 2.2, -7.75, 'brick'],
  [1.8, 4.4, 10, 8.5, 2.2, 8, 'wall'], [1.8, 4.4, 11, 8.5, 2.2, -7.5, 'brick'],
  [1.4, 3.6, 1.6, -6.6, 1.8, -1, 'darkSteel'], [1.4, 3.6, 1.6, 6.6, 1.8, -1, 'darkSteel'],
  [15.2, 1.4, 2.2, 0, 4.3, -1, 'darkSteel', 8], [15.2, 0.25, 2.3, 0, 3.55, -1, 'amber', 8],
  [2.4, 1.25, 1.4, 0, 0.625, 4.2, 'crate'], [1.8, 2.8, 1.8, 0, 1.4, -7.2, 'darkSteel'],
  [1.6, 1, 1.4, -4, 0.5, -3.6, 'crate'], [1.6, 1, 1.4, 4, 0.5, -3.6, 'crate'],
  [2.2, 1.1, 1.2, -3.6, 0.55, 12, 'concrete'], [2.2, 1.1, 1.2, 3.6, 0.55, 12, 'concrete'],
  [2.8, 1.1, 1.2, 0, 0.55, -13.6, 'concrete'],
  [2.6, 1.1, 1.4, -15.5, 0.55, 9.2, 'crate'], [1.6, 3, 1.6, -12.6, 1.5, 2.2, 'darkSteel'],
  [1.8, 1.35, 1.8, -11.6, 0.675, -5.4, 'crate'], [2.4, 2.2, 1.8, -18.2, 1.1, -8.6, 'teal'],
  [2.2, 0.55, 1.4, -20.5, 0.275, -3, 'crate'], [2.2, 1.1, 2.6, -20.5, 0.55, -5, 'crate'],
  [2.6, 4, 2.6, -15, 2, -12, 'darkSteel'], [1.2, 2.9, 1.2, -15, 1.9, -10.55, 'glowA', 10],
  [3.4, 0.35, 3.4, -15, 4.15, -12, 'amber', 10],
  [2.5, 2.5, 4.4, 15, 1.25, 8.2, 'amber'], [2.4, 2.5, 3.4, 12.8, 1.25, -2.5, 'teal'],
  [2, 1.1, 1.2, 17.4, 0.55, -11.2, 'crate'], [2.4, 0.55, 1.3, 19.6, 0.275, -4.4, 'crate'],
  [2.4, 1.15, 3, 19.6, 0.575, -6.55, 'amber'], [1.3, 1.3, 1.3, 19.6, 1.8, -7.2, 'crate'],
];

export function createFoundryMap(scene) {
  const tex = createTextureSet();
  const group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(96, 28, 18),
    new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false }),
  ));

  const std = (opts) => new THREE.MeshStandardMaterial(opts);
  const mats = {
    floor: std({ map: tex.floor, roughness: 0.84, metalness: 0.05 }),
    wall: std({ map: tex.wallSteel, roughness: 0.58, metalness: 0.36 }),
    brick: std({ map: tex.wallBrick, roughness: 0.82, metalness: 0.08 }),
    darkSteel: std({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.48, metalness: 0.56 }),
    concrete: std({ color: new THREE.Color(PALETTE.concreteDark), roughness: 0.85, metalness: 0.08 }),
    crate: std({ map: tex.crate, roughness: 0.78, metalness: 0.06 }),
    amber: std({ map: tex.containerAmber, roughness: 0.52, metalness: 0.38 }),
    teal: std({ map: tex.containerTeal, roughness: 0.52, metalness: 0.38 }),
    hazard: std({ map: tex.hazard, roughness: 0.66, metalness: 0.22 }),
    glowA: std({ color: new THREE.Color(PALETTE.siteA), emissive: new THREE.Color(PALETTE.siteA), emissiveIntensity: 1.5 }),
    glowB: std({ color: new THREE.Color(PALETTE.siteB), emissive: new THREE.Color(PALETTE.siteB), emissiveIntensity: 1.5 }),
    skyDark: std({ color: new THREE.Color('#303642'), roughness: 0.72, metalness: 0.32 }),
    skyTerra: std({ color: new THREE.Color('#7a4334'), roughness: 0.8, metalness: 0.14 }),
    skyAmber: std({ color: new THREE.Color('#d97724'), roughness: 0.6, metalness: 0.28 }),
    beacon: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  };

  const colliders = [];
  const shootables = [];
  const radarBoxes = [];

  function addBox(w, h, d, x, y, z, matKey, flags = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[matKey]);
    mesh.position.set(x, y, z);
    mesh.castShadow = !(flags & 1);
    mesh.receiveShadow = !(flags & 16);
    group.add(mesh);
    if (!(flags & 2)) colliders.push(new THREE.Box3().setFromObject(mesh));
    if (!(flags & 4)) shootables.push(mesh);
    if (!(flags & 8) && y + h * 0.5 > 0.3) radarBoxes.push({ x, z, w, d, h });
    return mesh;
  }

  for (let i = 0; i < ARENA_BOXES.length; i += 1) addBox(...ARENA_BOXES[i]);
  for (const zBeam of [-15, -7, 7, 15]) addBox(48, 0.42, 0.65, 0, 5.65, zBeam, 'darkSteel', 14);

  for (const site of SITES) {
    addBox(3.6, 0.08, 3.6, site.center.x, 0.04, site.center.z, 'hazard', 14);
    const glowKey = site.id === 'A' ? 'glowA' : 'glowB';
    addBox(2.8, 0.04, 0.16, site.center.x, 0.09, site.center.z - 1.4, glowKey, 14);
    addBox(2.8, 0.04, 0.16, site.center.x, 0.09, site.center.z + 1.4, glowKey, 14);
  }

  for (const [texMap, x, y, z, ry, w, h] of [
    [tex.signA, -9.46, 2.55, -6.2, -Math.PI * 0.5, 2.6, 1.3],
    [tex.signA, -15, 3.2, -21.93, 0, 3, 1.5],
    [tex.signB, 9.46, 2.55, -6.2, Math.PI * 0.5, 2.6, 1.3],
    [tex.signB, 15, 3.2, -21.93, 0, 3, 1.5],
    [tex.signMid, 0, 4.3, 0.15, 0, 2.8, 1.15],
    [tex.signMid, 0, 3.2, -21.93, 0, 2.6, 1.25],
  ]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texMap }));
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    group.add(sign);
  }

  // Outside-the-perimeter skyline landmarks (non-colliding, non-radar)
  for (const [sx, sz, h] of [[-28, -29, 22], [-5, -35, 25], [27, -30, 21]]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.55, h, 14), mats.skyDark);
    stack.position.set(sx, h * 0.5, sz);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.18, 1.1, 14), mats.skyAmber);
    band.position.set(sx, h - 3.2, sz);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mats.beacon);
    tip.position.set(sx, h + 0.3, sz);
    group.add(stack, band, tip);
  }
  for (const [rx, rz, r, h] of [[-18.5, -29.5, 3.2, 13.5], [-31.5, -10, 2.9, 12]]) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, h, 16), mats.skyTerra);
    silo.position.set(rx, h * 0.5, rz);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.9, 16), mats.skyDark);
    ring.position.set(rx, h * 0.72, rz);
    group.add(silo, ring);
  }
  for (const b of [
    [44, 1.1, 1.4, 0, 11.8, -28.5, 'skyDark', 31], [1.4, 12, 1.4, -14, 6, -28.5, 'skyDark', 31], [1.4, 12, 1.4, 14, 6, -28.5, 'skyDark', 31],
    [1.6, 21, 1.6, 29.5, 10.5, -20.5, 'skyDark', 31], [2.4, 1.8, 2.6, 29.5, 20.6, -20.5, 'skyAmber', 31],
    [0.14, 7.5, 0.14, 14.5, 17.6, -20.5, 'skyDark', 31], [1.2, 1.1, 1.2, 14.5, 13.6, -20.5, 'skyAmber', 31],
  ]) addBox(...b);
  addBox(19.5, 0.9, 1.1, 21.8, 21.8, -20.5, 'skyAmber', 31).rotation.z = -0.06;

  // Resonance Bomb Core 3D Model
  const bombCore = new THREE.Group();
  const coreBase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.4), mats.darkSteel);
  coreBase.position.y = 0.12;
  const coreRing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.34, 12), mats.skyAmber);
  coreRing.position.y = 0.32;
  const coreBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }));
  coreBeacon.position.y = 0.54;
  const bombLight = new THREE.PointLight(new THREE.Color(PALETTE.obsidian), 0, 11);
  bombLight.position.y = 0.8;
  bombCore.add(coreBase, coreRing, coreBeacon, bombLight);
  bombCore.visible = false;
  scene.add(bombCore);

  // Solstice Sunset Lighting
  scene.add(new THREE.HemisphereLight(new THREE.Color(PALETTE.rimCool), new THREE.Color(PALETTE.groundBounce), 1.65));
  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 2.75);
  sun.position.set(22, 24, 14);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 26, bottom: -26, far: 80 });
  sun.shadow.bias = -0.00042;
  const rim = new THREE.DirectionalLight(new THREE.Color(PALETTE.rimCool), 0.95);
  rim.position.set(-18, 15, -20);
  const siteALight = new THREE.PointLight(new THREE.Color(PALETTE.siteA), 7.5, 18);
  siteALight.position.set(-15, 3.4, -6);
  const siteBLight = new THREE.PointLight(new THREE.Color(PALETTE.siteB), 7.5, 18);
  siteBLight.position.set(15, 3.4, -6);
  scene.add(sun, sun.target, rim, siteALight, siteBLight);

  return {
    colliders, shootables, radarBoxes, group, bombCore, coreBeacon, bombLight,
    setBombPlanted(siteId) {
      if (!siteId) { bombCore.visible = false; bombLight.intensity = 0; return; }
      const site = getSiteById(siteId) ?? SITES[0];
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
