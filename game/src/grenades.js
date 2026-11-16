// Pre-allocated Utility Grenade Pool (Frag HE, Smoke, Flash) with shockwave ring & spark-streak FX.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GRAVITY = 18.5;
const THROW_SPEED = 16.5;
const BLAST_RADIUS = 7.2;
const MAX_DAMAGE = 96;
const R = 0.14;
const MAX_G = 6;
const MAX_B = 6;
const SHARDS = 8;

const FUSE = { frag: 1.6, smoke: 1.15, flash: 1.05 };
const COLOR = { frag: PALETTE.obsidian, smoke: PALETTE.vanguard, flash: PALETTE.headGold };

const _probe = new THREE.Box3();
const _blastPos = new THREE.Vector3();
const _dirNorm = new THREE.Vector3();

export function createGrenades(scene, colliders) {
  const bodyGeom = new THREE.CylinderGeometry(0.095, 0.095, 0.24, 10);
  const beaconGeom = new THREE.SphereGeometry(0.055, 8, 6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2c3b35'), roughness: 0.44, metalness: 0.46 });
  const emberGeom = new THREE.OctahedronGeometry(0.24, 0);
  const ringGeom = new THREE.RingGeometry(0.76, 1.0, 28);
  ringGeom.rotateX(-Math.PI * 0.5);
  const shardGeom = new THREE.BoxGeometry(0.036, 0.036, 0.34);

  const grenadePool = [];
  for (let i = 0; i < MAX_G; i += 1) {
    const group = new THREE.Group();
    const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.y = 0.14;
    group.add(new THREE.Mesh(bodyGeom, bodyMat), beacon);
    group.visible = false;
    scene.add(group);
    grenadePool.push({ active: false, group, pos: group.position, vel: new THREE.Vector3(), fuse: 0, kind: 'frag', throwerTeam: 'vanguard', beaconMat });
  }

  const blastPool = [];
  for (let i = 0; i < MAX_B; i += 1) {
    const group = new THREE.Group();
    const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d2'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.headGold), transparent: true, opacity: 0.9, depthWrite: false });
    const ember = new THREE.Mesh(emberGeom, emberMat);
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 0.06;
    group.add(ember, ring);
    const shards = [];
    for (let s = 0; s < SHARDS; s += 1) {
      const mesh = new THREE.Mesh(shardGeom, shardMat);
      group.add(mesh);
      shards.push({ mesh, vel: new THREE.Vector3() });
    }
    group.visible = false;
    scene.add(group);
    blastPool.push({ active: false, group, ember, ring, emberMat, ringMat, shardMat, shards, life: 0, maxLife: 0.38 });
  }

  function bounceAxis(pos, vel, axis) {
    _probe.min.set(pos.x - R, pos.y - R, pos.z - R);
    _probe.max.set(pos.x + R, pos.y + R, pos.z + R);
    for (let i = 0; i < colliders.length; i += 1) {
      if (_probe.intersectsBox(colliders[i])) { vel[axis] *= -0.48; return true; }
    }
    return false;
  }

  function spawn(origin, dir, throwerTeam = 'vanguard', kind = 'frag', fuseOverride = null) {
    let slot = grenadePool[0];
    for (let i = 0; i < MAX_G; i += 1) if (!grenadePool[i].active) { slot = grenadePool[i]; break; }
    slot.active = true;
    slot.kind = kind;
    slot.pos.copy(origin);
    _dirNorm.set(dir.x, dir.y + 0.25, dir.z).normalize().multiplyScalar(THROW_SPEED);
    slot.vel.copy(_dirNorm);
    slot.fuse = fuseOverride ?? (FUSE[kind] ?? 1.5);
    slot.throwerTeam = throwerTeam;
    slot.beaconMat.color.set(COLOR[kind] ?? PALETTE.obsidian);
    slot.group.visible = true;
  }

  function spawnBlastVisual(pos, kind) {
    let b = blastPool[0];
    for (let i = 0; i < MAX_B; i += 1) if (!blastPool[i].active) { b = blastPool[i]; break; }
    b.active = true;
    b.group.position.copy(pos);
    b.group.visible = true;
    b.life = b.maxLife;
    b.ember.scale.setScalar(kind === 'flash' ? 1.15 : 0.9);
    b.ember.visible = kind !== 'smoke';
    b.emberMat.color.set(kind === 'flash' ? '#ffffff' : '#ffecd1');
    b.ringMat.color.set(kind === 'smoke' ? PALETTE.vanguard : kind === 'flash' ? '#ffffff' : PALETTE.accent);
    b.shardMat.color.set(kind === 'flash' ? '#e0f2fe' : PALETTE.headGold);
    b.ring.scale.setScalar(0.6);
    b.ring.position.y = Math.max(0.06 - pos.y, -pos.y + 0.06);
    for (let s = 0; s < SHARDS; s += 1) {
      const sh = b.shards[s];
      sh.mesh.visible = kind !== 'smoke';
      sh.mesh.position.set(0, 0.12, 0);
      const ang = (s / SHARDS) * Math.PI * 2 + pos.x * 0.4;
      const spd = kind === 'flash' ? 7.5 : 10.5;
      sh.vel.set(Math.cos(ang) * spd, 3.5 + (s % 2) * 2.5, Math.sin(ang) * spd);
      sh.mesh.rotation.set(0, -ang + Math.PI * 0.5, 0);
    }
  }

  function step(dt, onDetonate) {
    for (let i = 0; i < MAX_G; i += 1) {
      const g = grenadePool[i];
      if (!g.active) continue;
      g.fuse -= dt;
      g.vel.y -= GRAVITY * dt;
      const px = g.pos.x; g.pos.x += g.vel.x * dt;
      if (bounceAxis(g.pos, g.vel, 'x')) g.pos.x = px;
      const pz = g.pos.z; g.pos.z += g.vel.z * dt;
      if (bounceAxis(g.pos, g.vel, 'z')) g.pos.z = pz;
      const py = g.pos.y; g.pos.y += g.vel.y * dt;
      if (g.pos.y < R || bounceAxis(g.pos, g.vel, 'y')) {
        g.pos.y = Math.max(R, py);
        if (Math.abs(g.vel.y) < 1.2) g.vel.y = 0;
        g.vel.x *= 0.72; g.vel.z *= 0.72;
      }
      g.group.rotation.x += dt * 7;
      g.group.rotation.z += dt * 5;
      if (g.fuse <= 0) {
        _blastPos.copy(g.pos);
        const { throwerTeam, kind } = g;
        g.active = false; g.group.visible = false;
        spawnBlastVisual(_blastPos, kind);
        if (onDetonate) onDetonate(_blastPos, kind, BLAST_RADIUS, MAX_DAMAGE, throwerTeam);
      }
    }
    for (let i = 0; i < MAX_B; i += 1) {
      const b = blastPool[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) { b.active = false; b.group.visible = false; continue; }
      const t = 1 - b.life / b.maxLife;
      b.ring.scale.setScalar(0.75 + t * 4.8);
      b.ringMat.opacity = (1 - t) * 0.72;
      b.ember.scale.setScalar(0.55 + t * 0.65);
      b.emberMat.opacity = Math.max(0, 1 - t * 2.5) * 0.92;
      b.shardMat.opacity = Math.max(0, 1 - t * 1.2);
      for (let s = 0; s < SHARDS; s += 1) {
        const sh = b.shards[s];
        if (!sh.mesh.visible) continue;
        sh.vel.y -= 16 * dt;
        sh.mesh.position.addScaledVector(sh.vel, dt);
      }
    }
  }

  function clear() {
    for (let i = 0; i < MAX_G; i += 1) { grenadePool[i].active = false; grenadePool[i].group.visible = false; }
    for (let i = 0; i < MAX_B; i += 1) { blastPool[i].active = false; blastPool[i].group.visible = false; }
  }

  return { spawn, step, clear };
}
