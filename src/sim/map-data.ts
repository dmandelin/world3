import { Tile, River, TerrainType } from './types';

// ── Map Configuration ───────────────────────────────────────────────
// Covers southern Mesopotamia, roughly 150x120 miles
// Tile grid: 15 wide x 12 high, each tile 10x10 miles
// Origin (0,0) is bottom-left (southwest corner)
// The area roughly covers from the marshes in the south to north of Nippur

export const MAP_TILES_WIDE = 15;
export const MAP_TILES_HIGH = 12;
export const TILE_SIZE_MILES = 10;
export const MAP_WIDTH_MILES = MAP_TILES_WIDE * TILE_SIZE_MILES;
export const MAP_HEIGHT_MILES = MAP_TILES_HIGH * TILE_SIZE_MILES;

// ── Terrain Layout ──────────────────────────────────────────────────
// Key: M=marsh, R=riverPlain, A=alluvialPlain, D=drySteppe, W=water, X=desert

const TERRAIN_CODES: Record<string, TerrainType> = {
  M: 'marsh',
  R: 'riverPlain',
  A: 'alluvialPlain',
  D: 'drySteppe',
  W: 'water',
  X: 'desert',
};

// Row 0 = bottom (south), Row 11 = top (north)
// Col 0 = left (west), Col 14 = right (east)
const TERRAIN_MAP: string[] = [
  // Southern Mesopotamia terrain grid
  'X X D D D M M W W M M D D X X',  // row 0:  far south, marshes & gulf
  'X D D D M M M M M M D D D D X',  // row 1:  marshes
  'X D D R M M R R M M M D D D X',  // row 2:  edge of marshes, rivers merge
  'X D D R A R R R R A D D D D X',  // row 3:  lower alluvial plain
  'X D D A R A A A R A D D D D X',  // row 4:  Eridu/Ur area
  'X D D A A R A A A R A D D D X',  // row 5:  middle plain
  'X D A A A R A A A A R A D D X',  // row 6:  Uruk area
  'X D A A R A A A A A R A D D X',  // row 7:  between rivers
  'D D A R A A A A A A A R A D D',  // row 8:  Nippur area
  'D D A R A A A A A A A R A D D',  // row 9:  upper plain
  'D D R A A A D A A A A A R D D',  // row 10: northern edge
  'D D R A D D D D A A A A R D D',  // row 11: far north
];

function parseTerrainRow(row: string): TerrainType[] {
  return row.split(' ').map(code => TERRAIN_CODES[code] || 'drySteppe');
}

// ── Terrain Properties ──────────────────────────────────────────────

function terrainProperties(terrain: TerrainType): Pick<Tile, 'arableLand' | 'fertility' | 'waterAccess'> {
  switch (terrain) {
    case 'marsh':
      return { arableLand: 0.1, fertility: 0.7, waterAccess: 1.0 };
    case 'riverPlain':
      return { arableLand: 0.7, fertility: 0.9, waterAccess: 0.9 };
    case 'alluvialPlain':
      return { arableLand: 0.5, fertility: 0.6, waterAccess: 0.4 };
    case 'drySteppe':
      return { arableLand: 0.15, fertility: 0.2, waterAccess: 0.1 };
    case 'desert':
      return { arableLand: 0.0, fertility: 0.05, waterAccess: 0.0 };
    case 'water':
      return { arableLand: 0.0, fertility: 0.0, waterAccess: 1.0 };
    case 'irrigatedLand':
      return { arableLand: 0.85, fertility: 0.95, waterAccess: 0.95 };
  }
}

// ── Generate Tile Grid ──────────────────────────────────────────────

export function generateTiles(): Tile[][] {
  const tiles: Tile[][] = [];
  for (let y = 0; y < MAP_TILES_HIGH; y++) {
    const row: Tile[] = [];
    const terrainRow = parseTerrainRow(TERRAIN_MAP[MAP_TILES_HIGH - 1 - y]);
    for (let x = 0; x < MAP_TILES_WIDE; x++) {
      const terrain = terrainRow[x];
      const props = terrainProperties(terrain);
      row.push({
        x,
        y,
        terrain,
        ...props,
        elevation: terrain === 'water' ? -1 : terrain === 'marsh' ? 1 : 3 + y * 0.5,
        usedLand: 0,
      });
    }
    tiles.push(row);
  }
  return tiles;
}

