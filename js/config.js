// config.js - tiles, colors, constants
const MAP_W = 128, MAP_H = 128, TILE = 8;
const TILE_DIRT = 0, TILE_ROCK = 1, TILE_WATER = 2, TILE_TREE = 3, TILE_STUMP = 4, TILE_BASE = 5, TILE_JET = 6, TILE_TUNNEL = 7, TILE_ARMORY = 8;
const COLORS = {
  [TILE_DIRT]: '#8B5A2B', [TILE_ROCK]: '#6B6B6B', [TILE_WATER]: '#1E6BB8',
  [TILE_TREE]: '#2D8B2D', [TILE_STUMP]: '#5C4033', [TILE_BASE]: '#9C27B0',
  [TILE_JET]: '#1A1A2E', [TILE_TUNNEL]: '#4A3728', [TILE_ARMORY]: '#B71C1C'
};
const ROCK_SHADES = [
  '#3A3A3A', '#4A4A4A', '#5A5A5A', '#6B6B6B',
  '#7E7E7E', '#909090', '#A8A8A8', '#C0C0C0'
];
const TREE_SHADES = [
  '#A5D6A7', '#66BB6A', '#43A047', '#2E7D32', '#1B5E20'
];
const BASE_SHADES = [
  '#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA',
  '#9C27B0', '#AB47BC', '#6A1B9A', '#5E35B1'
];
const ARMORY_SHADES = [
  '#7F0000', '#B71C1C', '#C62828', '#D32F2F',
  '#E53935', '#8B0000', '#A52A2A', '#6D1B1B'
];
const VIRELIUM_SHADES = [
  '#004D40', '#00695C', '#00796B', '#00897B', '#009688',
  '#26A69A', '#4DB6AC', '#80CBC4', '#00BCD4', '#00E5FF'
];
function tileColor(tx, ty, tile) {
  if (tile === TILE_TREE) {
    const d = (treeDensity && treeDensity[ty] && treeDensity[ty][tx]) ? treeDensity[ty][tx] : 3;
    return TREE_SHADES[Math.max(0, Math.min(4, d - 1))];
  }
  if (tile === TILE_ROCK) {
    const elev = (rockElev && rockElev[ty]) ? (rockElev[ty][tx] || 0) : 0;
    return ROCK_SHADES[Math.max(0, Math.min(ROCK_SHADES.length - 1, elev))];
  }
  if (tile === TILE_BASE) {
    const h = ((tx * 19349663) ^ (ty * 83492791) ^ ((tx + ty) * 17)) >>> 0;
    return BASE_SHADES[h % BASE_SHADES.length];
  }
  if (tile === TILE_ARMORY) {
    const h = ((tx * 73856093) ^ (ty * 19349663) ^ ((tx + ty) * 31)) >>> 0;
    return ARMORY_SHADES[h % ARMORY_SHADES.length];
  }
  if (tile === TILE_JET) return '#0D0D1A';
  if (tile === TILE_TUNNEL) return '#4A3728';
  return COLORS[tile];
}

// Base: 3×3 segments, 3 workers per level
const BASE_SEGMENT_SIZE = 3;
const WORKERS_PER_BASE_LEVEL = 3;
const BASE_FOOTPRINT = [];
(function () {
  for (let dy = 0; dy < BASE_SEGMENT_SIZE; dy++)
    for (let dx = 0; dx < BASE_SEGMENT_SIZE; dx++)
      BASE_FOOTPRINT.push({ dx, dy });
})();

// Armory: 2×2 building, up to 5 soldiers each
const ARMORY_SIZE = 2;
const SOLDIERS_PER_ARMORY = 5;
const ARMORY_FOOTPRINT = [];
(function () {
  for (let dy = 0; dy < ARMORY_SIZE; dy++)
    for (let dx = 0; dx < ARMORY_SIZE; dx++)
      ARMORY_FOOTPRINT.push({ dx, dy });
})();

const MOVE_SPEED = 5.5;
const SOLDIER_MOVE_SPEED = 6.5;
const HARVEST_TIME = 0.7;
const TUNNEL_CARVE_TIME = 1.2;
const TUNNEL_MOVE_SPEED = 1.2;
const SELECT_RADIUS = 28;
const WOOD_WEIGHT = 1;
const VIRELIUM_WEIGHT = 3;

const JET_SPEW_INTERVAL_MIN = 30;
const JET_SPEW_INTERVAL_MAX = 120;
const JET_SPEW_AMOUNT_MIN = 1;
const JET_SPEW_AMOUNT_MAX = 6;
const JET_MINERAL_CAP = 10;
const JET_PULSE_DURATION = 1.4;

function getUnitSpeed(u) {
  if (u.tunneling && u.tunnelCarvePath === null && u.path && u.path.length) {
    return TUNNEL_MOVE_SPEED;
  }
  if (u.unitType === 'soldier') return SOLDIER_MOVE_SPEED;
  let weight = 0;
  if (u.carryingWood) weight += WOOD_WEIGHT;
  if (u.carryingVirelium) weight += VIRELIUM_WEIGHT;
  if (weight <= 0) return MOVE_SPEED;
  return MOVE_SPEED / (1 + weight);
}
