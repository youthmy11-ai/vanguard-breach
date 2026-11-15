// Match controller, fixed 60 Hz simulation loop, hitscan & grenade combat, round economy & deterministic shot modes.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITES, TEAM_SPAWNS } from './world.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeaponRig, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenades.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const WIN_ROUNDS = 5;
const BUY_FREEZE_SEC = 6;
const ROUND_SEC = 75;
const BOMB_SEC = 28;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.skyHorizon);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.skyHorizon), 28, 76);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const audio = createAudio();
const world = createWorld(scene);
const weapon = createWeaponRig(camera);
const player = createPlayer(world.colliders);
const bots = createBots(scene, world, random);
const grenades = createGrenades(scene, world.colliders);
const hud = createHud();
const input = createInput(renderer.domElement, onLockChange, onDiscreteKey);

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const shootables = world.shootables.concat(bots.hitMeshes);
const tmpDir = new THREE.Vector3();
const tmpMuzzle = new THREE.Vector3();
const tmpEnd = new THREE.Vector3();
const tmpZero = new THREE.Vector3();

const match = {
  round: 1,
  vanScore: 0,
  obsScore: 0,
  credits: 800,
  kills: 0,
  deaths: 0,
  hits: 0,
  headshots: 0,
  damage: 0,
  score: 0,
  phase: 'start', // start | buy | live | roundEnd | matchEnd
  phaseTimer: BUY_FREEZE_SEC,
  roundElapsed: 0,
  bombPlanted: null,
  bombTimer: 0,
  bombTickAccum: 0,
  plantProgress: 0,
  defuseProgress: 0,
  side: 'attack',
  attackTarget: 'A',
};

let elapsed = 0;
let playing = false;
let frozen = false;
let triggerConsumed = false;
let accumulator = 0;
let lastTime = performance.now();
let overviewCam = null;

function canUseBuyMenu() {
  if (match.phase === 'buy') return true;
  if (match.phase === 'live' && (match.roundElapsed <= 12 || player.state.position.z > 13.0)) return true;
  return false;
}

function toggleBuyMenu() {
  if (shot || !playing || match.phase === 'start' || match.phase === 'matchEnd') return;
  if (hud.isBuyOpen()) {
    hud.hideBuyMenu();
    input.setActive(true);
    input.requestLock();
  } else if (canUseBuyMenu()) {
    input.setActive(false);
    input.exitLock();
    hud.showBuyMenu(match.credits, weapon.state, player.state.armor);
  } else {
    hud.showBanner('Buy window closed — return to base', 1400);
  }
}

function purchaseItem(item) {
  if (!canUseBuyMenu()) return;
  const owned =
    (item.type === 'weapon' && weapon.state.owned[item.id]) ||
    (item.type === 'armor' && player.state.armor >= 100) ||
    (item.type === 'grenade' && weapon.state.grenades >= 2);
  if (owned || match.credits < item.price) {
    audio.ui('deny');
    return;
  }
  match.credits -= item.price;
  if (item.type === 'weapon') {
    weapon.giveWeapon(item.id);
  } else if (item.type === 'armor') {
    player.state.armor = 100;
  } else if (item.type === 'grenade') {
    weapon.state.grenades += 1;
  }
  audio.ui('buy');
  hud.showBuyMenu(match.credits, weapon.state, player.state.armor);
  syncHud();
}

function throwGrenade() {
  if (!player.state.alive || (match.phase !== 'live' && !shot)) return;
  if (weapon.state.grenades <= 0) return;
  weapon.state.grenades -= 1;
  camera.getWorldDirection(tmpDir);
  tmpMuzzle.set(
    player.state.position.x + tmpDir.x * 0.6,
    player.state.position.y + player.state.eye - 0.1,
    player.state.position.z + tmpDir.z * 0.6,
  );
  grenades.spawn(tmpMuzzle, tmpDir, 'vanguard');
  audio.shot('knife', 0.9);
  syncHud();
}

