import { World, Clan, Settlement, Tile, Skills, LaborAllocation } from './types';
import { clamp } from './utils';

// ── Constants ───────────────────────────────────────────────────────

// Base food output per laborer per year (in person-months of food)
// With ~70% of labor on food and average terrain, a clan should be self-sustaining
const BASE_FARMING_OUTPUT = 80;     // A skilled farmer on good land feeds ~6 people
const BASE_FISHING_OUTPUT = 65;
const BASE_GATHERING_OUTPUT = 45;
const BASE_HERDING_OUTPUT = 55;

// Skill multipliers: at skill 0, output is 70%; at skill 100, output is 140%
function skillMultiplier(skill: number): number {
  return 0.7 + (skill / 143);
}

// Food consumption: 12 person-months per person per year
const FOOD_PER_PERSON_PER_YEAR = 12;

// Children consume less
const CHILD_FOOD_FACTOR = 0.5;
const ELDER_FOOD_FACTOR = 0.8;

// ── Production Calculation ──────────────────────────────────────────

export interface ProductionResult {
  farming: number;
  fishing: number;
  gathering: number;
  herding: number;
  totalFood: number;
  totalConsumption: number;
  surplus: number;
  buildingOutput: number;
  craftingOutput: number;
  ritualOutput: number;
  tradeOutput: number;
}

export function calculateProduction(
  clan: Clan,
  tile: Tile,
  settlement: Settlement,
  world: World,
): ProductionResult {
  const workers = getWorkerCount(clan);
  const labor = clan.laborAllocation;

  // ── Food production ───────────────────────────────────────────
  const farmWorkers = workers * labor.farming;
  const fishWorkers = workers * labor.fishing;
  const gatherWorkers = workers * labor.gathering;
  const herdWorkers = workers * labor.herding;

  // Farming depends on tile fertility and arable land
  // Use additive base so even poor terrain yields something
  const farmLandFactor = 0.3 + 0.7 * clamp(tile.arableLand * tile.fertility, 0, 1);
  const irrigationBonus = hasIrrigation(settlement) ? 0.25 : 0;
  const granaryBonus = hasGranary(settlement) ? 0.1 : 0;
  const farmTechBonus = getTechBonus(clan, 'farming');

  const farming = farmWorkers * BASE_FARMING_OUTPUT
    * skillMultiplier(clan.skills.farming)
    * (farmLandFactor + irrigationBonus)
    * (1 + farmTechBonus + granaryBonus);

  // Fishing depends on water access — minimum 30% even inland (small streams)
  const fishFactor = 0.3 + 0.7 * clamp(tile.waterAccess, 0, 1);
  const fishing = fishWorkers * BASE_FISHING_OUTPUT
    * skillMultiplier(clan.skills.fishing)
    * fishFactor
    * (1 + getTechBonus(clan, 'fishing'));

  // Gathering depends on terrain richness
  const gatherFactor = tile.terrain === 'marsh' ? 0.9
    : tile.terrain === 'riverPlain' ? 0.8
    : tile.terrain === 'alluvialPlain' ? 0.6
    : tile.terrain === 'drySteppe' ? 0.35
    : 0.2;
  const gathering = gatherWorkers * BASE_GATHERING_OUTPUT
    * skillMultiplier(clan.skills.gathering)
    * gatherFactor;

  // Herding is relatively terrain-independent but needs some space
  const herdFactor = tile.terrain === 'drySteppe' ? 1.0
    : tile.terrain === 'alluvialPlain' ? 0.8
    : tile.terrain === 'riverPlain' ? 0.7
    : tile.terrain === 'marsh' ? 0.4
    : 0.3;
  const herding = herdWorkers * BASE_HERDING_OUTPUT
    * skillMultiplier(clan.skills.herding)
    * herdFactor;

  const totalFood = farming + fishing + gathering + herding;

  // ── Consumption ───────────────────────────────────────────────
  const totalConsumption = calculateConsumption(clan);

  // ── Non-food production ───────────────────────────────────────
  const buildWorkers = workers * labor.building;
  const craftWorkers = workers * labor.crafting;
  const ritualWorkers = workers * labor.ritual;
  const tradeWorkers = workers * labor.trade;

  const buildingOutput = buildWorkers * skillMultiplier(clan.skills.building) * 10;
  const craftingOutput = craftWorkers * skillMultiplier(clan.skills.pottery) * 8;
  const ritualOutput = ritualWorkers * skillMultiplier(clan.skills.ritual) * 6;
  const tradeOutput = tradeWorkers * skillMultiplier(clan.skills.trade) * 5;

  return {
    farming,
    fishing,
    gathering,
    herding,
    totalFood,
    totalConsumption,
    surplus: totalFood - totalConsumption,
    buildingOutput,
    craftingOutput,
    ritualOutput,
    tradeOutput,
  };
}

