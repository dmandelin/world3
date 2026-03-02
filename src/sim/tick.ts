import { World, WorldSnapshot, ClanSnapshot, SkillName, SKILL_NAMES, GameEvent } from './types';
import { evaluateNeeds, getOverallSatisfaction } from './needs';
import { calculateProduction, applyProduction, improveSkills, getClanPopulation } from './production';
import { updatePopulation, checkEpidemic } from './population';
import { updateRelationships, transmitOpinions } from './relationships';
import { makeDecisions, checkClanSplitting } from './decisions';
import { generateEvents, recoverFertility } from './events';

// ── Single Tick ─────────────────────────────────────────────────────

export function tick(world: World): GameEvent[] {
  const allEvents: GameEvent[] = [];

  // 1. Evaluate: Agents assess their current state
  for (const clan of Object.values(world.clans)) {
    evaluateNeeds(clan, world);
  }

  // 2. Decide: Agents choose actions and policies
  const decisionEvents = makeDecisions(world);
  allEvents.push(...decisionEvents);

  // 3. Produce: Calculate and apply production
  for (const clan of Object.values(world.clans)) {
    const settlement = world.settlements[clan.settlementId];
    if (!settlement) continue;
    const tile = world.tiles[settlement.tileY]?.[settlement.tileX];
    if (!tile) continue;

    const result = calculateProduction(clan, tile, settlement, world);
    applyProduction(clan, result);
    improveSkills(clan);
  }

  // 4. Population: Births, deaths, aging
  for (const clan of Object.values(world.clans)) {
    updatePopulation(clan, world);

    // Check for epidemics
    const epidemic = checkEpidemic(clan, world);
    if (epidemic) allEvents.push(epidemic);
  }

  // 5. Relationships: Update social dynamics
  const relationshipEvents = updateRelationships(world);
  allEvents.push(...relationshipEvents);
  transmitOpinions(world);

  // 6. Clan splitting
  const splitEvents = checkClanSplitting(world);
  allEvents.push(...splitEvents);

  // 7. World events: Floods, droughts, discoveries
  const worldEvents = generateEvents(world);
  allEvents.push(...worldEvents);

  // 8. Fertility recovery
  recoverFertility(world);

  // 9. Clean up dead clans / empty settlements
  cleanupWorld(world);

  // 10. Record history
  recordHistory(world);
  recordClanHistories(world);

  // 11. Store events and advance year
  world.events.push(...allEvents);

  // Keep only last 200 events
  if (world.events.length > 200) {
    world.events = world.events.slice(-200);
  }

  // Store recent events on clans
  for (const event of allEvents) {
    if (event.clanId && world.clans[event.clanId]) {
      world.clans[event.clanId].recentEvents.push(event.description);
      if (world.clans[event.clanId].recentEvents.length > 5) {
        world.clans[event.clanId].recentEvents.shift();
      }
    }
  }

  world.year++;

  return allEvents;
}

// ── Multi-Tick ──────────────────────────────────────────────────────

export function tickMultiple(world: World, count: number): GameEvent[] {
  const allEvents: GameEvent[] = [];
  for (let i = 0; i < count; i++) {
    const events = tick(world);
    // Only keep notable+ events from batch runs
    if (count > 1) {
      allEvents.push(...events.filter(e => e.severity !== 'minor'));
    } else {
      allEvents.push(...events);
    }
  }
  return allEvents;
}

// ── Cleanup ─────────────────────────────────────────────────────────

function cleanupWorld(world: World): void {
  // Remove dead clans (population 0)
  for (const [id, clan] of Object.entries(world.clans)) {
    if (getClanPopulation(clan) <= 0) {
      // Remove from settlement
      const settlement = world.settlements[clan.settlementId];
      if (settlement) {
        settlement.clanIds = settlement.clanIds.filter(cid => cid !== id);
      }
      delete world.clans[id];
    }
  }

  // Don't delete empty settlements — they become ruins/tells
}

// ── History Recording ───────────────────────────────────────────────

function recordHistory(world: World): void {
  const clans = Object.values(world.clans);
  const totalPop = clans.reduce((s, c) => s + getClanPopulation(c), 0);
  const avgFood = clans.length > 0
    ? clans.reduce((s, c) => s + c.needs.food, 0) / clans.length
    : 0;
  const avgPrestige = clans.length > 0
    ? clans.reduce((s, c) => s + c.needs.prestige, 0) / clans.length
    : 0;
  const avgTech = clans.length > 0
    ? clans.reduce((s, c) => {
        const skills = SKILL_NAMES.map(sk => c.skills[sk]);
        return s + skills.reduce((a, b) => a + b, 0) / skills.length;
      }, 0) / clans.length
    : 0;

  const settlements = Object.values(world.settlements)
    .filter(s => s.clanIds.length > 0)
    .map(s => ({
      id: s.id,
      name: s.name,
      population: s.clanIds
        .map(id => world.clans[id])
        .filter(Boolean)
        .reduce((sum, c) => sum + getClanPopulation(c), 0),
    }));

  const snapshot: WorldSnapshot = {
    year: world.year,
    totalPopulation: totalPop,
    settlementCount: settlements.length,
    clanCount: clans.length,
    avgFoodSatisfaction: avgFood,
    avgPrestige,
    avgTechLevel: avgTech,
    settlements,
  };

  world.history.push(snapshot);

  // Keep history manageable
  if (world.history.length > 500) {
    // Thin out: keep every other entry for old data
    const recent = world.history.slice(-100);
    const old = world.history.slice(0, -100).filter((_, i) => i % 2 === 0);
    world.history = [...old, ...recent];
  }
}

function recordClanHistories(world: World): void {
  for (const clan of Object.values(world.clans)) {
    const pop = getClanPopulation(clan);
    const avgSatisfaction = getOverallSatisfaction(clan.needs);

    let topSkill: SkillName = 'farming';
    let topLevel = 0;
    for (const sk of SKILL_NAMES) {
      if (clan.skills[sk] > topLevel) {
        topLevel = clan.skills[sk];
        topSkill = sk;
      }
    }

    const snapshot: ClanSnapshot = {
      year: world.year,
      population: pop,
      foodStores: clan.foodStores,
      avgNeedSatisfaction: avgSatisfaction,
      topSkill,
      topSkillLevel: topLevel,
    };

    if (!world.clanHistories[clan.id]) {
      world.clanHistories[clan.id] = [];
    }
    world.clanHistories[clan.id].push(snapshot);

    // Limit history length
    if (world.clanHistories[clan.id].length > 200) {
      world.clanHistories[clan.id] = world.clanHistories[clan.id].slice(-200);
    }
  }
}
