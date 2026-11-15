// Pre-allocated Frag/HE Grenade & Blast Pool: arc physics, AABB bounces, fuse countdown & fireball FX (zero per-frame GC).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GRAVITY = 18.5;
const THROW_SPEED = 16.5;
const FUSE_TIME = 1.65;
const BLAST_RADIUS = 7.4;
const MAX_DAMAGE = 96;
const GRENADE_RADIUS = 0.14;
const MAX_GRENADES = 6;
const MAX_BLASTS = 6;

const _probe = new THREE.Box3();
const _blastPos = new THREE.Vector3();
const _dirNorm = new THREE.Vector3();

export function createGrenades(scene, colliders) {
  const bodyGeom = new THREE.SphereGeometry(GRENADE_RADIUS, 10, 8);
  const beaconGeom = new THREE.SphereGeometry(0.055, 8, 6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f4238'), roughness: 0.42, metalness: 0.45 });
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) });

  const sphereGeom = new THREE.SphereGeometry(1, 16, 12);
  const ringGeom = new THREE.RingGeometry(0.65, 1.0, 24);
  ringGeom.rotateX(-Math.PI * 0.5);

  const grenadePool = [];
  for (let i = 0; i < MAX_GRENADES; i += 1) {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(bodyGeom, bodyMat);
    const beacon = new THREE.Mesh(beaconGeom, ringMat);
    beacon.position.y = 0.12;
    group.add(shell, beacon);
    group.visible = false;
    scene.add(group);
    grenadePool.push({
      active: false,
      group,
      pos: group.position,
      vel: new THREE.Vector3(),
      fuse: 0,
      throwerTeam: 'vanguard',
    });
  }

  const blastPool = [];
  for (let i = 0; i < MAX_BLASTS; i += 1) {
    const group = new THREE.Group();
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff4d2'),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.accent),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringBlastMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.obsidian),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const inner = new THREE.Mesh(sphereGeom, innerMat);
    const outer = new THREE.Mesh(sphereGeom, outerMat);
    const ring = new THREE.Mesh(ringGeom, ringBlastMat);
    ring.position.y = 0.06;
    group.add(outer, inner, ring);
    group.visible = false;
    scene.add(group);
    blastPool.push({
      active: false,
      group,
      inner,
      outer,
      ring,
      innerMat,
      outerMat,
      ringBlastMat,
      life: 0,
      maxLife: 0.42,
    });
  }

  function bounceAxis(pos, vel, axis) {
    _probe.min.set(pos.x - GRENADE_RADIUS, pos.y - GRENADE_RADIUS, pos.z - GRENADE_RADIUS);
    _probe.max.set(pos.x + GRENADE_RADIUS, pos.y + GRENADE_RADIUS, pos.z + GRENADE_RADIUS);
    for (let i = 0; i < colliders.length; i += 1) {
      if (_probe.intersectsBox(colliders[i])) {
        vel[axis] *= -0.48;
        return true;
      }
    }
    return false;
  }

  function spawn(origin, dir, throwerTeam = 'vanguard', fuse = FUSE_TIME) {
    let slot = grenadePool[0];
    for (let i = 0; i < MAX_GRENADES; i += 1) {
      if (!grenadePool[i].active) {
        slot = grenadePool[i];
        break;
      }
    }
    slot.active = true;
    slot.pos.copy(origin);
    _dirNorm.set(dir.x, dir.y + 0.25, dir.z).normalize().multiplyScalar(THROW_SPEED);
    slot.vel.copy(_dirNorm);
    slot.fuse = fuse;
    slot.throwerTeam = throwerTeam;
    slot.group.visible = true;
  }

  function spawnBlastVisual(pos) {
    let b = blastPool[0];
    for (let i = 0; i < MAX_BLASTS; i += 1) {
      if (!blastPool[i].active) {
        b = blastPool[i];
        break;
      }
    }
    b.active = true;
    b.group.position.copy(pos);
    b.group.visible = true;
    b.life = b.maxLife;
    b.inner.scale.setScalar(0.5);
    b.outer.scale.setScalar(0.8);
    b.ring.scale.setScalar(0.8);
    b.ring.position.y = Math.max(0.06 - pos.y, -pos.y + 0.06);
  }

  function step(dt, onDetonate) {
    for (let i = 0; i < MAX_GRENADES; i += 1) {
      const g = grenadePool[i];
      if (!g.active) continue;
      g.fuse -= dt;
      g.vel.y -= GRAVITY * dt;

      const prevX = g.pos.x;
      g.pos.x += g.vel.x * dt;
      if (bounceAxis(g.pos, g.vel, 'x')) g.pos.x = prevX;

      const prevZ = g.pos.z;
      g.pos.z += g.vel.z * dt;
      if (bounceAxis(g.pos, g.vel, 'z')) g.pos.z = prevZ;

      const prevY = g.pos.y;
      g.pos.y += g.vel.y * dt;
      if (g.pos.y < GRENADE_RADIUS || bounceAxis(g.pos, g.vel, 'y')) {
        g.pos.y = Math.max(GRENADE_RADIUS, prevY);
        if (Math.abs(g.vel.y) < 1.2) g.vel.y = 0;
        g.vel.x *= 0.72;
        g.vel.z *= 0.72;
      }

      g.group.rotation.x += dt * 7;
      g.group.rotation.z += dt * 5;

      if (g.fuse <= 0) {
        _blastPos.copy(g.pos);
        const team = g.throwerTeam;
        g.active = false;
        g.group.visible = false;
        spawnBlastVisual(_blastPos);
        if (onDetonate) onDetonate(_blastPos, BLAST_RADIUS, MAX_DAMAGE, team);
      }
    }

    for (let i = 0; i < MAX_BLASTS; i += 1) {
      const b = blastPool[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        b.group.visible = false;
      } else {
        const t = 1 - b.life / b.maxLife;
        b.inner.scale.setScalar(0.55 + t * 2.5);
        b.outer.scale.setScalar(0.85 + t * 4.2);
        b.ring.scale.setScalar(1.0 + t * 5.8);
        b.innerMat.opacity = (1 - t) * 0.92;
        b.outerMat.opacity = (1 - t) * 0.76;
        b.ringBlastMat.opacity = (1 - t) * 0.62;
      }
    }
  }

  function clear() {
    for (let i = 0; i < MAX_GRENADES; i += 1) {
      grenadePool[i].active = false;
      grenadePool[i].group.visible = false;
    }
    for (let i = 0; i < MAX_BLASTS; i += 1) {
      blastPool[i].active = false;
      blastPool[i].group.visible = false;
    }
  }

  return { spawn, step, clear };
}
