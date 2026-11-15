// Procedural offline CanvasTexture generator for Solstice Foundry surfaces. Zero external assets.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
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

function addNoise(ctx, size, alpha = 0.06) {
  let s = 1337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 900; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 1 + rand() * 3;
    ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
    ctx.fillRect(x, y, w, w);
  }
}

export function createTextureSet() {
  // 1. Concrete Courtyard Floor Tiles
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
  addNoise(floor.ctx, 256, 0.05);

  // 2. Ribbed Steel Wall Panels
  const wall = makeCanvas(256);
  wall.ctx.fillStyle = PALETTE.steel;
  wall.ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    wall.ctx.fillStyle = 'rgba(0,0,0,0.16)';
    wall.ctx.fillRect(x, 0, 6, 256);
    wall.ctx.fillStyle = 'rgba(255,255,255,0.06)';
    wall.ctx.fillRect(x + 6, 0, 3, 256);
  }
  wall.ctx.fillStyle = PALETTE.steelDark;
  wall.ctx.fillRect(0, 210, 256, 46);
  wall.ctx.fillStyle = PALETTE.accent;
  wall.ctx.fillRect(0, 206, 256, 4);
  addNoise(wall.ctx, 256, 0.04);

  // 3. Hazard Chevron Pad (Site A / B markers)
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
  hazard.ctx.fillStyle = '#1e242e';
  hazard.ctx.fillRect(24, 24, 208, 208);

  // 4. Corrugated Shipping Container (Amber & Teal)
  function makeContainer(baseHex) {
    const c = makeCanvas(256);
    c.ctx.fillStyle = baseHex;
    c.ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      c.ctx.fillStyle = 'rgba(0,0,0,0.22)';
      c.ctx.fillRect(x, 0, 6, 256);
      c.ctx.fillStyle = 'rgba(255,255,255,0.09)';
      c.ctx.fillRect(x + 6, 0, 3, 256);
    }
    c.ctx.strokeStyle = 'rgba(18,22,29,0.55)';
    c.ctx.lineWidth = 10;
    c.ctx.strokeRect(5, 5, 246, 246);
    addNoise(c.ctx, 256, 0.04);
    return finalize(c.canvas, 2, 1);
  }

  // 5. Tactical Supply Crate
  const crate = makeCanvas(128);
  crate.ctx.fillStyle = PALETTE.crateWood;
  crate.ctx.fillRect(0, 0, 128, 128);
  crate.ctx.strokeStyle = '#574128';
  crate.ctx.lineWidth = 10;
  crate.ctx.strokeRect(5, 5, 118, 118);
  crate.ctx.beginPath();
  crate.ctx.moveTo(10, 10);
  crate.ctx.lineTo(118, 118);
  crate.ctx.moveTo(118, 10);
  crate.ctx.lineTo(10, 118);
  crate.ctx.stroke();
  addNoise(crate.ctx, 128, 0.05);

  // 6. Site Label Decal Canvas
  function makeSiteDecal(letter, colorHex) {
    const c = makeCanvas(128);
    c.ctx.fillStyle = 'rgba(18,22,29,0.85)';
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

  return {
    floor: finalize(floor.canvas, 16, 15),
    wall: finalize(wall.canvas, 3, 1),
    hazard: finalize(hazard.canvas, 1, 1),
    containerAmber: makeContainer(PALETTE.containerAmber),
    containerTeal: makeContainer(PALETTE.containerTeal),
    crate: finalize(crate.canvas, 1, 1),
    siteA: makeSiteDecal('A', PALETTE.siteA),
    siteB: makeSiteDecal('B', PALETTE.siteB),
  };
}
