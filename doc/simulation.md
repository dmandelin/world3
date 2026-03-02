# Simulation Mechanics

This document covers every simulation system in detail: how it works, what constants drive it, and where the code lives.

## The Tick Loop (`tick.ts`)

Each call to `tick(world)` advances the world by one year. The phases execute in strict order — each phase may depend on the results of previous phases within the same tick.

`tickMultiple(world, count)` calls `tick()` in a loop. When count > 1, only notable+ events are kept (minor events are filtered out to reduce noise).

## Geography (`map-data.ts`)

### Terrain Grid

The map is a 15×12 grid of 10-mile tiles covering ~150×120 miles of southern Mesopotamia. Row 0 is the southern edge (marshes, Persian Gulf), row 11 is the north.

Each tile has:
| Property | Range | Meaning |
|---|---|---|
| `terrain` | enum | One of 7 terrain types |
| `arableLand` | 0-1 | Fraction usable for farming |
| `fertility` | 0-1 | Current soil quality (can change from floods/droughts) |
| `waterAccess` | 0-1 | Proximity to rivers/water |
| `elevation` | meters | Rough elevation |
| `usedLand` | 0-1 | Fraction currently farmed (not yet used in production) |

### Terrain Properties

| Terrain | Arable | Fertility | Water | Notes |
|---|---|---|---|---|
| `riverPlain` | 0.7 | 0.9 | 0.9 | Best farmland |
| `irrigatedLand` | 0.85 | 0.95 | 0.95 | After irrigation (not yet generated at init) |
| `marsh` | 0.1 | 0.7 | 1.0 | Great for fishing, poor for farming |
| `alluvialPlain` | 0.5 | 0.6 | 0.4 | Decent all-around |
| `drySteppe` | 0.15 | 0.2 | 0.1 | Marginal, good for herding |
| `desert` | 0.0 | 0.05 | 0.0 | Uninhabitable |
| `water` | 0.0 | 0.0 | 1.0 | Persian Gulf |

### Rivers

Two rivers are defined as polylines (arrays of `{x, y}` points in miles from origin):
- **Euphrates**: Flows roughly NW to SE on the western side.
- **Tigris**: Flows NW to SE on the eastern side, converging with the Euphrates in the south.

Rivers are purely visual — their effect on gameplay comes through terrain type (`riverPlain`, `marsh`).

## Production (`production.ts`)

### Food Production Formula

For each food category (farming, fishing, gathering, herding):

```
output = workers × laborFraction × BASE_OUTPUT × skillMultiplier(skill) × terrainFactor × bonuses
```

Where:
- `workers` = youth + adults + 0.5 × elders
- `skillMultiplier(skill)` = `0.7 + skill/143` (ranges from 0.7 at skill 0 to 1.4 at skill 100)
- `terrainFactor` is additive: `0.3 + 0.7 × quality` (so even bad terrain gives 30% of base)

### Base Output Constants

| Category | Base Output | Terrain Factor |
|---|---|---|
| Farming | 80 | `0.3 + 0.7 × (arableLand × fertility)` |
| Fishing | 65 | `0.3 + 0.7 × waterAccess` |
| Gathering | 45 | Terrain-specific: marsh 0.9, riverPlain 0.8, alluvial 0.6, steppe 0.35 |
| Herding | 55 | Terrain-specific: steppe 1.0, alluvial 0.8, riverPlain 0.7, marsh 0.4 |

### Facility Bonuses

- **Irrigation ditch** (condition > 20): +25% farming output
- **Granary** (condition > 20): +10% farming output
- **Technology**: +3% per discovered technology (placeholder)

### Consumption

```
consumption = Σ (group.count × 12 × ageFactor)
```

Age factors: children 0.5, elders 0.8, everyone else 1.0. The constant 12 represents person-months of food per person per year.

### Food Stores

- Surplus adds to `foodStores`. Deficit subtracts.
- Floor at 0 (starvation effects come through population, not negative stores).
- Cap at 3 years of consumption (spoilage).

### Skill Improvement

Skills improve when labor is allocated (>5%) to the associated activity:
```
learningRate = 0.5 × (1 - skill/120) × laborFraction
```
Diminishing returns: harder to improve as skill increases. Skills decay at 0.1/year when not practiced.

### Non-Food Production

| Category | Formula | Effect |
|---|---|---|
| Building | workers × labor.building × skillMult(building) × 10 | Improves shelter quality |
| Crafting | workers × labor.crafting × skillMult(pottery) × 8 | Adds wealth goods |
| Ritual | workers × labor.ritual × skillMult(ritual) × 6 | Feeds spiritual need eval |
| Trade | workers × labor.trade × skillMult(trade) × 5 | (Currently unused output) |

## Population (`population.ts`)

### Demographics Model

Population is tracked as 8 groups: 2 genders × 4 age categories.