// ── Rivers ──────────────────────────────────────────────────────────
// Coordinates in miles from the bottom-left origin
// These approximate the courses of the Tigris and Euphrates

export function generateRivers(): River[] {
  return [
    {
      name: 'Euphrates',
      width: 0.5,
      points: [
        { x: 30, y: 115 },
        { x: 32, y: 108 },
        { x: 35, y: 100 },
        { x: 38, y: 92 },
        { x: 42, y: 85 },
        { x: 48, y: 78 },
        { x: 50, y: 70 },
        { x: 53, y: 62 },
        { x: 55, y: 55 },
        { x: 52, y: 48 },
        { x: 50, y: 42 },
        { x: 52, y: 35 },
        { x: 55, y: 28 },
        { x: 58, y: 20 },
        { x: 62, y: 12 },
        { x: 68, y: 5 },
      ],
    },
    {
      name: 'Tigris',
      width: 0.4,
      points: [
        { x: 120, y: 115 },
        { x: 115, y: 108 },
        { x: 108, y: 100 },
        { x: 102, y: 92 },
        { x: 98, y: 85 },
        { x: 95, y: 78 },
        { x: 92, y: 70 },
        { x: 88, y: 62 },
        { x: 85, y: 55 },
        { x: 82, y: 48 },
        { x: 78, y: 42 },
        { x: 75, y: 35 },
        { x: 72, y: 28 },
        { x: 70, y: 20 },
        { x: 68, y: 12 },
        { x: 68, y: 5 },
      ],
    },
  ];
}

// ── Settlement Name Pool ────────────────────────────────────────────

export const SETTLEMENT_NAMES = [
  'Eridu', 'Tell Oueili', 'Ur', 'Uruk', 'Lagash', 'Larsa',
  'Tell al-Ubaid', 'Girsu', 'Bad-tibira', 'Nippur', 'Shuruppak',
  'Tell Abu Shahrain', 'Tell el-Muqayyar', 'Kuara', 'Zabalam',
  'Adab', 'Umma', 'Tell Uqair', 'Isin', 'Kullab',
  'Kesh', 'Kisurra', 'Marad', 'Dilbat', 'Borsippa',
];

// ── Clan Name Components ────────────────────────────────────────────

export const CLAN_PREFIXES = [
  'Reed', 'River', 'Marsh', 'Sky', 'Earth', 'Sun', 'Moon',
  'Star', 'Fish', 'Ox', 'Ibex', 'Palm', 'Barley', 'Clay',
  'Copper', 'Flint', 'Shell', 'Serpent', 'Hawk', 'Heron',
  'Storm', 'Flood', 'Dawn', 'Dusk', 'Wind', 'Salt', 'Honey',
  'Fig', 'Gazelle', 'Lion', 'Crane', 'Lotus', 'Ember',
];

export const CLAN_SUFFIXES = [
  'Workers', 'Keepers', 'Walkers', 'Singers', 'Weavers',
  'Builders', 'Fishers', 'Hunters', 'Dancers', 'Speakers',
  'Watchers', 'Shapers', 'Planters', 'Herders', 'Traders',
  'Dreamers', 'Makers', 'Seekers', 'Carvers', 'Potters',
];

// ── Terrain Colors (for map rendering) ──────────────────────────────

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  marsh: '#4a6e45',
  riverPlain: '#7a8f50',
  alluvialPlain: '#9e9265',
  drySteppe: '#b8a67a',
  desert: '#c4b088',
  water: '#3a6e8f',
  irrigatedLand: '#5d8a3e',
};

export const TERRAIN_DISPLAY_NAMES: Record<TerrainType, string> = {
  marsh: 'Marshland',
  riverPlain: 'River Plain',
  alluvialPlain: 'Alluvial Plain',
  drySteppe: 'Dry Steppe',
  desert: 'Desert',
  water: 'Open Water',
  irrigatedLand: 'Irrigated Land',
};