function onDiscreteKey(code) {
  if (shot) return;
  if (hud.isBuyOpen()) {
    if (code === 'KeyB' || code === 'Escape') {
      toggleBuyMenu();
      return;
    }
    const idx = Number.parseInt(code.replace('Digit', ''), 10) - 1;
    if (idx >= 0 && idx < hud.BUY_ITEMS.length) purchaseItem(hud.BUY_ITEMS[idx]);
    return;
  }
  if (code === 'KeyB') {
    toggleBuyMenu();
    return;
  }
  if (!playing) return;
  if (code === 'Digit1') {
    if (!weapon.equipSlot(1)) hud.showBanner('No primary — press [B] to buy', 1400);
  } else if (code === 'Digit2') {
    weapon.equipSlot(2);
  } else if (code === 'Digit3') {
    weapon.equipSlot(3);
  } else if (code === 'KeyR') {
    if (weapon.reload()) audio.reload();
  } else if (code === 'KeyG') {
    throwGrenade();
  }
  syncHud();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    playing = true;
    input.setActive(true);
    hud.hideOverlay();
    hud.hideBuyMenu();
    if (match.phase === 'start') startNewMatch();
  } else if (!hud.isBuyOpen() && playing && match.phase !== 'matchEnd' && match.phase !== 'start') {
    playing = false;
    input.setActive(false);
    hud.showOverlay('paused', buildMatchStats());
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  playing = true;
  input.setActive(true);
  hud.hideOverlay();
  if (match.phase === 'matchEnd' || match.phase === 'start') {
    startNewMatch();
  }
  input.requestLock();
});

hud.onBuy((item) => purchaseItem(item));
hud.onBuyClose(() => toggleBuyMenu());

function buildMatchStats() {
  const hsPct = match.hits > 0 ? Math.round((match.headshots / match.hits) * 100) : 0;
  return {
    vanScore: match.vanScore,
    obsScore: match.obsScore,
    kills: match.kills,
    deaths: match.deaths,
    hsPct,
    damage: match.damage,
    score: match.score,
  };
}

function setupRound(roundNum) {
  match.round = roundNum;
  match.side = roundNum % 2 === 1 ? 'attack' : 'defend';
  match.attackTarget = roundNum % 4 <= 1 ? 'A' : 'B';
  match.phase = roundNum === 1 ? 'live' : 'buy';
  match.phaseTimer = roundNum === 1 ? ROUND_SEC : BUY_FREEZE_SEC;
  match.roundElapsed = 0;
  match.bombPlanted = null;
  match.bombTimer = 0;
  match.bombTickAccum = 0;
  match.plantProgress = 0;
  match.defuseProgress = 0;

  world.setBombPlanted(null);
  world.clearFx();
  grenades.clear();

  if (!player.state.alive) {
    player.state.armor = 0;
    weapon.state.owned.smg = false;
    weapon.state.owned.rifle = false;
    weapon.state.owned.sniper = false;
    weapon.state.owned.deagle = false;
    weapon.state.primaryId = null;
    weapon.state.sidearmId = 'pistol';
    weapon.equip('pistol');
  } else if (weapon.state.primaryId) {
    weapon.equipSlot(1);
  }
  weapon.refillAll();
  weapon.setVisible(true);
  player.spawnAt(TEAM_SPAWNS.vanguard[0], 0);
  bots.resetForRound(match);

  const roleText = match.side === 'attack' ? 'BREACH SITE A OR B [E] • PRESS [B] TO BUY' : 'DEFEND SITES / DEFUSE CORE [E] • PRESS [B] TO BUY';
  hud.showBanner(`ROUND ${roundNum} — ${roleText}`, 3400);
  syncHud();
}

function startNewMatch() {
  match.vanScore = 0;
  match.obsScore = 0;
  match.credits = 800;
  match.kills = 0;
  match.deaths = 0;
  match.hits = 0;
  match.headshots = 0;
  match.damage = 0;
  match.score = 0;
  player.state.armor = 0;
  player.state.alive = true;
  weapon.resetMatch();
  hud.clearKillfeed();
  setupRound(1);
}

