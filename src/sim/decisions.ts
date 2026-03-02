import { Clan, World, Settlement, LaborAllocation, LABOR_CATEGORIES, FacilityType, GameEvent, PopulationGroup } from './types';
import { clamp, random, randomFloat, generateId } from './utils';
import { getClanPopulation, getWorkerCount } from './production';
import { getMostUrgentNeed } from './needs';
import { SETTLEMENT_NAMES, CLAN_PREFIXES, CLAN_SUFFIXES } from './map-data';

// ── Main Decision Step ──────────────────────────────────────────────

export function makeDecisions(world: World): GameEvent[] {
  const events: GameEvent[] = [];

  for (const clan of Object.values(world.clans)) {
    const settlement = world.settlements[clan.settlementId];
    if (!settlement) continue;

    // 1. Adjust labor allocation based on needs
    adjustLabor(clan, settlement, world);

    // 2. Consider building facilities
    const buildEvent = considerBuilding(clan, settlement, world);
    if (buildEvent) events.push(buildEvent);

    // 3. Consider migration
    const migrateEvent = considerMigration(clan, settlement, world);
    if (migrateEvent) events.push(migrateEvent);
  }

  return events;
}

// ── Labor Allocation ────────────────────────────────────────────────

function adjustLabor(clan: Clan, settlement: Settlement, world: World): void {
  const urgentNeed = getMostUrgentNeed(clan);
  const tile = world.tiles[settlement.tileY]?.[settlement.tileX];
  if (!tile) return;

  // Start from current allocation and adjust
  const labor = { ...clan.laborAllocation };

  // Calculate ideal allocation based on needs and terrain
  const ideal = calculateIdealLabor(clan, tile, settlement, urgentNeed);

  // Smooth transition: move 30% toward ideal each year
  const blendRate = 0.3;
  for (const cat of LABOR_CATEGORIES) {
    labor[cat] = labor[cat] * (1 - blendRate) + ideal[cat] * blendRate;
  }

  // Normalize to sum to 1
  const total = LABOR_CATEGORIES.reduce((s, c) => s + labor[c], 0);
  if (total > 0) {
    for (const cat of LABOR_CATEGORIES) {
      labor[cat] /= total;
    }
  }

  clan.laborAllocation = labor;
}

function calculateIdealLabor(
  clan: Clan,
  tile: { terrain: string; waterAccess: number; arableLand: number },
  settlement: Settlement,
  urgentNeed: string,
): LaborAllocation {
  const labor: LaborAllocation = {
    farming: 0.25,
    fishing: 0.15,
    gathering: 0.15,
    herding: 0.10,
    building: 0.10,
    crafting: 0.05,
    ritual: 0.10,
    trade: 0.10,
  };

  // Terrain adjustments
  if (tile.waterAccess > 0.7) {
    labor.fishing += 0.10;
    labor.gathering -= 0.05;
  }
  if (tile.arableLand > 0.5) {
    labor.farming += 0.10;
    labor.fishing -= 0.05;
  }
  if (tile.terrain === 'marsh') {
    labor.fishing += 0.15;
    labor.gathering += 0.05;
    labor.farming -= 0.10;
    labor.herding -= 0.05;
  }
  if (tile.terrain === 'drySteppe') {
    labor.herding += 0.10;
    labor.farming -= 0.10;
    labor.fishing -= 0.05;
  }

  // Need-based adjustments
  if (urgentNeed === 'food' || urgentNeed === 'foodSecurity') {
    labor.farming += 0.15;
    labor.fishing += 0.10;
    labor.gathering += 0.05;
    labor.building -= 0.05;
    labor.crafting -= 0.05;
    labor.trade -= 0.05;
    labor.ritual -= 0.05;
  } else if (urgentNeed === 'shelter') {
    labor.building += 0.15;
    labor.crafting -= 0.05;
    labor.trade -= 0.05;
  } else if (urgentNeed === 'spiritual') {
    labor.ritual += 0.10;
    labor.trade -= 0.05;
  } else if (urgentNeed === 'prestige' || urgentNeed === 'luxury') {
    labor.crafting += 0.10;
    labor.trade += 0.05;
    labor.gathering -= 0.05;
  } else if (urgentNeed === 'community') {
    labor.ritual += 0.05;
    labor.building += 0.05;
  }

  // Personality adjustments
  if (clan.personality.spirituality > 0.3) labor.ritual += 0.05;
  if (clan.personality.ambition > 0.3) labor.trade += 0.05;
  if (clan.personality.tradition > 0.3) labor.gathering += 0.03;
  if (clan.personality.boldness > 0.3) labor.trade += 0.03;

  // Clamp all to minimum 0
  for (const cat of LABOR_CATEGORIES) {
    labor[cat] = Math.max(0.02, labor[cat]);
  }

  return labor;
}

