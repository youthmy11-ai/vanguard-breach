// Tactical AI Bots: articulated armor, crouching cover/plant poses, smoke LOS checks, flash blindness & radio hooks.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { getSiteById, MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS } from './map.js';

const BOT_RADIUS = 0.36;
const BOT_HP = 100;
const _probe = new THREE.Box3();
const _losRay = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _eyeA = new THREE.Vector3();
const _eyeB = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();

const NEXT_HOP = WAYPOINTS.map((_, fromId) => {
  const row = new Int8Array(WAYPOINTS.length);
  for (let t = 0; t < WAYPOINTS.length; t += 1) {
    if (fromId === t) { row[t] = t; continue; }
    const vis = new Uint8Array(WAYPOINTS.length);
    vis[fromId] = 1;
    const q = [[fromId, -1]];
    let found = fromId;
    while (q.length > 0) {
      const [cur, first] = q.shift();
      for (const nxt of WAYPOINTS[cur].links) {
        const hop = first === -1 ? nxt : first;
        if (nxt === t) { found = hop; q.length = 0; break; }
        if (!vis[nxt]) { vis[nxt] = 1; q.push([nxt, hop]); }
      }
    }
    row[t] = found;
  }
  return row;
});

export function createBots(scene, world, random) {
  const bots = [];
  const hitMeshes = [];

  const geo = {
    torso: new THREE.BoxGeometry(0.46, 0.68, 0.28),
    plate: new THREE.BoxGeometry(0.5, 0.44, 0.33),
    pouch: new THREE.BoxGeometry(0.34, 0.14, 0.06),
    pauldron: new THREE.BoxGeometry(0.18, 0.16, 0.24),
    pack: new THREE.BoxGeometry(0.28, 0.4, 0.14),
    antenna: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6),
    head: new THREE.SphereGeometry(0.155, 14, 10),
    helmet: new THREE.BoxGeometry(0.32, 0.13, 0.34),
    visor: new THREE.BoxGeometry(0.27, 0.085, 0.14),
    arm: new THREE.CylinderGeometry(0.062, 0.052, 0.52, 10),
    leg: new THREE.CylinderGeometry(0.085, 0.068, 0.66, 10),
    knee: new THREE.BoxGeometry(0.185, 0.14, 0.21),
    gunBody: new THREE.BoxGeometry(0.075, 0.095, 0.48),
    gunStock: new THREE.BoxGeometry(0.06, 0.08, 0.18),
    gunBarrel: new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8),
    gunMag: new THREE.BoxGeometry(0.044, 0.13, 0.06),
    flash: new THREE.SphereGeometry(0.075, 6, 6),
  };
  const sharedMats = {
    gun: new THREE.MeshStandardMaterial({ color: new THREE.Color('#202733'), roughness: 0.45, metalness: 0.65 }),
    barrel: new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a5568'), roughness: 0.35, metalness: 0.78 }),
    flash: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  };
  const styles = {
    vanguard: {
      armor: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.vanguardArmor), roughness: 0.48, metalness: 0.35 }),
      plate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d354d'), roughness: 0.56, metalness: 0.28 }),
      limb: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a2433'), roughness: 0.75 }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.vanguard) }),
      names: ['Kestrel', 'Nova', 'Aegis', 'Valkyrie'],
    },
    obsidian: {
      armor: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.obsidianArmor), roughness: 0.48, metalness: 0.35 }),
      plate: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2d1b1e'), roughness: 0.56, metalness: 0.28 }),
      limb: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e1a1e'), roughness: 0.75 }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }),
      names: ['Viper', 'Cipher', 'Dusk', 'Talon', 'Nyx'],
    },
  };

  const makeMesh = (g, mat, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    return m;
  };

  function buildBot(team, slotIndex, name) {
    const s = styles[team];
    const armorMat = s.armor.clone();
    const headMat = s.armor.clone();
    const group = new THREE.Group();
    const upper = new THREE.Group();

    const legL = makeMesh(geo.leg, s.limb, -0.13, 0.33, 0);
    legL.add(makeMesh(geo.knee, armorMat, 0, 0.04, -0.02));
    const legR = makeMesh(geo.leg, s.limb, 0.13, 0.33, 0);
    legR.add(makeMesh(geo.knee, armorMat, 0, 0.04, -0.02));

    const torso = makeMesh(geo.torso, armorMat, 0, 1.02, 0);
    const plate = makeMesh(geo.plate, s.plate, 0, 1.07, 0);
    const pouch = makeMesh(geo.pouch, s.plate, 0, 0.98, -0.18);
    const pauldronL = makeMesh(geo.pauldron, armorMat, -0.33, 1.24, 0);
    const pauldronR = makeMesh(geo.pauldron, armorMat, 0.33, 1.24, 0);
    const pack = makeMesh(geo.pack, s.plate, 0, 1.08, 0.19);
    const antenna = makeMesh(geo.antenna, sharedMats.barrel, -0.08, 1.38, 0.21);
    const armL = makeMesh(geo.arm, s.limb, -0.29, 1.02, -0.1, 0.45, -0.2);
    const armR = makeMesh(geo.arm, s.limb, 0.3, 1.02, -0.14, 0.62);

    const gun = new THREE.Group();
    gun.position.set(0.24, 1.07, -0.34);
    gun.add(
      makeMesh(geo.gunBody, sharedMats.gun, 0, 0, 0),
      makeMesh(geo.gunStock, sharedMats.gun, 0, -0.01, 0.24),
      makeMesh(geo.gunBarrel, sharedMats.barrel, 0, 0.015, -0.36, Math.PI * 0.5),
      makeMesh(geo.gunMag, sharedMats.gun, 0, -0.09, -0.06),
    );
    const muzzle = makeMesh(geo.flash, sharedMats.flash, 0.24, 1.09, -0.84);
    muzzle.visible = false;

    const head = makeMesh(geo.head, headMat, 0, 1.54, 0);
    const helmet = makeMesh(geo.helmet, s.plate, 0, 1.61, 0.01);
    const visor = makeMesh(geo.visor, s.visor, 0, 1.54, -0.11);

    upper.add(torso, plate, pouch, pauldronL, pauldronR, pack, antenna, armL, armR, gun, muzzle, head, helmet, visor);
    group.add(legL, legR, upper);
    group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    scene.add(group);

    const bot = {
      id: `${team}-${slotIndex}`, name, team, slotIndex, group, upper, head, torso, legL, legR, muzzle,
      armorMat, headMat, pos: group.position, yaw: team === 'vanguard' ? 0 : Math.PI,
      hp: BOT_HP, alive: true, fall: 0, crouch: 0, crouching: false,
      hitFlash: 0, flashTimer: 0, blindTimer: 0, fireCooldown: 0.4 + random() * 0.5,
      strafeDir: random() > 0.5 ? 1 : -1, strafeTimer: 0.6 + random() * 0.8,
      radioCooldown: 1 + random() * 2, wpId: 0, goalWp: 0, laneBias: slotIndex % 3,
      heardPos: new THREE.Vector3(), hasHeard: false, heardTimer: 0,
      spotted: false, spotTimer: 0, walkPhase: random() * 6, defuseProgress: 0,
    };

    for (const [m, part] of [
      [head, 'head'], [helmet, 'head'], [visor, 'head'],
      [torso, 'torso'], [plate, 'torso'], [pouch, 'torso'], [pauldronL, 'torso'], [pauldronR, 'torso'],
      [armL, 'limb'], [armR, 'limb'], [legL, 'limb'], [legR, 'limb'],
    ]) {
      m.userData = { bot, part };
      hitMeshes.push(m);
    }
    bots.push(bot);
    return bot;
  }

  for (let i = 0; i < 4; i += 1) buildBot('vanguard', i + 1, styles.vanguard.names[i]);
  for (let i = 0; i < 5; i += 1) buildBot('obsidian', i, styles.obsidian.names[i]);

  function applyPose(bot) {
    const c = bot.crouch;
    bot.upper.position.y = -0.36 * c;
    const ls = 1 - 0.34 * c;
    bot.legL.scale.y = ls;
    bot.legR.scale.y = ls;
    bot.legL.position.y = 0.33 * ls;
    bot.legR.position.y = 0.33 * ls;
  }

  function nearestWaypoint(pos) {
    let bestId = 0, bestD = Infinity;
    for (let i = 0; i < WAYPOINTS.length; i += 1) {
      const d = pos.distanceToSquared(WAYPOINTS[i].pos);
      if (d < bestD) { bestD = d; bestId = i; }
    }
    return bestId;
  }

  function hasLineOfSight(fromPos, toPos, checkSmoke = true) {
    _eyeA.set(fromPos.x, fromPos.y + 1.44, fromPos.z);
    _eyeB.set(toPos.x, toPos.y + 1.36, toPos.z);
    if (checkSmoke && world.isBlockedBySmoke(_eyeA, _eyeB)) return false;
    _dir.subVectors(_eyeB, _eyeA);
    const dist = _dir.length();
    if (dist < 0.05) return true;
    _dir.divideScalar(dist);
    _losRay.set(_eyeA, _dir);
    _losRay.far = dist;
    return _losRay.intersectObjects(world.shootables, false).length === 0;
  }

  function collidesAt(x, z) {
    if (x < MAP_BOUNDS.minX + 0.5 || x > MAP_BOUNDS.maxX - 0.5 || z < MAP_BOUNDS.minZ + 0.5 || z > MAP_BOUNDS.maxZ - 0.5) return true;
    _probe.min.set(x - BOT_RADIUS, 0.08, z - BOT_RADIUS);
    _probe.max.set(x + BOT_RADIUS, 1.65, z + BOT_RADIUS);
    for (let i = 0; i < world.colliders.length; i += 1) if (_probe.intersectsBox(world.colliders[i])) return true;
    return false;
  }

  function moveBot(bot, moveX, moveZ, dt, speed = 3.9) {
    const len = Math.hypot(moveX, moveZ);
    if (len < 0.01) return false;
    const nx = (moveX / len) * speed * dt;
    const nz = (moveZ / len) * speed * dt;
    let moved = false;
    if (!collidesAt(bot.pos.x + nx, bot.pos.z)) { bot.pos.x += nx; moved = true; }
    if (!collidesAt(bot.pos.x, bot.pos.z + nz)) { bot.pos.z += nz; moved = true; }
    if (moved) {
      bot.walkPhase += dt * 9;
      bot.legL.rotation.x = Math.sin(bot.walkPhase) * 0.45;
      bot.legR.rotation.x = -Math.sin(bot.walkPhase) * 0.45;
    }
    return moved;
  }

  function applySeparation(bot, dt) {
    for (let i = 0; i < bots.length; i += 1) {
      const o = bots[i];
      if (o === bot || !o.alive) continue;
      const dx = bot.pos.x - o.pos.x, dz = bot.pos.z - o.pos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.0001 && dSq < 1.1) {
        const d = Math.sqrt(dSq), push = (1.05 - d) * 2.2 * dt;
        const px = (dx / d) * push, pz = (dz / d) * push;
        if (!collidesAt(bot.pos.x + px, bot.pos.z)) bot.pos.x += px;
        if (!collidesAt(bot.pos.x, bot.pos.z + pz)) bot.pos.z += pz;
      }
    }
  }

  function pickGoalWaypoint(bot, roundInfo) {
    if (roundInfo.bombPlanted) return roundInfo.bombPlanted === 'A' ? 8 : 12;
    if (bot.team === 'vanguard') {
      if (bot.laneBias === 0) return 8;
      if (bot.laneBias === 1) return 10;
      return roundInfo.attackTarget === 'A' ? 8 : 12;
    }
    const def = [8, 10, 12, 5];
    return def[bot.slotIndex % def.length];
  }

  function resetForRound(roundInfo) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      const sp = TEAM_SPAWNS[bot.team][bot.slotIndex % TEAM_SPAWNS[bot.team].length];
      bot.pos.copy(sp);
      bot.yaw = bot.team === 'vanguard' ? 0 : Math.PI;
      bot.group.rotation.set(0, bot.yaw, 0);
      bot.hp = BOT_HP; bot.alive = true; bot.fall = 0; bot.crouch = 0; bot.crouching = false;
      applyPose(bot);
      bot.hitFlash = 0; bot.flashTimer = 0; bot.blindTimer = 0; bot.muzzle.visible = false;
      bot.armorMat.emissive.setHex(0x000000); bot.headMat.emissive.setHex(0x000000);
      bot.fireCooldown = 0.4 + random() * 0.5; bot.radioCooldown = 1 + random() * 2;
      bot.hasHeard = false; bot.heardTimer = 0; bot.spotted = false; bot.spotTimer = 0; bot.defuseProgress = 0;
      bot.wpId = nearestWaypoint(bot.pos);
      bot.goalWp = pickGoalWaypoint(bot, roundInfo);
    }
  }

  function notifyNoise(sourcePos, team, radius = 22) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive || bot.team === team) continue;
      if (bot.pos.distanceTo(sourcePos) <= radius) { bot.heardPos.copy(sourcePos); bot.hasHeard = true; bot.heardTimer = 4.0; }
    }
  }

  function damageBot(mesh, rawDmg) {
    const bot = mesh.userData.bot;
    if (!bot || !bot.alive) return { hit: false };
    bot.hp = Math.max(0, bot.hp - rawDmg);
    bot.hitFlash = 0.09;
    bot.armorMat.emissive.setHex(0x552200);
    bot.headMat.emissive.setHex(0x552200);
    const killed = bot.hp === 0;
    if (killed) { bot.alive = false; bot.muzzle.visible = false; }
    return { hit: true, killed, headshot: mesh.userData.part === 'head', bot };
  }

  function applyBlast(pos, radius, maxDmg, onBotHit, onBotKill) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive) continue;
      const dist = bot.pos.distanceTo(pos);
      if (dist > radius) continue;
      const dmg = Math.round(maxDmg * Math.pow(1 - dist / radius, 1.35));
      if (dmg <= 0) continue;
      bot.hp = Math.max(0, bot.hp - dmg);
      bot.hitFlash = 0.12;
      if (onBotHit) onBotHit(bot, dmg);
      if (bot.hp === 0) { bot.alive = false; bot.muzzle.visible = false; if (onBotKill) onBotKill(bot); }
    }
  }

  function applyFlash(pos, radius = 16) {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive) continue;
      const dist = bot.pos.distanceTo(pos);
      if (dist > radius || !hasLineOfSight(bot.pos, pos, true)) continue;
      const dx = pos.x - bot.pos.x, dz = pos.z - bot.pos.z;
      const dot = (dx * -Math.sin(bot.yaw) + dz * -Math.cos(bot.yaw)) / (Math.hypot(dx, dz) || 1);
      if (dot > 0.15) { bot.blindTimer = Math.max(bot.blindTimer, 2.2); bot.fireCooldown = Math.max(bot.fireCooldown, 0.85); }
      else if (dist < 4.5) { bot.blindTimer = Math.max(bot.blindTimer, 0.9); bot.fireCooldown = Math.max(bot.fireCooldown, 0.45); }
    }
  }

  function step(dt, canAct, playerState, roundInfo, cb) {
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
        if (bot.hitFlash <= 0) { bot.armorMat.emissive.setHex(0x000000); bot.headMat.emissive.setHex(0x000000); }
      }
      if (bot.flashTimer > 0) { bot.flashTimer -= dt; if (bot.flashTimer <= 0) bot.muzzle.visible = false; }
      if (bot.blindTimer > 0) bot.blindTimer = Math.max(0, bot.blindTimer - dt);
      if (bot.radioCooldown > 0) bot.radioCooldown = Math.max(0, bot.radioCooldown - dt);
      if (bot.heardTimer > 0) { bot.heardTimer -= dt; if (bot.heardTimer <= 0) bot.hasHeard = false; }
      if (bot.spotTimer > 0) { bot.spotTimer -= dt; if (bot.spotTimer <= 0) bot.spotted = false; }

      const tc = bot.crouching ? 1 : 0;
      if (Math.abs(bot.crouch - tc) > 0.005) {
        bot.crouch += (tc - bot.crouch) * Math.min(1, dt * 12);
        applyPose(bot);
      }
      if (!canAct) continue;
      applySeparation(bot, dt);

      bot.fireCooldown = Math.max(0, bot.fireCooldown - dt);
      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) { bot.strafeDir *= -1; bot.strafeTimer = 0.75 + random() * 0.85; }
      bot.crouching = bot.blindTimer > 0 || bot.defuseProgress > 0;

      if (bot.blindTimer > 0) {
        moveBot(bot, Math.cos(bot.yaw) * bot.strafeDir, -Math.sin(bot.yaw) * bot.strafeDir, dt, 1.8);
        continue;
      }

      let target = null, targetPos = null, bestDist = 36, targetIsPlayer = false;
      if (bot.team === 'obsidian' && playerState.alive) {
        const d = bot.pos.distanceTo(playerState.position);
        if (d < bestDist && hasLineOfSight(bot.pos, playerState.position)) { bestDist = d; targetPos = playerState.position; targetIsPlayer = true; }
      }
      for (let j = 0; j < bots.length; j += 1) {
        const o = bots[j];
        if (!o.alive || o.team === bot.team) continue;
        const d = bot.pos.distanceTo(o.pos);
        if (d < bestDist && hasLineOfSight(bot.pos, o.pos)) { bestDist = d; target = o; targetPos = o.pos; targetIsPlayer = false; }
      }
      if (bot.team === 'obsidian' && playerState.alive && hasLineOfSight(playerState.position, bot.pos)) {
        bot.spotted = true; bot.spotTimer = 2.0;
      }

      if (targetPos) {
        if (bot.team === 'vanguard' && bot.radioCooldown <= 0 && cb.onRadioContact) {
          bot.radioCooldown = 9.5;
          cb.onRadioContact(bot, targetPos);
        }
        bot.yaw = Math.atan2(-(targetPos.x - bot.pos.x), -(targetPos.z - bot.pos.z));
        bot.group.rotation.y = bot.yaw;
        bot.crouching = bot.hp <= 45 || (bestDist > 13 && bot.strafeDir > 0);
        const adv = bestDist > 12 ? 0.55 : bestDist < 5.5 ? -0.45 : 0;
        moveBot(bot, Math.cos(bot.yaw) * bot.strafeDir - Math.sin(bot.yaw) * adv, -Math.sin(bot.yaw) * bot.strafeDir - Math.cos(bot.yaw) * adv, dt, bot.crouching ? 2.1 : 3.1);

        if (bot.fireCooldown <= 0) {
          bot.fireCooldown = 0.25 + random() * 0.22;
          bot.flashTimer = 0.055;
          bot.muzzle.visible = true;
          _muzzle.set(bot.pos.x - Math.sin(bot.yaw) * 0.55 + Math.cos(bot.yaw) * 0.24, bot.pos.y + 1.1 - 0.36 * bot.crouch, bot.pos.z - Math.cos(bot.yaw) * 0.55 - Math.sin(bot.yaw) * 0.24);
          const aimY = targetIsPlayer ? playerState.position.y + playerState.eye - 0.14 : targetPos.y + 1.15 - (target ? 0.36 * target.crouch : 0);
          const acc = Math.max(0.025, Math.min(0.085, 0.022 + bestDist * 0.002));
          _end.set(targetPos.x + (random() * 2 - 1) * acc * bestDist, aimY + (random() * 2 - 1) * acc * bestDist, targetPos.z + (random() * 2 - 1) * acc * bestDist);
          world.spawnTracer(_muzzle, _end, bot.team === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian, 0.08);
          if (cb.onShot) cb.onShot(bot);
          if (random() < Math.max(0.18, 0.62 - bestDist * 0.015)) {
            const dmg = Math.round(11 + random() * 8);
            const isHead = random() < 0.16;
            if (targetIsPlayer) { if (cb.onHitPlayer) cb.onHitPlayer(bot, dmg, isHead); }
            else if (target) {
              const applied = Math.round(dmg * (isHead ? 1.8 : 1));
              target.hp = Math.max(0, target.hp - applied);
              target.hitFlash = 0.08;
              if (cb.onBotHitBot) cb.onBotHitBot(bot, target, applied, isHead);
              if (target.hp === 0) { target.alive = false; target.muzzle.visible = false; if (cb.onBotKillBot) cb.onBotKillBot(bot, target, isHead); }
            }
          }
        }
        continue;
      }

      if (roundInfo.bombPlanted && bot.team === 'obsidian') {
        const site = getSiteById(roundInfo.bombPlanted);
        if (site && bot.pos.distanceTo(site.center) <= 2.4) {
          bot.crouching = true; bot.defuseProgress += dt;
          if (bot.defuseProgress >= 4.2 && cb.onBotDefuse) cb.onBotDefuse(bot);
          continue;
        }
      }
      if (!roundInfo.bombPlanted && roundInfo.side === 'defend' && bot.team === 'obsidian') {
        for (let sIdx = 0; sIdx < SITES.length; sIdx += 1) {
          if (bot.pos.distanceTo(SITES[sIdx].center) <= 2.3) {
            bot.crouching = true; bot.defuseProgress += dt;
            if (bot.defuseProgress >= 2.8 && cb.onBotPlant) { bot.defuseProgress = 0; cb.onBotPlant(bot, SITES[sIdx].id); }
            break;
          }
        }
      }

      let moveTarget = null;
      if (bot.hasHeard && bot.pos.distanceTo(bot.heardPos) > 2.0) moveTarget = bot.heardPos;
      else {
        bot.goalWp = pickGoalWaypoint(bot, roundInfo);
        if (bot.pos.distanceTo(WAYPOINTS[bot.wpId].pos) < 1.65) bot.wpId = NEXT_HOP[bot.wpId][bot.goalWp];
        moveTarget = WAYPOINTS[bot.wpId].pos;
      }
      if (moveTarget) {
        const dx = moveTarget.x - bot.pos.x, dz = moveTarget.z - bot.pos.z;
        if (Math.hypot(dx, dz) > 0.4) {
          bot.yaw = Math.atan2(-dx, -dz);
          bot.group.rotation.y = bot.yaw;
          if (!moveBot(bot, dx, dz, dt, 3.85)) moveBot(bot, Math.cos(bot.yaw) * bot.strafeDir, -Math.sin(bot.yaw) * bot.strafeDir, dt, 3.2);
        }
      }
    }
  }

  return {
    bots, hitMeshes, applyPose, resetForRound, notifyNoise, damageBot, applyBlast, applyFlash, step,
    aliveCount(team) {
      let c = 0;
      for (let i = 0; i < bots.length; i += 1) if (bots[i].alive && bots[i].team === team) c += 1;
      return c;
    },
  };
}