function endRound(winnerTeam, reason) {
  if (match.phase === 'roundEnd' || match.phase === 'matchEnd') return;
  match.phase = 'roundEnd';
  match.phaseTimer = 3.2;
  if (winnerTeam === 'vanguard') {
    match.vanScore += 1;
    match.credits = Math.min(6000, match.credits + 1600);
    match.score += 250;
    audio.ui('win');
  } else {
    match.obsScore += 1;
    match.credits = Math.min(6000, match.credits + 1150);
    audio.ui('loss');
  }
  hud.setActionPrompt(null, 0);
  hud.showBanner(`${winnerTeam === 'vanguard' ? 'VANGUARD' : 'OBSIDIAN'} ROUND WIN — ${reason}`, 3000);
  syncHud();
}

function syncCamera() {
  if (overviewCam) {
    camera.position.copy(overviewCam.pos);
    camera.lookAt(overviewCam.look);
    return;
  }
  if (!player.state.alive) {
    const ally = bots.bots.find((b) => b.team === 'vanguard' && b.alive);
    if (ally) {
      camera.position.set(ally.pos.x - Math.sin(ally.yaw) * -2.2, 2.35, ally.pos.z - Math.cos(ally.yaw) * -2.2);
      camera.lookAt(ally.pos.x - Math.sin(ally.yaw) * 6, 1.4, ally.pos.z - Math.cos(ally.yaw) * 6);
      return;
    }
  }
  const p = player.state;
  camera.position.set(p.position.x, p.position.y + p.eye, p.position.z);
  camera.rotation.set(p.pitch + p.punchPitch, p.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - player.state.position.x;
  const dy = point.y - (player.state.position.y + player.state.eye);
  const dz = point.z - player.state.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.state.yaw = Math.atan2(-dx, -dz);
  player.state.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}

function shoot(forceZeroSpread = false) {
  if (!player.state.alive) return false;
  const spec = weapon.currentSpec();
  if (!weapon.takeRound()) return false;

  const spread = forceZeroSpread ? 0 : weapon.spread(player.groundSpeed(), player.state.onGround, player.state.crouching);
  camera.getWorldDirection(tmpDir);
  tmpDir.x += (random() * 2 - 1) * spread;
  tmpDir.y += (random() * 2 - 1) * spread;
  tmpDir.z += (random() * 2 - 1) * spread;
  tmpDir.normalize();

  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, tmpDir);
  raycaster.far = spec.melee ? spec.range : 90;

  const hits = raycaster.intersectObjects(shootables, false);
  const hit = hits.find((h) => !(h.object.userData.bot && h.object.userData.bot.team === 'vanguard')) ?? null;
  if (!spec.melee) {
    weapon.getMuzzleWorldPos(tmpMuzzle);
    if (hit) tmpEnd.copy(hit.point);
    else tmpEnd.copy(camera.position).addScaledVector(tmpDir, 45);
    world.spawnTracer(tmpMuzzle, tmpEnd, PALETTE.accent, shot ? 0.45 : 0.085);
    bots.notifyNoise(player.state.position, 'vanguard', 24);
  }

  if (hit) {
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      if (bot.team === 'obsidian') {
        const part = hit.object.userData.part;
        const mult = part === 'head' ? spec.headMult : part === 'limb' ? 0.78 : 1.0;
        const dmg = Math.round(spec.damage * mult);
        const res = bots.damageBot(hit.object, dmg);
        if (res.hit) {
          match.hits += 1;
          match.damage += dmg;
          if (res.headshot) match.headshots += 1;
          hud.hitMarker(res.headshot, shot ? 4000 : 110);
          audio.hit(res.headshot);
          world.spawnImpact(hit.point, null, res.headshot ? PALETTE.headGold : PALETTE.obsidian, 5);
          if (res.killed) {
            match.kills += 1;
            const bonus = res.headshot ? 450 : 300;
            match.credits = Math.min(6000, match.credits + bonus);
            match.score += res.headshot ? 150 : 100;
            hud.pushKill('You', bot.name, spec.name, res.headshot, 'vanguard');
          }
        }
      }
    } else {
      world.spawnImpact(hit.point, hit.face?.normal, PALETTE.ink, 3);
    }
  }

  weapon.pullTrigger();
  if (!forceZeroSpread) {
    player.recoil(spec.recoilPitch + random() * 0.004, (random() * 2 - 1) * spec.recoilYaw);
  }
  audio.shot(spec.id);
  syncHud();
  return true;
}

