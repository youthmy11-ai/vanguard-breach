// Tactical AI Bots: articulated armor/helmets/pauldrons/carbines, separate Head/Torso/Limb hitboxes,
// precomputed waypoint routing (zero hot-loop allocations), sound awareness & bomb AI.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS } from './map.js';

const BOT_RADIUS = 0.36;
const BOT_HP = 100;

const _probe = new THREE.Box3();
const _losRay = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _eyeA = new THREE.Vector3();
const _eyeB = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();

// Precompute 16x16 shortest-hop navigation table once at boot (zero per-frame Set/Array GC)
const NEXT_HOP = WAYPOINTS.map((_, fromId) => {
  const row = new Int8Array(WAYPOINTS.length);
  for (let targetId = 0; targetId < WAYPOINTS.length; targetId += 1) {
    if (fromId === targetId) {
      row[targetId] = targetId;
      continue;
    }
    const visited = new Uint8Array(WAYPOINTS.length);
    visited[fromId] = 1;
    const queue = [[fromId, -1]];
    let found = fromId;
    while (queue.length > 0) {
      const [cur, first] = queue.shift();
      for (const nxt of WAYPOINTS[cur].links) {
        const hop = first === -1 ? nxt : first;
        if (nxt === targetId) {
          found = hop;
          queue.length = 0;
          break;
        }
        if (!visited[nxt]) {
          visited[nxt] = 1;
          queue.push([nxt, hop]);
        }
      }
    }
    row[targetId] = found;
  }
  return row;
});

