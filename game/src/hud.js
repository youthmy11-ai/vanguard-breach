// Tactical DOM HUD, 2D Radar + zone label, radio callouts, 4-column Armory [B], ally markers & 4v4 scoreboard.
import { getZoneName, MAP_BOUNDS, SITES } from './map.js';
import { PALETTE } from './palette.js';
import { WEAPONS } from './weapons.js';

export const BUY_COLUMNS = [
  {
    title: 'Sidearms',
    items: [
      { id: 'pistol', title: 'VX-9 Sidearm', type: 'weapon', price: 0, key: '', desc: 'Starter 9mm • 12 Mag • 2.6x HS' },
      { id: 'deagle', title: 'Viper .44 Magnum', type: 'weapon', price: WEAPONS.deagle.price, key: '1', desc: '48 DMG • 2.8x Head Crit' },
    ],
  },
  {
    title: 'Primaries',
    items: [
      { id: 'smg', title: 'Kestrel MP-7', type: 'weapon', price: WEAPONS.smg.price, key: '2', desc: 'Rapid PDW • 32 Mag • Fast Move' },
      { id: 'shotgun', title: 'Breacher 12', type: 'weapon', price: WEAPONS.shotgun.price, key: '3', desc: '8-Pellet Shotgun • 128 CQB DMG' },
      { id: 'rifle', title: 'Vanguard AR-47', type: 'weapon', price: WEAPONS.rifle.price, key: '4', desc: '34 DMG • 3.1x Head Crit' },
      { id: 'sniper', title: 'Helios M90', type: 'weapon', price: WEAPONS.sniper.price, key: '5', desc: '105 DMG • 2.5x Optic Scope' },
    ],
  },
  {
    title: 'Utility',
    items: [
      { id: 'frag', title: 'Frag HE Grenade', type: 'util', price: 250, key: '6', desc: 'HE Arc Blast [4] • Max 2' },
      { id: 'smoke', title: 'Smoke Grenade', type: 'util', price: 300, key: '7', desc: '14s LOS Screen [5] • Max 2' },
      { id: 'flash', title: 'Flashbang', type: 'util', price: 200, key: '8', desc: 'Blinds Hostiles [6] • Max 2' },
    ],
  },
  {
    title: 'Gear',
    items: [
      { id: 'vest', title: 'Kevlar Vest', type: 'vest', price: 500, key: '', desc: '100 Armor • Absorbs 44% Hits' },
      { id: 'armor', title: 'Vest + Helmet', type: 'armor', price: 850, key: '9', desc: '100+H Armor • Head Protection' },
      { id: 'kit', title: 'Defuse Kit', type: 'kit', price: 350, key: '0', desc: 'Cuts Core Defuse 5.0s → 2.5s' },
    ],
  },
];

