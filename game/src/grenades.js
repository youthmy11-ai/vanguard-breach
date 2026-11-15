// Frag/HE Grenade system: arc physics, AABB collider bounces, fuse countdown, blast FX & falloff damage.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GRAVITY = 18.5;
const THROW_SPEED = 16.5;
const FUSE_TIME = 1.65;
const BLAST_RADIUS = 7.2;
const MAX_DAMAGE = 96;
const GRENADE_RADIUS = 0.14;

export function createGrenades(scene, colliders) {
  const active = [];
  const blasts = [];
  const bodyGeom = new THREE.SphereGeometry(GRENADE_RADIUS, 10, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f4238'), roughness: 0.45, metalness: 0.4 });
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) });
  const blastGeom = new THREE.SphereGeometry(1, 16, 12);
  const probe = new THREE.Box3();

  function bounceAxis(pos, vel, axis) {
    probe.min.set(pos.x - GRENADE_RADIUS, pos.y - GRENADE_RADIUS, pos.z - GRENADE_RADIUS);
    probe.max.set(pos.x + GRENADE_RADIUS, pos.y + GRENADE_RADIUS, pos.z + GRENADE_RADIUS);
    for (let i = 0; i < colliders.length; i += 1) {
      if (probe.intersectsBox(colliders[i])) {
        vel[axis] *= -0.48;
        return true;
      }
    }
    return false;
  }

  function spawn(origin, dir, throwerTeam = 'vanguard') {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(bodyGeom, bodyMat);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), ringMat);
    beacon.position.y = 0.12;
    group.add(shell, beacon);
    group.position.copy(origin);
    scene.add(group);

    const vel = new THREE.Vector3(dir.x, dir.y + 0.26, dir.z).normalize().multiplyScalar(THROW_SPEED);
    active.push({ group, pos: group.position, vel, fuse: FUSE_TIME, throwerTeam });
  }

  function spawnBlastVisual(pos) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.accent),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(blastGeom, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.4);
    scene.add(mesh);
    blasts.push({ mesh, mat, life: 0.34, maxLife: 0.34 });
  }

  function step(dt, onDetonate) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const g = active[i];
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
        const blastPos = g.pos.clone();
        const team = g.throwerTeam;
        scene.remove(g.group);
        active.splice(i, 1);
        spawnBlastVisual(blastPos);
        if (onDetonate) onDetonate(blastPos, BLAST_RADIUS, MAX_DAMAGE, team);
      }
    }

    for (let i = blasts.length - 1; i >= 0; i -= 1) {
      const b = blasts[i];
      b.life -= dt;
      if (b.life <= 0) {
        scene.remove(b.mesh);
        b.mat.dispose();
        blasts.splice(i, 1);
      } else {
        const t = 1 - b.life / b.maxLife;
        b.mesh.scale.setScalar(0.5 + t * 5.2);
        b.mat.opacity = (1 - t) * 0.75;
      }
    }
  }

  function clear() {
    for (const g of active) scene.remove(g.group);
    active.length = 0;
    for (const b of blasts) {
      scene.remove(b.mesh);
      b.mat.dispose();
    }
    blasts.length = 0;
  }

  return { spawn, step, clear };
}
