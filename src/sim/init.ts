import {
  World, Clan, Settlement, Personality, Culture, Skills, Needs,
  LaborAllocation, PopulationGroup,
} from './types';
import { generateTiles, generateRivers, MAP_TILES_WIDE, MAP_TILES_HIGH, TILE_SIZE_MILES, CLAN_PREFIXES, CLAN_SUFFIXES } from './map-data';
import { generateId, randomFloat, randomInt, random, clamp, setSeed } from './utils';

// ── World Initialization ────────────────────────────────────────────

export function createWorld(seed: number = 6500): World {
  setSeed(seed);

  const tiles = generateTiles();
  const rivers = generateRivers();

  const world: World = {
    year: -6500, // 6500 BC
    tiles,
    tilesWide: MAP_TILES_WIDE,
    tilesHigh: MAP_TILES_HIGH,
    tileSize: TILE_SIZE_MILES,
    rivers,
    settlements: {},
    clans: {},
    technologies: {},
    events: [],
    history: [],
    clanHistories: {},
    nextId: 1,
  };

  // Create initial settlements
  createInitialSettlements(world);

  return world;
}

// ── Initial Settlements ─────────────────────────────────────────────

function createInitialSettlements(world: World): void {
  // Historical/archaeological starting points for early habitation
  // in southern Mesopotamia around 6500 BC

  const settlements: { name: string; tileX: number; tileY: number; clans: number }[] = [
    // Eridu area — one of the earliest known settlements
    { name: 'Eridu', tileX: 5, tileY: 4, clans: 3 },
    // Tell Oueili area — another very early site
    { name: 'Tell Oueili', tileX: 7, tileY: 5, clans: 2 },
    // Early camp near the marshes — fishing community
    { name: 'Kuara', tileX: 6, tileY: 3, clans: 2 },
    // Northern camp — initial migrants
    { name: 'Tell Uqair', tileX: 5, tileY: 8, clans: 2 },
  ];

  for (const spec of settlements) {
    const settlement: Settlement = {
      id: generateId('set'),
      name: spec.name,
      x: spec.tileX * TILE_SIZE_MILES + TILE_SIZE_MILES / 2 + randomFloat(-3, 3),
      y: spec.tileY * TILE_SIZE_MILES + TILE_SIZE_MILES / 2 + randomFloat(-3, 3),
      tileX: spec.tileX,
      tileY: spec.tileY,
      clanIds: [],
      facilities: [],
      founded: world.year,
      tellHeight: 0.5 + randomFloat(0, 1),
      permanence: 15 + randomFloat(0, 10),
    };

    world.settlements[settlement.id] = settlement;

    // Create clans for this settlement
    for (let i = 0; i < spec.clans; i++) {
      const clan = createClan(world, settlement);
      world.clans[clan.id] = clan;
      settlement.clanIds.push(clan.id);
      world.clanHistories[clan.id] = [];
    }
  }
}

// ── Clan Creation ───────────────────────────────────────────────────

function createClan(world: World, settlement: Settlement): Clan {
  const prefix = CLAN_PREFIXES[Math.floor(random() * CLAN_PREFIXES.length)];
  const suffix = CLAN_SUFFIXES[Math.floor(random() * CLAN_SUFFIXES.length)];
  const name = `${prefix}-${suffix}`;

  const population = createInitialPopulation();
  const personality = createPersonality();
  const culture = createCulture();
  const skills = createInitialSkills(world, settlement);
  const labor = createInitialLabor(world, settlement);

  const clan: Clan = {
    id: generateId('cln'),
    name,
    settlementId: settlement.id,
    population,
    personality,
    culture,
    skills,
    technologies: [],
    needs: {
      food: 50,
      foodSecurity: 40,
      shelter: 35,
      community: 50,
      prestige: 30,
      spiritual: 40,
      luxury: 20,
      safety: 50,
    },
    laborAllocation: labor,
    foodStores: randomFloat(80, 160), // several months stored per person
    wealthGoods: randomFloat(0, 5),
    shelterQuality: 25 + randomFloat(0, 20),
    founded: world.year,
    starred: false,
    relationships: {},
    lastFoodProduction: 0,
    lastFoodConsumption: 0,
    recentEvents: [],
  };

  return clan;
}

