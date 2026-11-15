// Solstice Foundry: original 3-lane tactical arena (Site A Reactor Bay, Mid Archway, Site B Container Dock).
// Exports AABB colliders, shootables, bomb sites, team spawns, tactical waypoints, and radar walls.
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

// Navigation graph waypoints for bots across all 3 lanes & connectors
export const WAYPOINTS = [
  { id: 0, pos: new THREE.Vector3(0, 0, 16.5), links: [1, 2, 3] },        // Vanguard courtyard
  { id: 1, pos: new THREE.Vector3(-14.5, 0, 15.5), links: [0, 4] },       // A South approach
  { id: 2, pos: new THREE.Vector3(0, 0, 9.0), links: [0, 5, 6] },         // Mid South
  { id: 3, pos: new THREE.Vector3(14.5, 0, 15.5), links: [0, 7] },        // B South approach
  { id: 4, pos: new THREE.Vector3(-15.0, 0, 4.5), links: [1, 8, 9] },     // West Lane
  { id: 5, pos: new THREE.Vector3(-3.6, 0, 0.2), links: [2, 8, 10] },     // Mid West arch
  { id: 6, pos: new THREE.Vector3(3.6, 0, 0.2), links: [2, 10, 11] },     // Mid East arch
  { id: 7, pos: new THREE.Vector3(15.0, 0, 4.5), links: [3, 11, 12] },    // East Lane
  { id: 8, pos: new THREE.Vector3(-14.8, 0, -5.8), links: [4, 5, 9, 13] },// Site A Core
  { id: 9, pos: new THREE.Vector3(-18.2, 0, -1.0), links: [4, 8] },       // Site A Flank
  { id: 10, pos: new THREE.Vector3(0, 0, -11.5), links: [5, 6, 13, 14] }, // Mid North Plaza
  { id: 11, pos: new THREE.Vector3(11.5, 0, -0.5), links: [6, 7, 12] },   // East-Mid connector
  { id: 12, pos: new THREE.Vector3(15.2, 0, -6.0), links: [7, 11, 14] },  // Site B Core
  { id: 13, pos: new THREE.Vector3(-13.5, 0, -16.5), links: [8, 10, 15] },// North-West link
  { id: 14, pos: new THREE.Vector3(13.5, 0, -16.5), links: [10, 12, 15] },// North-East link
  { id: 15, pos: new THREE.Vector3(0, 0, -17.8), links: [13, 14] },       // Obsidian Base
];

