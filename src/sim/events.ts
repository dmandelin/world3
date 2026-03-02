import { World, GameEvent, Settlement, Clan } from './types';
import { random, randomFloat, randomChoice, generateId, clamp } from './utils';
import { getClanPopulation } from './production';

// ── Generate World Events ───────────────────────────────────────────

export function generateEvents(world: World): GameEvent[] {
  const events: GameEvent[] = [];

  // Global events
  const floodEvent = checkFlood(world);
  if (floodEvent) events.push(...floodEvent);

  const droughtEvent = checkDrought(world);
  if (droughtEvent) events.push(droughtEvent);

  // Per-settlement events
  for (const settlement of Object.values(world.settlements)) {
    const clans = settlement.clanIds.map(id => world.clans[id]).filter(Boolean);

    const goodHarvest = checkGoodHarvest(settlement, clans, world);
    if (goodHarvest) events.push(goodHarvest);

    const discovery = checkDiscovery(settlement, clans, world);
    if (discovery) events.push(discovery);

    // Update settlement properties
    updateSettlement(settlement, clans, world);
  }

  return events;
}

// ── Floods ──────────────────────────────────────────────────────────

function checkFlood(world: World): GameEvent[] | null {
  // Floods happen periodically, more likely in river plain tiles
  // Minor floods: ~20% chance per year. Major floods: ~3%
  const events: GameEvent[] = [];

  const isMinorFlood = random() < 0.06;
  const isMajorFlood = !isMinorFlood && random() < 0.01;

  if (!isMinorFlood && !isMajorFlood) return null;

  const severity = isMajorFlood ? 'major' : 'minor';
  const floodStrength = isMajorFlood ? randomFloat(0.10, 0.25) : randomFloat(0.02, 0.06);

  // Affect settlements near rivers
  for (const settlement of Object.values(world.settlements)) {
    const tile = world.tiles[settlement.tileY]?.[settlement.tileX];
    if (!tile) continue;

    // River plains and marshes flood more
    let floodExposure = 0;
    if (tile.terrain === 'riverPlain') floodExposure = 1.0;
    else if (tile.terrain === 'marsh') floodExposure = 0.8;
    else if (tile.terrain === 'alluvialPlain') floodExposure = 0.4;
    else continue;

    // Irrigation ditches can help or hurt depending on flood severity
    const hasIrrigation = settlement.facilities.some(f => f.type === 'irrigationDitch');
    if (hasIrrigation && !isMajorFlood) {
      floodExposure *= 0.5; // ditches help manage minor floods
    }

    const impact = floodStrength * floodExposure;
    if (impact < 0.02) continue;

    // Apply flood effects to clans
    const clans = settlement.clanIds.map(id => world.clans[id]).filter(Boolean);
    let totalDamage = 0;

    for (const clan of clans) {
      // Food stores damaged
      const foodLoss = clan.foodStores * impact;
      clan.foodStores = Math.max(0, clan.foodStores - foodLoss);

      // Shelter damaged
      clan.shelterQuality = clamp(clan.shelterQuality - impact * 30, 0, 100);

      // Some deaths in major floods
      if (isMajorFlood && random() < 0.3) {
        for (const group of clan.population) {
          const deaths = Math.round(group.count * impact * 0.1);
          group.count = Math.max(0, group.count - deaths);
          totalDamage += deaths;
        }
      }

      totalDamage += foodLoss;
    }

    // But floods also deposit fertile silt!
    if (tile.terrain === 'riverPlain' || tile.terrain === 'alluvialPlain') {
      tile.fertility = clamp(tile.fertility + impact * 0.3, 0, 1);
    }

    // Damage facilities
    for (const facility of settlement.facilities) {
      facility.condition = clamp(facility.condition - impact * 40, 0, 100);
    }

    events.push({
      id: generateId('evt'),
      year: world.year,
      category: 'disaster',
      severity: isMajorFlood ? 'major' : 'minor',
      title: isMajorFlood ? 'Great Flood' : 'Seasonal Flooding',
      description: isMajorFlood
        ? `A devastating flood struck ${settlement.name}, destroying food stores and shelters.`
        : `Seasonal flooding affected ${settlement.name}, but deposited rich silt on the fields.`,
      settlementId: settlement.id,
    });
  }

  return events.length > 0 ? events : null;
}

// ── Drought ─────────────────────────────────────────────────────────

function checkDrought(world: World): GameEvent | null {
  if (random() > 0.02) return null; // ~2% chance per year

  const severity = randomFloat(0.05, 0.20);

  // Reduce fertility across all tiles temporarily
  for (const row of world.tiles) {
    for (const tile of row) {
      if (tile.terrain !== 'water') {
        tile.fertility = clamp(tile.fertility - severity * 0.15, 0, 1);
      }
    }
  }

  // Reduce food stores modestly
  for (const clan of Object.values(world.clans)) {
    clan.foodStores *= (1 - severity * 0.15);
  }

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'disaster',
    severity: severity > 0.2 ? 'major' : 'notable',
    title: 'Drought',
    description: severity > 0.2
      ? 'A severe drought has parched the land. Crops wither and stores dwindle.'
      : 'A dry season has reduced crop yields across the region.',
  };
}

