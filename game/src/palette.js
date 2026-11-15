// Cohesive Solstice Foundry industrial-dawn tactical palette shared between 3D shaders and DOM HUD.
export const PALETTE = {
  canvas: '#121822',
  surface: '#1a2230',
  panel: '#232d3f',
  hairline: '#36455e',
  ink: '#f1f5f9',
  muted: '#9fb0c7',
  accent: '#f59e0b',
  vanguard: '#38bdf8',
  vanguardArmor: '#2b547e',
  obsidian: '#ef4444',
  obsidianArmor: '#582428',
  headGold: '#fbbf24',
  concrete: '#7a7d78',
  concreteDark: '#525654',
  steel: '#5b6878',
  steelDark: '#2e3744',
  containerAmber: '#d97724',
  containerTeal: '#287a8c',
  crateWood: '#b38852',
  siteA: '#06b6d4',
  siteB: '#f97316',
  skyTop: '#2c4f7c',
  skyMid: '#6891b8',
  skyHorizon: '#e5a86c',
  sun: '#fff1d6',
  smoke: '#cfd6df',
};

export function shade(name) {
  return PALETTE[name] ?? PALETTE.ink;
}