function handleBombAction(dt) {
  if (match.phase !== 'live' || !player.state.alive) {
    hud.setActionPrompt(null, 0);
    return;
  }
  const holdingE = input.state.keys.has('KeyE');
  if (!match.bombPlanted && match.side === 'attack') {
    const onSite = SITES.find((s) => Math.hypot(player.state.position.x - s.center.x, player.state.position.z - s.center.z) <= s.radius);
    if (onSite) {
      if (holdingE) {
        match.plantProgress += dt;
        hud.setActionPrompt(`Planting Resonance Core at Site ${onSite.id}...`, match.plantProgress / 2.6);
        if (match.plantProgress >= 2.6) {
          match.plantProgress = 0;
          match.bombPlanted = onSite.id;
          match.bombTimer = BOMB_SEC;
          match.credits = Math.min(6000, match.credits + 300);
          match.score += 150;
          world.setBombPlanted(onSite.id);
          audio.bombEvent('plant');
          hud.showBanner(`CORE ARMED AT SITE ${onSite.id} — DEFEND IT`, 2600);
          hud.setActionPrompt(null, 0);
        }
      } else {
        match.plantProgress = 0;
        hud.setActionPrompt(`Hold [E] to Plant Core at Site ${onSite.id}`, 0);
      }
      return;
    }
  } else if (match.bombPlanted) {
    const site = SITES.find((s) => s.id === match.bombPlanted);
    if (site && Math.hypot(player.state.position.x - site.center.x, player.state.position.z - site.center.z) <= site.radius) {
      if (holdingE) {
        match.defuseProgress += dt;
        hud.setActionPrompt('Defusing Resonance Core...', match.defuseProgress / 3.0);
        if (match.defuseProgress >= 3.0) {
          match.defuseProgress = 0;
          match.credits = Math.min(6000, match.credits + 350);
          match.score += 200;
          audio.bombEvent('defuse');
          endRound('vanguard', 'Core Defused');
          return;
        }
      } else {
        match.defuseProgress = 0;
        hud.setActionPrompt('Hold [E] to Defuse Core', 0);
      }
      return;
    }
  }
  match.plantProgress = 0;
  match.defuseProgress = 0;
  hud.setActionPrompt(null, 0);
}

function syncHud() {
  const spec = weapon.currentSpec();
  const ammo = weapon.currentAmmo();
  const spread = weapon.spread(player.groundSpeed(), player.state.onGround, player.state.crouching);
  hud.setCrosshair(spread, weapon.isScoped());
  hud.setVitals(player.state.hp, player.state.armor, match.credits);
  hud.setWeapon(spec, ammo, weapon.state);

  const vanAlive = bots.aliveCount('vanguard') + (player.state.alive ? 1 : 0);
  const obsAlive = bots.aliveCount('obsidian');
  const timeVal = match.phase === 'buy' ? match.phaseTimer : match.bombPlanted ? match.bombTimer : match.phaseTimer;
  const phaseLabel =
    match.phase === 'buy'
      ? `ROUND ${match.round} • BUY [B]`
      : match.bombPlanted
        ? `CORE ARMED • SITE ${match.bombPlanted}`
        : `ROUND ${match.round} • ${match.side === 'attack' ? 'BREACH' : 'DEFEND'}`;
  hud.setMatchBar(match.vanScore, match.obsScore, vanAlive, obsAlive, timeVal, phaseLabel, Boolean(match.bombPlanted));
}

