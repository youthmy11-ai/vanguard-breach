// Tactical AI Bots (Vanguard Strike allies & Obsidian Wardens enemies).
// Separate Head vs Torso vs Limb hitboxes, waypoint navigation, cover strafing, gunshot awareness & bomb AI.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { MAP_BOUNDS, SITES, TEAM_SPAWNS, WAYPOINTS } from './map.js';

const BOT_RADIUS = 0.36;
const BOT_HP = 100;

export function createBots(scene, world, random) {
  const bots = [];
  const hitMeshes = [];

  const shared = {
    torsoGeo: new THREE.BoxGeometry(0.5, 0.72, 0.3),
    headGeo: new THREE.SphereGeometry(0.16, 14, 10),
    visorGeo: new THREE.BoxGeometry(0.24, 0.075, 0.12),
    armGeo: new THREE.BoxGeometry(0.15, 0.58, 0.16),
    legGeo: new THREE.BoxGeometry(0.18, 0.66, 0.2),
    gunGeo: new THREE.BoxGeometry(0.08, 0.1, 0.58),
    flashGeo: new THREE.SphereGeometry(0.09, 6, 6),
    gunMat: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.5, metalness: 0.6 }),
    flashMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  };

  const teamStyles = {
    vanguard: {
      armor: new THREE.MeshStandardMaterial({ color: new THREE.Color('#274766'), roughness: 0.58, metalness: 0.25 }),
      limb: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d2838'), roughness: 0.78 }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.vanguard) }),
      names: ['Kestrel', 'Nova', 'Aegis'],
    },
    obsidian: {
      armor: new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a2328'), roughness: 0.58, metalness: 0.25 }),
      limb: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d1d24'), roughness: 0.78 }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }),
      names: ['Viper', 'Cipher', 'Dusk', 'Talon'],
    },
  };

  const probe = new THREE.Box3();
  const losRay = new THREE.Raycaster();
  const tmpDir = new THREE.Vector3();
  const tmpEyeA = new THREE.Vector3();
  const tmpEyeB = new THREE.Vector3();
  const tmpMuzzle = new THREE.Vector3();
  const tmpEnd = new THREE.Vector3();

  function buildBot(team, slotIndex, name) {
    const style = teamStyles[team];
    const armorMat = style.armor.clone();
    const headMat = style.armor.clone();
    const group = new THREE.Group();

    const legL = new THREE.Mesh(shared.legGeo, style.limb);
    legL.position.set(-0.13, 0.33, 0);
    const legR = new THREE.Mesh(shared.legGeo, style.limb);
    legR.position.set(0.13, 0.33, 0);

    const torso = new THREE.Mesh(shared.torsoGeo, armorMat);
    torso.position.set(0, 1.02, 0);

    const armL = new THREE.Mesh(shared.armGeo, style.limb);
    armL.position.set(-0.34, 1.02, -0.05);
    const armR = new THREE.Mesh(shared.armGeo, style.limb);
    armR.position.set(0.34, 1.02, -0.14);
    armR.rotation.x = 0.55;

    const gun = new THREE.Mesh(shared.gunGeo, shared.gunMat);
    gun.position.set(0.28, 1.06, -0.34);

    const muzzle = new THREE.Mesh(shared.flashGeo, shared.flashMat);
    muzzle.position.set(0.28, 1.07, -0.66);
    muzzle.visible = false;

    const head = new THREE.Mesh(shared.headGeo, headMat);
    head.position.set(0, 1.54, 0);
    const visor = new THREE.Mesh(shared.visorGeo, style.visor);
    visor.position.set(0, 1.55, -0.11);

    group.add(legL, legR, torso, armL, armR, gun, muzzle, head, visor);
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
      burstLeft: 0,
      strafeDir: random() > 0.5 ? 1 : -1,
      strafeTimer: 0.6 + random() * 0.8,
      wpId: 0,
      goalWp: 0,
      laneBias: slotIndex % 3,
      heardPos: null,
      heardTimer: 0,
      spotted: false,
      spotTimer: 0,
      walkPhase: random() * 6,
      defuseProgress: 0,
    };

    head.userData = { bot, part: 'head' };
    visor.userData = { bot, part: 'head' };
    torso.userData = { bot, part: 'torso' };
    armL.userData = { bot, part: 'limb' };
    armR.userData = { bot, part: 'limb' };
    legL.userData = { bot, part: 'limb' };
    legR.userData = { bot, part: 'limb' };

    hitMeshes.push(head, visor, torso, armL, armR, legL, legR);
    bots.push(bot);
    return bot;
  }

  for (let i = 0; i < 3; i += 1) buildBot('vanguard', i + 1, teamStyles.vanguard.names[i]);
  for (let i = 0; i < 4; i += 1) buildBot('obsidian', i, teamStyles.obsidian.names[i]);

  function nearestWaypoint(pos) {
    let bestId = 0;
    let bestD = Infinity;
    for (const wp of WAYPOINTS) {
      const d = pos.distanceToSquared(wp.pos);
      if (d < bestD) {
        bestD = d;
        bestId = wp.id;
      }
    }
    return bestId;
  }

  function nextHop(fromId, targetId) {
    if (fromId === targetId) return targetId;
    const visited = new Set([fromId]);
    const queue = [[fromId, -1]];
    while (queue.length > 0) {
      const [cur, first] = queue.shift();
      for (const nxt of WAYPOINTS[cur].links) {
        const step = first === -1 ? nxt : first;
        if (nxt === targetId) return step;
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push([nxt, step]);
        }
      }
    }
    return fromId;
  }

  function hasLineOfSight(fromPos, toPos) {
    tmpEyeA.set(fromPos.x, fromPos.y + 1.46, fromPos.z);
    tmpEyeB.set(toPos.x, toPos.y + 1.38, toPos.z);
    tmpDir.subVectors(tmpEyeB, tmpEyeA);
    const dist = tmpDir.length();
    if (dist < 0.05) return true;
    tmpDir.divideScalar(dist);
    losRay.set(tmpEyeA, tmpDir);
    losRay.far = dist;
    const hits = losRay.intersectObjects(world.shootables, false);
    return hits.length === 0;
  }

  function collidesAt(x, z) {
    if (x < MAP_BOUNDS.minX + 0.5 || x > MAP_BOUNDS.maxX - 0.5) return true;
    if (z < MAP_BOUNDS.minZ + 0.5 || z > MAP_BOUNDS.maxZ - 0.5) return true;
    probe.min.set(x - BOT_RADIUS, 0.08, z - BOT_RADIUS);
    probe.max.set(x + BOT_RADIUS, 1.65, z + BOT_RADIUS);
    for (let i = 0; i < world.colliders.length; i += 1) {
      if (probe.intersectsBox(world.colliders[i])) return true;
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
    for (const other of bots) {
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
    if (roundInfo.bombPlanted) {
      return roundInfo.bombPlanted === 'A' ? 8 : 12;
    }
    if (bot.team === 'vanguard') {
      const targetSite = roundInfo.attackTarget === 'A' ? 8 : 12;
      if (bot.laneBias === 0) return 8;
      if (bot.laneBias === 1) return 10;
      return targetSite;
    }
    // Obsidian Wardens defend A, Mid, and B
    const defenseWps = [8, 10, 12, 5];
    return defenseWps[bot.slotIndex % defenseWps.length];
  }

  function resetForRound(roundInfo) {
    for (const bot of bots) {
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
      bot.heardPos = null;
      bot.heardTimer = 0;
      bot.spotted = false;
      bot.spotTimer = 0;
      bot.defuseProgress = 0;
      bot.wpId = nearestWaypoint(bot.pos);
      bot.goalWp = pickGoalWaypoint(bot, roundInfo);
    }
  }

  function notifyNoise(sourcePos, team, radius = 22) {
    for (const bot of bots) {
      if (!bot.alive || bot.team === team) continue;
      if (bot.pos.distanceTo(sourcePos) <= radius) {
        bot.heardPos = sourcePos.clone();
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
    for (const bot of bots) {
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
    for (const bot of bots) {
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
        if (bot.heardTimer <= 0) bot.heardPos = null;
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

      // Find nearest visible opposing combatant (including player if bot is obsidian)
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
      for (const other of bots) {
        if (!other.alive || other.team === bot.team) continue;
        const d = bot.pos.distanceTo(other.pos);
        if (d < bestDist && hasLineOfSight(bot.pos, other.pos)) {
          bestDist = d;
          target = other;
          targetPos = other.pos;
          targetIsPlayer = false;
        }
      }

      // Check if player can see this obsidian bot (for minimap spotting)
      if (bot.team === 'obsidian' && playerState.alive) {
        if (hasLineOfSight(playerState.position, bot.pos)) {
          bot.spotted = true;
          bot.spotTimer = 2.0;
        }
      }

      if (targetPos) {
        // Engage target: face, strafe, and burst fire
        const dx = targetPos.x - bot.pos.x;
        const dz = targetPos.z - bot.pos.z;
        const desiredYaw = Math.atan2(-dx, -dz);
        bot.yaw = desiredYaw;
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

          tmpMuzzle.set(bot.pos.x, bot.pos.y + 1.38, bot.pos.z);
          const aimY = targetIsPlayer ? playerState.position.y + playerState.eye - 0.14 : targetPos.y + 1.15;
          const accuracy = Math.max(0.025, Math.min(0.085, 0.022 + bestDist * 0.002));
          tmpEnd.set(
            targetPos.x + (random() * 2 - 1) * accuracy * bestDist,
            aimY + (random() * 2 - 1) * accuracy * bestDist,
            targetPos.z + (random() * 2 - 1) * accuracy * bestDist,
          );
          const tracerColor = bot.team === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian;
          world.spawnTracer(tmpMuzzle, tmpEnd, tracerColor, 0.08);
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

      // Check bomb defuse / plant objective if no immediate enemy in sight
      if (roundInfo.bombPlanted && bot.team === 'obsidian') {
        const site = SITES.find((s) => s.id === roundInfo.bombPlanted);
        if (site && bot.pos.distanceTo(site.center) <= 2.4) {
          bot.defuseProgress += dt;
          if (bot.defuseProgress >= 4.2 && callbacks.onBotDefuse) {
            callbacks.onBotDefuse(bot);
          }
          continue;
        }
      }
      if (!roundInfo.bombPlanted && roundInfo.side === 'defend' && bot.team === 'obsidian') {
        for (const site of SITES) {
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

      // Navigate via waypoint graph or investigate heard gunshot
      let moveTarget = null;
      if (bot.heardPos && bot.pos.distanceTo(bot.heardPos) > 2.0) {
        moveTarget = bot.heardPos;
      } else {
        bot.goalWp = pickGoalWaypoint(bot, roundInfo);
        if (bot.pos.distanceTo(WAYPOINTS[bot.wpId].pos) < 1.65) {
          bot.wpId = nextHop(bot.wpId, bot.goalWp);
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
            // Steering recovery around corners
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
      for (const b of bots) if (b.alive && b.team === team) c += 1;
      return c;
    },
    firstAliveEnemy(pos) {
      let best = null;
      let bestD = Infinity;
      for (const b of bots) {
        if (!b.alive || b.team !== 'obsidian') continue;
        const d = b.pos.distanceTo(pos);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      return best;
    },
  };
}
