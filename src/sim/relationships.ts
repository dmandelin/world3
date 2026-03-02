import { Clan, Relationship, Settlement, World, GameEvent } from './types';
import { clamp, random, randomFloat, generateId, shuffled } from './utils';
import { getClanPopulation } from './production';

function shuffleIndices(length: number, exclude: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter(i => i !== exclude);
  // Fisher-Yates using our seeded random
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

// ── Constants ───────────────────────────────────────────────────────

const AFFINITY_DECAY_RATE = 0.02;     // slow drift toward 0
const TRUST_DECAY_RATE = 0.01;
const FAMILIARITY_GROWTH = 2.0;       // per year in same settlement
const FAMILIARITY_DECAY = 0.5;        // per year apart
const MARRIAGE_AFFINITY_BONUS = 5;
const MARRIAGE_TRUST_BONUS = 3;

// ── Initialize Relationship ─────────────────────────────────────────

export function createRelationship(year: number): Relationship {
  return {
    affinity: 0,
    trust: 20,
    marriageLinks: 0,
    statusDiff: 0,
    familiarity: 0,
    lastInteraction: year,
  };
}

export function ensureRelationship(clan: Clan, otherId: string, year: number): Relationship {
  if (!clan.relationships[otherId]) {
    clan.relationships[otherId] = createRelationship(year);
  }
  return clan.relationships[otherId];
}

// ── Update Relationships ────────────────────────────────────────────

export function updateRelationships(world: World): GameEvent[] {
  const events: GameEvent[] = [];

  for (const settlement of Object.values(world.settlements)) {
    const clans = settlement.clanIds
      .map(id => world.clans[id])
      .filter(Boolean);

    // In small settlements all clans interact; in larger ones, limit to ~10 interactions per clan
    const maxPairsPerClan = Math.min(clans.length - 1, 10);
    const allPairs: [number, number][] = [];
    for (let i = 0; i < clans.length; i++) {
      // Each clan interacts with a limited subset
      const partners = clans.length <= 12
        ? Array.from({ length: clans.length }, (_, k) => k).filter(k => k !== i)
        : shuffleIndices(clans.length, i).slice(0, maxPairsPerClan);
      for (const j of partners) {
        if (j > i) allPairs.push([i, j]);
      }
    }
    // Deduplicate pairs
    const pairSet = new Set(allPairs.map(([a, b]) => `${a},${b}`));
    const uniquePairs = [...pairSet].map(s => s.split(',').map(Number) as [number, number]);

    for (const [i, j] of uniquePairs) {
        const a = clans[i];
        const b = clans[j];

        const relA = ensureRelationship(a, b.id, world.year);
        const relB = ensureRelationship(b, a.id, world.year);

        // ── Familiarity grows from proximity ────────────────
        relA.familiarity = clamp(relA.familiarity + FAMILIARITY_GROWTH, 0, 100);
        relB.familiarity = clamp(relB.familiarity + FAMILIARITY_GROWTH, 0, 100);

        // ── Personality-based affinity drift ────────────────
        const compatScore = personalityCompatibility(a, b);
        relA.affinity = clamp(relA.affinity + compatScore * 0.5, -100, 100);
        relB.affinity = clamp(relB.affinity + compatScore * 0.5, -100, 100);

        // ── Community interactions ──────────────────────────
        const communityEvent = processCommunityInteraction(a, b, relA, relB, settlement, world);
        if (communityEvent) events.push(communityEvent);

        // ── Marriage ────────────────────────────────────────
        const marriageEvent = processMarriage(a, b, relA, relB, world);
        if (marriageEvent) events.push(marriageEvent);

        // ── Disputes ────────────────────────────────────────
        const disputeEvent = processDispute(a, b, relA, relB, world);
        if (disputeEvent) events.push(disputeEvent);

        // ── Status comparison ───────────────────────────────
        updateStatus(a, b, relA, relB, world);

        // ── Skill sharing ───────────────────────────────────
        shareSkills(a, b, relA, relB);

        // ── Natural decay ───────────────────────────────────
        relA.affinity *= (1 - AFFINITY_DECAY_RATE);
        relB.affinity *= (1 - AFFINITY_DECAY_RATE);

        relA.lastInteraction = world.year;
        relB.lastInteraction = world.year;
    }
  }

  // Decay familiarity for clans in different settlements
  for (const clan of Object.values(world.clans)) {
    for (const [otherId, rel] of Object.entries(clan.relationships)) {
      const other = world.clans[otherId];
      if (!other) continue;
      if (clan.settlementId !== other.settlementId) {
        rel.familiarity = clamp(rel.familiarity - FAMILIARITY_DECAY, 0, 100);
      }
    }
  }

  return events;
}

// ── Personality Compatibility ───────────────────────────────────────

function personalityCompatibility(a: Clan, b: Clan): number {
  // Similar sociability and generosity → positive
  // Similar ambition can lead to competition → slight negative
  let score = 0;
  score += (1 - Math.abs(a.personality.sociability - b.personality.sociability)) * 0.5;
  score += (1 - Math.abs(a.personality.generosity - b.personality.generosity)) * 0.3;
  score += (1 - Math.abs(a.personality.spirituality - b.personality.spirituality)) * 0.2;
  score -= Math.abs(a.personality.ambition + b.personality.ambition) * 0.1; // both ambitious = friction

  // Cultural similarity helps
  const cultureSim = culturalSimilarity(a, b);
  score += cultureSim * 0.3;

  return clamp(score, -1, 1);
}

function culturalSimilarity(a: Clan, b: Clan): number {
  const ca = a.culture;
  const cb = b.culture;
  let diff = 0;
  diff += Math.abs(ca.collectivism - cb.collectivism);
  diff += Math.abs(ca.hierarchy - cb.hierarchy);
  diff += Math.abs(ca.religiosity - cb.religiosity);
  diff += Math.abs(ca.innovation - cb.innovation);
  diff += Math.abs(ca.hospitality - cb.hospitality);
  // avg diff 0 to 1, higher = more different
  const avgDiff = diff / 5;
  return 1 - avgDiff;
}

// ── Community Interaction ───────────────────────────────────────────

function processCommunityInteraction(
  a: Clan, b: Clan,
  relA: Relationship, relB: Relationship,
  settlement: Settlement, world: World,
): GameEvent | null {
  // Small chance of a notable community event
  if (random() > 0.08) return null;

  const hasMeetingPlace = settlement.facilities.some(f => f.type === 'meetingPlace');
  const affinityBoost = hasMeetingPlace ? 3 : 1.5;
  const trustBoost = hasMeetingPlace ? 2 : 1;

  relA.affinity = clamp(relA.affinity + affinityBoost, -100, 100);
  relB.affinity = clamp(relB.affinity + affinityBoost, -100, 100);
  relA.trust = clamp(relA.trust + trustBoost, 0, 100);
  relB.trust = clamp(relB.trust + trustBoost, 0, 100);

  const activities = [
    'shared a feast together',
    'gathered for a seasonal celebration',
    'exchanged gifts at a community gathering',
    'worked together on a shared project',
    'participated in a communal ritual',
  ];

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'social',
    severity: 'minor',
    title: 'Community Gathering',
    description: `The ${a.name} and ${b.name} ${activities[Math.floor(random() * activities.length)]}.`,
    settlementId: settlement.id,
  };
}

