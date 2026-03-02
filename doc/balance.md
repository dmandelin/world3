# Balance and Tuning

This document covers the key constants that drive simulation dynamics, how they were tuned, and how to adjust them.

## Population Growth Target

The simulation targets ~0.1% annual population growth, consistent with pre-modern demographic estimates for early Neolithic communities. Starting from 278 people (9 clans across 4 settlements), the population should:

- Grow to ~350-400 after 250 years
- Occasionally dip during disasters or famines
- Not collapse to zero or explode exponentially

## Constants Reference

### Production (`production.ts`)

| Constant | Value | Effect |
|---|---|---|
| `BASE_FARMING_OUTPUT` | 80 | Person-months of food per farmer per year |
| `BASE_FISHING_OUTPUT` | 65 | Person-months of food per fisher per year |
| `BASE_GATHERING_OUTPUT` | 45 | Person-months of food per gatherer per year |
| `BASE_HERDING_OUTPUT` | 55 | Person-months of food per herder per year |
| `FOOD_PER_PERSON_PER_YEAR` | 12 | Baseline annual consumption per person |
| `CHILD_FOOD_FACTOR` | 0.5 | Children consume half |
| `ELDER_FOOD_FACTOR` | 0.8 | Elders consume 80% |
| Skill multiplier | `0.7 + skill/143` | Ranges 0.7 (skill 0) to 1.4 (skill 100) |
| Terrain factor | `0.3 + 0.7 × quality` | Minimum 30% output even on poor terrain |
| Spoilage cap | 3 × consumption | Max stored food |

**If populations are starving**: Increase base outputs or improve terrain factors. The additive terrain formula (`0.3 + 0.7 × quality`) was specifically chosen to prevent near-zero production on marginal land.

**If populations are growing too fast**: Reduce base outputs or increase consumption rate.

### Population (`population.ts`)

| Constant | Value | Effect |
|---|---|---|
| `BASE_BIRTH_RATE` | 0.14 | Births per fertile woman per year |
| `BASE_DEATH_RATE_CHILD` | 0.025 | ~30% child mortality before adulthood |
| `BASE_DEATH_RATE_YOUTH` | 0.008 | Low mortality |
| `BASE_DEATH_RATE_ADULT` | 0.01 | Moderate mortality |
| `BASE_DEATH_RATE_ELDER` | 0.05 | High mortality |
| `STARVATION_DEATH_MULTIPLIER` | 2.0 | Death rate multiplied by up to 3× under starvation |
| Food stress threshold | 6 months | Stress begins when stores < 6 months per capita |
| Density stress threshold | 150 people | Crowding begins at Dunbar's number |

**Birth rate tuning history**:
- 0.08 → Too low, population declined (only 2 children per woman lifetime)
- 0.18 → Too high, population exploded to 9,000+ in 200 years
- 0.14 → Balanced, ~3.5 children per woman lifetime, slow growth

**Important**: The floor+fractional rounding strategy is critical. Using `Math.round()` introduces systematic bias that can cause population decline in small groups (20-40 people).

### Events (`events.ts`)

| Event | Chance/Year | Severity |
|---|---|---|
| Minor flood | 6% | Food/shelter damage, silt deposit |
| Major flood | 1% | Heavy damage, possible deaths |
| Drought | 2% | Global fertility and food store reduction |
| Good harvest | 10%/settlement | Bonus food |
| Discovery | 3%/settlement | Skill improvement |

**Event tuning history**:
- Floods at 15%, droughts at 5% → Population crashed from compounding disasters
- Reduced to 6% / 2% → Stable with occasional stress periods

### Relationships (`relationships.ts`)

| Constant | Value | Effect |
|---|---|---|
| `AFFINITY_DECAY_RATE` | 0.02 | 2%/year drift toward 0 |
| `TRUST_DECAY_RATE` | 0.01 | 1%/year (slower than affinity) |
| `FAMILIARITY_GROWTH` | 2.0 | Per year in same settlement |
| `FAMILIARITY_DECAY` | 0.5 | Per year apart |
| `MARRIAGE_AFFINITY_BONUS` | 5 | Per marriage event |
| `MARRIAGE_TRUST_BONUS` | 3 | Per marriage event |
| Interaction limit | 10 | Max partner clans per year (in large settlements) |

**Scaling fix**: Without the 10-partner limit, all O(n²) pairs in a large settlement interact every tick, compounding dispute damage faster than positive interactions can compensate. The limit was essential to prevent relationship negativity spirals in settlements with 40+ clans.

### Decisions (`decisions.ts`)

| Parameter | Value | Effect |
|---|---|---|
| Labor blend rate | 0.3 | 30% toward ideal allocation per year |
| Minimum labor | 0.02 | 2% floor per category |
| Build chance | 6% | Per eligible clan per year |
| Migration pressure threshold | 0.3 | Minimum pressure before migration possible |
| Split threshold | ~60 | Population size (adjusted ±20 by sociability) |
| Split chance | 15% | Per eligible clan per year |
| Split ratio | ~35-45% | Fraction going to new clan |

### Facility Thresholds

| Pop Threshold | Facility | Primary Benefit |
|---|---|---|
| 30 | Meeting Place | +community satisfaction |
| 40 | Granary | +10% farming, +food security |
| 50 | Shrine | +spiritual satisfaction |
| 80 | Irrigation Ditch | +25% farming, flood mitigation |
| 100 | Kiln | (crafting support) |
| 120 | Brewhouse | (luxury/social) |
| 200 | Marketplace | (trade support) |

## Known Dynamics

### Typical Population Trajectory

1. **Years 0-50**: Slow growth. Clans are small (20-40), birth rate is limited by small population. Skills improve. Settlements get first facilities.
2. **Years 50-150**: Steady growth. Clans begin splitting at ~60 pop. New settlements may be founded as migration kicks in.
3. **Years 150-300**: Growth with occasional setbacks from floods/droughts/epidemics. Settlement network expands. Some clans die out, others thrive.
4. **Years 300+**: Population stabilizes around carrying capacity unless new settlements open fresh land.

### Feedback Loops

**Positive loops** (growth-promoting):
- More people → more workers → more food → more births
- Better skills → more food → more people → more skill sharing
- More clans → more marriage access → higher birth rate
- Facilities → production bonuses → food surplus → population growth

**Negative loops** (growth-limiting):
- Crowding → density stress → higher death rates
- Crowding → relationship conflicts → lower satisfaction → migration
- Population > ~60 → clan splitting → smaller, more vulnerable clans
- Food scarcity → lower birth rate, higher death rate
- Disaster events → food/shelter/population shocks

### Common Issues and Fixes

| Symptom | Likely Cause | Fix |
|---|---|---|
| Population crashes to 0 | Food production too low | Increase base outputs or terrain factors |
| Population explodes | Birth rate too high or death rates too low | Reduce `BASE_BIRTH_RATE` |
| All clans hate each other | Too many interactions per tick | Lower interaction limit or reduce dispute chance |
| No new settlements | Migration pressure never triggers | Lower the 150-person density threshold |
| Skills never improve | Labor fractions too spread out | Reduce minimum labor floor or increase learning rate |
| Facilities never built | Build chance too low or food threshold too strict | Lower food satisfaction threshold or increase build chance |
