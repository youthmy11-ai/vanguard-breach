// Match controller, fixed 60 Hz loop, multi-pellet & utility combat, 4v4 roster stats & deterministic shots.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, getSiteById, getZoneName, SITES, TEAM_SPAWNS } from './world.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeaponRig, UTIL_ORDER } from './weapons.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenades.js';
import { BUY_HOTKEYS, createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const WIN_ROUNDS = 5;
const BUY_FREEZE_SEC = 5;
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
scene.background = new THREE.Color(PALETTE.skyWarm);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 38, 104);

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
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _end = new THREE.Vector3();
const _upNorm = new THREE.Vector3(0, 1, 0);
const _shotA = new THREE.Vector3();
const _shotB = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _flashDir = new THREE.Vector3();

const makeStat = (id, name, team, isPlayer) => ({ id, name, team, isPlayer, kills: 0, assists: 0, deaths: 0, hits: 0, headshots: 0, damage: 0, mvp: 0, credits: 800, roundScore: 0 });
const roster = [makeStat('you', 'You', 'vanguard', true), ...bots.bots.map((b) => makeStat(b.id, b.name, b.team, false))];
const rosterById = {};
const roundDmg = {};
for (let i = 0; i < roster.length; i += 1) {
  rosterById[roster[i].id] = roster[i];
  roundDmg[roster[i].id] = {};
  for (let j = 0; j < roster.length; j += 1) roundDmg[roster[i].id][roster[j].id] = 0;
}

const match = {
  round: 1, vanScore: 0, obsScore: 0, credits: 800, phase: 'start', phaseTimer: BUY_FREEZE_SEC,
  roundElapsed: 0, bombPlanted: null, bombTimer: 0, bombTickAccum: 0, plantProgress: 0, defuseProgress: 0,
  side: 'attack', attackTarget: 'A', roundHistory: [],
};

let elapsed = 0, playing = false, frozen = false, triggerConsumed = false, accumulator = 0, lastTime = performance.now(), overviewCam = null;

function resetRoundDamage() {
  for (let i = 0; i < roster.length; i += 1) {
    roster[i].roundScore = 0;
    const row = roundDmg[roster[i].id];
    for (let j = 0; j < roster.length; j += 1) row[roster[j].id] = 0;
  }
}

function recordDamage(atkId, vicId, dmg, hs) {
  const atk = rosterById[atkId];
  if (!atk || dmg <= 0) return;
  atk.hits += 1; atk.damage += dmg;
  if (hs) atk.headshots += 1;
  atk.roundScore += dmg * 0.35;
  if (roundDmg[vicId]) roundDmg[vicId][atkId] = (roundDmg[vicId][atkId] || 0) + dmg;
}

function recordKill(killerId, vicId, hs, bonus = 300) {
  const k = rosterById[killerId], v = rosterById[vicId];
  if (k) {
    k.kills += 1; k.roundScore += hs ? 150 : 100;
    k.credits = Math.min(6000, k.credits + bonus);
    if (k.isPlayer) match.credits = k.credits;
    const vRow = roundDmg[vicId];
    if (vRow) {
      for (let i = 0; i < roster.length; i += 1) {
        const a = roster[i];
        if (a.team === k.team && a.id !== k.id && vRow[a.id] >= 35) { a.assists += 1; a.roundScore += 50; }
      }
    }
  }
  if (v) v.deaths += 1;
}

function pushRadioCallout(sender, text) {
  hud.pushRadio(sender, text);
  if (!shot && playing) audio.radio();
}

const canUseBuyMenu = () => match.phase === 'buy' || (match.phase === 'live' && (match.roundElapsed <= 12 || player.state.position.z > 13.0));

function toggleBuyMenu() {
  if (shot || !playing || match.phase === 'start' || match.phase === 'matchEnd') return;
  if (hud.isBuyOpen()) { hud.hideBuyMenu(); input.setActive(true); input.requestLock(); }
  else if (canUseBuyMenu()) { input.setActive(false); input.exitLock(); hud.showBuyMenu(match.credits, weapon.state, player.state); }
  else hud.showBanner('Buy window closed — return to base', 1400);
}