// ── Building Decisions ──────────────────────────────────────────────

function considerBuilding(clan: Clan, settlement: Settlement, world: World): GameEvent | null {
  const pop = getClanPopulation(clan);
  const workers = getWorkerCount(clan);
  if (workers < 5) return null;

  // Only try building if we have surplus food and some building labor
  if (clan.needs.food < 40) return null;
  if (clan.laborAllocation.building < 0.05) return null;

  const buildPower = workers * clan.laborAllocation.building * (clan.skills.building / 50);

  // Check what the settlement needs
  const needed = identifyNeededFacility(settlement, world);
  if (!needed) return null;

  // Building chance based on build power and need
  if (buildPower < 1 || random() > 0.06) return null;

  // Check if facility already exists and can be upgraded
  const existing = settlement.facilities.find(f => f.type === needed);
  if (existing) {
    if (existing.level < 5 && existing.condition > 50) {
      existing.level++;
      existing.condition = 100;
      return {
        id: generateId('evt'),
        year: world.year,
        category: 'construction',
        severity: 'notable',
        title: 'Facility Upgraded',
        description: `The ${clan.name} upgraded the ${facilityName(needed)} in ${settlement.name} to level ${existing.level}.`,
        settlementId: settlement.id,
        clanId: clan.id,
      };
    }
    return null;
  }

  // Build new facility
  settlement.facilities.push({
    type: needed,
    level: 1,
    condition: 100,
    builtYear: world.year,
  });

  // Building improves skill
  clan.skills.building = clamp(clan.skills.building + 2, 0, 100);

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'construction',
    severity: 'notable',
    title: 'New Construction',
    description: `The ${clan.name} built a ${facilityName(needed)} in ${settlement.name}.`,
    settlementId: settlement.id,
    clanId: clan.id,
  };
}

function identifyNeededFacility(settlement: Settlement, world: World): FacilityType | null {
  const has = (type: FacilityType) => settlement.facilities.some(f => f.type === type);
  const clans = settlement.clanIds.map(id => world.clans[id]).filter(Boolean);
  const totalPop = clans.reduce((s, c) => s + getClanPopulation(c), 0);

  // Priority order depends on settlement size and current facilities
  if (totalPop >= 30 && !has('meetingPlace')) return 'meetingPlace';
  if (totalPop >= 40 && !has('granary')) return 'granary';
  if (totalPop >= 50 && !has('shrine')) return 'shrine';
  if (totalPop >= 80 && !has('irrigationDitch')) return 'irrigationDitch';
  if (totalPop >= 100 && !has('kiln')) return 'kiln';
  if (totalPop >= 120 && !has('brewhouse')) return 'brewhouse';
  if (totalPop >= 200 && !has('marketplace')) return 'marketplace';

  return null;
}

function facilityName(type: FacilityType): string {
  const names: Record<FacilityType, string> = {
    meetingPlace: 'Meeting Place',
    granary: 'Granary',
    irrigationDitch: 'Irrigation Ditch',
    marketplace: 'Marketplace',
    shrine: 'Shrine',
    kiln: 'Kiln',
    brewhouse: 'Brewhouse',
  };
  return names[type];
}

// ── Migration Decisions ─────────────────────────────────────────────

