import { Clan, PopulationGroup, Gender, AgeCategory, GameEvent, World } from './types';
import { clamp, random, randomGaussian, generateId } from './utils';
import { getClanPopulation } from './production';

// ── Constants ───────────────────────────────────────────────────────

// Base rates per year — pre-modern: high fertility, high child mortality
const BASE_BIRTH_RATE = 0.14;         // births per fertile woman per year (~3.5 in lifetime)
const BASE_DEATH_RATE_CHILD = 0.025;  // ~30% die before adulthood
const BASE_DEATH_RATE_YOUTH = 0.008;
const BASE_DEATH_RATE_ADULT = 0.01;
const BASE_DEATH_RATE_ELDER = 0.05;

// Food stress multiplier on death rate
const STARVATION_DEATH_MULTIPLIER = 2.0;

// Aging: fraction of each group that ages up per year
// Children spend 15 years → ~1/15 age up per year
const AGING_RATES: Record<AgeCategory, number> = {
  children: 1 / 15,
  youth: 1 / 10,
  adults: 1 / 20,
  elders: 0,   // elders don't age up, they die
};

// ── Population Update ───────────────────────────────────────────────

export interface PopulationChange {
  births: number;
  deaths: number;
  aged: Record<AgeCategory, number>;
}

export function updatePopulation(
  clan: Clan,
  world: World,
): PopulationChange {
  const pop = getClanPopulation(clan);
  if (pop <= 0) return { births: 0, deaths: 0, aged: { children: 0, youth: 0, adults: 0, elders: 0 } };

  const foodStress = calculateFoodStress(clan);
  const densityStress = calculateDensityStress(clan, world);

  // ── Deaths ────────────────────────────────────────────────────
  let totalDeaths = 0;
  const deathMultiplier = 1 + foodStress * STARVATION_DEATH_MULTIPLIER + densityStress * 0.5;

  for (const group of clan.population) {
    const baseRate = getDeathRate(group.age);
    const rate = baseRate * deathMultiplier;
    const expected = group.count * rate;
    // Floor + random fractional to avoid bias
    const wholeDeaths = Math.floor(expected);
    const frac = expected - wholeDeaths;
    const deaths = wholeDeaths + (random() < frac ? 1 : 0);
    const actualDeaths = clamp(deaths, 0, group.count);
    group.count -= actualDeaths;
    totalDeaths += actualDeaths;
  }

  // ── Births ────────────────────────────────────────────────────
  const adultWomen = clan.population
    .filter(g => g.gender === 'female' && (g.age === 'youth' || g.age === 'adults'))
    .reduce((sum, g) => sum + g.count, 0);

  // Birth rate reduced by food stress, boosted slightly by good food
  const birthMultiplier = foodStress > 0.3
    ? 0.4
    : 1.0 + (1 - foodStress) * 0.3;

  // Marriage access factor: need other clans for marriage partners
  const marriageAccess = calculateMarriageAccess(clan, world);

  // Use floor + random fractional to avoid systematic rounding bias
  const rawBirths = adultWomen * BASE_BIRTH_RATE * birthMultiplier * marriageAccess;
  const wholeBirths = Math.floor(rawBirths);
  const fractional = rawBirths - wholeBirths;
  const actualBirths = Math.max(0, wholeBirths + (random() < fractional ? 1 : 0));

  // Split births by gender
  const maleBirths = Math.round(actualBirths * 0.51);
  const femaleBirths = actualBirths - maleBirths;

  addToGroup(clan, 'male', 'children', maleBirths);
  addToGroup(clan, 'female', 'children', femaleBirths);

  // ── Aging ─────────────────────────────────────────────────────
  const aged: Record<AgeCategory, number> = { children: 0, youth: 0, adults: 0, elders: 0 };
  const ageOrder: AgeCategory[] = ['children', 'youth', 'adults'];
  const nextAge: Record<string, AgeCategory> = { children: 'youth', youth: 'adults', adults: 'elders' };

  for (const age of ageOrder) {
    for (const gender of ['male', 'female'] as Gender[]) {
      const group = clan.population.find(g => g.gender === gender && g.age === age);
      if (!group || group.count <= 0) continue;

      const agingUp = Math.round(group.count * AGING_RATES[age] + (random() - 0.5) * 0.5);
      const actual = clamp(agingUp, 0, group.count);
      if (actual > 0) {
        group.count -= actual;
        addToGroup(clan, gender, nextAge[age], actual);
        aged[age] += actual;
      }
    }
  }

  return { births: actualBirths, deaths: totalDeaths, aged };
}