function purchaseItem(item) {
  if (!canUseBuyMenu()) return;
  const price = hud.effectivePrice(item, player.state.armor, player.state.helmet);
  const owned =
    (item.type === 'weapon' && weapon.state.owned[item.id]) ||
    (item.type === 'vest' && player.state.armor >= 100) ||
    (item.type === 'armor' && player.state.armor >= 100 && player.state.helmet) ||
    (item.type === 'kit' && player.state.defuseKit) ||
    (item.type === 'util' && (weapon.state.utility[item.id] ?? 0) >= 2);
  if (owned || match.credits < price) { audio.ui('deny'); return; }
  match.credits -= price;
  rosterById.you.credits = match.credits;
  if (item.type === 'weapon') weapon.giveWeapon(item.id);
  else if (item.type === 'vest') player.state.armor = 100;
  else if (item.type === 'armor') { player.state.armor = 100; player.state.helmet = true; }
  else if (item.type === 'kit') player.state.defuseKit = true;
  else if (item.type === 'util') { weapon.state.utility[item.id] += 1; weapon.state.activeUtil = item.id; }
  audio.ui('buy');
  hud.showBuyMenu(match.credits, weapon.state, player.state);
  syncHud();
}

function throwUtility(reqKind = null) {
  if (!player.state.alive || (match.phase !== 'live' && !shot)) return;
  let kind = reqKind ?? weapon.state.activeUtil;
  if (!reqKind && (weapon.state.utility[kind] ?? 0) <= 0) {
    for (let i = 0; i < UTIL_ORDER.length; i += 1) if (weapon.state.utility[UTIL_ORDER[i]] > 0) { kind = UTIL_ORDER[i]; break; }
  }
  if ((weapon.state.utility[kind] ?? 0) <= 0) return;
  weapon.state.utility[kind] -= 1;
  weapon.state.activeUtil = kind;
  camera.getWorldDirection(_dir);
  _muzzle.set(player.state.position.x + _dir.x * 0.6, player.state.position.y + player.state.eye - 0.1, player.state.position.z + _dir.z * 0.6);
  grenades.spawn(_muzzle, _dir, 'vanguard', kind);
  audio.shot('knife', 0.9);
  syncHud();
}

function onDiscreteKey(code) {
  if (shot) return;
  if (hud.isBuyOpen()) {
    if (code === 'KeyB' || code === 'Escape') { toggleBuyMenu(); return; }
    const k = code.startsWith('Digit') ? code.slice(5) : '';
    if (k && BUY_HOTKEYS[k]) purchaseItem(BUY_HOTKEYS[k]);
    return;
  }
  if (code === 'KeyB') { toggleBuyMenu(); return; }
  if (!playing) return;
  if (code === 'Digit1') { if (!weapon.equipSlot(1)) hud.showBanner('No primary — press [B] to buy', 1400); }
  else if (code === 'Digit2') weapon.equipSlot(2);
  else if (code === 'Digit3') weapon.equipSlot(3);
  else if (code === 'Digit4') throwUtility('frag');
  else if (code === 'Digit5') throwUtility('smoke');
  else if (code === 'Digit6') throwUtility('flash');
  else if (code === 'KeyQ') weapon.cycleUtility();
  else if (code === 'KeyG') throwUtility(null);
  else if (code === 'KeyR' && weapon.reload()) audio.reload();
  syncHud();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    playing = true; input.setActive(true); hud.setHudVisible(true); hud.hideOverlay(); hud.hideBuyMenu();
    if (match.phase === 'start') startNewMatch();
  } else if (!hud.isBuyOpen() && playing && match.phase !== 'matchEnd' && match.phase !== 'start') {
    playing = false; input.setActive(false); hud.showOverlay('paused', buildMatchStats());
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock(); playing = true; input.setActive(true); hud.setHudVisible(true); hud.hideOverlay();
  if (match.phase === 'matchEnd' || match.phase === 'start') startNewMatch();
  input.requestLock();
});
hud.onBuy((item) => purchaseItem(item));
hud.onBuyClose(() => toggleBuyMenu());

function buildMatchStats() {
  let mvp = roster[0];
  for (let i = 1; i < roster.length; i += 1) {
    const r = roster[i];
    if (r.mvp > mvp.mvp || (r.mvp === mvp.mvp && r.kills * 3 + r.damage * 0.01 > mvp.kills * 3 + mvp.damage * 0.01)) mvp = r;
  }
  return {
    vanScore: match.vanScore, obsScore: match.obsScore,
    mvpName: mvp.name.toUpperCase(), mvpKills: mvp.kills,
    mvpHsPct: mvp.hits > 0 ? Math.round((mvp.headshots / mvp.hits) * 100) : 0,
    mvpDamage: mvp.damage, roster, roundHistory: match.roundHistory,
  };
}