| Category | Age Range | Duration (years) | Aging Rate |
|---|---|---|---|
| Children | 0-14 | 15 | 1/15 per year |
| Youth | 15-24 | 10 | 1/10 per year |
| Adults | 25-44 | 20 | 1/20 per year |
| Elders | 45+ | — | 0 (die instead) |

### Death Rates

Base rates per person per year:

| Category | Base Rate | Notes |
|---|---|---|
| Children | 0.025 | ~30% die before adulthood |
| Youth | 0.008 | Lowest mortality |
| Adults | 0.01 | |
| Elders | 0.05 | Highest natural mortality |

Actual rate = baseRate × deathMultiplier, where:
```
deathMultiplier = 1 + foodStress × 2.0 + densityStress × 0.5
```

### Food Stress

```
monthsOfFood = foodStores / population
if monthsOfFood >= 6: stress = 0
else: stress = 1 - monthsOfFood/6
```

### Density Stress

```
if settlementPop < 150: stress = 0
else: stress = clamp((settlementPop - 150) / 500, 0, 0.5)
```

Dunbar's number (150) is the threshold where crowding begins to cause problems.

### Birth Rate

```
rawBirths = adultWomen × 0.14 × birthMultiplier × marriageAccess
```

- `adultWomen` = females in youth + adult age groups
- `birthMultiplier`:
  - If foodStress > 0.3: 0.4 (severe reduction)
  - Else: 1.0 + (1 - foodStress) × 0.3 (slight boost when food is good)
- `marriageAccess`:
  - No other clans in settlement: 0.6
  - 1 other clan: 0.8
  - 2+ other clans: 1.0

The base rate of 0.14 produces ~3.5 children per woman over a lifetime, yielding realistic pre-modern growth of ~0.1%/year.

### Rounding Strategy

Both births and deaths use floor + fractional random to avoid systematic bias:
```typescript
const whole = Math.floor(expected);
const frac = expected - whole;
const actual = whole + (random() < frac ? 1 : 0);
```

This is critical for small populations where `Math.round()` introduces significant bias.

### Aging

Each year, a fraction of each age group advances:
```
agingUp = round(count × agingRate + noise)
```
Where noise is `(random() - 0.5) × 0.5` to add stochastic variation.

### Epidemics

Checked per clan per year. Chance increases with settlement density:
- settlementPop > 300: 2%
- settlementPop > 150: 0.8%
- Otherwise: 0.2%

Epidemics kill 5-15% of the affected clan's population uniformly across all groups.

## Needs (`needs.ts`)

Eight needs, each evaluated as a 0-100 satisfaction score:

| Need | Key Inputs |
|---|---|
| `food` | Production/consumption ratio (1.0 → 60, 1.5 → 90) |
| `foodSecurity` | Months of stored food (12mo → 80, 24mo → 100) |
| `shelter` | Direct shelterQuality score |
| `community` | Avg affinity with neighbors + meeting place + marriage links |
| `prestige` | Relative status, population size, wealth |
| `spiritual` | Personality baseline + shrine level + ritual labor |
| `luxury` | Wealth goods |
| `safety` | Composite: 50% food security + 30% shelter + 20% permanence |

### Need Weights (for decisions)

```
food: 3.0, safety: 2.5, foodSecurity: 2.0, shelter: 1.5,
community: 1.2, spiritual: 1.0, prestige: 0.8, luxury: 0.4
```

These weights are defined in `types.ts` but currently `getMostUrgentNeed()` just picks the lowest raw score (unweighted). The weights are available for future use.

## Decisions (`decisions.ts`)

### Labor Allocation

Each tick, every clan adjusts its labor allocation:
1. Calculate an **ideal allocation** based on terrain, most urgent need, and personality.
2. Blend 30% toward ideal (smooth transitions, no sudden shifts).
3. Normalize so all categories sum to 1.0.
4. Minimum of 2% per category (nobody fully abandons any activity).

Terrain adjustments: marshes boost fishing/gathering, dry steppe boosts herding, etc.
Need adjustments: food urgency shifts labor toward farming/fishing/gathering, shelter urgency boosts building, etc.

### Building Facilities

Clans consider building when they have:
- Workers ≥ 5
- Food satisfaction ≥ 40
- Building labor allocation ≥ 5%
- Sufficient build power (workers × building labor × building skill / 50)

Facilities are unlocked by settlement population thresholds:

| Threshold | Facility |
|---|---|
| 30 | Meeting Place |
| 40 | Granary |
| 50 | Shrine |
| 80 | Irrigation Ditch |
| 100 | Kiln |
| 120 | Brewhouse |
| 200 | Marketplace |

Each facility can be upgraded to level 5. Facilities decay 2 condition/year and are destroyed at condition 0. Floods and other events accelerate decay.

### Migration

Migration pressure accumulates from:
- Settlement population > 150 (Dunbar crowding)
- Food satisfaction < 30
- Bold personality (positive) / sociable personality (negative)
- Low average affinity with neighbors (< -20)

