import { Clan, Needs, NeedName, NEED_NAMES, Settlement, World } from './types';
import { clamp } from './utils';
import { getClanPopulation, getWorkerCount } from './production';

// ── Evaluate all needs for a clan ───────────────────────────────────

export function evaluateNeeds(clan: Clan, world: World): void {
  const settlement = world.settlements[clan.settlementId];
  if (!settlement) return;

  clan.needs.food = evaluateFood(clan);
  clan.needs.foodSecurity = evaluateFoodSecurity(clan);
  clan.needs.shelter = evaluateShelter(clan);
  clan.needs.community = evaluateCommunity(clan, settlement, world);
  clan.needs.prestige = evaluatePrestige(clan, settlement, world);
  clan.needs.spiritual = evaluateSpiritual(clan, settlement);
  clan.needs.luxury = evaluateLuxury(clan);
  clan.needs.safety = evaluateSafety(clan, settlement, world);
}

// ── Individual Need Evaluations ─────────────────────────────────────

function evaluateFood(clan: Clan): number {
  // Based on recent production vs consumption
  if (clan.lastFoodConsumption <= 0) return 50;
  const ratio = clan.lastFoodProduction / clan.lastFoodConsumption;
  // ratio of 1.0 = satisfaction 60, 1.5 = 90, 0.5 = 20
  return clamp(ratio * 60, 0, 100);
}

function evaluateFoodSecurity(clan: Clan): number {
  const pop = getClanPopulation(clan);
  if (pop <= 0) return 50;
  const monthsStored = clan.foodStores / Math.max(pop, 1);
  // 12 months stored = 80 satisfaction, 24 = 100, 0 = 10
  return clamp(10 + monthsStored * (70 / 12), 0, 100);
}

function evaluateShelter(clan: Clan): number {
  return clamp(clan.shelterQuality, 0, 100);
}

function evaluateCommunity(clan: Clan, settlement: Settlement, world: World): number {
  const otherClans = settlement.clanIds.filter(id => id !== clan.id);
  if (otherClans.length === 0) {
    // Isolated, but personality might be OK with it
    return clamp(30 + clan.personality.sociability * -20, 0, 100);
  }

  // Average affinity with other clans in settlement
  let totalAffinity = 0;
  let count = 0;
  for (const otherId of otherClans) {
    const rel = clan.relationships[otherId];
    if (rel) {
      totalAffinity += rel.affinity;
      count++;
    }
  }
  const avgAffinity = count > 0 ? totalAffinity / count : 0;

  // Having a meeting place helps
  const meetingPlace = settlement.facilities.find(f => f.type === 'meetingPlace');
  const meetingBonus = meetingPlace ? meetingPlace.level * 5 : 0;

  // Marriage links contribute
  let marriageLinks = 0;
  for (const otherId of otherClans) {
    const rel = clan.relationships[otherId];
    if (rel) marriageLinks += rel.marriageLinks;
  }
  const marriageBonus = Math.min(marriageLinks * 5, 20);

  // Map affinity range (-100 to 100) to satisfaction (10 to 90)
  const base = 50 + avgAffinity * 0.4;
  return clamp(base + meetingBonus + marriageBonus, 0, 100);
}

function evaluatePrestige(clan: Clan, settlement: Settlement, world: World): number {
  const otherClans = settlement.clanIds
    .filter(id => id !== clan.id)
    .map(id => world.clans[id])
    .filter(Boolean);

  if (otherClans.length === 0) return 50;

  // Compare clan's overall status to others
  let higherStatus = 0;
  let total = 0;
  for (const other of otherClans) {
    const rel = clan.relationships[other.id];
    if (rel) {
      if (rel.statusDiff > 0) higherStatus++;
      total++;
    }
  }

  const statusRatio = total > 0 ? higherStatus / total : 0.5;

  // Wealth and population size also contribute
  const pop = getClanPopulation(clan);
  const avgPop = otherClans.reduce((s, c) => s + getClanPopulation(c), 0) / otherClans.length;
  const popFactor = pop > avgPop ? 10 : -5;

  const wealthFactor = Math.min(clan.wealthGoods * 2, 20);

  return clamp(30 + statusRatio * 40 + popFactor + wealthFactor, 0, 100);
}

function evaluateSpiritual(clan: Clan, settlement: Settlement): number {
  // Base spiritual satisfaction from personality
  const base = 30 + clan.personality.spirituality * 20;

  // Shrine boosts
  const shrine = settlement.facilities.find(f => f.type === 'shrine');
  const shrineBonus = shrine ? shrine.level * 10 : 0;

  // Ritual labor allocation contributes
  const ritualBonus = clan.laborAllocation.ritual * 60;

  return clamp(base + shrineBonus + ritualBonus, 0, 100);
}

function evaluateLuxury(clan: Clan): number {
  // Based on wealth goods and crafting output
  return clamp(20 + clan.wealthGoods * 3, 0, 100);
}

function evaluateSafety(clan: Clan, settlement: Settlement, world: World): number {
  // In early simulation, safety is mostly about food security and settlement stability
  const foodSafety = clan.needs.foodSecurity * 0.5;
  const shelterSafety = clan.shelterQuality * 0.3;
  const permanenceSafety = settlement.permanence * 0.2;

  return clamp(foodSafety + shelterSafety + permanenceSafety, 0, 100);
}

// ── Aggregate Need Score ────────────────────────────────────────────

export function getOverallSatisfaction(needs: Needs): number {
  let total = 0;
  let count = 0;
  for (const name of NEED_NAMES) {
    total += needs[name];
    count++;
  }
  return total / count;
}

export function getMostUrgentNeed(clan: Clan): NeedName {
  let worstNeed: NeedName = 'food';
  let worstScore = 100;

  for (const name of NEED_NAMES) {
    // Weight the urgency
    const weighted = clan.needs[name];
    if (weighted < worstScore) {
      worstScore = weighted;
      worstNeed = name;
    }
  }
  return worstNeed;
}