function setupRound(roundNum) {
  match.round = roundNum;
  match.side = roundNum % 2 === 1 ? 'attack' : 'defend';
  match.attackTarget = roundNum % 4 <= 1 ? 'A' : 'B';
  match.phase = roundNum === 1 ? 'live' : 'buy';
  match.phaseTimer = roundNum === 1 ? ROUND_SEC : BUY_FREEZE_SEC;
  match.roundElapsed = 0; match.bombPlanted = null; match.bombTimer = 0; match.bombTickAccum = 0; match.plantProgress = 0; match.defuseProgress = 0;

  resetRoundDamage();
  world.setBombPlanted(null); world.clearFx(); grenades.clear();

  if (!player.state.alive) {
    player.state.armor = 0; player.state.helmet = false; player.state.defuseKit = false;
    for (const id of ['deagle', 'shotgun', 'smg', 'rifle', 'sniper']) weapon.state.owned[id] = false;
    weapon.state.primaryId = null; weapon.state.sidearmId = 'pistol'; weapon.equip('pistol');
  } else if (weapon.state.primaryId) weapon.equipSlot(1);

  weapon.refillAll(); weapon.setVisible(true);
  player.spawnAt(TEAM_SPAWNS.vanguard[0], 0);
  bots.resetForRound(match);

  const role = match.side === 'attack' ? 'BREACH SITE A OR B [E] • PRESS [B] TO BUY' : 'DEFEND SITES / DEFUSE CORE [E] • PRESS [B] TO BUY';
  hud.showBanner(`ROUND ${roundNum} — ${role}`, 3200);
  syncHud();
}

function startNewMatch() {
  match.vanScore = 0; match.obsScore = 0; match.credits = 800; match.roundHistory = [];
  for (let i = 0; i < roster.length; i += 1) Object.assign(roster[i], { kills: 0, assists: 0, deaths: 0, hits: 0, headshots: 0, damage: 0, mvp: 0, credits: 800, roundScore: 0 });
  player.state.armor = 0; player.state.helmet = false; player.state.defuseKit = false; player.state.alive = true;
  weapon.resetMatch(); hud.clearKillfeed(); hud.clearRadio();
  setupRound(1);
}

function endRound(winnerTeam, reason, tag = 'Elim') {
  if (match.phase === 'roundEnd' || match.phase === 'matchEnd') return;
  match.phase = 'roundEnd'; match.phaseTimer = 3.2;
  match.roundHistory.push({ round: match.round, winner: winnerTeam, tag });
  if (winnerTeam === 'vanguard') { match.vanScore += 1; audio.ui('win'); }
  else { match.obsScore += 1; audio.ui('loss'); }

  let bestWin = null;
  for (let i = 0; i < roster.length; i += 1) {
    const r = roster[i];
    r.credits = Math.min(6000, r.credits + (r.team === winnerTeam ? 1600 : 1150));
    if (r.isPlayer) match.credits = r.credits;
    if (r.team === winnerTeam && (!bestWin || r.roundScore > bestWin.roundScore)) bestWin = r;
  }
  if (bestWin) bestWin.mvp += 1;
  hud.setActionPrompt(null, 0);
  hud.showBanner(`${winnerTeam === 'vanguard' ? 'VANGUARD' : 'OBSIDIAN'} ROUND WIN — ${reason}`, 3000);
  syncHud();
}