// ── Marriage ────────────────────────────────────────────────────────

function processMarriage(
  a: Clan, b: Clan,
  relA: Relationship, relB: Relationship,
  world: World,
): GameEvent | null {
  // Marriage chance depends on familiarity, affinity, and available partners
  if (relA.familiarity < 20) return null;
  if (relA.affinity < -20) return null;

  const aYouth = a.population.filter(g => g.age === 'youth').reduce((s, g) => s + g.count, 0);
  const bYouth = b.population.filter(g => g.age === 'youth').reduce((s, g) => s + g.count, 0);

  if (aYouth < 2 || bYouth < 2) return null;

  // Chance of marriage per year
  const chance = 0.05 + relA.familiarity * 0.001 + Math.max(0, relA.affinity) * 0.001;
  if (random() > chance) return null;

  // Marriage happens
  relA.marriageLinks++;
  relB.marriageLinks++;
  relA.affinity = clamp(relA.affinity + MARRIAGE_AFFINITY_BONUS, -100, 100);
  relB.affinity = clamp(relB.affinity + MARRIAGE_AFFINITY_BONUS, -100, 100);
  relA.trust = clamp(relA.trust + MARRIAGE_TRUST_BONUS, 0, 100);
  relB.trust = clamp(relB.trust + MARRIAGE_TRUST_BONUS, 0, 100);

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'social',
    severity: 'minor',
    title: 'Marriage Alliance',
    description: `A marriage between the ${a.name} and the ${b.name} strengthens ties between the clans.`,
    settlementId: a.settlementId,
  };
}

// ── Disputes ────────────────────────────────────────────────────────

