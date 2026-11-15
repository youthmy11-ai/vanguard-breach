// World facade: wraps map geometry and manages pooled bullet tracers and impact sparks with zero per-frame GC.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createFoundryMap, MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS } from './map.js';

export { MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS };

const TRACER_POOL_SIZE = 28;
const SPARK_POOL_SIZE = 32;

export function createWorld(scene) {
  const map = createFoundryMap(scene);

  // Pooled tracer beams
  const tracers = [];
  const tracerGeom = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
  tracerGeom.rotateX(Math.PI * 0.5);
  const midVec = new THREE.Vector3();

  for (let i = 0; i < TRACER_POOL_SIZE; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.accent),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(tracerGeom, mat);
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, mat, life: 0, maxLife: 0.09 });
  }

  // Pooled impact sparks
  const sparks = [];
  const sparkGeom = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  for (let i = 0; i < SPARK_POOL_SIZE; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.headGold),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(sparkGeom, mat);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, mat, vel: new THREE.Vector3(), life: 0, maxLife: 0.28 });
  }

  let tracerCursor = 0;
  let sparkCursor = 0;

  function spawnTracer(start, end, colorHex = PALETTE.accent, life = 0.09) {
    const t = tracers[tracerCursor];
    tracerCursor = (tracerCursor + 1) % TRACER_POOL_SIZE;
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;
    midVec.addVectors(start, end).multiplyScalar(0.5);
    t.mesh.position.copy(midVec);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.lookAt(end);
    t.mat.color.set(colorHex);
    t.mat.opacity = 0.92;
    t.mesh.visible = true;
    t.life = life;
    t.maxLife = life;
  }

  function spawnImpact(point, normal, colorHex = PALETTE.headGold, count = 4) {
    for (let i = 0; i < count; i += 1) {
      const s = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARK_POOL_SIZE;
      s.mesh.position.copy(point);
      s.mat.color.set(colorHex);
      s.mat.opacity = 1;
      s.mesh.visible = true;
      s.life = 0.24;
      s.maxLife = 0.24;
      const spread = 2.6;
      const nx = normal ? normal.x : 0;
      const ny = normal ? normal.y : 1;
      const nz = normal ? normal.z : 0;
      s.vel.set(
        nx * 2.5 + (Math.sin(i * 2.1 + point.x) * spread),
        ny * 2.5 + 1.5 + (i % 2) * 1.4,
        nz * 2.5 + (Math.cos(i * 1.9 + point.z) * spread),
      );
    }
  }

  function step(dt, time, bombUrgency = 0) {
    for (let i = 0; i < TRACER_POOL_SIZE; i += 1) {
      const t = tracers[i];
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.mesh.visible = false;
      } else {
        t.mat.opacity = (t.life / t.maxLife) * 0.9;
      }
    }
    for (let i = 0; i < SPARK_POOL_SIZE; i += 1) {
      const s = sparks[i];
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
      } else {
        s.vel.y -= 12 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mat.opacity = s.life / s.maxLife;
      }
    }
    map.pulseBomb(time, bombUrgency);
  }

  function clearFx() {
    for (const t of tracers) t.mesh.visible = false;
    for (const s of sparks) s.mesh.visible = false;
  }

  return {
    colliders: map.colliders,
    shootables: map.shootables,
    radarBoxes: map.radarBoxes,
    group: map.group,
    setBombPlanted: map.setBombPlanted,
    spawnTracer,
    spawnImpact,
    step,
    clearFx,
  };
}