function syncCamera() {
  if (overviewCam) { camera.position.copy(overviewCam.pos); camera.lookAt(overviewCam.look); return; }
  if (!player.state.alive) {
    for (let i = 0; i < bots.bots.length; i += 1) {
      const a = bots.bots[i];
      if (a.team === 'vanguard' && a.alive) {
        camera.position.set(a.pos.x + Math.sin(a.yaw) * 2.2, 2.35, a.pos.z + Math.cos(a.yaw) * 2.2);
        camera.lookAt(a.pos.x - Math.sin(a.yaw) * 6, 1.4, a.pos.z - Math.cos(a.yaw) * 6);
        return;
      }
    }
  }
  const p = player.state;
  camera.position.set(p.position.x, p.position.y + p.eye, p.position.z);
  camera.rotation.set(p.pitch + p.punchPitch, p.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - player.state.position.x, dy = point.y - (player.state.position.y + player.state.eye), dz = point.z - player.state.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  player.state.yaw = Math.atan2(-dx, -dz);
  player.state.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}

function shoot(forceZeroSpread = false) {
  if (!player.state.alive) return false;
  const spec = weapon.currentSpec();
  if (!weapon.takeRound()) return false;

  const baseSpread = forceZeroSpread ? 0 : weapon.spread(player.groundSpeed(), player.state.onGround, player.state.crouching);
  const pellets = spec.pellets || 1;
  scene.updateMatrixWorld(true);
  weapon.getMuzzleWorldPos(_muzzle);

  let anyHit = false, anyHead = false;
  for (let p = 0; p < pellets; p += 1) {
    const sp = baseSpread + (forceZeroSpread ? 0 : (spec.pelletSpread || 0));
    camera.getWorldDirection(_dir);
    _dir.x += (random() * 2 - 1) * sp; _dir.y += (random() * 2 - 1) * sp; _dir.z += (random() * 2 - 1) * sp;
    _dir.normalize();
    raycaster.set(camera.position, _dir);
    raycaster.far = spec.melee ? spec.range : 90;
    const hits = raycaster.intersectObjects(shootables, false);
    let hit = null;
    for (let h = 0; h < hits.length; h += 1) {
      const b = hits[h].object.userData.bot;
      if (!(b && b.team === 'vanguard')) { hit = hits[h]; break; }
    }
    if (!spec.melee) {
      if (hit) _end.copy(hit.point); else _end.copy(camera.position).addScaledVector(_dir, 45);
      world.spawnTracer(_muzzle, _end, PALETTE.accent, shot ? 0.5 : 0.085);
    }
    if (hit) {
      const bot = hit.object.userData.bot;
      if (bot && bot.team === 'obsidian') {
        const part = hit.object.userData.part;
        const dmg = Math.round(spec.damage * (part === 'head' ? spec.headMult : part === 'limb' ? 0.78 : 1.0));
        const wasAlive = bot.alive;
        const res = bots.damageBot(hit.object, dmg);
        if (res.hit) {
          anyHit = true;
          if (res.headshot) anyHead = true;
          recordDamage('you', bot.id, dmg, res.headshot);
          world.spawnImpact(hit.point, null, res.headshot ? PALETTE.headGold : PALETTE.obsidian, pellets > 1 ? 3 : 6);
          if (wasAlive && res.killed) {
            recordKill('you', bot.id, res.headshot, res.headshot ? 450 : 300);
            hud.pushKill('You', bot.name, spec.name, res.headshot, 'vanguard');
          }
        }
      } else if (!bot) world.spawnImpact(hit.point, hit.face?.normal, PALETTE.ink, pellets > 1 ? 2 : 4);
    }
  }

  if (!spec.melee) bots.notifyNoise(player.state.position, 'vanguard', 24);
  if (anyHit) { hud.hitMarker(anyHead, shot ? 4000 : 110); audio.hit(anyHead); }
  weapon.pullTrigger();
  if (!forceZeroSpread) player.recoil(spec.recoilPitch + random() * 0.004, (random() * 2 - 1) * spec.recoilYaw);
  audio.shot(spec.id);
  syncHud();
  return true;
}

function handleBombAction(dt) {
  if (match.phase !== 'live' || !player.state.alive) { hud.setActionPrompt(null, 0); return; }
  const holdingE = input.state.keys.has('KeyE');
  if (!match.bombPlanted && match.side === 'attack') {
    let onSite = null;
    for (let i = 0; i < SITES.length; i += 1) {
      if (Math.hypot(player.state.position.x - SITES[i].center.x, player.state.position.z - SITES[i].center.z) <= SITES[i].radius) { onSite = SITES[i]; break; }
    }
    if (onSite) {
      if (holdingE) {
        match.plantProgress += dt;
        hud.setActionPrompt(`Planting Resonance Core at Site ${onSite.id}...`, match.plantProgress / 2.6);
        if (match.plantProgress >= 2.6) {
          match.plantProgress = 0; match.bombPlanted = onSite.id; match.bombTimer = BOMB_SEC;
          rosterById.you.roundScore += 160; rosterById.you.credits = Math.min(6000, rosterById.you.credits + 300); match.credits = rosterById.you.credits;
          world.setBombPlanted(onSite.id); audio.bombEvent('plant');
          hud.showBanner(`CORE ARMED AT SITE ${onSite.id} — DEFEND IT`, 2600);
          pushRadioCallout('Kestrel', `Core planted at ${onSite.name} — locking angles!`);
          hud.setActionPrompt(null, 0);
        }
      } else { match.plantProgress = 0; hud.setActionPrompt(`Hold [E] to Plant Core at Site ${onSite.id}`, 0); }
      return;
    }
  } else if (match.bombPlanted) {
    const site = getSiteById(match.bombPlanted);
    if (site && Math.hypot(player.state.position.x - site.center.x, player.state.position.z - site.center.z) <= site.radius) {
      const goal = player.state.defuseKit ? 2.5 : 5.0;
      const tag = player.state.defuseKit ? ' [Kit]' : '';
      if (holdingE) {
        match.defuseProgress += dt;
        hud.setActionPrompt(`Defusing Resonance Core${tag}...`, match.defuseProgress / goal);
        if (match.defuseProgress >= goal) {
          match.defuseProgress = 0;
          rosterById.you.roundScore += 200; rosterById.you.credits = Math.min(6000, rosterById.you.credits + 350); match.credits = rosterById.you.credits;
          audio.bombEvent('defuse');
          endRound('vanguard', 'Core Defused', 'Defuse');
          return;
        }
      } else { match.defuseProgress = 0; hud.setActionPrompt(`Hold [E] to Defuse Core${tag}`, 0); }
      return;
    }
  }
  match.plantProgress = 0; match.defuseProgress = 0; hud.setActionPrompt(null, 0);
}

function syncAllyTags() {
  const show = !overviewCam && match.phase !== 'start' && match.phase !== 'matchEnd';
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < 4; i += 1) {
    const bot = bots.bots[i];
    if (!show || !bot || !bot.alive) { hud.setAllyTag(i, false); continue; }
    _projVec.set(bot.pos.x, bot.pos.y + 1.98 - 0.36 * bot.crouch, bot.pos.z).project(camera);
    if (_projVec.z >= -1 && _projVec.z <= 1 && Math.abs(_projVec.x) <= 0.94 && Math.abs(_projVec.y) <= 0.9) {
      hud.setAllyTag(i, true, (_projVec.x * 0.5 + 0.5) * w, (-_projVec.y * 0.5 + 0.5) * h, bot.name, bot.hp);
    } else hud.setAllyTag(i, false);
  }
}