function step(dt) {
  elapsed += dt;
  const canMove = match.phase === 'live' && !hud.isBuyOpen();
  const spec = weapon.currentSpec();

  player.step(dt, input.state.keys, spec.speedMult, canMove || match.phase === 'buy', (crouching) => {
    audio.footstep(crouching);
  });
  weapon.step(dt, input.state.ads && !hud.isBuyOpen(), canMove ? player.groundSpeed() : 0);

  grenades.step(dt, (blastPos, radius, maxDmg) => {
    audio.explosion();
    world.spawnImpact(blastPos, tmpZero, PALETTE.accent, 8);
    bots.applyBlast(blastPos, radius, maxDmg, (bot) => {
      if (bot.team === 'obsidian') {
        match.kills += 1;
        match.credits = Math.min(6000, match.credits + 300);
        match.score += 100;
        hud.pushKill('You', bot.name, 'Frag HE', false, 'vanguard');
      } else {
        hud.pushKill('Frag HE', bot.name, 'Blast', false, 'obsidian');
      }
    });
    if (player.state.alive) {
      const dist = player.state.position.distanceTo(blastPos);
      if (dist < radius) {
        const selfDmg = Math.round(maxDmg * 0.45 * (1 - dist / radius));
        if (selfDmg > 0) {
          const r = player.takeDamage(selfDmg);
          hud.damageFlash();
          if (r.killed) match.deaths += 1;
        }
      }
    }
  });

  bots.step(dt, match.phase === 'live', player.state, match, {
    onShot(bot) {
      const dist = bot.pos.distanceTo(player.state.position);
      if (dist < 28) audio.shot('rifle', Math.max(0.15, 0.55 - dist * 0.015));
    },
    onHitPlayer(bot, dmg) {
      const r = player.takeDamage(dmg);
      hud.damageFlash();
      if (r.killed) {
        match.deaths += 1;
        hud.pushKill(bot.name, 'You', 'AR-47', false, 'obsidian');
      }
    },
    onBotKillBot(killer, victim) {
      hud.pushKill(killer.name, victim.name, 'AR-47', false, killer.team);
    },
    onBotPlant(bot, siteId) {
      if (match.bombPlanted || match.phase !== 'live') return;
      match.bombPlanted = siteId;
      match.bombTimer = BOMB_SEC;
      world.setBombPlanted(siteId);
      audio.bombEvent('plant');
      hud.showBanner(`${bot.name} PLANTED CORE AT SITE ${siteId}`, 2600);
    },
    onBotDefuse() {
      if (!match.bombPlanted || match.phase !== 'live') return;
      audio.bombEvent('defuse');
      endRound('obsidian', 'Core Defused');
    },
  });

  const urgency = match.bombPlanted ? 1 - match.bombTimer / BOMB_SEC : 0;
  world.step(dt, elapsed, urgency);

  if (shot) return;

  if (match.phase === 'buy') {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) {
      match.phase = 'live';
      match.phaseTimer = ROUND_SEC;
      hud.showBanner(`ROUND ${match.round} LIVE — ENGAGE`, 1800);
    }
  } else if (match.phase === 'live') {
    match.roundElapsed += dt;
    handleBombAction(dt);

    if (match.bombPlanted) {
      match.bombTimer -= dt;
      match.bombTickAccum += dt;
      const tickRate = Math.max(0.22, 0.95 * (match.bombTimer / BOMB_SEC));
      if (match.bombTickAccum >= tickRate) {
        match.bombTickAccum = 0;
        audio.bombTick(match.bombTimer < 7);
      }
      if (match.bombTimer <= 0) {
        audio.bombEvent('boom');
        endRound('vanguard', 'Core Detonated');
      }
    } else {
      match.phaseTimer -= dt;
      if (match.phaseTimer <= 0) {
        endRound(match.side === 'defend' ? 'vanguard' : 'obsidian', 'Time Expired');
      }
    }

    const vanAlive = bots.aliveCount('vanguard') + (player.state.alive ? 1 : 0);
    const obsAlive = bots.aliveCount('obsidian');
    if (obsAlive === 0 && (!match.bombPlanted || match.side === 'attack')) {
      endRound('vanguard', 'Obsidian Eliminated');
    } else if (vanAlive === 0 && !match.bombPlanted) {
      endRound('obsidian', 'Vanguard Eliminated');
    }
  } else if (match.phase === 'roundEnd') {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) {
      if (match.vanScore >= WIN_ROUNDS || match.obsScore >= WIN_ROUNDS) {
        match.phase = 'matchEnd';
        playing = false;
        input.setActive(false);
        input.exitLock();
        hud.showOverlay('end', buildMatchStats());
      } else {
        setupRound(match.round + 1);
      }
    }
  }

  hud.drawRadar(world.radarBoxes, player.state, bots.bots, match.bombPlanted);
  syncHud();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (!frozen) {
    const look = input.takeLook();
    if (!hud.isBuyOpen() && match.phase !== 'matchEnd' && match.phase !== 'start') {
      player.look(look.x, look.y);
      const spec = weapon.currentSpec();
      if (input.state.firing && match.phase === 'live' && weapon.ready()) {
        if (spec.auto || !triggerConsumed) {
          shoot(false);
          triggerConsumed = true;
        }
      }
      if (!input.state.firing) triggerConsumed = false;
    }

    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }

  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuyMenu();
  startNewMatch();
  hud.showBanner(null, 0);

  if (name === 'start') {
    match.phase = 'start';
    overviewCam = { pos: new THREE.Vector3(-5.5, 6.2, 13.5), look: new THREE.Vector3(-12.5, 1.4, -6.0) };
    weapon.setVisible(false);
    for (const b of bots.bots) b.spotted = true;
    bots.bots[3].pos.set(-14.2, 0, -4.5);
    bots.bots[4].pos.set(-10.5, 0, -2.5);
    settle(6);
    hud.showOverlay('start', buildMatchStats());
  } else if (name === 'buy') {
    match.phase = 'buy';
    match.round = 3;
    match.vanScore = 1;
    match.obsScore = 1;
    match.credits = 2250;
    player.state.armor = 50;
    weapon.setVisible(true);
    player.spawnAt(new THREE.Vector3(0, 0, 17.5), 0);
    settle(12);
    hud.showBuyMenu(match.credits, weapon.state, player.state.armor);
  } else if (name === 'play') {
    match.phase = 'live';
    match.round = 3;
    match.vanScore = 2;
    match.obsScore = 1;
    match.credits = 1450;
    player.state.armor = 85;
    weapon.setVisible(true);
    weapon.giveWeapon('rifle');
    player.spawnAt(new THREE.Vector3(-1.4, 0, 7.6), 0);
    // Position Obsidian bots down Mid Archway and a Vanguard teammate nearby
    bots.bots[0].pos.set(-3.2, 0, 5.2);
    bots.bots[3].pos.set(0.4, 0, -2.4);
    bots.bots[4].pos.set(2.3, 0, -5.0);
    bots.bots[5].pos.set(-2.6, 0, -6.5);
    for (const b of bots.bots) b.spotted = true;
    settle(10);
    // Aim at enemy head down Mid Archway and fire for live tracer + muzzle flash + gold HS hitmarker
    const targetHead = new THREE.Vector3(bots.bots[3].pos.x, 1.54, bots.bots[3].pos.z);
    aimAt(targetHead);
    shoot(true);
    world.spawnTracer(new THREE.Vector3(2.3, 1.38, -5.0), new THREE.Vector3(-0.3, 1.45, 5.2), PALETTE.obsidian, 0.45);
    settle(1);
    hud.showBanner('SITE A CLEAR — BREACH MID ARCH', 0);
  } else if (name === 'end') {
    match.phase = 'matchEnd';
    match.vanScore = 5;
    match.obsScore = 2;
    match.kills = 14;
    match.deaths = 3;
    match.hits = 28;
    match.headshots = 16;
    match.damage = 2140;
    match.score = 2850;
    overviewCam = { pos: new THREE.Vector3(6.5, 5.8, 12.0), look: new THREE.Vector3(14.5, 1.4, -6.0) };
    weapon.setVisible(false);
    settle(6);
    hud.showOverlay('end', buildMatchStats());
  }

  hud.drawRadar(world.radarBoxes, player.state, bots.bots, match.bombPlanted);
  syncHud();
  syncCamera();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) {
  runShot(shot);
} else {
  hud.showOverlay('start', buildMatchStats());
  hud.drawRadar(world.radarBoxes, player.state, bots.bots, null);
  syncHud();
  requestAnimationFrame(frame);
}
