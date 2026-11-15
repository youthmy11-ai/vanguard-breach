// Tactical DOM HUD, 2D Radar canvas, Buy Menu, Kill Feed, Damage Vignette, and Match Summary.
import { MAP_BOUNDS, SITES } from './map.js';
import { PALETTE } from './palette.js';
import { WEAPONS } from './weapons.js';

const BUY_ITEMS = [
  { id: 'deagle', title: 'Viper .44 Magnum', type: 'weapon', price: WEAPONS.deagle.price, desc: 'Heavy Sidearm • 48 DMG • 2.8x Head Crit' },
  { id: 'smg', title: 'Kestrel MP-7', type: 'weapon', price: WEAPONS.smg.price, desc: 'Rapid PDW • 32 Mag • High Mobility' },
  { id: 'rifle', title: 'Vanguard AR-47', type: 'weapon', price: WEAPONS.rifle.price, desc: 'Precision Rifle • 34 DMG • 3.1x Head Crit' },
  { id: 'sniper', title: 'Helios M90', type: 'weapon', price: WEAPONS.sniper.price, desc: 'Bolt Sniper • 105 DMG • 2.5x Optic Scope' },
  { id: 'armor', title: 'Kevlar + Helmet', type: 'armor', price: 600, desc: '100 Armor • Absorbs 48% Incoming Hit' },
  { id: 'grenade', title: 'Frag HE Grenade', type: 'grenade', price: 200, desc: 'HE Arc Blast [G] • Max 2 Carried' },
];

