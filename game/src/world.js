// World facade: wraps map geometry and manages pre-allocated tracer, spark & smoke puff pools (zero per-frame GC).
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createFoundryMap, MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS } from './map.js';

export { MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS };

const TRACER_POOL_SIZE = 32;
const SPARK_POOL_SIZE = 36;
const SMOKE_POOL_SIZE = 28;

const _midVec = new THREE.Vector3();

export function createWorld(scene) {
  const map = createFoundryMap(scene);

  const tracers = [];
  const tracerGeom = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  tracerGeom.rotateX(Math.PI * 0.5);

  for (let i = 0; i < TRACER_POOL_SIZE; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.accent),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(tracerGeom, mat);
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, mat, life: 0, maxLife: 0.09 });
  }

  const sparks = [];
  const sparkGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
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

  const smokes = [];
  const smokeGeom = new THREE.SphereGeometry(0.32, 8, 6);
  for (let i = 0; i < SMOKE_POOL_SIZE; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.smoke),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(smokeGeom, mat);
    mesh.visible = false;
    scene.add(mesh);
    smokes.push({ mesh, mat, vel: new THREE.Vector3(), life: 0, maxLife: 0.75, baseScale: 1 });
  }

  let tracerCursor = 0;
  let sparkCursor = 0;
  let smokeCursor = 0;

  function spawnTracer(start, end, colorHex = PALETTE.accent, life = 0.09) {
    const t = tracers[tracerCursor];
    tracerCursor = (tracerCursor + 1) % TRACER_POOL_SIZE;
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;
    _midVec.addVectors(start, end).multiplyScalar(0.5);
    t.mesh.position.copy(_midVec);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.lookAt(end);
    t.mat.color.set(colorHex);
    t.mat.opacity = 0.94;
    t.mesh.visible = true;
    t.life = life;
    t.maxLife = life;
  }

  function spawnImpact(point, normal, colorHex = PALETTE.headGold, count = 5) {
    const nx = normal ? normal.x : 0;
    const ny = normal ? normal.y : 1;
    const nz = normal ? normal.z : 0;
    for (let i = 0; i < count; i += 1) {
      const s = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARK_POOL_SIZE;
      s.mesh.position.copy(point);
      s.mat.color.set(colorHex);
      s.mat.opacity = 1;
      s.mesh.visible = true;
      s.life = 0.26;
      s.maxLife = 0.26;
      s.vel.set(
        nx * 2.6 + Math.sin(i * 2.1 + point.x) * 2.8,
        ny * 2.6 + 1.6 + (i % 2) * 1.4,
        nz * 2.6 + Math.cos(i * 1.9 + point.z) * 2.8,
      );
    }
  }

  function spawnSmokeBurst(point, count = 6, colorHex = PALETTE.smoke, scale = 1.2) {
    for (let i = 0; i < count; i += 1) {
      const p = smokes[smokeCursor];
      smokeCursor = (smokeCursor + 1) % SMOKE_POOL_SIZE;
      const ang = (i / count) * Math.PI * 2;
      p.mesh.position.set(point.x + Math.cos(ang) * 0.45, Math.max(0.25, point.y + (i % 3) * 0.22), point.z + Math.sin(ang) * 0.45);
      p.mat.color.set(colorHex);
      p.mat.opacity = 0.62;
      p.mesh.visible = true;
      p.life = 0.8;
      p.maxLife = 0.8;
      p.baseScale = scale;
      p.mesh.scale.setScalar(scale * 0.7);
      p.vel.set(Math.cos(ang) * 1.5, 1.4 + (i % 2) * 0.7, Math.sin(ang) * 1.5);
    }
  }

  function step(dt, time, bombUrgency = 0) {
    for (let i = 0; i < TRACER_POOL_SIZE; i += 1) {
      const t = tracers[i];
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
      else t.mat.opacity = (t.life / t.maxLife) * 0.92;
    }
    for (let i = 0; i < SPARK_POOL_SIZE; i += 1) {
      const s = sparks[i];
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) s.mesh.visible = false;
      else {
        s.vel.y -= 12 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mat.opacity = s.life / s.maxLife;
      }
    }
    for (let i = 0; i < SMOKE_POOL_SIZE; i += 1) {
      const p = smokes[i];
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) p.mesh.visible = false;
      else {
        const k = 1 - p.life / p.maxLife;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - Math.min(1, dt * 2.5));
        p.mesh.scale.setScalar(p.baseScale * (0.7 + k * 1.8));
        p.mat.opacity = (1 - k) * 0.58;
      }
    }
    map.pulseBomb(time, bombUrgency);
  }

  function clearFx() {
    for (const t of tracers) t.mesh.visible = false;
    for (const s of sparks) s.mesh.visible = false;
    for (const p of smokes) p.mesh.visible = false;
  }

  return {
    colliders: map.colliders,
    shootables: map.shootables,
    radarBoxes: map.radarBoxes,
    group: map.group,
    setBombPlanted: map.setBombPlanted,
    spawnTracer,
    spawnImpact,
    spawnSmokeBurst,
    step,
    clearFx,
  };
}
