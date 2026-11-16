// Tactical arsenal: 6 procedural 3D firearms (incl. Breacher 12 Shotgun) + blade, gloved first-person arms & utility.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function w(id, name, slot, price, magSize, reserve, fireGap, reloadTime, damage, headMult, spreadStill, spreadMove, recoilPitch, recoilYaw, adsFov, auto, speedMult, extra = {}) {
  return { id, name, slot, price, magSize, reserve, fireGap, reloadTime, damage, headMult, spreadStill, spreadMove, recoilPitch, recoilYaw, adsFov, auto, speedMult, ...extra };
}

export const WEAPONS = {
  pistol: w('pistol', 'VX-9 Sidearm', 2, 0, 12, 48, 0.17, 1.4, 28, 2.6, 0.004, 0.02, 0.013, 0.005, 64, false, 1.04),
  deagle: w('deagle', 'Viper .44 Magnum', 2, 450, 7, 35, 0.32, 1.65, 48, 2.8, 0.0028, 0.024, 0.026, 0.008, 62, false, 1.02),
  shotgun: w('shotgun', 'Breacher 12', 1, 1100, 6, 24, 0.72, 2.0, 16, 1.9, 0.014, 0.025, 0.028, 0.01, 65, false, 0.99, { pellets: 8, pelletSpread: 0.042 }),
  smg: w('smg', 'Kestrel MP-7', 1, 800, 32, 96, 0.068, 1.65, 21, 2.2, 0.006, 0.022, 0.008, 0.006, 61, true, 1.02),
  rifle: w('rifle', 'Vanguard AR-47', 1, 1650, 30, 90, 0.095, 1.9, 34, 3.1, 0.0022, 0.029, 0.012, 0.006, 56, true, 0.96),
  sniper: w('sniper', 'Helios M90', 1, 2350, 5, 20, 1.05, 2.35, 105, 2.5, 0.0005, 0.055, 0.036, 0.008, 26, false, 0.88, { scope: true }),
  knife: w('knife', 'Combat Blade', 3, 0, 0, 0, 0.42, 0, 55, 1.8, 0, 0, 0, 0, 74, false, 1.18, { melee: true, range: 2.4 }),
};

export const UTIL_ORDER = ['frag', 'smoke', 'flash'];