When pressure exceeds 0.3 and passes a random check, the clan:
1. Searches nearby tiles (3-tile radius) for suitable terrain.
2. Prefers unsettled tiles with high fertility/water, closer over farther.
3. If a settlement already exists on the best tile, joins it.
4. Otherwise, founds a new settlement.

### Clan Splitting

When a clan exceeds ~60 population (adjusted by sociability):
- 15% chance per year of splitting.
- The new clan takes ~35-45% of each population group.
- Inherits skills, culture, labor allocation from parent.
- Personality has slight random variation (±0.2 per trait).
- Starts with positive relationship to parent clan (affinity 40, trust 60).

## Relationships (`relationships.ts`)

### Interaction Scope

In settlements with ≤12 clans, all pairs interact every year. In larger settlements, each clan interacts with at most 10 randomly chosen partners per year. This prevents O(n²) computational blowup and also models the realistic limit of social bandwidth.

### Per-Pair Updates (each year)

1. **Familiarity**: +2.0/year in same settlement, -0.5/year apart.
2. **Personality compatibility**: Score from -1 to +1 based on sociability, generosity, spirituality similarity, and cultural similarity. Applied as ±0.5 affinity drift/year.
3. **Community interaction** (8% chance): Boosts affinity +1.5 (or +3 with meeting place) and trust.
4. **Marriage** (variable chance, requires familiarity ≥ 20, affinity > -20, both clans have youth ≥ 2): Creates a marriage link, boosts affinity +5 and trust +3.
5. **Dispute** (base 3% + trust/scarcity/ambition factors): Reduces affinity and trust. Three severity levels: minor (2-8 affinity loss), serious (8-20), feud (20-40).
6. **Status update**: Weighted comparison of wealth, population, skill differences.
7. **Skill sharing**: Clans learn from higher-skilled neighbors. Rate depends on familiarity × trust.
8. **Natural decay**: Affinity decays 2%/year toward 0.

### Gossip (Opinion Transmission)

After pair interactions, each clan may adopt opinions of trusted neighbors:
- Requires trust ≥ 30 and familiarity ≥ 30.
- Influence rate: trust/100 × 0.05.
- A clan's affinity toward a third party shifts toward its trusted neighbor's opinion.

## Events (`events.ts`)

### Flood Events

- **Minor flood**: 6%/year. Damage multiplier 0.02-0.06.
- **Major flood**: 1%/year. Damage multiplier 0.10-0.25.
- Only affects settlements on floodable terrain (riverPlain, marsh, alluvialPlain).
- Irrigation ditches halve exposure during minor floods.
- Damages food stores, shelter quality, facility condition.
- Major floods can kill people (10% of impact fraction, 30% chance per clan).
- Floods deposit silt: +30% of impact on riverPlain/alluvialPlain fertility.

### Drought Events

- 2%/year chance.
- Severity 0.05-0.20.
- Reduces fertility across all non-water tiles by severity × 15%.
- Reduces all clans' food stores by severity × 15%.

### Good Harvest

- 10% chance per settlement per year.
- Bonus food: 10-30% of last consumption for all clans in settlement.

### Discovery Events

- 3% chance per settlement per year.
- Random clan gains 2-8 points in a random skill.
- Flavored with specific discovery descriptions per skill.

### Settlement Updates (per tick)

- **Tell height**: Grows slowly with habitation (+0.01 + pop × 0.00005 per year).
- **Permanence**: Increases with facilities and population, decreases by 0.5/year.
- **Facility decay**: All facilities lose 2 condition/year.
- **Destroyed facilities**: Removed when condition reaches 0.

### Fertility Recovery

All tiles slowly recover fertility toward their terrain baseline at +0.02/year.

Baselines: riverPlain 0.9, irrigatedLand 0.95, marsh 0.7, alluvialPlain 0.6, drySteppe 0.2.

## World Initialization (`init.ts`)

### Starting Settlements

| Settlement | Tile | Clans | Historical Basis |
|---|---|---|---|
| Eridu | (5, 4) | 3 | One of the earliest known cities |
| Tell Oueili | (7, 5) | 2 | Very early Ubaid-period site |
| Kuara | (6, 3) | 2 | Early fishing community near marshes |
| Tell Uqair | (5, 8) | 2 | Northern settlement |

### Starting Clan Properties

- **Population**: 20-40 people, distributed ~30% children, 20% youth, 35% adults, 15% elders.
- **Skills**: Randomized within ranges; marsh/river clans get higher fishing skills (20-35 vs 5-15).
- **Personality**: 6 traits, each randomized with slight biases toward sociable, traditional, spiritual.
- **Culture**: 6 dimensions. Starts collectivist (0.4-0.8), egalitarian (0.1-0.4), low militarism (0-0.2).
- **Food stores**: 80-160 person-months (several months per person).
- **Shelter quality**: 25-45.
- **Relationships**: Neighboring clans start with mild positive affinity (5-25), trust (20-45), familiarity (30-60).