export function createHud() {
  const el = {
    hud: document.getElementById('hud'),
    crosshair: document.getElementById('crosshair'),
    scope: document.getElementById('scope-overlay'),
    hitmarker: document.getElementById('hitmarker'),
    vignette: document.getElementById('damage-vignette'),
    radar: document.getElementById('radar'),
    scoreVan: document.getElementById('score-van'),
    scoreObs: document.getElementById('score-obs'),
    pipsVan: document.getElementById('pips-van'),
    pipsObs: document.getElementById('pips-obs'),
    timer: document.getElementById('round-timer'),
    phase: document.getElementById('round-phase'),
    killfeed: document.getElementById('killfeed'),
    banner: document.getElementById('banner'),
    actionWrap: document.getElementById('action-wrap'),
    actionText: document.getElementById('action-text'),
    actionFill: document.getElementById('action-bar-fill'),
    hpVal: document.getElementById('hp-val'),
    hpFill: document.getElementById('hp-fill'),
    armorVal: document.getElementById('armor-val'),
    armorFill: document.getElementById('armor-fill'),
    creditsVal: document.getElementById('credits-val'),
    weaponName: document.getElementById('weapon-name'),
    ammoMag: document.getElementById('ammo-mag'),
    ammoReserve: document.getElementById('ammo-reserve'),
    slot1: document.getElementById('slot-1'),
    slot2: document.getElementById('slot-2'),
    slot3: document.getElementById('slot-3'),
    slotG: document.getElementById('slot-g'),
    buyMenu: document.getElementById('buy-menu'),
    buyCredits: document.getElementById('buy-credits'),
    buyGrid: document.getElementById('buy-grid'),
    buyClose: document.getElementById('buy-close'),
    overlay: document.getElementById('overlay'),
    overlayTag: document.getElementById('overlay-tag'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayCopy: document.getElementById('overlay-copy'),
    mvpBanner: document.getElementById('mvp-banner'),
    statsGrid: document.getElementById('stats-grid'),
    statKd: document.getElementById('stat-kd'),
    statHs: document.getElementById('stat-hs'),
    statDmg: document.getElementById('stat-dmg'),
    statScore: document.getElementById('stat-score'),
    roundStrip: document.getElementById('round-strip'),
    playBtn: document.getElementById('play'),
  };

  const radarCtx = el.radar.getContext('2d');
  const mapSpanX = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapSpanZ = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
  const radarW = el.radar.width;
  const radarH = el.radar.height;
  const scaleX = radarW / mapSpanX;
  const scaleZ = radarH / mapSpanZ;

  let hitTimer = 0;
  let vignetteTimer = 0;
  let bannerTimer = 0;
  let buyHandler = null;
  let closeBuyHandler = null;

  const cache = {
    hp: -1,
    armor: -1,
    credits: -1,
    vanScore: -1,
    obsScore: -1,
    vanAlive: -1,
    obsAlive: -1,
    timeSec: -1,
    phaseLabel: '',
    armed: null,
    weaponLabel: '',
    mag: -9,
    reserve: -9,
    slotKey: '',
    gap: -1,
    scoped: null,
  };

  function renderBuyCards(credits, weaponState, armor) {
    el.buyCredits.textContent = `$${credits}`;
    el.buyGrid.innerHTML = '';
    BUY_ITEMS.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'buy-card';
      const owned =
        (item.type === 'weapon' && weaponState.owned[item.id]) ||
        (item.type === 'armor' && armor >= 100) ||
        (item.type === 'grenade' && weaponState.grenades >= 2);
      if (owned) btn.classList.add('owned');
      btn.disabled = owned || credits < item.price;
      const priceLabel = owned ? 'OWNED' : `$${item.price}`;
      btn.innerHTML = `<div class="buy-title"><span>[${idx + 1}] ${item.title}</span><span class="buy-price">${priceLabel}</span></div><div class="buy-stats">${item.desc}</div>`;
      btn.addEventListener('click', () => {
        if (buyHandler) buyHandler(item);
      });
      el.buyGrid.appendChild(btn);
    });
  }

  el.buyClose.addEventListener('click', () => {
    if (closeBuyHandler) closeBuyHandler();
  });

  return {
    BUY_ITEMS,
    setHudVisible(visible) {
      el.hud.hidden = !visible;
    },
    setCrosshair(spread, scoped) {
      if (cache.scoped !== Boolean(scoped)) {
        cache.scoped = Boolean(scoped);
        el.scope.classList.toggle('on', cache.scoped);
        el.crosshair.style.display = cache.scoped ? 'none' : 'block';
      }
      const gap = Math.round(4 + Math.min(24, spread * 460));
      if (cache.gap !== gap) {
        cache.gap = gap;
        el.crosshair.style.setProperty('--gap', `${gap}px`);
      }
    },
    hitMarker(headshot, holdMs = 95) {
      el.hitmarker.classList.add('on');
      el.hitmarker.classList.toggle('head', Boolean(headshot));
      el.hitmarker.style.transform = headshot ? 'translate(-50%, -50%) rotate(45deg) scale(1.28)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        el.hitmarker.classList.remove('on', 'head');
        el.hitmarker.style.transform = '';
      }, holdMs);
    },
    damageFlash() {
      el.vignette.style.opacity = '1';
      clearTimeout(vignetteTimer);
      vignetteTimer = setTimeout(() => {
        el.vignette.style.opacity = '0';
      }, 180);
    },
    setVitals(hp, armor, credits) {
      const clampedHp = Math.max(0, hp);
      const clampedArmor = Math.max(0, armor);
      if (cache.hp !== clampedHp) {
        cache.hp = clampedHp;
        el.hpVal.textContent = String(clampedHp);
        el.hpFill.style.width = `${Math.min(100, clampedHp)}%`;
        el.hpFill.style.background = clampedHp > 35 ? '#22c55e' : PALETTE.obsidian;
      }
      if (cache.armor !== clampedArmor) {
        cache.armor = clampedArmor;
        el.armorVal.textContent = String(clampedArmor);
        el.armorFill.style.width = `${Math.min(100, clampedArmor)}%`;
      }
      if (cache.credits !== credits) {
        cache.credits = credits;
        el.creditsVal.textContent = `$${credits}`;
      }
    },
    setWeapon(spec, ammo, weaponState) {
      const label = weaponState.reloadLeft > 0 ? `${spec.name} • RELOADING` : spec.name;
      if (cache.weaponLabel !== label) {
        cache.weaponLabel = label;
        el.weaponName.textContent = label;
      }
      const magVal = spec.melee ? -1 : ammo.mag;
      const resVal = spec.melee ? -1 : ammo.reserve;
      if (cache.mag !== magVal || cache.reserve !== resVal) {
        cache.mag = magVal;
        cache.reserve = resVal;
        if (spec.melee) {
          el.ammoMag.textContent = '—';
          el.ammoReserve.textContent = 'MELEE';
          el.ammoMag.classList.remove('low');
        } else {
          el.ammoMag.textContent = String(ammo.mag);
          el.ammoReserve.textContent = `/ ${ammo.reserve}`;
          el.ammoMag.classList.toggle('low', ammo.mag <= Math.ceil(spec.magSize * 0.25));
        }
      }
      const slotKey = `${spec.slot}|${weaponState.primaryId}|${weaponState.sidearmId}|${weaponState.grenades}`;
      if (cache.slotKey !== slotKey) {
        cache.slotKey = slotKey;
        el.slot1.textContent = weaponState.primaryId ? `1 ${WEAPONS[weaponState.primaryId].name.split(' ')[0]}` : '1 Empty';
        el.slot1.classList.toggle('active', spec.slot === 1);
        el.slot2.textContent = `2 ${WEAPONS[weaponState.sidearmId || 'pistol'].name.split(' ')[0]}`;
        el.slot2.classList.toggle('active', spec.slot === 2);
        el.slot3.classList.toggle('active', spec.slot === 3);
        el.slotG.textContent = `G Frag (${weaponState.grenades})`;
      }
    },
    setMatchBar(vanScore, obsScore, vanAlive, obsAlive, timeSec, phaseLabel, armed) {
      if (cache.vanScore !== vanScore) {
        cache.vanScore = vanScore;
        el.scoreVan.textContent = String(vanScore);
      }
      if (cache.obsScore !== obsScore) {
        cache.obsScore = obsScore;
        el.scoreObs.textContent = String(obsScore);
      }
      const secInt = Math.max(0, Math.floor(timeSec));
      if (cache.timeSec !== secInt) {
        cache.timeSec = secInt;
        const mins = Math.floor(secInt / 60);
        const secs = secInt % 60;
        el.timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      if (cache.armed !== Boolean(armed)) {
        cache.armed = Boolean(armed);
        el.timer.classList.toggle('armed', cache.armed);
      }
      if (cache.phaseLabel !== phaseLabel) {
        cache.phaseLabel = phaseLabel;
        el.phase.textContent = phaseLabel;
      }
      if (cache.vanAlive !== vanAlive) {
        cache.vanAlive = vanAlive;
        let vHtml = '';
        for (let i = 0; i < 4; i += 1) vHtml += `<span class="pip van ${i < vanAlive ? 'on' : ''}"></span>`;
        el.pipsVan.innerHTML = vHtml;
      }
      if (cache.obsAlive !== obsAlive) {
        cache.obsAlive = obsAlive;
        let oHtml = '';
        for (let i = 0; i < 4; i += 1) oHtml += `<span class="pip obs ${i < obsAlive ? 'on' : ''}"></span>`;
        el.pipsObs.innerHTML = oHtml;
      }
    },
    setActionPrompt(text, progress01) {
      if (!text) {
        el.actionWrap.hidden = true;
        return;
      }
      el.actionWrap.hidden = false;
      el.actionText.textContent = text;
      el.actionFill.style.width = `${Math.round(Math.max(0, Math.min(1, progress01)) * 100)}%`;
    },
    showBanner(text, holdMs = 2400) {
      if (!text) {
        el.banner.hidden = true;
        return;
      }
      el.banner.textContent = text;
      el.banner.hidden = false;
      clearTimeout(bannerTimer);
      if (holdMs > 0) {
        bannerTimer = setTimeout(() => {
          el.banner.hidden = true;
        }, holdMs);
      }
    },
    pushKill(killer, victim, weaponName, headshot, killerTeam) {
      const row = document.createElement('div');
      row.className = 'kf-row';
      const kCol = killerTeam === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian;
      const vCol = killerTeam === 'vanguard' ? PALETTE.obsidian : PALETTE.vanguard;
      row.innerHTML = `<span style="color:${kCol};font-weight:600">${killer}</span><span style="color:var(--muted)">[${weaponName}]</span>${headshot ? '<span class="kf-hs">HS</span>' : ''}<span style="color:${vCol};font-weight:600">${victim}</span>`;
      el.killfeed.prepend(row);
      while (el.killfeed.children.length > 4) el.killfeed.lastChild.remove();
      setTimeout(() => {
        if (row.parentNode) row.remove();
      }, 5200);
    },
    clearKillfeed() {
      el.killfeed.innerHTML = '';
    },
    drawRadar(radarBoxes, playerState, bots, bombPlantedSite) {
      radarCtx.fillStyle = '#141b25';
      radarCtx.fillRect(0, 0, radarW, radarH);

      radarCtx.fillStyle = '#334054';
      for (let i = 0; i < radarBoxes.length; i += 1) {
        const b = radarBoxes[i];
        const cx = ((b.x - MAP_BOUNDS.minX) / mapSpanX) * radarW;
        const cz = ((b.z - MAP_BOUNDS.minZ) / mapSpanZ) * radarH;
        const bw = Math.max(2, b.w * scaleX);
        const bd = Math.max(2, b.d * scaleZ);
        radarCtx.fillRect(cx - bw * 0.5, cz - bd * 0.5, bw, bd);
      }

      for (let i = 0; i < SITES.length; i += 1) {
        const site = SITES[i];
        const sx = ((site.center.x - MAP_BOUNDS.minX) / mapSpanX) * radarW;
        const sz = ((site.center.z - MAP_BOUNDS.minZ) / mapSpanZ) * radarH;
        radarCtx.strokeStyle = bombPlantedSite === site.id ? PALETTE.obsidian : site.color;
        radarCtx.lineWidth = 1.5;
        radarCtx.strokeRect(sx - 8, sz - 8, 16, 16);
        radarCtx.fillStyle = site.color;
        radarCtx.font = 'bold 10px monospace';
        radarCtx.textAlign = 'center';
        radarCtx.textBaseline = 'middle';
        radarCtx.fillText(site.id, sx, sz);
      }

      for (let i = 0; i < bots.length; i += 1) {
        const bot = bots[i];
        if (!bot.alive || (bot.team === 'obsidian' && !bot.spotted)) continue;
        const bx = ((bot.pos.x - MAP_BOUNDS.minX) / mapSpanX) * radarW;
        const bz = ((bot.pos.z - MAP_BOUNDS.minZ) / mapSpanZ) * radarH;
        radarCtx.fillStyle = bot.team === 'vanguard' ? PALETTE.vanguard : PALETTE.obsidian;
        radarCtx.beginPath();
        radarCtx.arc(bx, bz, 3.3, 0, Math.PI * 2);
        radarCtx.fill();
      }

      if (playerState.alive) {
        const px = ((playerState.position.x - MAP_BOUNDS.minX) / mapSpanX) * radarW;
        const pz = ((playerState.position.z - MAP_BOUNDS.minZ) / mapSpanZ) * radarH;
        const dirX = -Math.sin(playerState.yaw);
        const dirZ = -Math.cos(playerState.yaw);
        radarCtx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        radarCtx.lineWidth = 1.5;
        radarCtx.beginPath();
        radarCtx.moveTo(px, pz);
        radarCtx.lineTo(px + dirX * 14, pz + dirZ * 14);
        radarCtx.stroke();
        radarCtx.fillStyle = PALETTE.accent;
        radarCtx.beginPath();
        radarCtx.arc(px, pz, 3.8, 0, Math.PI * 2);
        radarCtx.fill();
      }
    },
    showBuyMenu(credits, weaponState, armor) {
      renderBuyCards(credits, weaponState, armor);
      el.buyMenu.hidden = false;
    },
    hideBuyMenu() {
      el.buyMenu.hidden = true;
    },
    isBuyOpen() {
      return !el.buyMenu.hidden;
    },
    showOverlay(mode, stats) {
      el.buyMenu.hidden = true;
      el.overlay.classList.toggle('start-mode', mode === 'start');
      if (mode === 'start') {
        el.overlayTag.textContent = '4v4 Tactical Arena • Solstice Foundry';
        el.overlayTitle.textContent = 'Vanguard Breach';
        el.overlayCopy.textContent = 'Lead Vanguard Strike against Obsidian Wardens across Reactor Bay (A), Mid Archway, and Container Dock (B). First to 5 rounds wins.';
        el.mvpBanner.hidden = true;
        el.statsGrid.hidden = true;
        el.roundStrip.hidden = true;
        el.playBtn.textContent = 'Play Match';
      } else if (mode === 'paused') {
        el.overlayTag.textContent = 'Match Paused';
        el.overlayTitle.textContent = 'Tactical Hold';
        el.overlayCopy.textContent = 'Pointer lock released. Click below to re-enter the arena.';
        el.mvpBanner.hidden = true;
        el.statsGrid.hidden = true;
        el.roundStrip.hidden = true;
        el.playBtn.textContent = 'Resume Match';
      } else {
        const won = stats.vanScore > stats.obsScore;
        el.overlayTag.textContent = `Match Final • ${stats.vanScore} – ${stats.obsScore}`;
        el.overlayTitle.textContent = won ? 'Vanguard Victory' : 'Obsidian Victory';
        el.overlayCopy.textContent = won
          ? 'Solstice Foundry secured. Vanguard Strike dominated the lanes.'
          : 'Obsidian Wardens held the foundry. Regroup and breach again.';
        el.mvpBanner.textContent = `MATCH MVP • YOU — ${stats.kills} KILLS • ${stats.hsPct}% HEADSHOTS • ${stats.damage} DMG`;
        el.mvpBanner.hidden = false;
        el.statsGrid.hidden = false;
        el.statKd.textContent = `${stats.kills} / ${stats.deaths}`;
        el.statHs.textContent = `${stats.hsPct}%`;
        el.statDmg.textContent = String(stats.damage);
        el.statScore.textContent = String(stats.score);
        if (stats.roundHistory && stats.roundHistory.length > 0) {
          el.roundStrip.innerHTML = stats.roundHistory
            .map((r) => `<div class="rnd-pill ${r.winner === 'vanguard' ? 'van' : 'obs'}">R${r.round} ${r.winner === 'vanguard' ? 'WIN' : 'LOSS'}<span>${r.tag}</span></div>`)
            .join('');
          el.roundStrip.hidden = false;
        } else {
          el.roundStrip.hidden = true;
        }
        el.playBtn.textContent = 'Play Again';
      }
      el.overlay.hidden = false;
    },
    hideOverlay() {
      el.overlay.hidden = true;
    },
    onPlay(handler) {
      el.playBtn.addEventListener('click', handler);
    },
    onBuy(handler) {
      buyHandler = handler;
    },
    onBuyClose(handler) {
      closeBuyHandler = handler;
    },
  };
}
