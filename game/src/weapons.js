// Tactical arsenal: 4 distinct 3D procedural firearms + combat blade, stats, ADS zoom, recoil & spread.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'VX-9 Sidearm',
    slot: 2,
    price: 0,
    magSize: 12,
    reserve: 48,
    fireGap: 0.17,
    reloadTime: 1.4,
    damage: 28,
    headMult: 2.6,
    spreadStill: 0.004,
    spreadMove: 0.02,
    recoilPitch: 0.013,
    recoilYaw: 0.005,
    adsFov: 64,
    auto: false,
    speedMult: 1.04,
  },
  deagle: {
    id: 'deagle',
    name: 'Viper .44 Magnum',
    slot: 2,
    price: 450,
    magSize: 7,
    reserve: 35,
    fireGap: 0.32,
    reloadTime: 1.65,
    damage: 48,
    headMult: 2.8,
    spreadStill: 0.0028,
    spreadMove: 0.024,
    recoilPitch: 0.026,
    recoilYaw: 0.008,
    adsFov: 62,
    auto: false,
    speedMult: 1.02,
  },
  smg: {
    id: 'smg',
    name: 'Kestrel MP-7',
    slot: 1,
    price: 800,
    magSize: 32,
    reserve: 96,
    fireGap: 0.068,
    reloadTime: 1.65,
    damage: 21,
    headMult: 2.2,
    spreadStill: 0.006,
    spreadMove: 0.022,
    recoilPitch: 0.008,
    recoilYaw: 0.006,
    adsFov: 61,
    auto: true,
    speedMult: 1.02,
  },
  rifle: {
    id: 'rifle',
    name: 'Vanguard AR-47',
    slot: 1,
    price: 1650,
    magSize: 30,
    reserve: 90,
    fireGap: 0.095,
    reloadTime: 1.9,
    damage: 34,
    headMult: 3.1,
    spreadStill: 0.0022,
    spreadMove: 0.029,
    recoilPitch: 0.012,
    recoilYaw: 0.006,
    adsFov: 56,
    auto: true,
    speedMult: 0.96,
  },
  sniper: {
    id: 'sniper',
    name: 'Helios M90',
    slot: 1,
    price: 2350,
    magSize: 5,
    reserve: 20,
    fireGap: 1.05,
    reloadTime: 2.35,
    damage: 105,
    headMult: 2.5,
    spreadStill: 0.0005,
    spreadMove: 0.055,
    recoilPitch: 0.036,
    recoilYaw: 0.008,
    adsFov: 26,
    auto: false,
    speedMult: 0.88,
    scope: true,
  },
  knife: {
    id: 'knife',
    name: 'Combat Blade',
    slot: 3,
    price: 0,
    magSize: 0,
    reserve: 0,
    fireGap: 0.42,
    reloadTime: 0,
    damage: 55,
    headMult: 1.8,
    spreadStill: 0,
    spreadMove: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    adsFov: 74,
    auto: false,
    speedMult: 1.18,
    melee: true,
    range: 2.4,
  },
};