export function createFoundryMap(scene) {
  const tex = createTextureSet();
  const group = new THREE.Group();
  scene.add(group);

  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.9, metalness: 0.05 }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.65, metalness: 0.35 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.55, metalness: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.concreteDark), roughness: 0.85, metalness: 0.08 }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.8, metalness: 0.05 }),
    amber: new THREE.MeshStandardMaterial({ map: tex.containerAmber, roughness: 0.58, metalness: 0.38 }),
    teal: new THREE.MeshStandardMaterial({ map: tex.containerTeal, roughness: 0.58, metalness: 0.38 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.72, metalness: 0.2 }),
    siteA: new THREE.MeshStandardMaterial({ map: tex.siteA, emissive: new THREE.Color(PALETTE.siteA), emissiveIntensity: 0.35 }),
    siteB: new THREE.MeshStandardMaterial({ map: tex.siteB, emissive: new THREE.Color(PALETTE.siteB), emissiveIntensity: 0.35 }),
    glowA: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.siteA), emissive: new THREE.Color(PALETTE.siteA), emissiveIntensity: 1.5 }),
    glowB: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.siteB), emissive: new THREE.Color(PALETTE.siteB), emissiveIntensity: 1.5 }),
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
    if (options.collide !== false) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
    }
    if (options.shoot !== false) {
      shootables.push(mesh);
    }
    if (options.radar !== false && y + h * 0.5 > 0.3) {
      radarBoxes.push({ x, z, w, d, h, color: matKey });
    }
    return mesh;
  }

  // Ground floor
  addBox(49, 0.4, 45, 0, -0.2, 0, 'floor', { shadow: false, radar: false });

  // Outer perimeter foundry walls
  addBox(1.0, 6.0, 45, -24.5, 3.0, 0, 'wall');
  addBox(1.0, 6.0, 45, 24.5, 3.0, 0, 'wall');
  addBox(49, 6.0, 1.0, 0, 3.0, -22.5, 'wall');
  addBox(49, 6.0, 1.0, 0, 3.0, 22.5, 'wall');

  // West Lane / Mid divider (X = -8.5)
  addBox(1.8, 4.4, 11.0, -8.5, 2.2, 7.5, 'wall');   // Z: +2 to +13
  addBox(1.8, 4.4, 9.5, -8.5, 2.2, -7.75, 'wall'); // Z: -12.5 to -3 (gap -3..+2 is West-Mid link)

  // East Lane / Mid divider (X = +8.5)
  addBox(1.8, 4.4, 10.0, 8.5, 2.2, 8.0, 'wall');   // Z: +3 to +13
  addBox(1.8, 4.4, 11.0, 8.5, 2.2, -7.5, 'wall');  // Z: -13 to -2 (gap -2..+3 is East-Mid link)

  // Mid Archway overhead structure (walkable clearance underneath: 3.6m high)
  addBox(1.4, 3.6, 1.6, -6.6, 1.8, -1.0, 'darkSteel');
  addBox(1.4, 3.6, 1.6, 6.6, 1.8, -1.0, 'darkSteel');
  addBox(15.2, 1.4, 2.2, 0, 4.3, -1.0, 'darkSteel', { radar: false });
  addBox(15.2, 0.25, 2.3, 0, 3.55, -1.0, 'amber', { radar: false });

  // Overhead industrial roof trusses for architectural depth
  for (const zBeam of [-15, -7, 7, 15]) {
    addBox(48, 0.45, 0.7, 0, 5.75, zBeam, 'darkSteel', { collide: false, shoot: false, radar: false });
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
  addBox(1.6, 3.0, 1.6, -13.5, 1.5, 2.2, 'darkSteel');
  addBox(1.8, 1.35, 1.8, -12.2, 0.675, -5.2, 'crate');
  addBox(2.4, 2.2, 1.8, -17.8, 1.1, -8.5, 'teal');
  // Walkable stepped crates at Site A West flank
  addBox(2.2, 0.55, 1.4, -20.5, 0.275, -3.0, 'crate');
  addBox(2.2, 1.1, 2.6, -20.5, 0.55, -5.0, 'crate');
  // Reactor Core visual tower behind Site A
  addBox(2.4, 3.8, 2.4, -15.0, 1.9, -11.8, 'darkSteel');
  addBox(1.1, 2.6, 1.1, -15.0, 1.8, -10.5, 'glowA', { collide: false, radar: false });

  // East Lane & Site B Container Dock
  addBox(2.5, 2.5, 4.4, 15.0, 1.25, 8.2, 'amber');
  addBox(2.4, 2.5, 3.4, 13.0, 1.25, -2.5, 'teal');
  addBox(2.0, 1.1, 1.2, 17.4, 0.55, -11.2, 'crate');
  // Walkable ramp-steps onto Site B Dock platform
  addBox(2.4, 0.55, 1.3, 19.6, 0.275, -4.4, 'crate');
  addBox(2.4, 1.15, 3.0, 19.6, 0.575, -6.55, 'amber');
  addBox(1.3, 1.3, 1.3, 19.6, 1.8, -7.2, 'crate');

  // Bomb Site Pads & Signage Decals
  for (const site of SITES) {
    addBox(3.4, 0.08, 3.4, site.center.x, 0.04, site.center.z, 'hazard', { collide: false, shoot: false, radar: false });
    const glowKey = site.id === 'A' ? 'glowA' : 'glowB';
    addBox(2.6, 0.03, 0.14, site.center.x, 0.08, site.center.z - 1.3, glowKey, { collide: false, shoot: false, radar: false });
    addBox(2.6, 0.03, 0.14, site.center.x, 0.08, site.center.z + 1.3, glowKey, { collide: false, shoot: false, radar: false });
    const decalMat = site.id === 'A' ? mats.siteA : mats.siteB;
    const signX = site.id === 'A' ? -9.45 : 9.45;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.3), decalMat);
    sign.position.set(signX, 2.4, -6.0);
    group.add(sign);
  }

  // Interactive Bomb Core 3D object (shown on planted site or carried)
  const bombCore = new THREE.Group();
  const coreBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.42, 12),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), metalness: 0.7, roughness: 0.3 }),
  );
  coreBody.position.y = 0.21;
  const coreBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }),
  );
  coreBeacon.position.y = 0.46;
  const bombLight = new THREE.PointLight(new THREE.Color(PALETTE.obsidian), 0, 9);
  bombLight.position.y = 0.7;
  bombCore.add(coreBody, coreBeacon, bombLight);
  bombCore.visible = false;
  scene.add(bombCore);

  // Lighting: industrial golden-hour sunlight + cool sky fill + Site A/B accent lights
  const hemi = new THREE.HemisphereLight(new THREE.Color(PALETTE.skyTop), new THREE.Color(PALETTE.skyHorizon), 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 2.35);
  sun.position.set(16, 26, 14);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.far = 72;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const rim = new THREE.DirectionalLight(new THREE.Color('#7aa2d4'), 0.65);
  rim.position.set(-14, 12, -16);
  scene.add(rim);

  const siteALight = new THREE.PointLight(new THREE.Color(PALETTE.siteA), 4.5, 16);
  siteALight.position.set(-15, 3.2, -6);
  const siteBLight = new THREE.PointLight(new THREE.Color(PALETTE.siteB), 4.5, 16);
  siteBLight.position.set(15, 3.2, -6);
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
      bombLight.intensity = 5;
    },
    pulseBomb(time, urgency) {
      if (!bombCore.visible) return;
      const pulse = Math.sin(time * (4 + urgency * 18)) > 0.25 ? 1 : 0.15;
      bombLight.intensity = 2 + pulse * 7;
      coreBeacon.scale.setScalar(0.85 + pulse * 0.45);
    },
  };
}
