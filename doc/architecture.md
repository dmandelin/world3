# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        main.ts                               │
│   createWorld(seed) → initializeRelationships → new App()    │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
    ┌────▼──────────┐              ┌──────────▼──────────┐
    │   src/sim/     │              │      src/ui/         │
    │  (headless)    │◄─────────────│   (DOM + canvas)     │
    │                │  reads       │                      │
    │  types.ts      │  World       │  state.ts            │
    │  utils.ts      │  object      │  app.ts              │
    │  map-data.ts   │              │  map-renderer.ts     │
    │  init.ts       │              │  panels.ts           │
    │  production.ts │              └──────────────────────┘
    │  population.ts │
    │  needs.ts      │
    │  decisions.ts  │
    │  relationships.ts
    │  events.ts     │
    │  tick.ts       │
    └────────────────┘
```

The simulation and UI are strictly separated. All sim code is in `src/sim/` and has zero DOM dependencies. The UI reads the `World` object (the single source of truth) and renders it. The UI calls `tick()` or `tickMultiple()` to advance the simulation.

## Core Data Model

The entire simulation state lives in a single `World` object (defined in `types.ts`):

```
World
├── year: number                       # Current year (negative = BC)
├── tiles: Tile[][]                    # 15×12 terrain grid
├── rivers: River[]                    # Euphrates + Tigris polylines
├── settlements: Record<string, Settlement>
│   ├── id, name, x, y, tileX, tileY
│   ├── clanIds: string[]              # Which clans live here
│   ├── facilities: Facility[]         # Built structures
│   ├── tellHeight: number             # Grows with habitation
│   └── permanence: number             # 0-100
├── clans: Record<string, Clan>
│   ├── id, name, settlementId
│   ├── population: PopulationGroup[]  # 8 groups: 2 genders × 4 ages
│   ├── personality: Personality       # 6 traits, each -1 to 1
│   ├── culture: Culture               # 6 dimensions, each 0 to 1
│   ├── skills: Skills                 # 9 skills, each 0-100
│   ├── needs: Needs                   # 8 needs, each 0-100
│   ├── laborAllocation: LaborAllocation  # 8 categories, sum to 1.0
│   ├── relationships: Record<string, Relationship>
│   ├── foodStores, wealthGoods, shelterQuality
│   └── lastFoodProduction, lastFoodConsumption
├── events: GameEvent[]                # Rolling buffer of recent events
├── history: WorldSnapshot[]           # Population snapshots over time
└── clanHistories: Record<string, ClanSnapshot[]>
```

### Key Entity Relationships

- A **Settlement** contains one or more **Clans** (via `clanIds`).
- A **Clan** belongs to exactly one **Settlement** (via `settlementId`).
- **Relationships** are stored on each clan as a map from other clan IDs to `Relationship` objects. They are maintained symmetrically (both sides updated together).
- **Tiles** are the geographic substrate. Settlements sit on tiles and inherit terrain properties (fertility, water access, arable land).

## Module Responsibilities

### `types.ts` — Type Definitions
All interfaces, type aliases, and shared constants. No logic. This is the contract between all other modules.

### `utils.ts` — Seeded Random and Utilities
- **Seeded PRNG**: `random()`, `randomInt()`, `randomFloat()`, `randomChoice()`, `weightedChoice()`, `randomGaussian()`, `shuffled()` — all deterministic given the seed.
- **Math**: `clamp()`, `lerp()`, `distance()`, `smoothstep()`
- **IDs**: `generateId(prefix)` — monotonically increasing IDs like `cln_42`
- **Formatting**: `formatYear()`, `formatPopulation()`, `formatNeed()`, `needColor()`

### `map-data.ts` — Geography
- 15×12 tile grid at 10 miles per tile, covering ~150×120 miles of southern Mesopotamia.
- Terrain encoded as a string grid (`M`=marsh, `R`=riverPlain, `A`=alluvialPlain, `D`=drySteppe, `W`=water, `X`=desert).
- River polylines for Euphrates and Tigris.
- Name pools for settlements, clan prefixes, and clan suffixes.
- Terrain colors and display names for the map renderer.

### `init.ts` — World Initialization
Creates the starting `World` with seed-based randomness:
- 4 initial settlements: Eridu (3 clans), Tell Oueili (2), Kuara (2), Tell Uqair (2).
- Each clan starts with 20-40 people, randomized skills biased by terrain, random personality and culture.
- Initial relationships between co-located clans with mild positive affinity.

### `production.ts` — Economic Engine
Calculates food production from labor allocation × skill × terrain. Also handles:
- Worker count (youth + adults + 0.5×elders)
- Consumption (12 person-months/year, reduced for children/elders)
- Non-food outputs: building, crafting, ritual, trade
- Skill improvement through practice (diminishing returns)
- Food store management (spoilage cap at 3 years)

### `population.ts` — Demographics
Handles births, deaths, aging, and epidemics:
- **Deaths**: Base rate per age group × stress multipliers (food, density)
- **Births**: Fertile women × birth rate × food modifier × marriage access
- **Aging**: Fraction of each age group advances per year
- **Epidemics**: Density-dependent random events that kill 5-15% of population

### `needs.ts` — Need Evaluation
Evaluates 8 need categories (0-100) based on clan state:
- **food**: production/consumption ratio
- **foodSecurity**: months of stored food
- **shelter**: shelter quality score
- **community**: relationship quality with neighbors + facilities
- **prestige**: relative status, wealth, and population
- **spiritual**: personality baseline + shrine + ritual labor
- **luxury**: wealth goods
- **safety**: composite of food security + shelter + permanence

### `decisions.ts` — AI Decision-Making
Three decision types per tick:
1. **Labor allocation**: Shifts labor toward the most urgent need, blended 30% per year toward ideal.
2. **Building**: Identifies needed facilities based on settlement population thresholds (meeting place at 30, granary at 40, shrine at 50, etc.).
3. **Migration**: Triggered by crowding (Dunbar's number), low satisfaction, or personality. Clans can join existing settlements or found new ones.
4. **Clan splitting**: Clans exceeding ~60 population may split into two, with the new clan inheriting skills and culture with slight variation.

### `relationships.ts` — Social Dynamics
Manages inter-clan relationships within settlements:
- **Familiarity** grows from proximity, decays when apart.
- **Personality compatibility** drives affinity drift.
- **Community interactions** (8% chance/pair/year): feasts, celebrations.
- **Marriage** (variable chance): requires familiarity, affinity, available youth.
- **Disputes** (variable chance): based on low trust, high ambition, scarcity.
- **Status comparison**: based on wealth, population, and skill differences.
- **Skill sharing**: higher-skilled clan teaches lower-skilled one.
- **Gossip**: clans adopt trusted neighbors' opinions of third parties.
- **Scaling**: In settlements with >12 clans, interactions are limited to ~10 partners per clan per year to prevent O(n²) blowup.

### `events.ts` — World Events
Random events that affect settlements and clans:
- **Floods**: Minor (6%/yr) and major (1%/yr). Damage food, shelter, facilities. Deposit fertile silt.
- **Droughts**: 2%/yr. Reduce fertility and food stores globally.
- **Good harvests**: 10%/settlement/yr. Bonus food.
- **Discoveries**: 3%/settlement/yr. Random skill jump for a clan.
- **Settlement updates**: Tell height growth, permanence tracking, facility decay.
- **Fertility recovery**: Tiles slowly regenerate toward baseline.

### `tick.ts` — Simulation Orchestrator
Executes one year of simulation in this order:

```
1. evaluateNeeds        — All clans assess current state
2. makeDecisions        — Labor, building, migration
3. calculateProduction  — Food and goods output
   applyProduction      — Update stores, shelter, wealth
   improveSkills        — Learning by doing