// ── Good Harvest ────────────────────────────────────────────────────

function checkGoodHarvest(settlement: Settlement, clans: Clan[], world: World): GameEvent | null {
  if (random() > 0.1) return null;

  // Bonus food for all clans in settlement
  const bonus = randomFloat(0.1, 0.3);
  for (const clan of clans) {
    clan.foodStores += clan.lastFoodConsumption * bonus;
  }

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'production',
    severity: 'minor',
    title: 'Bountiful Season',
    description: `An especially bountiful season blessed ${settlement.name} with extra food.`,
    settlementId: settlement.id,
  };
}

// ── Discovery ───────────────────────────────────────────────────────

function checkDiscovery(settlement: Settlement, clans: Clan[], world: World): GameEvent | null {
  if (clans.length === 0) return null;
  if (random() > 0.03) return null; // ~3% per settlement per year

  // Pick a random clan and a random skill
  const clan = randomChoice(clans);
  const skills = ['farming', 'fishing', 'building', 'pottery', 'irrigation', 'ritual'] as const;
  const skill = randomChoice([...skills]);

  // Skill jump
  const currentSkill = clan.skills[skill];
  const improvement = randomFloat(2, 8);
  clan.skills[skill] = clamp(currentSkill + improvement, 0, 100);

  const discoveries: Record<string, string[]> = {
    farming: [
      'a new way to select better seeds',
      'improved soil preparation techniques',
      'a method for crop rotation',
    ],
    fishing: [
      'a new type of fish trap',
      'better reed boat construction',
      'improved net-weaving techniques',
    ],
    building: [
      'a stronger mud-brick formula',
      'improved foundation techniques',
      'better roofing methods',
    ],
    pottery: [
      'a new clay firing technique',
      'decorative glazing methods',
      'improved kiln design',
    ],
    irrigation: [
      'a better canal design',
      'water level management techniques',
      'improved sluice gates',
    ],
    ritual: [
      'a new ceremonial tradition',
      'astronomical observations useful for the calendar',
      'improved methods of sacred record-keeping',
    ],
  };

  const desc = randomChoice(discoveries[skill] || ['a useful improvement']);

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'discovery',
    severity: improvement > 5 ? 'notable' : 'minor',
    title: 'Innovation',
    description: `The ${clan.name} of ${settlement.name} discovered ${desc} (+${improvement.toFixed(1)} ${skill}).`,
    settlementId: settlement.id,
    clanId: clan.id,
  };
}

// ── Settlement Updates ──────────────────────────────────────────────

function updateSettlement(settlement: Settlement, clans: Clan[], world: World): void {
  const totalPop = clans.reduce((s, c) => s + getClanPopulation(c), 0);

  // Tell height grows slowly with habitation
  if (totalPop > 20) {
    settlement.tellHeight += 0.01 + totalPop * 0.00005;
  }

  // Permanence increases with facilities and population
  const facilityBonus = settlement.facilities.length * 2;
  const popBonus = Math.min(totalPop * 0.1, 20);
  settlement.permanence = clamp(
    settlement.permanence + (facilityBonus + popBonus) * 0.02 - 0.5,
    0,
    100
  );

  // Facility decay
  for (const facility of settlement.facilities) {
    facility.condition = clamp(facility.condition - 2, 0, 100);
  }

  // Remove destroyed facilities
  settlement.facilities = settlement.facilities.filter(f => f.condition > 0);

  // Remove empty settlements
  if (totalPop === 0 && clans.length === 0) {
    // Leave it as abandoned but don't delete (for history)
    settlement.permanence = Math.max(0, settlement.permanence - 5);
  }
}

// ── Fertility Recovery ──────────────────────────────────────────────

export function recoverFertility(world: World): void {
  for (const row of world.tiles) {
    for (const tile of row) {
      // Natural fertility slowly recovers toward baseline
      const baseline = getBaselineFertility(tile.terrain);
      if (tile.fertility < baseline) {
        tile.fertility = clamp(tile.fertility + 0.02, 0, baseline);
      }
    }
  }
}

function getBaselineFertility(terrain: string): number {
  switch (terrain) {
    case 'riverPlain': return 0.9;
    case 'marsh': return 0.7;
    case 'alluvialPlain': return 0.6;
    case 'irrigatedLand': return 0.95;
    case 'drySteppe': return 0.2;
    default: return 0.1;
  }
}