function syncHud() {
  const spec = weapon.currentSpec();
  hud.setCrosshair(weapon.spread(player.groundSpeed(), player.state.onGround, player.state.crouching), weapon.isScoped());
  hud.setVitals(player.state.hp, player.state.armor, player.state.helmet, player.state.defuseKit, match.credits);
  hud.setWeapon(spec, weapon.currentAmmo(), weapon.state);
  hud.setZone(player.state.position.x, player.state.position.z);
  const vanAlive = bots.aliveCount('vanguard') + (player.state.alive ? 1 : 0);
  const obsAlive = bots.aliveCount('obsidian');
  const timeVal = match.phase === 'buy' ? match.phaseTimer : match.bombPlanted ? match.bombTimer : match.phaseTimer;
  const phaseLabel = match.phase === 'buy' ? `ROUND ${match.round} • BUY [B]` : match.bombPlanted ? `CORE ARMED • SITE ${match.bombPlanted}` : `ROUND ${match.round} • ${match.side === 'attack' ? 'BREACH' : 'DEFEND'}`;
  hud.setMatchBar(match.vanScore, match.obsScore, vanAlive, obsAlive, timeVal, phaseLabel, Boolean(match.bombPlanted));
}

function step(dt) {
  elapsed += dt;
  const canMove = match.phase === 'live' && !hud.isBuyOpen();
  const spec = weapon.currentSpec();

  player.step(dt, input.state.keys, spec.speedMult, canMove || match.phase === 'buy', (crouching) => {
    audio.footstep(crouching);
    if (!crouching) bots.notifyNoise(player.state.position, 'vanguard', 9.0);
  });
  weapon.step(dt, input.state.ads && !hud.isBuyOpen(), canMove ? player.groundSpeed() : 0);

  grenades.step(dt, (blastPos, kind, radius, maxDmg, throwerTeam) => {
    audio.explosion(kind);
    if (kind === 'smoke') {
      world.spawnSmokeScreen(blastPos, 3.25, 14.0);
      if (!shot) pushRadioCallout('Aegis', `Smoke deployed on ${getZoneName(blastPos.x, blastPos.z)}`);
      return;
    }
    if (kind === 'flash') {
      world.spawnImpact(blastPos, _upNorm, PALETTE.flash, 10);
      bots.applyFlash(blastPos, 16);
      if (player.state.alive) {
        const dist = player.state.position.distanceTo(blastPos);
        if (dist < 15) {
          camera.getWorldDirection(_dir);
          _flashDir.subVectors(blastPos, camera.position).normalize();
          if (_dir.dot(_flashDir) > 0.28) hud.flashBang(0.75 * (1 - dist / 15));
        }
      }
      return;
    }
    world.spawnImpact(blastPos, _upNorm, PALETTE.accent, 14);
    world.spawnSmokeBurst(blastPos, 6, PALETTE.smoke, 1.0);
    const atkId = throwerTeam === 'vanguard' ? 'you' : 'obsidian-0';
    bots.applyBlast(blastPos, radius, maxDmg, (bot, dmg) => recordDamage(atkId, bot.id, dmg, false), (bot) => {
      if (bot.team === 'obsidian') { recordKill(atkId, bot.id, false, 300); hud.pushKill('You', bot.name, 'Frag HE', false, 'vanguard'); }
      else { recordKill('obsidian-0', bot.id, false, 0); hud.pushKill('Frag HE', bot.name, 'Blast', false, 'obsidian'); }
    });
    if (player.state.alive) {
      const dist = player.state.position.distanceTo(blastPos);
      if (dist < radius) {
        const selfDmg = Math.round(maxDmg * 0.45 * (1 - dist / radius));
        if (selfDmg > 0 && player.takeDamage(selfDmg, false).killed) { hud.damageFlash(); recordKill('obsidian-0', 'you', false, 0); }
        else if (selfDmg > 0) hud.damageFlash();
      }
    }
  });

  bots.step(dt, match.phase === 'live' && !shot, player.state, match, {
    onShot(bot) {
      const d = bot.pos.distanceTo(player.state.position);
      if (d < 28) audio.shot('rifle', Math.max(0.15, 0.55 - d * 0.015));
    },
    onRadioContact(bot, enemyPos) {
      if (!shot) pushRadioCallout(bot.name, `Contact at ${getZoneName(enemyPos.x, enemyPos.z)}, holding crossfire`);
    },
    onHitPlayer(bot, dmg, isHead) {
      const r = player.takeDamage(dmg, isHead);
      recordDamage(bot.id, 'you', r.dmg, isHead);
      hud.damageFlash();
      if (r.killed) { recordKill(bot.id, 'you', isHead, 300); hud.pushKill(bot.name, 'You', 'AR-47', isHead, 'obsidian'); }
    },
    onBotHitBot(atk, vic, dmg, isHead) { recordDamage(atk.id, vic.id, dmg, isHead); },
    onBotKillBot(k, v, isHead) { recordKill(k.id, v.id, isHead, 300); hud.pushKill(k.name, v.name, 'AR-47', isHead, k.team); },
    onBotPlant(bot, siteId) {
      if (match.bombPlanted || match.phase !== 'live') return;
      match.bombPlanted = siteId; match.bombTimer = BOMB_SEC;
      world.setBombPlanted(siteId); audio.bombEvent('plant');
      hud.showBanner(`${bot.name} PLANTED CORE AT SITE ${siteId}`, 2600);
      pushRadioCallout('Nova', `Hostiles armed Core at Site ${siteId} — move to defuse!`);
    },
    onBotDefuse() {
      if (!match.bombPlanted || match.phase !== 'live') return;
      audio.bombEvent('defuse');
      endRound('obsidian', 'Core Defused', 'Defuse');
    },
  });

  world.step(dt, elapsed, match.bombPlanted ? 1 - match.bombTimer / BOMB_SEC : 0);
  if (shot) return;

  if (match.phase === 'buy') {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) { match.phase = 'live'; match.phaseTimer = ROUND_SEC; hud.showBanner(`ROUND ${match.round} LIVE — ENGAGE`, 1800); }
  } else if (match.phase === 'live') {
    match.roundElapsed += dt;
    handleBombAction(dt);
    if (match.bombPlanted) {
      match.bombTimer -= dt; match.bombTickAccum += dt;
      if (match.bombTickAccum >= Math.max(0.22, 0.95 * (match.bombTimer / BOMB_SEC))) { match.bombTickAccum = 0; audio.bombTick(match.bombTimer < 7); }
      if (match.bombTimer <= 0) { audio.bombEvent('boom'); endRound('vanguard', 'Core Detonated', 'Core'); }
    } else {
      match.phaseTimer -= dt;
      if (match.phaseTimer <= 0) endRound(match.side === 'defend' ? 'vanguard' : 'obsidian', 'Time Expired', 'Time');
    }
    const vanAlive = bots.aliveCount('vanguard') + (player.state.alive ? 1 : 0);
    const obsAlive = bots.aliveCount('obsidian');
    if (obsAlive === 0 && (!match.bombPlanted || match.side === 'attack')) endRound('vanguard', 'Obsidian Eliminated', 'Elim');
    else if (vanAlive === 0 && !match.bombPlanted) endRound('obsidian', 'Vanguard Eliminated', 'Elim');
  } else if (match.phase === 'roundEnd') {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) {
      if (match.vanScore >= WIN_ROUNDS || match.obsScore >= WIN_ROUNDS) {
        match.phase = 'matchEnd'; playing = false; input.setActive(false); input.exitLock();
        hud.showOverlay('end', buildMatchStats());
      } else setupRound(match.round + 1);
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
      if (input.state.firing && match.phase === 'live' && weapon.ready() && (spec.auto || !triggerConsumed)) {
        shoot(false); triggerConsumed = true;
      }
      if (!input.state.firing) triggerConsumed = false;
    }
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) { step(FIXED_STEP); accumulator -= FIXED_STEP; steps += 1; }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera(); syncAllyTags();
  }
  renderer.render(scene, camera);
}