function considerMigration(clan: Clan, settlement: Settlement, world: World): GameEvent | null {
  const pop = getClanPopulation(clan);
  if (pop < 15) return null; // too small to split

  const settlementPop = settlement.clanIds
    .map(id => world.clans[id])
    .filter(Boolean)
    .reduce((s, c) => s + getClanPopulation(c), 0);

  // Migration triggers:
  // 1. Settlement too crowded (above Dunbar's number)
  // 2. Very low satisfaction
  // 3. Personality: bold + low sociability clans more likely
  let migrationPressure = 0;

  if (settlementPop > 150) {
    migrationPressure += (settlementPop - 150) / 200;
  }

  if (clan.needs.food < 30) {
    migrationPressure += 0.3;
  }

  // Personality factors
  migrationPressure += clan.personality.boldness * 0.1;
  migrationPressure -= clan.personality.sociability * 0.1;

  // Low affinity with neighbors pushes migration
  const avgAffinity = getAvgAffinity(clan, settlement, world);
  if (avgAffinity < -20) {
    migrationPressure += 0.2;
  }

  // Check if migration happens (requires minimum pressure)
  if (migrationPressure < 0.3 || random() > migrationPressure * 0.15) {
    return null;
  }

  // Find a suitable tile for a new settlement
  return performMigration(clan, settlement, world);
}

function getAvgAffinity(clan: Clan, settlement: Settlement, world: World): number {
  const others = settlement.clanIds.filter(id => id !== clan.id);
  if (others.length === 0) return 0;
  let total = 0;
  for (const id of others) {
    const rel = clan.relationships[id];
    if (rel) total += rel.affinity;
  }
  return total / others.length;
}

function performMigration(clan: Clan, oldSettlement: Settlement, world: World): GameEvent | null {
  const pop = getClanPopulation(clan);

  // Find nearby tiles with decent terrain
  const candidates: { x: number; y: number; score: number }[] = [];
  const ox = oldSettlement.tileX;
  const oy = oldSettlement.tileY;

  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tx = ox + dx;
      const ty = oy + dy;
      if (tx < 0 || tx >= world.tilesWide || ty < 0 || ty >= world.tilesHigh) continue;

      const tile = world.tiles[ty][tx];
      if (tile.terrain === 'water' || tile.terrain === 'desert') continue;

      // Check if there's already a settlement here
      const hasSettlement = Object.values(world.settlements).some(
        s => s.tileX === tx && s.tileY === ty
      );

      let score = tile.fertility + tile.waterAccess + tile.arableLand;
      if (hasSettlement) score -= 0.5; // prefer unsettled tiles
      score -= Math.sqrt(dx * dx + dy * dy) * 0.1; // prefer nearby

      candidates.push({ x: tx, y: ty, score });
    }
  }

  if (candidates.length === 0) return null;

  // Pick best candidate
  candidates.sort((a, b) => b.score - a.score);
  const target = candidates[0];

  // Check if there's an existing settlement to join on the target tile
  const existingSettlement = Object.values(world.settlements).find(
    s => s.tileX === target.x && s.tileY === target.y
  );

  if (existingSettlement) {
    // Join existing settlement
    oldSettlement.clanIds = oldSettlement.clanIds.filter(id => id !== clan.id);
    existingSettlement.clanIds.push(clan.id);
    clan.settlementId = existingSettlement.id;

    return {
      id: generateId('evt'),
      year: world.year,
      category: 'migration',
      severity: 'notable',
      title: 'Clan Migration',
      description: `The ${clan.name} (${pop} people) moved from ${oldSettlement.name} to ${existingSettlement.name}.`,
      settlementId: existingSettlement.id,
      clanId: clan.id,
    };
  }

  // Found a new settlement
  const usedNames = new Set(Object.values(world.settlements).map(s => s.name));
  const availableNames = SETTLEMENT_NAMES.filter(n => !usedNames.has(n));
  const name = availableNames.length > 0
    ? availableNames[Math.floor(random() * availableNames.length)]
    : `New Settlement ${Object.keys(world.settlements).length + 1}`;

  const newSettlement: Settlement = {
    id: generateId('set'),
    name,
    x: target.x * world.tileSize + world.tileSize / 2 + randomFloat(-3, 3),
    y: target.y * world.tileSize + world.tileSize / 2 + randomFloat(-3, 3),
    tileX: target.x,
    tileY: target.y,
    clanIds: [clan.id],
    facilities: [],
    founded: world.year,
    tellHeight: 0,
    permanence: 10,
  };

  // Remove clan from old settlement
  oldSettlement.clanIds = oldSettlement.clanIds.filter(id => id !== clan.id);
  clan.settlementId = newSettlement.id;
  world.settlements[newSettlement.id] = newSettlement;

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'migration',
    severity: 'major',
    title: 'New Settlement Founded',
    description: `The ${clan.name} (${pop} people) left ${oldSettlement.name} and founded ${name}!`,
    settlementId: newSettlement.id,
    clanId: clan.id,
  };
}

