// Procedural offline CanvasTexture generator for Solstice Foundry surfaces and golden-hour sky.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function makeCanvas(w, h = w) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finalize(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addNoise(ctx, size, alpha = 0.05) {
  let s = 1337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 950; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 1 + rand() * 3;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
    ctx.fillRect(x, y, w, w);
  }
}

export function createTextureSet() {
  // 1. Sunlit Concrete Courtyard Tiles
  const floor = makeCanvas(256);
  floor.ctx.fillStyle = PALETTE.concrete;
  floor.ctx.fillRect(0, 0, 256, 256);
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
  addNoise(floor.ctx, 256, 0.055);

  // 2. Ribbed Industrial Steel Walls with Safety Trim
  const wall = makeCanvas(256);
  wall.ctx.fillStyle = PALETTE.steel;
  wall.ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    wall.ctx.fillStyle = 'rgba(0,0,0,0.16)';
    wall.ctx.fillRect(x, 0, 6, 256);
    wall.ctx.fillStyle = 'rgba(255,255,255,0.08)';
    wall.ctx.fillRect(x + 6, 0, 3, 256);
  }
  wall.ctx.fillStyle = PALETTE.steelDark;
  wall.ctx.fillRect(0, 206, 256, 50);
  wall.ctx.fillStyle = PALETTE.accent;
  wall.ctx.fillRect(0, 200, 256, 6);
  addNoise(wall.ctx, 256, 0.04);

  // 3. Hazard Chevron Planting Pad
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

  // 4. Corrugated Cargo Containers
  function makeContainer(baseHex) {
    const c = makeCanvas(256);
    c.ctx.fillStyle = baseHex;
    c.ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      c.ctx.fillStyle = 'rgba(0,0,0,0.2)';
      c.ctx.fillRect(x, 0, 6, 256);
      c.ctx.fillStyle = 'rgba(255,255,255,0.1)';
      c.ctx.fillRect(x + 6, 0, 3, 256);
    }
    c.ctx.strokeStyle = 'rgba(18,24,34,0.55)';
    c.ctx.lineWidth = 10;
    c.ctx.strokeRect(5, 5, 246, 246);
    addNoise(c.ctx, 256, 0.04);
    return finalize(c.canvas, 2, 1);
  }

  // 5. Reinforced Tactical Crate
  const crate = makeCanvas(128);
  crate.ctx.fillStyle = PALETTE.crateWood;
  crate.ctx.fillRect(0, 0, 128, 128);
  crate.ctx.strokeStyle = '#5e4528';
  crate.ctx.lineWidth = 10;
  crate.ctx.strokeRect(5, 5, 118, 118);
  crate.ctx.beginPath();
  crate.ctx.moveTo(10, 10);
  crate.ctx.lineTo(118, 118);
  crate.ctx.moveTo(118, 10);
  crate.ctx.lineTo(10, 118);
  crate.ctx.stroke();
  addNoise(crate.ctx, 128, 0.05);

  // 6. Site Marker Decal
  function makeSiteDecal(letter, colorHex) {
    const c = makeCanvas(128);
    c.ctx.fillStyle = 'rgba(18,24,34,0.9)';
    c.ctx.fillRect(0, 0, 128, 128);
    c.ctx.strokeStyle = colorHex;
    c.ctx.lineWidth = 8;
    c.ctx.strokeRect(8, 8, 112, 112);
    c.ctx.fillStyle = colorHex;
    c.ctx.font = 'bold 76px system-ui, sans-serif';
    c.ctx.textAlign = 'center';
    c.ctx.textBaseline = 'middle';
    c.ctx.fillText(letter, 64, 68);
    return finalize(c.canvas, 1, 1);
  }

  // 7. Golden-Hour Sky Dome Texture
  const sky = makeCanvas(512, 256);
  const skyGrad = sky.ctx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, PALETTE.skyTop);
  skyGrad.addColorStop(0.45, PALETTE.skyMid);
  skyGrad.addColorStop(0.68, PALETTE.skyHorizon);
  skyGrad.addColorStop(1, '#313a48');
  sky.ctx.fillStyle = skyGrad;
  sky.ctx.fillRect(0, 0, 512, 256);

  // Subtle distant foundry skyline silhouettes along horizon
  sky.ctx.fillStyle = 'rgba(28, 36, 48, 0.52)';
  for (let x = 0; x < 512; x += 28) {
    const h = 14 + ((x * 37) % 26);
    sky.ctx.fillRect(x, 166 - h, 20, h + 18);
  }

  const skyTex = finalize(sky.canvas, 1, 1);
  skyTex.wrapS = THREE.ClampToEdgeWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;

  return {
    floor: finalize(floor.canvas, 16, 15),
    wall: finalize(wall.canvas, 3, 1),
    hazard: finalize(hazard.canvas, 1, 1),
    containerAmber: makeContainer(PALETTE.containerAmber),
    containerTeal: makeContainer(PALETTE.containerTeal),
    crate: finalize(crate.canvas, 1, 1),
    siteA: makeSiteDecal('A', PALETTE.siteA),
    siteB: makeSiteDecal('B', PALETTE.siteB),
    sky: skyTex,
  };
}
