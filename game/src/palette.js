// Cohesive Solstice Foundry industrial-tactical colour system shared between 3D shaders and DOM HUD.
export const PALETTE = {
  canvas: '#12161d',
  surface: '#1b212c',
  panel: '#242c3a',
  hairline: '#333e50',
  ink: '#eef1f6',
  muted: '#95a3b8',
  accent: '#f5a623',
  vanguard: '#38bdf8',
  obsidian: '#ef4444',
  headGold: '#fbbf24',
  concrete: '#454c57',
  concreteDark: '#313740',
  steel: '#525d6d',
  steelDark: '#2a313c',
  containerAmber: '#c46f26',
  containerTeal: '#2c6878',
  crateWood: '#8c6d46',
  siteA: '#22d3ee',
  siteB: '#f97316',
  skyTop: '#647d9c',
  skyHorizon: '#2b3646',
  sun: '#ffeed6',
};

export function shade(name) {
  return PALETTE[name] ?? PALETTE.ink;
}