export function createWeaponRig(camera) {
  const m = {
    dark: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2d3748'), roughness: 0.42, metalness: 0.58 }),
    gun: new THREE.MeshStandardMaterial({ color: new THREE.Color('#64748b'), roughness: 0.32, metalness: 0.65 }),
    poly: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1e2633'), roughness: 0.72, metalness: 0.16 }),
    sleeve: new THREE.MeshStandardMaterial({ color: new THREE.Color('#293f56'), roughness: 0.76, metalness: 0.08 }),
    glove: new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a202c'), roughness: 0.64, metalness: 0.14 }),
    knuckle: new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a4759'), roughness: 0.48, metalness: 0.32 }),
    cyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.vanguard) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
    obs: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.obsidian) }),
    glass: new THREE.MeshBasicMaterial({ color: new THREE.Color('#0ea5e9'), transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    blade: new THREE.MeshStandardMaterial({ color: new THREE.Color('#d6e0ea'), roughness: 0.22, metalness: 0.9 }),
  };

  const rig = new THREE.Group();
  rig.position.set(0.24, -0.21, -0.44);
  camera.add(rig);

  function addParts(target, list) {
    for (let i = 0; i < list.length; i += 1) {
      const [w0, h0, d0, x, y, z, matKey, rx = 0] = list[i];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w0, h0, d0), m[matKey]);
      mesh.position.set(x, y, z);
      if (rx) mesh.rotation.x = rx;
      target.add(mesh);
    }
    return target;
  }

  const rightArm = addParts(new THREE.Group(), [
    [0.068, 0.072, 0.072, 0, 0, 0, 'glove'],
    [0.072, 0.022, 0.042, 0, 0.032, -0.008, 'knuckle'],
    [0.024, 0.036, 0.048, -0.038, 0.018, -0.015, 'glove'],
    [0.078, 0.076, 0.24, 0.02, -0.045, 0.14, 'sleeve'],
    [0.082, 0.08, 0.028, 0.012, -0.02, 0.045, 'knuckle'],
  ]);
  const leftArm = addParts(new THREE.Group(), [
    [0.066, 0.064, 0.074, 0, 0, 0, 'glove'],
    [0.07, 0.018, 0.04, 0, -0.024, -0.01, 'knuckle'],
    [0.024, 0.034, 0.046, 0.038, 0.016, -0.014, 'glove'],
    [0.078, 0.076, 0.28, -0.11, -0.07, 0.15, 'sleeve'],
    [0.082, 0.08, 0.028, -0.04, -0.03, 0.05, 'knuckle'],
  ]);
  rig.add(rightArm, leftArm);

  const models = {
    pistol: addParts(new THREE.Group(), [
      [0.052, 0.052, 0.27, 0, 0.032, -0.05, 'gun'],
      [0.048, 0.025, 0.24, 0, -0.004, -0.04, 'dark'],
      [0.044, 0.115, 0.062, 0, -0.065, 0.045, 'poly'],
      [0.014, 0.014, 0.018, 0, 0.064, -0.16, 'cyan'],
    ]),
    deagle: addParts(new THREE.Group(), [
      [0.058, 0.064, 0.32, 0, 0.032, -0.07, 'gun'],
      [0.048, 0.026, 0.28, 0, -0.008, -0.05, 'dark'],
      [0.048, 0.12, 0.066, 0, -0.068, 0.05, 'poly'],
      [0.016, 0.016, 0.022, 0, 0.07, -0.2, 'amber'],
    ]),
    shotgun: addParts(new THREE.Group(), [
      [0.078, 0.082, 0.36, 0, 0.01, 0.01, 'dark'],
      [0.068, 0.086, 0.24, 0, -0.014, 0.28, 'poly'],
      [0.038, 0.038, 0.48, 0, 0.038, -0.4, 'gun'],
      [0.034, 0.034, 0.42, 0, -0.004, -0.37, 'dark'],
      [0.074, 0.064, 0.2, 0, -0.018, -0.34, 'poly'],
      [0.016, 0.016, 0.02, 0, 0.065, -0.62, 'amber'],
      [0.014, 0.046, 0.12, -0.045, 0.01, 0.02, 'obs'],
    ]),
    smg: addParts(new THREE.Group(), [
      [0.074, 0.088, 0.34, 0, 0.01, -0.02, 'poly'],
      [0.066, 0.024, 0.28, 0, 0.062, -0.04, 'gun'],
      [0.04, 0.04, 0.24, 0, 0.02, -0.29, 'dark'],
      [0.034, 0.135, 0.044, 0, -0.085, -0.11, 'gun'],
      [0.042, 0.1, 0.055, 0, -0.075, 0.08, 'poly'],
      [0.042, 0.036, 0.07, 0, 0.09, -0.02, 'dark'],
      [0.028, 0.024, 0.004, 0, 0.09, -0.02, 'glass'],
      [0.008, 0.008, 0.008, 0, 0.09, -0.02, 'cyan'],
    ]),
    rifle: addParts(new THREE.Group(), [
      [0.078, 0.072, 0.42, 0, 0.018, -0.01, 'gun'],
      [0.072, 0.042, 0.38, 0, -0.034, 0.01, 'poly'],
      [0.056, 0.02, 0.46, 0, 0.062, -0.06, 'dark'],
      [0.068, 0.066, 0.26, 0, 0.018, -0.31, 'dark'],
      [0.072, 0.014, 0.24, 0, 0.034, -0.31, 'gun'],
      [0.082, 0.008, 0.34, 0, 0.002, -0.14, 'cyan'],
      [0.032, 0.032, 0.25, 0, 0.024, -0.5, 'gun'],
      [0.044, 0.044, 0.055, 0, 0.024, -0.62, 'dark'],
      [0.064, 0.088, 0.24, 0, -0.014, 0.3, 'poly'],
      [0.052, 0.018, 0.025, 0.048, 0.032, -0.06, 'amber'],
      [0.056, 0.016, 0.09, 0, 0.08, -0.02, 'dark'],
      [0.012, 0.044, 0.085, -0.022, 0.105, -0.02, 'gun'],
      [0.012, 0.044, 0.085, 0.022, 0.105, -0.02, 'gun'],
      [0.056, 0.01, 0.085, 0, 0.128, -0.02, 'gun'],
      [0.034, 0.034, 0.004, 0, 0.105, -0.02, 'glass'],
      [0.008, 0.008, 0.008, 0, 0.105, -0.02, 'cyan'],
      [0.044, 0.155, 0.068, 0, -0.11, -0.07, 'dark', 0.2],
      [0.036, 0.09, 0.042, 0, -0.078, -0.27, 'poly', -0.18],
    ]),
    sniper: addParts(new THREE.Group(), [
      [0.076, 0.09, 0.48, 0, 0, 0.02, 'poly'],
      [0.034, 0.034, 0.62, 0, 0.026, -0.48, 'gun'],
      [0.058, 0.048, 0.065, 0, 0.026, -0.8, 'dark'],
      [0.068, 0.09, 0.26, 0, -0.015, 0.34, 'poly'],
      [0.014, 0.014, 0.06, 0.045, 0.03, -0.08, 'cyan'],
    ]),
    knife: addParts(new THREE.Group(), [
      [0.036, 0.044, 0.14, 0, -0.02, 0.05, 'poly'],
      [0.012, 0.046, 0.22, 0, 0.01, -0.12, 'blade'],
    ]),
  };
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.32, 12), m.dark);
  scopeTube.rotation.x = Math.PI * 0.5;
  scopeTube.position.set(0, 0.095, -0.04);
  models.sniper.add(scopeTube);
  models.knife.rotation.set(0.25, 0.2, -0.35);

  for (const key of Object.keys(models)) {
    models[key].visible = false;
    rig.add(models[key]);
  }

  function createMuzzleTexture() {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(48, 48, 1, 48, 48, 42);
    g.addColorStop(0, 'rgba(255,252,232,1)');
    g.addColorStop(0.24, 'rgba(255,210,115,0.88)');
    g.addColorStop(0.55, 'rgba(245,166,35,0.28)');
    g.addColorStop(1, 'rgba(245,166,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    ctx.save();
    ctx.translate(48, 48);
    for (let i = 0; i < 6; i += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.fillStyle = 'rgba(255,240,185,0.7)';
      ctx.beginPath();
      ctx.moveTo(-2.5, 0);
      ctx.lineTo(0, -40);
      ctx.lineTo(2.5, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const flashMat = new THREE.MeshBasicMaterial({
    map: createMuzzleTexture(), color: new THREE.Color('#ffd38a'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const flash = new THREE.Group();
  const flashCrossA = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), flashMat);
  const flashCrossB = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), flashMat);
  flashCrossB.rotation.set(Math.PI * 0.5, Math.PI * 0.5, 0);
  flashCrossB.position.z = -0.03;
  const flashCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fffbeb') }));
  flashCore.scale.set(0.9, 0.9, 1.8);
  flashCore.position.z = -0.025;
  flash.add(flashCrossA, flashCrossB, flashCore);
  flash.visible = false;
  rig.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5.5);
  flashLight.position.set(0.24, -0.16, -0.68);
  camera.add(flashLight);

  const muzzleTip = new THREE.Object3D();
  rig.add(muzzleTip);

  const state = {
    activeId: 'pistol',
    owned: { pistol: true, deagle: false, shotgun: false, smg: false, rifle: false, sniper: false, knife: true },
    primaryId: null,
    sidearmId: 'pistol',
    ammo: {},
    utility: { frag: 1, smoke: 0, flash: 0 },
    activeUtil: 'frag',
    cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, slash: 0, adsBlend: 0, bobPhase: 0, forceHidden: false,
  };
  for (const id of Object.keys(WEAPONS)) state.ammo[id] = { mag: WEAPONS[id].magSize, reserve: WEAPONS[id].reserve };

  function syncVisibleModel() {
    for (const key of Object.keys(models)) models[key].visible = key === state.activeId;
    const id = state.activeId;
    const zTip = id === 'sniper' ? -0.85 : id === 'shotgun' ? -0.68 : id === 'rifle' ? -0.66 : id === 'smg' ? -0.44 : -0.25;
    flash.position.set(0, 0.025, zTip);
    muzzleTip.position.set(0, 0.025, zTip);
    if (id === 'pistol' || id === 'deagle') {
      rightArm.position.set(0.01, -0.07, 0.07); rightArm.rotation.set(0.14, 0.08, 0);
      leftArm.position.set(-0.04, -0.09, 0.06); leftArm.rotation.set(0.18, -0.32, 0.25);
      leftArm.visible = true;
    } else if (id === 'knife') {
      rightArm.position.set(0.01, -0.06, 0.07); rightArm.rotation.set(0.24, 0.16, -0.3);
      leftArm.visible = false;
    } else {
      rightArm.position.set(0.015, -0.065, 0.12); rightArm.rotation.set(0.12, 0.08, 0);
      leftArm.position.set(-0.032, -0.055, id === 'smg' ? -0.14 : -0.23); leftArm.rotation.set(0.1, -0.42, 0.2);
      leftArm.visible = true;
    }
  }
  syncVisibleModel();

  function currentSpec() { return WEAPONS[state.activeId]; }
  function currentAmmo() { return state.ammo[state.activeId]; }

  function equip(id) {
    if (!state.owned[id]) return false;
    state.activeId = id; state.reloadLeft = 0; state.cooldown = 0.14; state.adsBlend = 0;
    syncVisibleModel();
    return true;
  }

  function equipSlot(slot) {
    if (slot === 1 && state.primaryId && state.owned[state.primaryId]) return equip(state.primaryId);
    if (slot === 2) return equip(state.sidearmId || 'pistol');
    if (slot === 3) return equip('knife');
    return false;
  }

  function giveWeapon(id) {
    const spec = WEAPONS[id];
    if (!spec) return false;
    state.owned[id] = true;
    state.ammo[id].mag = spec.magSize;
    state.ammo[id].reserve = spec.reserve;
    if (spec.slot === 1) state.primaryId = id;
    if (spec.slot === 2) state.sidearmId = id;
    equip(id);
    return true;
  }

  function cycleUtility() {
    const curIdx = UTIL_ORDER.indexOf(state.activeUtil);
    for (let s = 1; s <= UTIL_ORDER.length; s += 1) {
      const next = UTIL_ORDER[(curIdx + s) % UTIL_ORDER.length];
      if (state.utility[next] > 0) { state.activeUtil = next; return next; }
    }
    state.activeUtil = UTIL_ORDER[(curIdx + 1) % UTIL_ORDER.length];
    return state.activeUtil;
  }

  function refillAll() {
    for (const id of Object.keys(state.ammo)) {
      state.ammo[id].mag = WEAPONS[id].magSize;
      state.ammo[id].reserve = WEAPONS[id].reserve;
    }
    state.cooldown = 0; state.reloadLeft = 0; state.flash = 0; state.kick = 0; state.slash = 0;
  }

  function resetMatch() {
    state.owned = { pistol: true, deagle: false, shotgun: false, smg: false, rifle: false, sniper: false, knife: true };
    state.primaryId = null; state.sidearmId = 'pistol';
    state.utility = { frag: 1, smoke: 0, flash: 0 }; state.activeUtil = 'frag';
    state.forceHidden = false;
    refillAll();
    equip('pistol');
  }

  function step(dt, isAds, moveSpeed) {
    const spec = currentSpec();
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.slash = Math.max(0, state.slash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);

    const wantAds = isAds && !spec.melee && state.reloadLeft === 0;
    state.adsBlend += ((wantAds ? 1 : 0) - state.adsBlend) * Math.min(1, dt * 12);

    if (moveSpeed > 0.6) state.bobPhase += dt * (moveSpeed > 4 ? 10.5 : 6.5);
    const bobAmp = Math.min(1, moveSpeed / 5.4) * (1 - state.adsBlend * 0.75) * 0.012;
    const hipX = spec.melee ? 0.22 : 0.24;
    const adsX = spec.scope ? 0.0 : 0.04;
    rig.position.set(
      hipX + (adsX - hipX) * state.adsBlend + Math.cos(state.bobPhase) * bobAmp,
      -0.21 + state.adsBlend * 0.045 - Math.abs(Math.sin(state.bobPhase)) * bobAmp,
      -0.44 + state.kick - state.slash * 0.16,
    );
    rig.visible = !state.forceHidden && !(spec.scope && state.adsBlend > 0.62);

    let rotX = state.kick * 2.2 - state.slash * 1.1;
    rig.rotation.y = state.slash * 2.4;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      rotX = -0.6 * Math.sin((1 - state.reloadLeft / spec.reloadTime) * Math.PI);
      if (state.reloadLeft === 0) {
        const a = currentAmmo();
        const take = Math.min(spec.magSize - a.mag, a.reserve);
        a.mag += take; a.reserve -= take;
      }
    }
    rig.rotation.x = rotX;

    flash.visible = state.flash > 0 && !spec.melee;
    if (flash.visible) {
      const fRatio = Math.min(1, state.flash / 0.048);
      flash.rotation.z = state.flash * 46;
      flash.scale.setScalar(0.68 + fRatio * 0.34);
      flashMat.opacity = 0.88 * fRatio;
    }
    flashLight.intensity = flash.visible ? 11 : 0;

    const targetFov = 74 + (spec.adsFov - 74) * state.adsBlend;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
      camera.updateProjectionMatrix();
    }
  }

  return {
    state, currentSpec, currentAmmo, equip, equipSlot, giveWeapon, cycleUtility, refillAll, resetMatch, step,
    ready() {
      const spec = currentSpec();
      return spec.melee ? state.cooldown === 0 : currentAmmo().mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    takeRound() {
      const spec = currentSpec();
      if (spec.melee) return true;
      const a = currentAmmo();
      if (a.mag <= 0) return false;
      a.mag -= 1;
      return true;
    },
    pullTrigger() {
      const spec = currentSpec();
      state.cooldown = spec.fireGap;
      if (spec.melee) state.slash = 0.18;
      else {
        state.flash = 0.048;
        state.kick = spec.id === 'sniper' || spec.id === 'shotgun' ? 0.092 : spec.id === 'smg' ? 0.035 : 0.055;
      }
    },
    reload() {
      const spec = currentSpec();
      if (spec.melee) return false;
      const a = currentAmmo();
      if (state.reloadLeft > 0 || a.mag === spec.magSize || a.reserve === 0) return false;
      state.reloadLeft = spec.reloadTime;
      return true;
    },
    spread(moveSpeed, onGround, crouching) {
      const spec = currentSpec();
      if (spec.melee) return 0;
      let sp = spec.spreadStill + Math.min(1, moveSpeed / 5.4) * spec.spreadMove;
      if (crouching) sp *= 0.65;
      if (!onGround) sp += 0.035;
      return sp * (1 - state.adsBlend * (spec.scope ? 0.92 : 0.48));
    },
    getMuzzleWorldPos(out) { muzzleTip.getWorldPosition(out); return out; },
    isScoped() { return Boolean(currentSpec().scope && state.adsBlend > 0.62); },
    setVisible(v) { state.forceHidden = !v; rig.visible = v; },
  };
}