export function createWeaponRig(camera) {
  const darkMetal = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.52, metalness: 0.55 });
  const lightMetal = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steel), roughness: 0.42, metalness: 0.6 });
  const polymer = new THREE.MeshStandardMaterial({ color: new THREE.Color('#202630'), roughness: 0.78, metalness: 0.12 });
  const accentMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.vanguard) });
  const bladeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#cbd5e1'), roughness: 0.25, metalness: 0.88 });

  const rig = new THREE.Group();
  rig.position.set(0.24, -0.21, -0.44);
  camera.add(rig);

  const models = {};

  function part(w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  // 1. Pistol
  const pistol = new THREE.Group();
  pistol.add(
    part(0.052, 0.06, 0.26, 0, 0.02, -0.04, darkMetal),
    part(0.044, 0.11, 0.06, 0, -0.055, 0.05, polymer),
    part(0.014, 0.014, 0.02, 0, 0.056, -0.15, accentMat),
  );
  models.pistol = pistol;

  // 1b. Heavy Sidearm (Viper .44)
  const deagle = new THREE.Group();
  deagle.add(
    part(0.058, 0.068, 0.31, 0, 0.024, -0.06, lightMetal),
    part(0.048, 0.115, 0.064, 0, -0.055, 0.05, polymer),
    part(0.016, 0.016, 0.022, 0, 0.064, -0.19, new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) })),
  );
  models.deagle = deagle;

  // 2. SMG
  const smg = new THREE.Group();
  smg.add(
    part(0.072, 0.09, 0.34, 0, 0.01, -0.02, polymer),
    part(0.036, 0.036, 0.24, 0, 0.02, -0.28, darkMetal),
    part(0.036, 0.13, 0.045, 0, -0.08, -0.1, darkMetal),
    part(0.042, 0.1, 0.055, 0, -0.075, 0.08, polymer),
    part(0.024, 0.022, 0.03, 0, 0.065, 0, accentMat),
  );
  models.smg = smg;

  // 3. Assault Rifle
  const rifle = new THREE.Group();
  rifle.add(
    part(0.082, 0.095, 0.44, 0, 0.005, 0, darkMetal),
    part(0.042, 0.042, 0.42, 0, 0.025, -0.39, lightMetal),
    part(0.068, 0.085, 0.24, 0, -0.015, 0.31, polymer),
    part(0.046, 0.15, 0.07, 0, -0.1, -0.06, polymer),
    part(0.05, 0.04, 0.09, 0, 0.07, -0.02, darkMetal),
    part(0.018, 0.016, 0.015, 0, 0.075, -0.02, accentMat),
  );
  models.rifle = rifle;

  // 4. Sniper Rifle
  const sniper = new THREE.Group();
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.3, 12), darkMetal);
  scopeTube.rotation.x = Math.PI * 0.5;
  scopeTube.position.set(0, 0.088, -0.04);
  sniper.add(
    part(0.078, 0.09, 0.48, 0, 0, 0.02, polymer),
    part(0.032, 0.032, 0.62, 0, 0.026, -0.48, lightMetal),
    part(0.058, 0.048, 0.06, 0, 0.026, -0.8, darkMetal),
    part(0.068, 0.09, 0.26, 0, -0.015, 0.34, polymer),
    scopeTube,
  );
  models.sniper = sniper;

  // 5. Combat Blade
  const knife = new THREE.Group();
  const handle = part(0.036, 0.044, 0.14, 0, -0.02, 0.05, polymer);
  const blade = part(0.012, 0.046, 0.22, 0, 0.01, -0.12, bladeMat);
  knife.rotation.set(0.25, 0.2, -0.35);
  knife.add(handle, blade);
  models.knife = knife;

  for (const key of Object.keys(models)) {
    models[key].visible = false;
    rig.add(models[key]);
  }

  function createMuzzleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 58);
    grad.addColorStop(0, 'rgba(255, 252, 232, 1)');
    grad.addColorStop(0.22, 'rgba(255, 210, 115, 0.92)');
    grad.addColorStop(0.52, 'rgba(245, 166, 35, 0.36)');
    grad.addColorStop(1, 'rgba(245, 166, 35, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    ctx.save();
    ctx.translate(64, 64);
    for (let i = 0; i < 6; i += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.fillStyle = 'rgba(255, 236, 178, 0.68)';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(0, -56);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const flashMat = new THREE.MeshBasicMaterial({
    map: createMuzzleTexture(),
    color: new THREE.Color('#ffd38a'),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flash = new THREE.Group();
  const flashCrossA = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
  const flashCrossB = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.2), flashMat);
  flashCrossB.rotation.y = Math.PI * 0.5;
  flashCrossB.rotation.x = Math.PI * 0.5;
  flashCrossB.position.z = -0.05;
  flash.add(flashCrossA, flashCrossB);
  flash.position.set(0, 0.025, -0.64);
  flash.visible = false;
  rig.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.68);
  camera.add(flashLight);

  const muzzleTip = new THREE.Object3D();
  muzzleTip.position.set(0, 0.03, -0.68);
  rig.add(muzzleTip);

  const state = {
    activeId: 'pistol',
    owned: { pistol: true, deagle: false, smg: false, rifle: false, sniper: false, knife: true },
    primaryId: null,
    sidearmId: 'pistol',
    ammo: {
      pistol: { mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserve },
      deagle: { mag: WEAPONS.deagle.magSize, reserve: WEAPONS.deagle.reserve },
      smg: { mag: WEAPONS.smg.magSize, reserve: WEAPONS.smg.reserve },
      rifle: { mag: WEAPONS.rifle.magSize, reserve: WEAPONS.rifle.reserve },
      sniper: { mag: WEAPONS.sniper.magSize, reserve: WEAPONS.sniper.reserve },
      knife: { mag: 0, reserve: 0 },
    },
    grenades: 1,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    slash: 0,
    adsBlend: 0,
    bobPhase: 0,
    forceHidden: false,
  };

  function syncVisibleModel() {
    for (const key of Object.keys(models)) {
      models[key].visible = key === state.activeId;
    }
    const zTip = state.activeId === 'sniper' ? -0.84 : state.activeId === 'pistol' || state.activeId === 'deagle' ? -0.27 : -0.62;
    flash.position.set(0, 0.025, zTip);
    muzzleTip.position.set(0, 0.025, zTip);
  }
  syncVisibleModel();

  function currentSpec() {
    return WEAPONS[state.activeId];
  }

  function currentAmmo() {
    return state.ammo[state.activeId];
  }

  function equip(id) {
    if (!state.owned[id]) return false;
    state.activeId = id;
    state.reloadLeft = 0;
    state.cooldown = 0.14;
    state.adsBlend = 0;
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

  function refillAll() {
    for (const id of Object.keys(state.ammo)) {
      state.ammo[id].mag = WEAPONS[id].magSize;
      state.ammo[id].reserve = WEAPONS[id].reserve;
    }
    state.cooldown = 0;
    state.reloadLeft = 0;
    state.flash = 0;
    state.kick = 0;
    state.slash = 0;
  }

  function resetMatch() {
    state.owned = { pistol: true, deagle: false, smg: false, rifle: false, sniper: false, knife: true };
    state.primaryId = null;
    state.sidearmId = 'pistol';
    state.grenades = 1;
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
    const bobX = Math.cos(state.bobPhase) * bobAmp;
    const bobY = Math.abs(Math.sin(state.bobPhase)) * bobAmp;

    const hipX = spec.melee ? 0.22 : 0.24;
    const adsX = spec.scope ? 0.0 : 0.04;
    rig.position.x = hipX + (adsX - hipX) * state.adsBlend + bobX;
    rig.position.y = -0.21 + state.adsBlend * 0.045 - bobY;
    rig.position.z = -0.44 + state.kick - state.slash * 0.16;

    rig.visible = !state.forceHidden && !(spec.scope && state.adsBlend > 0.62);

    let rotX = state.kick * 2.2 - state.slash * 1.1;
    rig.rotation.y = state.slash * 2.4;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const t = 1 - state.reloadLeft / spec.reloadTime;
      rotX = -0.6 * Math.sin(t * Math.PI);
      if (state.reloadLeft === 0) {
        const a = currentAmmo();
        const need = spec.magSize - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
    }
    rig.rotation.x = rotX;

    flash.visible = state.flash > 0 && !spec.melee;
    if (flash.visible) {
      const fRatio = Math.min(1, state.flash / 0.055);
      flash.rotation.z = state.flash * 42;
      flash.scale.setScalar(0.7 + fRatio * 0.4);
      flashMat.opacity = 0.85 * fRatio;
    }
    flashLight.intensity = flash.visible ? 14 : 0;

    const targetFov = 74 + (spec.adsFov - 74) * state.adsBlend;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
      camera.updateProjectionMatrix();
    }
  }

  return {
    state,
    currentSpec,
    currentAmmo,
    equip,
    equipSlot,
    giveWeapon,
    refillAll,
    resetMatch,
    step,
    ready() {
      const spec = currentSpec();
      if (spec.melee) return state.cooldown === 0;
      return currentAmmo().mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
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
      if (spec.melee) {
        state.slash = 0.18;
      } else {
        state.flash = 0.055;
        state.kick = spec.id === 'sniper' ? 0.095 : spec.id === 'smg' ? 0.036 : 0.058;
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
      const speedFactor = Math.min(1, moveSpeed / 5.4);
      let sp = spec.spreadStill + speedFactor * spec.spreadMove;
      if (crouching) sp *= 0.65;
      if (!onGround) sp += 0.035;
      sp *= 1 - state.adsBlend * (spec.scope ? 0.92 : 0.48);
      return sp;
    },
    getMuzzleWorldPos(out) {
      muzzleTip.getWorldPosition(out);
      return out;
    },
    isScoped() {
      return Boolean(currentSpec().scope && state.adsBlend > 0.62);
    },
    setVisible(visible) {
      state.forceHidden = !visible;
      rig.visible = visible;
    },
  };
}