function createInitialPopulation(): PopulationGroup[] {
  // Small clan of 20-40 people
  const totalTarget = randomInt(20, 40);

  // Rough distribution: 30% children, 20% youth, 35% adults, 15% elders
  const children = Math.round(totalTarget * 0.30);
  const youth = Math.round(totalTarget * 0.20);
  const adults = Math.round(totalTarget * 0.35);
  const elders = totalTarget - children - youth - adults;

  return [
    { gender: 'male', age: 'children', count: Math.ceil(children / 2) },
    { gender: 'female', age: 'children', count: Math.floor(children / 2) },
    { gender: 'male', age: 'youth', count: Math.ceil(youth / 2) },
    { gender: 'female', age: 'youth', count: Math.floor(youth / 2) },
    { gender: 'male', age: 'adults', count: Math.ceil(adults / 2) },
    { gender: 'female', age: 'adults', count: Math.floor(adults / 2) },
    { gender: 'male', age: 'elders', count: Math.ceil(elders / 2) },
    { gender: 'female', age: 'elders', count: Math.floor(elders / 2) },
  ];
}

function createPersonality(): Personality {
  return {
    boldness: randomFloat(-0.6, 0.6),
    sociability: randomFloat(-0.3, 0.7), // slightly biased toward sociable
    tradition: randomFloat(-0.3, 0.5),    // slightly biased toward traditional
    ambition: randomFloat(-0.5, 0.5),
    spirituality: randomFloat(0.0, 0.8),  // most are somewhat spiritual
    generosity: randomFloat(-0.2, 0.6),
  };
}

function createCulture(): Culture {
  return {
    collectivism: randomFloat(0.4, 0.8),   // early societies tend collectivist
    hierarchy: randomFloat(0.1, 0.4),       // relatively egalitarian initially
    religiosity: randomFloat(0.3, 0.7),
    militarism: randomFloat(0.0, 0.2),      // low initially
    innovation: randomFloat(0.2, 0.6),
    hospitality: randomFloat(0.3, 0.7),
  };
}

function createInitialSkills(world: World, settlement: Settlement): Skills {
  const tile = world.tiles[settlement.tileY]?.[settlement.tileX];
  const isMarsh = tile?.terrain === 'marsh';
  const isRiver = tile?.terrain === 'riverPlain';

  return {
    farming: randomFloat(10, 25),
    fishing: isMarsh || isRiver ? randomFloat(20, 35) : randomFloat(5, 15),
    gathering: randomFloat(25, 40), // everyone gathers
    herding: randomFloat(5, 15),
    building: randomFloat(10, 20),
    pottery: randomFloat(5, 15),
    irrigation: randomFloat(0, 8),
    ritual: randomFloat(10, 25),
    trade: randomFloat(5, 15),
  };
}

function createInitialLabor(world: World, settlement: Settlement): LaborAllocation {
  const tile = world.tiles[settlement.tileY]?.[settlement.tileX];
  const isMarsh = tile?.terrain === 'marsh';

  if (isMarsh) {
    return {
      farming: 0.10,
      fishing: 0.30,
      gathering: 0.25,
      herding: 0.05,
      building: 0.10,
      crafting: 0.05,
      ritual: 0.10,
      trade: 0.05,
    };
  }

  return {
    farming: 0.20,
    fishing: 0.15,
    gathering: 0.25,
    herding: 0.10,
    building: 0.10,
    crafting: 0.05,
    ritual: 0.10,
    trade: 0.05,
  };
}

// ── Initialize Relationships ────────────────────────────────────────

export function initializeRelationships(world: World): void {
  for (const settlement of Object.values(world.settlements)) {
    const clanIds = settlement.clanIds;
    for (let i = 0; i < clanIds.length; i++) {
      for (let j = i + 1; j < clanIds.length; j++) {
        const a = world.clans[clanIds[i]];
        const b = world.clans[clanIds[j]];
        if (!a || !b) continue;

        // Initial neighbors start with some familiarity and mild positive affinity
        const baseAffinity = randomFloat(5, 25);
        const baseTrust = randomFloat(20, 45);
        const baseFamiliarity = randomFloat(30, 60);

        a.relationships[b.id] = {
          affinity: baseAffinity,
          trust: baseTrust,
          marriageLinks: randomInt(0, 2),
          statusDiff: randomFloat(-10, 10),
          familiarity: baseFamiliarity,
          lastInteraction: world.year,
        };

        b.relationships[a.id] = {
          affinity: baseAffinity + randomFloat(-5, 5),
          trust: baseTrust + randomFloat(-5, 5),
          marriageLinks: a.relationships[b.id].marriageLinks,
          statusDiff: -a.relationships[b.id].statusDiff,
          familiarity: baseFamiliarity + randomFloat(-5, 5),
          lastInteraction: world.year,
        };
      }
    }
  }
}