// ── Helper Functions ────────────────────────────────────────────────

export function getClanPopulation(clan: Clan): number {
  return clan.population.reduce((sum, g) => sum + g.count, 0);
}

export function getWorkerCount(clan: Clan): number {
  // Youth and adults can work; elders do light work (50%)
  let workers = 0;
  for (const group of clan.population) {
    if (group.age === 'youth' || group.age === 'adults') {
      workers += group.count;
    } else if (group.age === 'elders') {
      workers += group.count * 0.5;
    }
  }
  return workers;
}

export function calculateConsumption(clan: Clan): number {
  let consumption = 0;
  for (const group of clan.population) {
    const factor = group.age === 'children' ? CHILD_FOOD_FACTOR
      : group.age === 'elders' ? ELDER_FOOD_FACTOR
      : 1.0;
    consumption += group.count * FOOD_PER_PERSON_PER_YEAR * factor;
  }
  return consumption;
}

function hasIrrigation(settlement: Settlement): boolean {
  return settlement.facilities.some(f => f.type === 'irrigationDitch' && f.condition > 20);
}

function hasGranary(settlement: Settlement): boolean {
  return settlement.facilities.some(f => f.type === 'granary' && f.condition > 20);
}

function getTechBonus(clan: Clan, _skill: string): number {
  // Sum up productivity bonuses from discovered technologies
  // For now, a simple count-based approach
  return clan.technologies.length * 0.03;
}

// ── Skill Improvement ───────────────────────────────────────────────

export function improveSkills(clan: Clan): void {
  const labor = clan.laborAllocation;

  // Skills improve when used, decay slightly when not
  const skillLabor: Record<string, number> = {
    farming: labor.farming,
    fishing: labor.fishing,
    gathering: labor.gathering,
    herding: labor.herding,
    building: labor.building,
    pottery: labor.crafting,
    irrigation: labor.farming * 0.3, // farming involves some irrigation learning
    ritual: labor.ritual,
    trade: labor.trade,
  };

  for (const [skill, laborFrac] of Object.entries(skillLabor)) {
    const key = skill as keyof typeof clan.skills;
    const current = clan.skills[key];

    if (laborFrac > 0.05) {
      // Learning rate decreases as skill increases (diminishing returns)
      const learningRate = 0.5 * (1 - current / 120) * laborFrac;
      clan.skills[key] = clamp(current + learningRate, 0, 100);
    } else {
      // Slight decay when not practicing
      clan.skills[key] = clamp(current - 0.1, 0, 100);
    }
  }
}

// ── Apply Production Results ────────────────────────────────────────

export function applyProduction(clan: Clan, result: ProductionResult): void {
  // Update food stores
  clan.foodStores += result.surplus;
  clan.lastFoodProduction = result.totalFood;
  clan.lastFoodConsumption = result.totalConsumption;

  // Food stores can't go below 0 (people die in population step if food < 0)
  if (clan.foodStores < 0) {
    clan.foodStores = 0;
  }

  // Cap food stores at ~3 years worth (spoilage)
  const maxStores = result.totalConsumption * 3;
  if (clan.foodStores > maxStores) {
    clan.foodStores = maxStores;
  }

  // Building output improves shelter
  if (result.buildingOutput > 0) {
    clan.shelterQuality = clamp(
      clan.shelterQuality + result.buildingOutput * 0.02 - 1, // slight decay
      0,
      100
    );
  } else {
    clan.shelterQuality = clamp(clan.shelterQuality - 1, 0, 100);
  }

  // Crafting adds wealth
  clan.wealthGoods += result.craftingOutput * 0.1;
}
