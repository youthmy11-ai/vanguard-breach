// Procedural offline CanvasTexture generator for Solstice Foundry Sunset surfaces, decals & sky dome.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function makeCanvas(w, h = w) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finalize(canvas, rx = 1, ry = 1, clamp = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addNoise(ctx, w, h, alpha = 0.05, count = 900) {
  let s = 1337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const sz = 1 + rand() * 3;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,250,240,${alpha})` : `rgba(24,16,12,${alpha * 1.45})`;
    ctx.fillRect(x, y, sz, sz);
  }
}

function makeWallSign(badge, title, sub, colorHex) {
  const { canvas, ctx } = makeCanvas(256, 128);
  ctx.fillStyle = '#141b26';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 246, 118);

  ctx.fillStyle = colorHex;
  ctx.fillRect(14, 16, 68, 96);
  ctx.fillStyle = '#101620';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 48, 66);

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 20px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(title, 94, 50);

  ctx.fillStyle = colorHex;
  ctx.font = 'bold 14px ui-monospace, monospace';
  ctx.fillText(sub, 94, 84);
  return finalize(canvas, 1, 1, true);
}

function makeContainer(baseHex) {
  const { canvas, ctx } = makeCanvas(256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 6, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.11)';
    ctx.fillRect(x + 6, 0, 3, 256);
  }
  ctx.strokeStyle = 'rgba(18,24,34,0.6)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 246);
  ctx.fillStyle = 'rgba(241,245,249,0.22)';
  ctx.fillRect(18, 22, 46, 10);
  addNoise(ctx, 256, 256, 0.045);
  return finalize(canvas, 2, 1);
}

export function createTextureSet() {
  // 1. Sunlit Travertine / Industrial Courtyard Floor Tiles
  const floor = makeCanvas(256);
  floor.ctx.fillStyle = PALETTE.concrete;
  floor.ctx.fillRect(0, 0, 256, 256);
  for (let ty = 0; ty < 4; ty += 1) {
    for (let tx = 0; tx < 4; tx += 1) {
      floor.ctx.fillStyle = (tx + ty) % 2 === 0 ? 'rgba(255,238,214,0.06)' : 'rgba(54,40,28,0.06)';
      floor.ctx.fillRect(tx * 64 + 2, ty * 64 + 2, 60, 60);
    }
  }
  floor.ctx.strokeStyle = PALETTE.concreteDark;
  floor.ctx.lineWidth = 4;
  for (let i = 0; i <= 256; i += 64) {
    floor.ctx.beginPath();
    floor.ctx.moveTo(i, 0);
    floor.ctx.lineTo(i, 256);
    floor.ctx.moveTo(0, i);
    floor.ctx.lineTo(256, i);
    floor.ctx.stroke();
  }
  floor.ctx.fillStyle = 'rgba(245,158,11,0.22)';
  floor.ctx.fillRect(0, 124, 24, 6);
  floor.ctx.fillRect(128, 124, 24, 6);
  addNoise(floor.ctx, 256, 256, 0.05, 1100);

  // 2. Ribbed Painted Steel Wall with Safety Trim
  const wallSteel = makeCanvas(256);
  wallSteel.ctx.fillStyle = PALETTE.steel;
  wallSteel.ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    wallSteel.ctx.fillStyle = 'rgba(0,0,0,0.18)';
    wallSteel.ctx.fillRect(x, 0, 6, 256);
    wallSteel.ctx.fillStyle = 'rgba(255,245,230,0.09)';
    wallSteel.ctx.fillRect(x + 6, 0, 3, 256);
  }
  wallSteel.ctx.fillStyle = PALETTE.steelDark;
  wallSteel.ctx.fillRect(0, 206, 256, 50);
  wallSteel.ctx.fillStyle = PALETTE.accent;
  wallSteel.ctx.fillRect(0, 198, 256, 7);
  addNoise(wallSteel.ctx, 256, 256, 0.04);

  // 3. Terracotta Industrial Masonry Brickwork with Trim
  const wallBrick = makeCanvas(256);
  wallBrick.ctx.fillStyle = PALETTE.terracottaDark;
  wallBrick.ctx.fillRect(0, 0, 256, 256);
  const bw = 32;
  const bh = 16;
  for (let row = 0; row < 13; row += 1) {
    const offset = (row % 2) * (bw * 0.5);
    for (let col = -1; col < 9; col += 1) {
      const shadeShift = ((row * 7 + col * 13) % 5) - 2;
      wallBrick.ctx.fillStyle = shadeShift > 0 ? '#b26247' : shadeShift < 0 ? '#914933' : PALETTE.terracotta;
      wallBrick.ctx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 3, bh - 3);
    }
  }
  wallBrick.ctx.fillStyle = PALETTE.steelDark;
  wallBrick.ctx.fillRect(0, 210, 256, 46);
  wallBrick.ctx.fillStyle = PALETTE.accent;
  wallBrick.ctx.fillRect(0, 204, 256, 6);
  addNoise(wallBrick.ctx, 256, 256, 0.045, 950);

  // 4. Hazard Chevron Planting Pad
  const hazard = makeCanvas(256);
  hazard.ctx.fillStyle = '#202630';
  hazard.ctx.fillRect(0, 0, 256, 256);
  hazard.ctx.fillStyle = PALETTE.accent;
  for (let i = -256; i < 512; i += 48) {
    hazard.ctx.beginPath();
    hazard.ctx.moveTo(i, 0);
    hazard.ctx.lineTo(i + 24, 0);
    hazard.ctx.lineTo(i - 104, 256);
    hazard.ctx.lineTo(i - 128, 256);
    hazard.ctx.closePath();
    hazard.ctx.fill();
  }
  hazard.ctx.fillStyle = '#262f3d';
  hazard.ctx.fillRect(26, 26, 204, 204);

  // 5. Reinforced Tactical Crate
  const crate = makeCanvas(128);
  crate.ctx.fillStyle = PALETTE.crateWood;
  crate.ctx.fillRect(0, 0, 128, 128);
  crate.ctx.strokeStyle = '#5c4124';
  crate.ctx.lineWidth = 10;
  crate.ctx.strokeRect(5, 5, 118, 118);
  crate.ctx.beginPath();
  crate.ctx.moveTo(10, 10);
  crate.ctx.lineTo(118, 118);
  crate.ctx.moveTo(118, 10);
  crate.ctx.lineTo(10, 118);
  crate.ctx.stroke();
  addNoise(crate.ctx, 128, 128, 0.05, 450);

  // 6. Sunset Sky Dome with Soft Glowing Sun Disc
  const sky = makeCanvas(1024, 512);
  const grad = sky.ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, PALETTE.skyZenith);
  grad.addColorStop(0.24, PALETTE.skyUpper);
  grad.addColorStop(0.39, PALETTE.skyWarm);
  grad.addColorStop(0.49, PALETTE.skyHorizon);
  grad.addColorStop(0.55, PALETTE.fog);
  grad.addColorStop(1, '#31231d');
  sky.ctx.fillStyle = grad;
  sky.ctx.fillRect(0, 0, 1024, 512);

  // Soft golden sun disc & radial bloom on North-Northeast horizon
  const sunX = 700;
  const sunY = 198;
  const sunGlow = sky.ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 170);
  sunGlow.addColorStop(0, 'rgba(255, 246, 214, 0.96)');
  sunGlow.addColorStop(0.14, 'rgba(255, 214, 153, 0.72)');
  sunGlow.addColorStop(0.42, 'rgba(245, 158, 11, 0.28)');
  sunGlow.addColorStop(1, 'rgba(217, 107, 67, 0)');
  sky.ctx.fillStyle = sunGlow;
  sky.ctx.fillRect(sunX - 175, sunY - 175, 350, 350);

  // Distant foundry horizon silhouettes
  sky.ctx.fillStyle = 'rgba(38, 28, 30, 0.42)';
  for (let x = 0; x < 1024; x += 36) {
    const h = 16 + ((x * 29) % 34);
    sky.ctx.fillRect(x, 260 - h, 26, h + 28);
  }

  return {
    floor: finalize(floor.canvas, 16, 15),
    wallSteel: finalize(wallSteel.canvas, 3, 1),
    wallBrick: finalize(wallBrick.canvas, 4, 2),
    hazard: finalize(hazard.canvas, 1, 1),
    containerAmber: makeContainer(PALETTE.containerAmber),
    containerTeal: makeContainer(PALETTE.containerTeal),
    crate: finalize(crate.canvas, 1, 1),
    signA: makeWallSign('A', 'REACTOR BAY', 'SITE A • CORE', PALETTE.siteA),
    signB: makeWallSign('B', 'DOCKYARD', 'SITE B • CORE', PALETTE.siteB),
    signMid: makeWallSign('→', 'MID ARCH', 'MAIN LANE', PALETTE.accent),
    sky: finalize(sky.canvas, 1, 1, true),
  };
}