const settle = (steps) => { for (let i = 0; i < steps; i += 1) step(FIXED_STEP); };
const placeBot = (idx, x, z, crouch = false, yaw = null) => {
  const b = bots.bots[idx];
  b.pos.set(x, 0, z);
  if (yaw !== null) { b.yaw = yaw; b.group.rotation.y = yaw; }
  b.crouching = crouch; b.crouch = crouch ? 1 : 0; b.spotted = true;
  bots.applyPose(b);
};
const tracer = (x1, y1, z1, x2, y2, z2, col) => { _shotA.set(x1, y1, z1); _shotB.set(x2, y2, z2); world.spawnTracer(_shotA, _shotB, col, 0.5); };

function runShot(name) {
  hud.hideOverlay(); hud.hideBuyMenu(); startNewMatch(); hud.showBanner(null, 0);

  if (name === 'start') {
    match.phase = 'live'; match.round = 3; match.vanScore = 2; match.obsScore = 1; match.credits = 2150; match.phaseTimer = 46;
    player.state.armor = 100; player.state.helmet = true;
    hud.setHudVisible(true); weapon.setVisible(true); weapon.giveWeapon('rifle');
    weapon.state.utility = { frag: 1, smoke: 0, flash: 1 };
    player.spawnAt(new THREE.Vector3(-16.0, 0, 3.6), 0);
    placeBot(0, -13.8, -0.4, false, 0.22); placeBot(1, -10.4, -1.2); placeBot(2, -18.2, 0.4); placeBot(3, -12.0, 2.2);
    placeBot(4, -14.2, -4.6); placeBot(5, -12.6, -7.8, true); placeBot(6, -16.8, -6.4);
    world.spawnSmokeScreen(_shotA.set(-9.8, 0.1, -9.2), 2.5, 14.0);
    settle(24);
    aimAt(_shotA.set(bots.bots[4].pos.x, 1.54, bots.bots[4].pos.z));
    shoot(true);
    tracer(-13.6, 1.15, -0.6, -12.6, 1.05, -7.8, PALETTE.vanguard);
    tracer(-16.8, 1.15, -6.4, -14.1, 1.25, -0.4, PALETTE.obsidian);
    hud.pushRadio('Kestrel', 'Contact at Reactor Bay A — pushing crossfire!', 0);
    settle(1);
  } else if (name === 'play') {
    match.phase = 'live'; match.round = 4; match.vanScore = 2; match.obsScore = 1; match.credits = 1950;
    match.bombPlanted = 'B'; match.bombTimer = 18.2; world.setBombPlanted('B');
    player.state.armor = 100; player.state.helmet = true; player.state.defuseKit = true;
    hud.setHudVisible(true); weapon.setVisible(true); weapon.giveWeapon('shotgun');
    weapon.state.utility = { frag: 1, smoke: 0, flash: 1 };
    player.spawnAt(new THREE.Vector3(15.3, 0, -3.7), 0);
    placeBot(1, 17.2, -7.6, true); placeBot(2, 12.2, -5.8);
    placeBot(4, 15.8, -14.0); placeBot(5, 12.6, -12.4); placeBot(6, 18.4, -12.8, true);
    world.spawnSmokeScreen(_shotA.set(9.6, 0.1, -11.4), 2.4, 14.0);
    settle(24);
    aimAt(_shotA.set(14.7, 0.92, -7.4));
    tracer(17.1, 0.85, -7.7, 15.8, 1.32, -14.0, PALETTE.vanguard);
    tracer(15.8, 1.25, -14.0, 17.2, 0.95, -7.6, PALETTE.obsidian);
    hud.pushRadio('Nova', 'Covering Dockyard defuse — holding flank!', 0);
    hud.setActionPrompt('Defusing Resonance Core [Kit]', 0.72);
    settle(1);
  } else if (name === 'buy') {
    match.phase = 'buy'; match.round = 3; match.vanScore = 1; match.obsScore = 1; match.credits = 2850;
    player.state.armor = 100; player.state.helmet = true; player.state.defuseKit = true;
    weapon.giveWeapon('rifle'); weapon.state.utility = { frag: 1, smoke: 1, flash: 0 };
    hud.setHudVisible(true); weapon.setVisible(true);
    player.spawnAt(new THREE.Vector3(0, 0, 15.2), 0);
    placeBot(0, -4.6, 8.8); placeBot(1, 4.6, 8.8);
    settle(12);
    hud.showBuyMenu(match.credits, weapon.state, player.state);
  } else if (name === 'end') {
    match.phase = 'matchEnd'; match.vanScore = 5; match.obsScore = 2;
    const preset = [
      [14, 3, 3, 28, 16, 2140, 3, 3450], [9, 5, 4, 24, 9, 1460, 1, 2900],
      [7, 4, 4, 19, 6, 1180, 1, 2650], [6, 6, 5, 16, 4, 980, 0, 2200], [5, 5, 5, 14, 4, 860, 0, 2050],
      [8, 2, 7, 22, 7, 1310, 1, 2450], [6, 3, 7, 18, 5, 1020, 1, 2100],
      [5, 3, 7, 15, 4, 890, 0, 1950], [4, 4, 7, 14, 3, 790, 0, 1850], [3, 2, 8, 11, 2, 620, 0, 1650],
    ];
    for (let i = 0; i < roster.length; i += 1) {
      const [kills, assists, deaths, hits, headshots, damage, mvp, credits] = preset[i];
      Object.assign(roster[i], { kills, assists, deaths, hits, headshots, damage, mvp, credits });
    }
    match.roundHistory = [
      ['vanguard', 'Core'], ['obsidian', 'Elim'], ['vanguard', 'Defuse'], ['vanguard', 'Core'],
      ['obsidian', 'Time'], ['vanguard', 'Elim'], ['vanguard', 'Core'],
    ].map(([winner, tag], idx) => ({ round: idx + 1, winner, tag }));
    hud.setHudVisible(false); world.setBombPlanted('B');
    overviewCam = { pos: new THREE.Vector3(14.5, 4.4, 6.2), look: new THREE.Vector3(14.8, 1.4, -6.5) };
    weapon.setVisible(false);
    placeBot(0, 10.6, -1.2); placeBot(1, 18.6, -1.6); placeBot(4, 15.2, -8.2);
    settle(6);
    hud.showOverlay('end', buildMatchStats());
  }

  hud.drawRadar(world.radarBoxes, player.state, bots.bots, match.bombPlanted);
  syncHud(); syncCamera(); syncAllyTags();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera(); renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) { window.__shotReady = true; frozen = true; }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) runShot(shot);
else {
  hud.setHudVisible(false);
  hud.showOverlay('start', buildMatchStats());
  hud.drawRadar(world.radarBoxes, player.state, bots.bots, null);
  syncHud();
  requestAnimationFrame(frame);
}