export function createBots(scene, world, random) {
  const bots = [];
  const hitMeshes = [];

  const shared = {
    torsoGeo: new THREE.BoxGeometry(0.46, 0.68, 0.28),
    plateGeo: new THREE.BoxGeometry(0.5, 0.44, 0.33),
    pauldronGeo: new THREE.BoxGeometry(0.18, 0.16, 0.24),
    packGeo: new THREE.BoxGeometry(0.28, 0.4, 0.14),
    antennaGeo: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6),
    headGeo: new THREE.SphereGeometry(0.155, 14, 10),
    helmetGeo: new THREE.BoxGeometry(0.32, 0.13, 0.34),
    visorGeo: new THREE.BoxGeometry(0.27, 0.085, 0.14),
    armGeo: new THREE.BoxGeometry(0.135, 0.52, 0.145),
    legGeo: new THREE.BoxGeometry(0.17, 0.66, 0.19),
    kneeGeo: new THREE.BoxGeometry(0.185, 0.14, 0.21),
    gunBodyGeo: new THREE.BoxGeometry(0.075, 0.095, 0.48),
    gunBarrelGeo: new THREE.BoxGeometry(0.036, 0.036, 0.32),
    gunMagGeo: new THREE.BoxGeometry(0.044, 0.13, 0.06),
    flashGeo: new THREE.SphereGeometry(0.095, 6, 6),
    gunMat: new THREE.MeshStandardMaterial({ color: new THREE.Color('#202733'), roughness: 0.45, metalness: 0.65 }),
    barrelMat: new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a5568'), roughness: 0.35, metalness: 0.78 }),
    flashMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  };

  const teamStyles = {
    vanguard: {
      armor: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.vanguardArmor), roughness: 0.5, metalness: 0.35 }),
      plate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d354d'), roughness: 0.58, metalness: 0.28 }),
      limb: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a2433'), roughness: 0.75 }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.vanguard) }),
      names: ['Kestrel', 'Nova', 'Aegis'],
    },
    obsidian: {
      armor: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.obsidianArmor), roughness: 0.5, metalness: 0.35 }),
      plate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2d1b1e'), roughness: 0.58, metalness: 0.28 }),
      limb: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e1a1e'), roughness: 0.75 }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }),
      names: ['Viper', 'Cipher', 'Dusk', 'Talon'],
    },
  };

  function buildBot(team, slotIndex, name) {
    const style = teamStyles[team];
    const armorMat = style.armor.clone();
    const headMat = style.armor.clone();
    const group = new THREE.Group();

    const legL = new THREE.Mesh(shared.legGeo, style.limb);
    legL.position.set(-0.13, 0.33, 0);
    const kneeL = new THREE.Mesh(shared.kneeGeo, armorMat);
    kneeL.position.set(0, 0.04, -0.02);
    legL.add(kneeL);

    const legR = new THREE.Mesh(shared.legGeo, style.limb);
    legR.position.set(0.13, 0.33, 0);
    const kneeR = new THREE.Mesh(shared.kneeGeo, armorMat);
    kneeR.position.set(0, 0.04, -0.02);
    legR.add(kneeR);

    const torso = new THREE.Mesh(shared.torsoGeo, armorMat);
    torso.position.set(0, 1.02, 0);
    const plate = new THREE.Mesh(shared.plateGeo, style.plate);
    plate.position.set(0, 1.07, 0);
    const pauldronL = new THREE.Mesh(shared.pauldronGeo, armorMat);
    pauldronL.position.set(-0.33, 1.24, 0);
    const pauldronR = new THREE.Mesh(shared.pauldronGeo, armorMat);
    pauldronR.position.set(0.33, 1.24, 0);
    const pack = new THREE.Mesh(shared.packGeo, style.plate);
    pack.position.set(0, 1.08, 0.19);
    const antenna = new THREE.Mesh(shared.antennaGeo, shared.barrelMat);
    antenna.position.set(-0.08, 1.38, 0.21);

    const armL = new THREE.Mesh(shared.armGeo, style.limb);
    armL.position.set(-0.29, 1.02, -0.1);
    armL.rotation.set(0.45, 0, -0.2);
    const armR = new THREE.Mesh(shared.armGeo, style.limb);
    armR.position.set(0.3, 1.02, -0.14);
    armR.rotation.x = 0.62;

    const gun = new THREE.Group();
    gun.position.set(0.24, 1.07, -0.34);
    const gunBody = new THREE.Mesh(shared.gunBodyGeo, shared.gunMat);
    const gunBarrel = new THREE.Mesh(shared.gunBarrelGeo, shared.barrelMat);
    gunBarrel.position.set(0, 0.015, -0.36);
    const gunMag = new THREE.Mesh(shared.gunMagGeo, shared.gunMat);
    gunMag.position.set(0, -0.09, -0.06);
    gun.add(gunBody, gunBarrel, gunMag);

    const muzzle = new THREE.Mesh(shared.flashGeo, shared.flashMat);
    muzzle.position.set(0.24, 1.09, -0.84);
    muzzle.visible = false;

    const head = new THREE.Mesh(shared.headGeo, headMat);
    head.position.set(0, 1.54, 0);
    const helmet = new THREE.Mesh(shared.helmetGeo, style.plate);
    helmet.position.set(0, 1.61, 0.01);
    const visor = new THREE.Mesh(shared.visorGeo, style.visor);
    visor.position.set(0, 1.54, -0.11);

    group.add(legL, legR, torso, plate, pauldronL, pauldronR, pack, antenna, armL, armR, gun, muzzle, head, helmet, visor);
    group.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    scene.add(group);

    const bot = {
      id: `${team}-${slotIndex}`,
      name,
      team,
      slotIndex,
      group,
      head,
      torso,
      legL,
      legR,
      muzzle,
      armorMat,
      headMat,
      pos: group.position,
      yaw: team === 'vanguard' ? 0 : Math.PI,
      hp: BOT_HP,
      alive: true,
      fall: 0,
      hitFlash: 0,
      flashTimer: 0,
      fireCooldown: 0.4 + random() * 0.5,
      strafeDir: random() > 0.5 ? 1 : -1,
      strafeTimer: 0.6 + random() * 0.8,
      wpId: 0,
      goalWp: 0,
      laneBias: slotIndex % 3,
      heardPos: new THREE.Vector3(),
      hasHeard: false,
      heardTimer: 0,
      spotted: false,
      spotTimer: 0,
      walkPhase: random() * 6,
      defuseProgress: 0,
    };

    head.userData = { bot, part: 'head' };
    helmet.userData = { bot, part: 'head' };
    visor.userData = { bot, part: 'head' };
    torso.userData = { bot, part: 'torso' };
    plate.userData = { bot, part: 'torso' };
    pauldronL.userData = { bot, part: 'torso' };
    pauldronR.userData = { bot, part: 'torso' };
    armL.userData = { bot, part: 'limb' };
    armR.userData = { bot, part: 'limb' };
    legL.userData = { bot, part: 'limb' };
    legR.userData = { bot, part: 'limb' };

    hitMeshes.push(head, helmet, visor, torso, plate, pauldronL, pauldronR, armL, armR, legL, legR);
    bots.push(bot);
    return bot;
  }

  for (let i = 0; i < 3; i += 1) buildBot('vanguard', i + 1, teamStyles.vanguard.names[i]);
  for (let i = 0; i < 4; i += 1) buildBot('obsidian', i, teamStyles.obsidian.names[i]);

  function nearestWaypoint(pos) {
    let bestId = 0;
    let bestD = Infinity;
    for (let i = 0; i < WAYPOINTS.length; i += 1) {
      const d = pos.distanceToSquared(WAYPOINTS[i].pos);
      if (d < bestD) {
        bestD = d;
        bestId = i;
      }
    }
    return bestId;
  }

  function hasLineOfSight(fromPos, toPos) {
    _eyeA.set(fromPos.x, fromPos.y + 1.46, fromPos.z);
    _eyeB.set(toPos.x, toPos.y + 1.38, toPos.z);
    _dir.subVectors(_eyeB, _eyeA);
    const dist = _dir.length();
    if (dist < 0.05) return true;
    _dir.divideScalar(dist);
    _losRay.set(_eyeA, _dir);
    _losRay.far = dist;
    return _losRay.intersectObjects(world.shootables, false).length === 0;
  }

  function collidesAt(x, z) {
    if (x < MAP_BOUNDS.minX + 0.5 || x > MAP_BOUNDS.maxX - 0.5) return true;
    if (z < MAP_BOUNDS.minZ + 0.5 || z > MAP_BOUNDS.maxZ - 0.5) return true;
    _probe.min.set(x - BOT_RADIUS, 0.08, z - BOT_RADIUS);
    _probe.max.set(x + BOT_RADIUS, 1.65, z + BOT_RADIUS);
    for (let i = 0; i < world.colliders.length; i += 1) {
      if (_probe.intersectsBox(world.colliders[i])) return true;
    }
    return false;
  }

  function moveBot(bot, moveX, moveZ, dt, speed = 3.9) {
    const len = Math.hypot(moveX, moveZ);
    if (len < 0.01) return false;
    const nx = (moveX / len) * speed * dt;
    const nz = (moveZ / len) * speed * dt;
    let moved = false;
    if (!collidesAt(bot.pos.x + nx, bot.pos.z)) {
      bot.pos.x += nx;
      moved = true;
    }
    if (!collidesAt(bot.pos.x, bot.pos.z + nz)) {
      bot.pos.z += nz;
      moved = true;
    }
    if (moved) {
      bot.walkPhase += dt * 9;
      bot.legL.rotation.x = Math.sin(bot.walkPhase) * 0.45;
      bot.legR.rotation.x = -Math.sin(bot.walkPhase) * 0.45;
    }
    return moved;
  }

  function applySeparation(bot, dt) {
    for (let i = 0; i < bots.length; i += 1) {
      const other = bots[i];
      if (other === bot || !other.alive) continue;
      const dx = bot.pos.x - other.pos.x;
      const dz = bot.pos.z - other.pos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.0001 && distSq < 1.1) {
        const d = Math.sqrt(distSq);
        const push = (1.05 - d) * 2.2 * dt;
        const px = (dx / d) * push;
        const pz = (dz / d) * push;
        if (!collidesAt(bot.pos.x + px, bot.pos.z)) bot.pos.x += px;
        if (!collidesAt(bot.pos.x, bot.pos.z + pz)) bot.pos.z += pz;
      }
    }
  }

  function pickGoalWaypoint(bot, roundInfo) {
    if (roundInfo.bombPlanted) return roundInfo.bombPlanted === 'A' ? 8 : 12;
    if (bot.team === 'vanguard') {
      const targetSite = roundInfo.attackTarget === 'A' ? 8 : 12;
      if (bot.laneBias === 0) return 8;
      if (bot.laneBias === 1) return 10;
      return targetSite;
    }
    const defenseWps = [8, 10, 12, 5];
    return defenseWps[bot.slotIndex % defenseWps.length];
  }

  function resetForRound(roundInfo) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      const list = TEAM_SPAWNS[bot.team];
      const sp = list[bot.slotIndex % list.length];
      bot.pos.copy(sp);
      bot.group.rotation.set(0, bot.team === 'vanguard' ? 0 : Math.PI, 0);
      bot.yaw = bot.team === 'vanguard' ? 0 : Math.PI;
      bot.hp = BOT_HP;
      bot.alive = true;
      bot.fall = 0;
      bot.hitFlash = 0;
      bot.flashTimer = 0;
      bot.muzzle.visible = false;
      bot.armorMat.emissive.setHex(0x000000);
      bot.headMat.emissive.setHex(0x000000);
      bot.fireCooldown = 0.4 + random() * 0.5;
      bot.hasHeard = false;
      bot.heardTimer = 0;
      bot.spotted = false;
      bot.spotTimer = 0;
      bot.defuseProgress = 0;
      bot.wpId = nearestWaypoint(bot.pos);
      bot.goalWp = pickGoalWaypoint(bot, roundInfo);
    }
  }

  function notifyNoise(sourcePos, team, radius = 22) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive || bot.team === team) continue;
      if (bot.pos.distanceTo(sourcePos) <= radius) {
        bot.heardPos.copy(sourcePos);
        bot.hasHeard = true;
        bot.heardTimer = 4.0;
      }
    }
  }

  function damageBot(mesh, rawDmg) {
    const bot = mesh.userData.bot;
    if (!bot || !bot.alive) return { hit: false };
    const part = mesh.userData.part;
    bot.hp = Math.max(0, bot.hp - rawDmg);
    bot.hitFlash = 0.09;
    bot.armorMat.emissive.setHex(0x552200);
    bot.headMat.emissive.setHex(0x552200);
    const killed = bot.hp === 0;
    if (killed) {
      bot.alive = false;
      bot.muzzle.visible = false;
    }
    return { hit: true, killed, headshot: part === 'head', bot };
  }

  function applyBlast(pos, radius, maxDmg, onBotKill) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive) continue;
      const dist = bot.pos.distanceTo(pos);
      if (dist > radius) continue;
      const dmg = Math.round(maxDmg * Math.pow(1 - dist / radius, 1.35));
      if (dmg <= 0) continue;
      bot.hp = Math.max(0, bot.hp - dmg);
      bot.hitFlash = 0.12;
      if (bot.hp === 0) {
        bot.alive = false;
        bot.muzzle.visible = false;
        if (onBotKill) onBotKill(bot);
      }
    }
  }

  function step(dt, canAct, playerState, roundInfo, callbacks) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive) {
        if (bot.fall < 1) {
          bot.fall = Math.min(1, bot.fall + dt * 3.4);
          bot.group.rotation.x = -bot.fall * 1.48;
          bot.pos.y = -bot.fall * 0.06;
        }
        continue;
      }

      if (bot.hitFlash > 0) {
        bot.hitFlash -= dt;
        if (bot.hitFlash <= 0) {
          bot.armorMat.emissive.setHex(0x000000);
          bot.headMat.emissive.setHex(0x000000);
        }
      }
      if (bot.flashTimer > 0) {
        bot.flashTimer -= dt;
        if (bot.flashTimer <= 0) bot.muzzle.visible = false;
      }
      if (bot.heardTimer > 0) {
        bot.heardTimer -= dt;
        if (bot.heardTimer <= 0) bot.hasHeard = false;
      }
      if (bot.spotTimer > 0) {
        bot.spotTimer -= dt;
        if (bot.spotTimer <= 0) bot.spotted = false;
      }

      if (!canAct) continue;
      applySeparation(bot, dt);

      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir *= -1;
        bot.strafeTimer = 0.75 + random() * 0.85;
      }

      let target = null;
      let targetPos = null;
      let bestDist = 36;
      let targetIsPlayer = false;

      if (bot.team === 'obsidian' && playerState.alive) {
        const d = bot.pos.distanceTo(playerState.position);
        if (d < bestDist && hasLineOfSight(bot.pos, playerState.position)) {
          bestDist = d;
          targetPos = playerState.position;
          targetIsPlayer = true;
        }
      }
      for (let j = 0; j < bots.length; j += 1) {
        const other = bots[j];
        if (!other.alive || other.team === bot.team) continue;
        const d = bot.pos.distanceTo(other.pos);
        if (d < bestDist && hasLineOfSight(bot.pos, other.pos)) {
          bestDist = d;
          target = other;
          targetPos = other.pos;
          targetIsPlayer = false;
        }
      }

      if (bot.team === 'obsidian' && playerState.alive && hasLineOfSight(playerState.position, bot.pos)) {
        bot.spotted = true;
        bot.spotTimer = 2.0;
      }

      if (targetPos) {
        const dx = targetPos.x - bot.pos.x;
        const dz = targetPos.z - bot.pos.z;
        bot.yaw = Math.atan2(-dx, -dz);
        bot.group.rotation.y = bot.yaw;

        const strafeX = Math.cos(bot.yaw) * bot.strafeDir;
        const strafeZ = -Math.sin(bot.yaw) * bot.strafeDir;
        const advance = bestDist > 12 ? 0.55 : bestDist < 5.5 ? -0.45 : 0;
        const fwdX = -Math.sin(bot.yaw) * advance;
        const fwdZ = -Math.cos(bot.yaw) * advance;
        moveBot(bot, strafeX + fwdX, strafeZ + fwdZ, dt, 3.1);

        if (bot.fireCooldown <= 0) {
          bot.fireCooldown = 0.24 + random() * 0.22;
          bot.flashTimer = 0.055;
          bot.muzzle.visible = true;

          _muzzle.set(bot.pos.x, bot.pos.y + 1.38, bot.pos.z);
          const aimY = targetIsPlayer ? playerState.position.y + playerState.eye - 0.14 : targetPos.y + 1.15;
          const accuracy = Math.max(0.025, Math.min(0.085, 0.022 + bestDist * 0.002));
          _end.set(
            targetPos.x + (random() * 2 - 1) * accuracy * bestDist,
            aimY + (random() * 2 - 1) * accuracy * bestDist,
            targetPos.z + (random() * 2 - 1) * accuracy * bestDist,
          );
          const tracerColor = bot.team === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian;
          world.spawnTracer(_muzzle, _end, tracerColor, 0.08);
          if (callbacks.onShot) callbacks.onShot(bot);

          const hitChance = Math.max(0.18, 0.62 - bestDist * 0.015);
          if (random() < hitChance) {
            const dmg = Math.round(11 + random() * 8);
            if (targetIsPlayer) {
              if (callbacks.onHitPlayer) callbacks.onHitPlayer(bot, dmg);
            } else if (target) {
              target.hp = Math.max(0, target.hp - dmg);
              target.hitFlash = 0.08;
              if (target.hp === 0) {
                target.alive = false;
                target.muzzle.visible = false;
                if (callbacks.onBotKillBot) callbacks.onBotKillBot(bot, target);
              }
            }
          }
        }
        continue;
      }

      if (roundInfo.bombPlanted && bot.team === 'obsidian') {
        const site = SITES.find((s) => s.id === roundInfo.bombPlanted);
        if (site && bot.pos.distanceTo(site.center) <= 2.4) {
          bot.defuseProgress += dt;
          if (bot.defuseProgress >= 4.2 && callbacks.onBotDefuse) callbacks.onBotDefuse(bot);
          continue;
        }
      }
      if (!roundInfo.bombPlanted && roundInfo.side === 'defend' && bot.team === 'obsidian') {
        for (let sIdx = 0; sIdx < SITES.length; sIdx += 1) {
          const site = SITES[sIdx];
          if (bot.pos.distanceTo(site.center) <= 2.3) {
            bot.defuseProgress += dt;
            if (bot.defuseProgress >= 2.8 && callbacks.onBotPlant) {
              bot.defuseProgress = 0;
              callbacks.onBotPlant(bot, site.id);
            }
            break;
          }
        }
      }

      let moveTarget = null;
      if (bot.hasHeard && bot.pos.distanceTo(bot.heardPos) > 2.0) {
        moveTarget = bot.heardPos;
      } else {
        bot.goalWp = pickGoalWaypoint(bot, roundInfo);
        if (bot.pos.distanceTo(WAYPOINTS[bot.wpId].pos) < 1.65) {
          bot.wpId = NEXT_HOP[bot.wpId][bot.goalWp];
        }
        moveTarget = WAYPOINTS[bot.wpId].pos;
      }

      if (moveTarget) {
        const dx = moveTarget.x - bot.pos.x;
        const dz = moveTarget.z - bot.pos.z;
        if (Math.hypot(dx, dz) > 0.4) {
          bot.yaw = Math.atan2(-dx, -dz);
          bot.group.rotation.y = bot.yaw;
          const moved = moveBot(bot, dx, dz, dt, 3.85);
          if (!moved) {
            moveBot(bot, Math.cos(bot.yaw) * bot.strafeDir, -Math.sin(bot.yaw) * bot.strafeDir, dt, 3.2);
          }
        }
      }
    }
  }

  return {
    bots,
    hitMeshes,
    resetForRound,
    notifyNoise,
    damageBot,
    applyBlast,
    step,
    aliveCount(team) {
      let c = 0;
      for (let i = 0; i < bots.length; i += 1) if (bots[i].alive && bots[i].team === team) c += 1;
      return c;
    },
  };
}
