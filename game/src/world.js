// World facade: wraps map geometry, tactical smoke-screen LOS occlusion, and pre-allocated FX pools.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createFoundryMap, getSiteById, getZoneName, MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS } from './map.js';

export { getSiteById, getZoneName, MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS };

const TRACERS = 44;
const SPARKS = 48;
const SMOKES = 32;
const SCREENS = 4;
const PUFFS = 14;
const _midVec = new THREE.Vector3();

export function createWorld(scene) {
  const map = createFoundryMap(scene);

  const makePool = (count, geom, makeMat, extra) => {
    const arr = [];
    for (let i = 0; i < count; i += 1) {
      const mat = makeMat(i);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.visible = false;
      scene.add(mesh);
      arr.push({ mesh, mat, life: 0, maxLife: 0.25, ...extra(i) });
    }
    return arr;
  };

  const tracerGeom = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  tracerGeom.rotateX(Math.PI * 0.5);
  const tracers = makePool(
    TRACERS, tracerGeom,
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.92, depthWrite: false }),
    () => ({}),
  );
  const sparks = makePool(
    SPARKS, new THREE.BoxGeometry(0.075, 0.075, 0.075),
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.headGold), transparent: true, opacity: 1, depthWrite: false }),
    () => ({ vel: new THREE.Vector3() }),
  );
  const smokes = makePool(
    SMOKES, new THREE.SphereGeometry(0.32, 8, 6),
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.smoke), transparent: true, opacity: 0.55, depthWrite: false }),
    () => ({ vel: new THREE.Vector3(), baseScale: 1 }),
  );

  const screenPuffGeom = new THREE.SphereGeometry(0.95, 10, 8);
  const smokeScreens = [];
  for (let s = 0; s < SCREENS; s += 1) {
    const puffs = makePool(
      PUFFS, screenPuffGeom,
      (p) => new THREE.MeshLambertMaterial({ color: new THREE.Color(p % 3 === 0 ? '#bac5d4' : p % 3 === 1 ? PALETTE.smoke : '#dce4ee'), transparent: true, opacity: 0, depthWrite: false }),
      (p) => ({ offset: new THREE.Vector3(), phase: p * 0.85 + s, baseScale: 1 }),
    );
    smokeScreens.push({ active: false, center: new THREE.Vector3(), radius: 3.25, life: 0, maxLife: 14, puffs });
  }

  let tCur = 0;
  let spCur = 0;
  let smCur = 0;
  let scCur = 0;

  function spawnTracer(start, end, colorHex = PALETTE.accent, life = 0.09) {
    const t = tracers[tCur];
    tCur = (tCur + 1) % TRACERS;
    if (start.distanceTo(end) < 0.05) return;
    _midVec.addVectors(start, end).multiplyScalar(0.5);
    t.mesh.position.copy(_midVec);
    t.mesh.scale.set(1, 1, start.distanceTo(end));
    t.mesh.lookAt(end);
    t.mat.color.set(colorHex);
    t.mat.opacity = 0.94;
    t.mesh.visible = true;
    t.life = life; t.maxLife = life;
  }

  function spawnImpact(point, normal, colorHex = PALETTE.headGold, count = 5) {
    const nx = normal ? normal.x : 0;
    const ny = normal ? normal.y : 1;
    const nz = normal ? normal.z : 0;
    for (let i = 0; i < count; i += 1) {
      const s = sparks[spCur];
      spCur = (spCur + 1) % SPARKS;
      s.mesh.position.copy(point);
      s.mat.color.set(colorHex);
      s.mat.opacity = 1;
      s.mesh.visible = true;
      s.life = 0.28; s.maxLife = 0.28;
      s.vel.set(nx * 2.8 + Math.sin(i * 2.1 + point.x) * 3.1, ny * 2.8 + 1.8 + (i % 2) * 1.6, nz * 2.8 + Math.cos(i * 1.9 + point.z) * 3.1);
    }
  }

  function spawnSmokeBurst(point, count = 6, colorHex = PALETTE.smoke, scale = 1.1) {
    for (let i = 0; i < count; i += 1) {
      const p = smokes[smCur];
      smCur = (smCur + 1) % SMOKES;
      const ang = (i / count) * Math.PI * 2;
      p.mesh.position.set(point.x + Math.cos(ang) * 0.45, Math.max(0.25, point.y + (i % 3) * 0.2), point.z + Math.sin(ang) * 0.45);
      p.mat.color.set(colorHex);
      p.mat.opacity = 0.56;
      p.mesh.visible = true;
      p.life = 0.75; p.maxLife = 0.75; p.baseScale = scale;
      p.mesh.scale.setScalar(scale * 0.65);
      p.vel.set(Math.cos(ang) * 1.4, 1.3 + (i % 2) * 0.65, Math.sin(ang) * 1.4);
    }
  }

  function spawnSmokeScreen(center, radius = 3.25, duration = 14.0) {
    let slot = null;
    for (let i = 0; i < SCREENS; i += 1) if (!smokeScreens[i].active) { slot = smokeScreens[i]; break; }
    if (!slot) { slot = smokeScreens[scCur]; scCur = (scCur + 1) % SCREENS; }
    slot.active = true;
    slot.center.set(center.x, Math.max(0.15, center.y), center.z);
    slot.radius = radius; slot.life = duration; slot.maxLife = duration;
    for (let i = 0; i < PUFFS; i += 1) {
      const puff = slot.puffs[i];
      const ring = i < 4 ? 0.35 : i < 10 ? 1.55 : 2.3;
      const ang = i * 2.39996;
      const ox = Math.cos(ang) * ring * (radius / 3.25);
      const oz = Math.sin(ang) * ring * (radius / 3.25);
      const oy = 0.65 + (i % 3) * 0.62;
      puff.offset.set(ox, oy, oz);
      puff.baseScale = i < 4 ? 1.42 : 1.15 + (i % 3) * 0.16;
      puff.mesh.position.set(slot.center.x + ox, slot.center.y + oy, slot.center.z + oz);
      puff.mesh.scale.setScalar(puff.baseScale * 0.45);
      puff.mat.opacity = 0.18;
      puff.mesh.visible = true;
    }
  }

  function isBlockedBySmoke(fromPos, toPos) {
    const ax = fromPos.x, ay = fromPos.y, az = fromPos.z;
    const dx = toPos.x - ax, dy = toPos.y - ay, dz = toPos.z - az;
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq < 0.0001) return false;
    for (let i = 0; i < SCREENS; i += 1) {
      const s = smokeScreens[i];
      if (!s.active || s.life <= 0.65) continue;
      const cx = s.center.x, cy = s.center.y + 1.15, cz = s.center.z;
      let t = ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / lenSq;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const px = ax + dx * t - cx, py = ay + dy * t - cy, pz = az + dz * t - cz;
      const r = s.radius * 0.92;
      if (px * px + py * py + pz * pz <= r * r) return true;
    }
    return false;
  }

  function step(dt, time, bombUrgency = 0) {
    for (let i = 0; i < TRACERS; i += 1) {
      const t = tracers[i];
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
      else t.mat.opacity = (t.life / t.maxLife) * 0.92;
    }
    for (let i = 0; i < SPARKS; i += 1) {
      const s = sparks[i];
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) s.mesh.visible = false;
      else { s.vel.y -= 12 * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mat.opacity = s.life / s.maxLife; }
    }
    for (let i = 0; i < SMOKES; i += 1) {
      const p = smokes[i];
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) p.mesh.visible = false;
      else {
        const k = 1 - p.life / p.maxLife;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - Math.min(1, dt * 2.5));
        p.mesh.scale.setScalar(p.baseScale * (0.65 + k * 1.55));
        p.mat.opacity = (1 - k) * 0.54;
      }
    }
    for (let i = 0; i < SCREENS; i += 1) {
      const s = smokeScreens[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        for (let j = 0; j < PUFFS; j += 1) s.puffs[j].mesh.visible = false;
        continue;
      }
      const grow = Math.min(1, (s.maxLife - s.life) / 0.55);
      const alpha = 0.68 * grow * (s.life < 2.2 ? s.life / 2.2 : 1);
      for (let j = 0; j < PUFFS; j += 1) {
        const pf = s.puffs[j];
        pf.mesh.position.set(
          s.center.x + pf.offset.x + Math.sin(time * 0.9 + pf.phase) * 0.16,
          s.center.y + pf.offset.y + Math.cos(time * 0.7 + pf.phase) * 0.1,
          s.center.z + pf.offset.z,
        );
        pf.mesh.scale.setScalar(pf.baseScale * (0.45 + 0.58 * grow));
        pf.mat.opacity = alpha;
      }
    }
    map.pulseBomb(time, bombUrgency);
  }

  function clearFx() {
    for (let i = 0; i < TRACERS; i += 1) tracers[i].mesh.visible = false;
    for (let i = 0; i < SPARKS; i += 1) sparks[i].mesh.visible = false;
    for (let i = 0; i < SMOKES; i += 1) smokes[i].mesh.visible = false;
    for (let i = 0; i < SCREENS; i += 1) {
      smokeScreens[i].active = false;
      for (let j = 0; j < PUFFS; j += 1) smokeScreens[i].puffs[j].mesh.visible = false;
    }
  }

  return {
    colliders: map.colliders, shootables: map.shootables, radarBoxes: map.radarBoxes, group: map.group,
    setBombPlanted: map.setBombPlanted, spawnTracer, spawnImpact, spawnSmokeBurst, spawnSmokeScreen, isBlockedBySmoke, step, clearFx,
  };
}