// ── Clan Splitting ──────────────────────────────────────────────────

export function checkClanSplitting(world: World): GameEvent[] {
  const events: GameEvent[] = [];

  for (const clan of Object.values(world.clans)) {
    const pop = getClanPopulation(clan);

    // Clans split when they get too large (>60-80 people)
    const splitThreshold = 60 + clan.personality.sociability * 20;
    if (pop < splitThreshold) continue;
    if (random() > 0.15) continue; // not every year

    // Split the clan
    const event = splitClan(clan, world);
    if (event) events.push(event);
  }

  return events;
}

function splitClan(parentClan: Clan, world: World): GameEvent | null {
  const prefix = CLAN_PREFIXES[Math.floor(random() * CLAN_PREFIXES.length)];
  const suffix = CLAN_SUFFIXES[Math.floor(random() * CLAN_SUFFIXES.length)];
  const newName = `${prefix}-${suffix}`;

  // Split population roughly 60/40
  const newPop: PopulationGroup[] = [];
  for (const group of parentClan.population) {
    const split = Math.round(group.count * (0.35 + random() * 0.1));
    group.count -= split;
    if (split > 0) {
      newPop.push({ ...group, count: split });
    }
  }

  const totalNewPop = newPop.reduce((s, g) => s + g.count, 0);
  if (totalNewPop < 5) return null;

  const newClan: Clan = {
    id: generateId('cln'),
    name: newName,
    settlementId: parentClan.settlementId,
    population: newPop,
    personality: {
      boldness: clamp(parentClan.personality.boldness + randomFloat(-0.2, 0.2), -1, 1),
      sociability: clamp(parentClan.personality.sociability + randomFloat(-0.2, 0.2), -1, 1),
      tradition: clamp(parentClan.personality.tradition + randomFloat(-0.2, 0.2), -1, 1),
      ambition: clamp(parentClan.personality.ambition + randomFloat(-0.2, 0.2), -1, 1),
      spirituality: clamp(parentClan.personality.spirituality + randomFloat(-0.2, 0.2), -1, 1),
      generosity: clamp(parentClan.personality.generosity + randomFloat(-0.2, 0.2), -1, 1),
    },
    culture: { ...parentClan.culture },
    skills: { ...parentClan.skills },
    technologies: [...parentClan.technologies],
    needs: { food: 50, foodSecurity: 50, shelter: 40, community: 50, prestige: 30, spiritual: 40, luxury: 20, safety: 50 },
    laborAllocation: { ...parentClan.laborAllocation },
    foodStores: parentClan.foodStores * 0.35,
    wealthGoods: parentClan.wealthGoods * 0.3,
    shelterQuality: parentClan.shelterQuality * 0.7,
    founded: world.year,
    starred: false,
    relationships: {},
    lastFoodProduction: 0,
    lastFoodConsumption: 0,
    recentEvents: [],
  };

  parentClan.foodStores *= 0.65;
  parentClan.wealthGoods *= 0.7;

  // Add to world and settlement
  world.clans[newClan.id] = newClan;
  const settlement = world.settlements[parentClan.settlementId];
  if (settlement) {
    settlement.clanIds.push(newClan.id);
  }

  // Start with a positive relationship to parent
  parentClan.relationships[newClan.id] = {
    affinity: 40,
    trust: 60,
    marriageLinks: 2,
    statusDiff: 10,
    familiarity: 80,
    lastInteraction: world.year,
  };
  newClan.relationships[parentClan.id] = {
    affinity: 40,
    trust: 60,
    marriageLinks: 2,
    statusDiff: -10,
    familiarity: 80,
    lastInteraction: world.year,
  };

  world.clanHistories[newClan.id] = [];

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'social',
    severity: 'major',
    title: 'Clan Split',
    description: `The ${newName} (${totalNewPop} people) have split off from the ${parentClan.name}.`,
    settlementId: parentClan.settlementId,
    clanId: newClan.id,
  };
}