4. updatePopulation     — Births, deaths, aging
   checkEpidemic        — Density-dependent disease
5. updateRelationships  — Social interactions
   transmitOpinions     — Gossip propagation
6. checkClanSplitting   — Large clans may split
7. generateEvents       — Floods, droughts, discoveries
8. recoverFertility     — Natural soil recovery
9. cleanupWorld         — Remove dead clans
10. recordHistory       — Snapshot for charts
11. Store events, advance year
```

## Data Flow Diagram

```
                    ┌───────────┐
                    │   World   │  (single mutable object)
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    ┌─────▼─────┐   ┌────▼────┐   ┌──────▼──────┐
    │ tick()    │   │ UI reads│   │ init creates│
    │ mutates   │   │ renders │   │ populates   │
    │ World     │   │ World   │   │ World       │
    └───────────┘   └─────────┘   └─────────────┘
```

There is no immutability layer or state diffing. The `World` object is mutated in place by `tick()`, and the UI re-renders from it on every update. This is simple and fast for the current scale.

## ID System

All entities use string IDs with a prefix:
- `set_1`, `set_2` — settlements
- `cln_1`, `cln_2` — clans
- `evt_1`, `evt_2` — events

IDs are generated by `generateId(prefix)` which increments a global counter. They are unique within a session but not persistent across reloads (no save/load yet).
