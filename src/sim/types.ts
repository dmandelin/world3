// ── Core Simulation Types ───────────────────────────────────────────

export type Gender = 'male' | 'female';
export type AgeCategory = 'children' | 'youth' | 'adults' | 'elders';

export interface PopulationGroup {
  gender: Gender;
  age: AgeCategory;
  count: number;
}

// Age ranges: children 0-14, youth 15-24, adults 25-44, elders 45+
export const AGE_RANGES: Record<AgeCategory, [number, number]> = {
  children: [0, 14],
  youth: [15, 24],
  adults: [25, 44],
  elders: [45, 70],
};

// ── Terrain ─────────────────────────────────────────────────────────

export type TerrainType =
  | 'marsh'
  | 'riverPlain'
  | 'drySteppe'
  | 'irrigatedLand'
  | 'desert'
  | 'water'
  | 'alluvialPlain';

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  arableLand: number;     // 0-1 fraction usable for farming
  fertility: number;      // 0-1
  waterAccess: number;    // 0-1 proximity to water
  elevation: number;      // meters above sea level (low in Mesopotamia)
  usedLand: number;       // 0-1 fraction currently farmed
}

export interface RiverPoint {
  x: number;
  y: number;
}

export interface River {
  name: string;
  points: RiverPoint[];
  width: number;          // visual width in miles
}

// ── Skills & Technology ─────────────────────────────────────────────

export interface Skills {
  farming: number;        // 0-100
  fishing: number;
  gathering: number;
  herding: number;
  building: number;
  pottery: number;
  irrigation: number;
  ritual: number;
  trade: number;
}

export type SkillName = keyof Skills;

export const SKILL_NAMES: SkillName[] = [
  'farming', 'fishing', 'gathering', 'herding',
  'building', 'pottery', 'irrigation', 'ritual', 'trade',
];

export interface Technology {
  id: string;
  name: string;
  description: string;
  prerequisiteSkill: SkillName;
  skillThreshold: number;
  productivityBonus: number;   // multiplier, e.g. 0.1 = +10%
  discovered: number;          // year discovered, -1 if not
}

// ── Personality & Culture ───────────────────────────────────────────

export interface Personality {
  boldness: number;       // -1 to 1
  sociability: number;
  tradition: number;      // negative = innovative
  ambition: number;
  spirituality: number;
  generosity: number;
}

export type PersonalityTrait = keyof Personality;

export interface Culture {
  collectivism: number;   // 0-1
  hierarchy: number;
  religiosity: number;
  militarism: number;
  innovation: number;
  hospitality: number;
}

// ── Needs ───────────────────────────────────────────────────────────

export interface Needs {
  food: number;           // 0-100 current satisfaction
  foodSecurity: number;
  shelter: number;
  community: number;
  prestige: number;
  spiritual: number;
  luxury: number;
  safety: number;
}

export type NeedName = keyof Needs;

export const NEED_NAMES: NeedName[] = [
  'food', 'foodSecurity', 'shelter', 'community',
  'prestige', 'spiritual', 'luxury', 'safety',
];

// Need weights for decision-making (how urgently each is pursued)
export const NEED_WEIGHTS: Record<NeedName, number> = {
  food: 3.0,
  foodSecurity: 2.0,
  shelter: 1.5,
  community: 1.2,
  prestige: 0.8,
  spiritual: 1.0,
  luxury: 0.4,
  safety: 2.5,
};

// ── Labor ───────────────────────────────────────────────────────────

export interface LaborAllocation {
  farming: number;
  fishing: number;
  gathering: number;
  herding: number;
  building: number;
  crafting: number;
  ritual: number;
  trade: number;
}

export type LaborCategory = keyof LaborAllocation;

export const LABOR_CATEGORIES: LaborCategory[] = [
  'farming', 'fishing', 'gathering', 'herding',
  'building', 'crafting', 'ritual', 'trade',
];

// ── Relationships ───────────────────────────────────────────────────