function processDispute(
  a: Clan, b: Clan,
  relA: Relationship, relB: Relationship,
  world: World,
): GameEvent | null {
  // Disputes more likely with low trust, high ambition, and resource scarcity
  const baseChance = 0.03;
  const trustFactor = (100 - relA.trust) / 200;  // low trust increases chance
  const ambitionFactor = (a.personality.ambition + b.personality.ambition) * 0.02;
  const scarcityFactor = (100 - a.needs.food + 100 - b.needs.food) / 400;

  const chance = baseChance + trustFactor + ambitionFactor + scarcityFactor;
  if (random() > chance) return null;

  // Dispute happens
  const severity = random();
  let affinityLoss: number;
  let trustLoss: number;
  let title: string;
  let desc: string;

  if (severity < 0.5) {
    // Minor disagreement
    affinityLoss = randomFloat(2, 8);
    trustLoss = randomFloat(1, 4);
    const causes = [
      'a disagreement over water rights',
      'a quarrel between their children',
      'a disputed inheritance',
      'accusations of theft',
    ];
    title = 'Minor Dispute';
    desc = `The ${a.name} and ${b.name} had ${causes[Math.floor(random() * causes.length)]}.`;
  } else if (severity < 0.85) {
    // Serious dispute
    affinityLoss = randomFloat(8, 20);
    trustLoss = randomFloat(4, 10);
    title = 'Serious Dispute';
    desc = `A serious conflict erupted between the ${a.name} and ${b.name} over resources and status.`;
  } else {
    // Major feud
    affinityLoss = randomFloat(20, 40);
    trustLoss = randomFloat(10, 25);
    title = 'Feud';
    desc = `A bitter feud has broken out between the ${a.name} and ${b.name}. Relations are severely damaged.`;
  }

  relA.affinity = clamp(relA.affinity - affinityLoss, -100, 100);
  relB.affinity = clamp(relB.affinity - affinityLoss, -100, 100);
  relA.trust = clamp(relA.trust - trustLoss, 0, 100);
  relB.trust = clamp(relB.trust - trustLoss, 0, 100);

  return {
    id: generateId('evt'),
    year: world.year,
    category: 'social',
    severity: severity < 0.5 ? 'minor' : severity < 0.85 ? 'notable' : 'major',
    title,
    description: desc,
    settlementId: a.settlementId,
  };
}

// ── Status Update ───────────────────────────────────────────────────

function updateStatus(
  a: Clan, b: Clan,
  relA: Relationship, relB: Relationship,
  world: World,
): void {
  const popA = getClanPopulation(a);
  const popB = getClanPopulation(b);
  const wealthDiff = (a.wealthGoods - b.wealthGoods) * 2;
  const popDiff = (popA - popB) * 0.5;
  const skillDiff = (avgSkill(a) - avgSkill(b)) * 0.3;

  const newStatus = clamp(wealthDiff + popDiff + skillDiff, -100, 100);
  relA.statusDiff = relA.statusDiff * 0.8 + newStatus * 0.2;
  relB.statusDiff = -relA.statusDiff;
}

function avgSkill(clan: Clan): number {
  const s = clan.skills;
  return (s.farming + s.fishing + s.gathering + s.building + s.pottery + s.ritual) / 6;
}

// ── Skill Sharing ───────────────────────────────────────────────────

function shareSkills(a: Clan, b: Clan, relA: Relationship, relB: Relationship): void {
  // Clans learn from each other based on familiarity and trust
  const learnRate = (relA.familiarity / 100) * (relA.trust / 100) * 0.3;
  if (learnRate < 0.01) return;

  const skills = ['farming', 'fishing', 'gathering', 'herding', 'building', 'pottery', 'irrigation', 'ritual', 'trade'] as const;

  for (const skill of skills) {
    if (a.skills[skill] > b.skills[skill] + 5) {
      b.skills[skill] = clamp(b.skills[skill] + learnRate, 0, 100);
    }
    if (b.skills[skill] > a.skills[skill] + 5) {
      a.skills[skill] = clamp(a.skills[skill] + learnRate, 0, 100);
    }
  }
}

// ── Gossip / Opinion Transmission ───────────────────────────────────

export function transmitOpinions(world: World): void {
  for (const settlement of Object.values(world.settlements)) {
    const clans = settlement.clanIds
      .map(id => world.clans[id])
      .filter(Boolean);

    // Each clan might adopt opinions of clans it trusts
    for (const clan of clans) {
      for (const other of clans) {
        if (clan.id === other.id) continue;
        const rel = clan.relationships[other.id];
        if (!rel || rel.trust < 30 || rel.familiarity < 30) continue;

        // Clan might adopt other's opinions about third parties
        for (const thirdId of Object.keys(other.relationships)) {
          if (thirdId === clan.id || thirdId === other.id) continue;
          const otherOpinion = other.relationships[thirdId];
          if (!otherOpinion) continue;

          const myRel = ensureRelationship(clan, thirdId, world.year);
          const influence = (rel.trust / 100) * 0.05;
          myRel.affinity = clamp(
            myRel.affinity + (otherOpinion.affinity - myRel.affinity) * influence,
            -100, 100
          );
        }
      }
    }
  }
}