// ── Helper Functions ────────────────────────────────────────────────

function addToGroup(clan: Clan, gender: Gender, age: AgeCategory, count: number): void {
  const group = clan.population.find(g => g.gender === gender && g.age === age);
  if (group) {
    group.count += count;
  } else {
    clan.population.push({ gender, age, count });
  }
}

function getDeathRate(age: AgeCategory): number {
  switch (age) {
    case 'children': return BASE_DEATH_RATE_CHILD;
    case 'youth': return BASE_DEATH_RATE_YOUTH;
    case 'adults': return BASE_DEATH_RATE_ADULT;
    case 'elders': return BASE_DEATH_RATE_ELDER;
  }
}

function calculateFoodStress(clan: Clan): number {
  // 0 = no stress, 1 = severe starvation
  const pop = getClanPopulation(clan);
  if (pop <= 0) return 0;
  const monthsOfFood = clan.foodStores / pop;
  // If less than 6 months of food stored, start stressing
  if (monthsOfFood >= 6) return 0;
  return clamp(1 - monthsOfFood / 6, 0, 1);
}

function calculateDensityStress(clan: Clan, world: World): number {
  // Settlements get increasingly crowded as population grows
  const settlement = world.settlements[clan.settlementId];
  if (!settlement) return 0;

  const settlementPop = settlement.clanIds
    .map(id => world.clans[id])
    .filter(Boolean)
    .reduce((sum, c) => sum + getClanPopulation(c), 0);

  // Stress begins above ~150 (Dunbar's number)
  if (settlementPop < 150) return 0;
  return clamp((settlementPop - 150) / 500, 0, 0.5);
}

function calculateMarriageAccess(clan: Clan, world: World): number {
  // Need other clans in the same settlement for marriage
  const settlement = world.settlements[clan.settlementId];
  if (!settlement) return 0.5;

  const otherClans = settlement.clanIds.filter(id => id !== clan.id).length;
  if (otherClans === 0) return 0.6; // can still have internal marriage
  if (otherClans === 1) return 0.8;
  return 1.0;
}

// ── Epidemic Check ──────────────────────────────────────────────────

export function checkEpidemic(clan: Clan, world: World): GameEvent | null {
  const pop = getClanPopulation(clan);
  const settlement = world.settlements[clan.settlementId];
  if (!settlement) return null;

  const settlementPop = settlement.clanIds
    .map(id => world.clans[id])
    .filter(Boolean)
    .reduce((sum, c) => sum + getClanPopulation(c), 0);

  // Epidemic chance increases with density
  const chance = settlementPop > 300 ? 0.02
    : settlementPop > 150 ? 0.008
    : 0.002;

  if (random() > chance) return null;

  // Epidemic strikes: kill 5-15% of population
  const severity = 0.05 + random() * 0.10;
  let killed = 0;
  for (const group of clan.population) {
    const deaths = Math.round(group.count * severity);
    group.count = Math.max(0, group.count - deaths);
    killed += deaths;
  }

  if (killed > 0) {
    return {
      id: generateId('evt'),
      year: world.year,
      category: 'disaster',
      severity: killed > pop * 0.1 ? 'major' : 'notable',
      title: 'Epidemic',
      description: `A sickness swept through the ${clan.name}, killing ${killed} people.`,
      settlementId: clan.settlementId,
      clanId: clan.id,
    };
  }
  return null;
}