export interface Relationship {
  affinity: number;       // -100 to 100
  trust: number;          // 0 to 100
  marriageLinks: number;
  statusDiff: number;     // positive = "I am higher status"
  familiarity: number;    // 0 to 100, how well they know each other
  lastInteraction: number;
}

// ── Facilities ──────────────────────────────────────────────────────

export type FacilityType =
  | 'meetingPlace'
  | 'granary'
  | 'irrigationDitch'
  | 'marketplace'
  | 'shrine'
  | 'kiln'
  | 'brewhouse';

export interface Facility {
  type: FacilityType;
  level: number;          // 1-5
  condition: number;      // 0-100
  builtYear: number;
}

export const FACILITY_INFO: Record<FacilityType, { name: string; icon: string; description: string }> = {
  meetingPlace:    { name: 'Meeting Place',    icon: '🏛', description: 'Gathering spot for community decisions and socializing' },
  granary:         { name: 'Granary',          icon: '🏺', description: 'Stores surplus grain against lean times' },
  irrigationDitch: { name: 'Irrigation Ditch', icon: '🌊', description: 'Channels water to fields, improving farming yields' },
  marketplace:     { name: 'Marketplace',      icon: '⚖',  description: 'Facilitates trade between clans and settlements' },
  shrine:          { name: 'Shrine',           icon: '✧',  description: 'Sacred space for rituals and spiritual practice' },
  kiln:            { name: 'Kiln',             icon: '🔥', description: 'Fires pottery and bricks, enabling crafts and construction' },
  brewhouse:       { name: 'Brewhouse',        icon: '🍺', description: 'Produces beer for feasts and daily life' },
};

// ── Clan ────────────────────────────────────────────────────────────

export interface Clan {
  id: string;
  name: string;
  settlementId: string;
  population: PopulationGroup[];
  personality: Personality;
  culture: Culture;
  skills: Skills;
  technologies: string[];        // IDs of discovered techs
  needs: Needs;
  laborAllocation: LaborAllocation;
  foodStores: number;            // person-months of stored food
  wealthGoods: number;           // abstract wealth units
  shelterQuality: number;        // 0-100
  founded: number;               // year (negative = BC)
  starred: boolean;
  relationships: Record<string, Relationship>;

  // Per-turn tracking
  lastFoodProduction: number;
  lastFoodConsumption: number;
  recentEvents: string[];
}

// ── Settlement ──────────────────────────────────────────────────────

export interface Settlement {
  id: string;
  name: string;
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  clanIds: string[];
  facilities: Facility[];
  founded: number;
  tellHeight: number;            // meters, grows with habitation
  permanence: number;            // 0-100
}

// ── Events ──────────────────────────────────────────────────────────

export type EventSeverity = 'minor' | 'notable' | 'major' | 'critical';
export type EventCategory = 'production' | 'population' | 'social' | 'disaster' | 'discovery' | 'construction' | 'migration';

export interface GameEvent {
  id: string;
  year: number;
  category: EventCategory;
  severity: EventSeverity;
  title: string;
  description: string;
  settlementId?: string;
  clanId?: string;
}

// ── History Snapshots ───────────────────────────────────────────────

export interface WorldSnapshot {
  year: number;
  totalPopulation: number;
  settlementCount: number;
  clanCount: number;
  avgFoodSatisfaction: number;
  avgPrestige: number;
  avgTechLevel: number;
  settlements: { id: string; name: string; population: number }[];
}

export interface ClanSnapshot {
  year: number;
  population: number;
  foodStores: number;
  avgNeedSatisfaction: number;
  topSkill: SkillName;
  topSkillLevel: number;
}

// ── World ───────────────────────────────────────────────────────────

export interface World {
  year: number;
  tiles: Tile[][];
  tilesWide: number;
  tilesHigh: number;
  tileSize: number;              // miles per tile edge
  rivers: River[];
  settlements: Record<string, Settlement>;
  clans: Record<string, Clan>;
  technologies: Record<string, Technology>;
  events: GameEvent[];
  history: WorldSnapshot[];
  clanHistories: Record<string, ClanSnapshot[]>;
  nextId: number;
}