export const BUY_HOTKEYS = {};
for (const col of BUY_COLUMNS) for (const item of col.items) if (item.key) BUY_HOTKEYS[item.key] = item;

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), crosshair: $('crosshair'), scope: $('scope-overlay'), hitmarker: $('hitmarker'),
    vignette: $('damage-vignette'), flashBang: $('flash-overlay'), radar: $('radar'),
    radarLabel: $('radar-label'), radioFeed: $('radio-feed'),
    allyTags: [$('ally-0'), $('ally-1'), $('ally-2')],
    scoreVan: $('score-van'), scoreObs: $('score-obs'), pipsVan: $('pips-van'), pipsObs: $('pips-obs'),
    timer: $('round-timer'), phase: $('round-phase'), killfeed: $('killfeed'), banner: $('banner'),
    actionWrap: $('action-wrap'), actionText: $('action-text'), actionFill: $('action-bar-fill'),
    hpVal: $('hp-val'), hpFill: $('hp-fill'), armorVal: $('armor-val'), armorFill: $('armor-fill'),
    kitTag: $('kit-tag'), creditsVal: $('credits-val'),
    weaponName: $('weapon-name'), ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'),
    slot1: $('slot-1'), slot2: $('slot-2'), slot3: $('slot-3'), slotUtil: $('slot-util'),
    buyMenu: $('buy-menu'), buyCredits: $('buy-credits'), buyCols: $('buy-cols'), buyClose: $('buy-close'),
    overlay: $('overlay'), overlayTag: $('overlay-tag'), overlayTitle: $('overlay-title'),
    overlayCopy: $('overlay-copy'), mvpBanner: $('mvp-banner'), scoreboard: $('scoreboard'),
    roundStrip: $('round-strip'), keysList: $('keys-list'), playBtn: $('play'),
  };

  const rCtx = el.radar.getContext('2d');
  const spanX = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const spanZ = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
  const rW = el.radar.width, rH = el.radar.height;
  const scX = rW / spanX, scZ = rH / spanZ;
  let hitT = 0, vigT = 0, flsT = 0, banT = 0, buyCb = null, closeCb = null;

  const cache = {};
  const changed = (k, v) => (cache[k] === v ? false : ((cache[k] = v), true));

  const effectivePrice = (item, armor, helmet) => (item.type === 'armor' && armor >= 50 && !helmet ? 350 : item.price);

  function renderBuyCards(credits, weaponState, playerState) {
    el.buyCredits.textContent = `$${credits}`;
    el.buyCols.innerHTML = BUY_COLUMNS.map((col) => {
      const cards = col.items.map((item) => {
        const price = effectivePrice(item, playerState.armor, playerState.helmet);
        const owned =
          (item.type === 'weapon' && weaponState.owned[item.id]) ||
          (item.type === 'vest' && playerState.armor >= 100) ||
          (item.type === 'armor' && playerState.armor >= 100 && playerState.helmet) ||
          (item.type === 'kit' && playerState.defuseKit) ||
          (item.type === 'util' && (weaponState.utility[item.id] ?? 0) >= 2);
        const disabled = owned || credits < price;
        const count = item.type === 'util' ? ` (${weaponState.utility[item.id] ?? 0}/2)` : '';
        return `<button type="button" class="buy-card${owned ? ' owned' : ''}" data-buy="${item.id}"${disabled ? ' disabled' : ''}>` +
          `<div class="buy-title"><span>${item.key ? `[${item.key}] ` : ''}${item.title}${count}</span><span class="buy-price">${owned ? 'OWNED' : `$${price}`}</span></div>` +
          `<div class="buy-stats">${item.desc}</div></button>`;
      }).join('');
      return `<div class="buy-col"><div class="buy-col-head">${col.title}</div>${cards}</div>`;
    }).join('');
  }

  el.buyCols.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-buy]');
    if (!btn || !buyCb) return;
    const id = btn.getAttribute('data-buy');
    for (const col of BUY_COLUMNS) {
      const item = col.items.find((x) => x.id === id);
      if (item) { buyCb(item); break; }
    }
  });
  el.buyClose.addEventListener('click', () => { if (closeCb) closeCb(); });

  function renderScoreboard(roster) {
    if (!roster || roster.length === 0) return '';
    const teamBlock = (team, label, cls) => {
      const rows = roster.filter((r) => r.team === team)
        .sort((a, b) => (b.kills * 3 + b.assists - b.deaths + b.damage * 0.005) - (a.kills * 3 + a.assists - a.deaths + a.damage * 0.005))
        .map((p) => {
          const hs = p.hits > 0 ? Math.round((p.headshots / p.hits) * 100) : 0;
          return `<tr class="${p.isPlayer ? 'sb-you' : ''}"><td class="sb-name">${p.name}</td><td>${p.kills}</td><td>${p.assists}</td><td>${p.deaths}</td><td>${hs}%</td><td>${p.damage}</td><td>${p.mvp > 0 ? `★${p.mvp}` : '—'}</td><td>$${p.credits}</td></tr>`;
        }).join('');
      return `<tr class="sb-team ${cls}"><th colspan="8">${label}</th></tr>${rows}`;
    };
    return `<table><thead><tr><th>Player</th><th>K</th><th>A</th><th>D</th><th>HS%</th><th>DMG</th><th>MVP</th><th>Cash</th></tr></thead><tbody>` +
      teamBlock('vanguard', 'VANGUARD STRIKE', 'van') + teamBlock('obsidian', 'OBSIDIAN WARDENS', 'obs') + '</tbody></table>';
  }

  return {
    effectivePrice,
    setHudVisible(v) { el.hud.hidden = !v; },
    setCrosshair(spread, scoped) {
      if (changed('scoped', Boolean(scoped))) {
        el.scope.classList.toggle('on', Boolean(scoped));
        el.crosshair.style.display = scoped ? 'none' : 'block';
      }
      const gap = Math.round(4 + Math.min(24, spread * 460));
      if (changed('gap', gap)) el.crosshair.style.setProperty('--gap', `${gap}px`);
    },
    hitMarker(hs, holdMs = 95) {
      el.hitmarker.classList.add('on');
      el.hitmarker.classList.toggle('head', Boolean(hs));
      el.hitmarker.style.transform = hs ? 'translate(-50%, -50%) rotate(45deg) scale(1.28)' : '';
      clearTimeout(hitT);
      hitT = setTimeout(() => { el.hitmarker.classList.remove('on', 'head'); el.hitmarker.style.transform = ''; }, holdMs);
    },
    damageFlash() {
      el.vignette.style.opacity = '1';
      clearTimeout(vigT);
      vigT = setTimeout(() => { el.vignette.style.opacity = '0'; }, 180);
    },
    flashBang(strength = 0.75) {
      el.flashBang.style.opacity = String(Math.min(0.85, strength));
      clearTimeout(flsT);
      flsT = setTimeout(() => { el.flashBang.style.opacity = '0'; }, 380);
    },
    setVitals(hp, armor, helmet, kit, credits) {
      const chp = Math.max(0, hp), carm = Math.max(0, armor);
      const aTxt = carm > 0 && helmet ? `${carm}+H` : String(carm);
      if (changed('hp', chp)) {
        el.hpVal.textContent = String(chp);
        el.hpFill.style.width = `${Math.min(100, chp)}%`;
        el.hpFill.style.background = chp > 35 ? '#22c55e' : PALETTE.obsidian;
      }
      if (changed('aTxt', aTxt)) el.armorVal.textContent = aTxt;
      if (changed('aPct', carm)) el.armorFill.style.width = `${Math.min(100, carm)}%`;
      if (changed('kit', Boolean(kit))) el.kitTag.hidden = !kit;
      if (changed('cred', credits)) el.creditsVal.textContent = `$${credits}`;
    },
    setZone(x, z) {
      const zone = getZoneName(x, z);
      if (changed('zone', zone)) el.radarLabel.textContent = zone;
    },
    setWeapon(spec, ammo, ws) {
      const label = ws.reloadLeft > 0 ? `${spec.name} • RELOADING` : spec.name;
      if (changed('wLbl', label)) el.weaponName.textContent = label;
      const mag = spec.melee ? -1 : ammo.mag, res = spec.melee ? -1 : ammo.reserve;
      if (changed('mag', mag) || changed('res', res)) {
        el.ammoMag.textContent = spec.melee ? '—' : String(mag);
        el.ammoReserve.textContent = spec.melee ? 'MELEE' : `/ ${res}`;
        el.ammoMag.classList.toggle('low', !spec.melee && mag <= Math.ceil(spec.magSize * 0.25));
      }
      const u = ws.utility;
      const sk = `${spec.slot}|${ws.primaryId}|${ws.sidearmId}|${u.frag}|${u.smoke}|${u.flash}|${ws.activeUtil}`;
      if (changed('sk', sk)) {
        el.slot1.textContent = ws.primaryId ? `1 ${WEAPONS[ws.primaryId].name.split(' ')[0]}` : '1 Empty';
        el.slot1.classList.toggle('active', spec.slot === 1);
        el.slot2.textContent = `2 ${WEAPONS[ws.sidearmId || 'pistol'].name.split(' ')[0]}`;
        el.slot2.classList.toggle('active', spec.slot === 2);
        el.slot3.classList.toggle('active', spec.slot === 3);
        el.slotUtil.textContent = `4 Frag(${u.frag}) · 5 Smoke(${u.smoke}) · 6 Flash(${u.flash}) · G:${ws.activeUtil.toUpperCase()}`;
      }
    },
    setMatchBar(vanScore, obsScore, vanAlive, obsAlive, timeSec, phaseLabel, armed) {
      if (changed('vs', vanScore)) el.scoreVan.textContent = String(vanScore);
      if (changed('os', obsScore)) el.scoreObs.textContent = String(obsScore);
      const sec = Math.max(0, Math.floor(timeSec));
      if (changed('sec', sec)) el.timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      if (changed('arm', Boolean(armed))) el.timer.classList.toggle('armed', Boolean(armed));
      if (changed('ph', phaseLabel)) el.phase.textContent = phaseLabel;
      if (changed('va', vanAlive)) el.pipsVan.innerHTML = [0, 1, 2, 3].map((i) => `<span class="pip van ${i < vanAlive ? 'on' : ''}"></span>`).join('');
      if (changed('oa', obsAlive)) el.pipsObs.innerHTML = [0, 1, 2, 3].map((i) => `<span class="pip obs ${i < obsAlive ? 'on' : ''}"></span>`).join('');
    },
    setActionPrompt(text, progress01) {
      if (!text) { el.actionWrap.hidden = true; return; }
      el.actionWrap.hidden = false;
      el.actionText.textContent = text;
      el.actionFill.style.width = `${Math.round(Math.max(0, Math.min(1, progress01)) * 100)}%`;
    },
    showBanner(text, holdMs = 2400) {
      if (!text) { el.banner.hidden = true; return; }
      el.banner.textContent = text; el.banner.hidden = false;
      clearTimeout(banT);
      if (holdMs > 0) banT = setTimeout(() => { el.banner.hidden = true; }, holdMs);
    },
    pushKill(killer, victim, weaponName, hs, team) {
      const row = document.createElement('div');
      row.className = 'kf-row';
      const kC = team === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian;
      const vC = team === 'vanguard' ? PALETTE.obsidian : PALETTE.vanguard;
      row.innerHTML = `<span style="color:${kC};font-weight:600">${killer}</span><span style="color:var(--muted)">[${weaponName}]</span>${hs ? '<span class="kf-hs">HS</span>' : ''}<span style="color:${vC};font-weight:600">${victim}</span>`;
      el.killfeed.prepend(row);
      while (el.killfeed.children.length > 4) el.killfeed.lastChild.remove();
      setTimeout(() => { if (row.parentNode) row.remove(); }, 5200);
    },
    clearKillfeed() { el.killfeed.innerHTML = ''; },
    pushRadio(sender, text, holdMs = 4600) {
      const row = document.createElement('div');
      row.className = 'radio-row';
      row.innerHTML = `<span class="radio-who">${sender}:</span> ${text}`;
      el.radioFeed.prepend(row);
      while (el.radioFeed.children.length > 3) el.radioFeed.lastChild.remove();
      if (holdMs > 0) setTimeout(() => { if (row.parentNode) row.remove(); }, holdMs);
    },
    clearRadio() { el.radioFeed.innerHTML = ''; },
    setAllyTag(idx, visible, x, y, name, hp) {
      const node = el.allyTags[idx];
      if (!node) return;
      if (!visible) { if (!node.hidden) node.hidden = true; return; }
      if (node.hidden) node.hidden = false;
      node.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0) translate(-50%,-100%)`;
      const txt = `${name} ${hp}`;
      if (node.textContent !== txt) node.textContent = txt;
    },
    drawRadar(radarBoxes, playerState, bots, bombSite) {
      rCtx.fillStyle = '#141b25';
      rCtx.fillRect(0, 0, rW, rH);
      rCtx.fillStyle = '#334054';
      for (let i = 0; i < radarBoxes.length; i += 1) {
        const b = radarBoxes[i];
        const cx = ((b.x - MAP_BOUNDS.minX) / spanX) * rW, cz = ((b.z - MAP_BOUNDS.minZ) / spanZ) * rH;
        const bw = Math.max(2, b.w * scX), bd = Math.max(2, b.d * scZ);
        rCtx.fillRect(cx - bw * 0.5, cz - bd * 0.5, bw, bd);
      }
      for (let i = 0; i < SITES.length; i += 1) {
        const s = SITES[i];
        const sx = ((s.center.x - MAP_BOUNDS.minX) / spanX) * rW, sz = ((s.center.z - MAP_BOUNDS.minZ) / spanZ) * rH;
        rCtx.strokeStyle = bombSite === s.id ? PALETTE.obsidian : s.color;
        rCtx.lineWidth = 1.5; rCtx.strokeRect(sx - 8, sz - 8, 16, 16);
        rCtx.fillStyle = s.color; rCtx.font = 'bold 10px monospace'; rCtx.textAlign = 'center'; rCtx.textBaseline = 'middle';
        rCtx.fillText(s.id, sx, sz);
      }
      for (let i = 0; i < bots.length; i += 1) {
        const bot = bots[i];
        if (!bot.alive || (bot.team === 'obsidian' && !bot.spotted)) continue;
        rCtx.fillStyle = bot.team === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian;
        rCtx.beginPath();
        rCtx.arc(((bot.pos.x - MAP_BOUNDS.minX) / spanX) * rW, ((bot.pos.z - MAP_BOUNDS.minZ) / spanZ) * rH, 3.3, 0, Math.PI * 2);
        rCtx.fill();
      }
      if (playerState.alive) {
        const px = ((playerState.position.x - MAP_BOUNDS.minX) / spanX) * rW, pz = ((playerState.position.z - MAP_BOUNDS.minZ) / spanZ) * rH;
        rCtx.strokeStyle = 'rgba(245,158,11,0.65)'; rCtx.lineWidth = 1.5;
        rCtx.beginPath(); rCtx.moveTo(px, pz); rCtx.lineTo(px - Math.sin(playerState.yaw) * 14, pz - Math.cos(playerState.yaw) * 14); rCtx.stroke();
        rCtx.fillStyle = PALETTE.accent; rCtx.beginPath(); rCtx.arc(px, pz, 3.8, 0, Math.PI * 2); rCtx.fill();
      }
    },
    showBuyMenu(credits, ws, ps) { renderBuyCards(credits, ws, ps); el.buyMenu.hidden = false; },
    hideBuyMenu() { el.buyMenu.hidden = true; },
    isBuyOpen() { return !el.buyMenu.hidden; },
    showOverlay(mode, stats) {
      el.buyMenu.hidden = true;
      el.overlay.classList.toggle('start-mode', mode === 'start');
      el.overlay.classList.toggle('end-mode', mode === 'end');
      el.keysList.hidden = mode === 'end';
      if (mode === 'start') {
        el.overlayTag.textContent = '4v4 Tactical Arena • Solstice Foundry';
        el.overlayTitle.textContent = 'Vanguard Breach';
        el.overlayCopy.textContent = 'Lead Vanguard Strike against Obsidian Wardens across Reactor Bay (A), Mid Archway, and Container Dock (B). First to 5 rounds wins.';
        el.mvpBanner.hidden = true; el.scoreboard.hidden = true; el.roundStrip.hidden = true;
        el.playBtn.textContent = 'Play Match';
      } else if (mode === 'paused') {
        el.overlayTag.textContent = 'Match Paused';
        el.overlayTitle.textContent = 'Tactical Hold';
        el.overlayCopy.textContent = 'Pointer lock released. Click below to re-enter the arena.';
        el.mvpBanner.hidden = true; el.scoreboard.hidden = true; el.roundStrip.hidden = true;
        el.playBtn.textContent = 'Resume Match';
      } else {
        const won = stats.vanScore > stats.obsScore;
        el.overlayTag.textContent = `Match Final • ${stats.vanScore} – ${stats.obsScore}`;
        el.overlayTitle.textContent = won ? 'Vanguard Victory' : 'Obsidian Victory';
        el.overlayCopy.textContent = won ? 'Solstice Foundry secured. Vanguard Strike dominated the lanes.' : 'Obsidian Wardens held the foundry. Regroup and breach again.';
        el.mvpBanner.textContent = `MATCH MVP • ${stats.mvpName} — ${stats.mvpKills} KILLS • ${stats.mvpHsPct}% HS • ${stats.mvpDamage} DMG`;
        el.mvpBanner.hidden = false;
        el.scoreboard.innerHTML = renderScoreboard(stats.roster);
        el.scoreboard.hidden = false;
        el.roundStrip.hidden = !(stats.roundHistory && stats.roundHistory.length > 0);
        if (!el.roundStrip.hidden) {
          el.roundStrip.innerHTML = stats.roundHistory.map((r) => `<div class="rnd-pill ${r.winner === 'vanguard' ? 'van' : 'obs'}">R${r.round} ${r.winner === 'vanguard' ? 'WIN' : 'LOSS'}<span>${r.tag}</span></div>`).join('');
        }
        el.playBtn.textContent = 'Play Again';
      }
      el.overlay.hidden = false;
    },
    hideOverlay() { el.overlay.hidden = true; },
    onPlay(h) { el.playBtn.addEventListener('click', h); },
    onBuy(h) { buyCb = h; },
    onBuyClose(h) { closeCb = h; },
  };
}
