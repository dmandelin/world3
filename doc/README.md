# World III Developer Documentation

World III is an agent-based civilization simulation set in southern Mesopotamia (6500-4000 BC). Clans act as autonomous agents with personality, culture, skills, and needs. They produce food, build facilities, form relationships, migrate, and split — all driven by internal AI decision-making. The result is an emergent history of early settlement, population growth, and social complexity.

## Documentation Map

| Document | Contents |
|---|---|
| [Getting Started](getting-started.md) | Setup, running, dev workflow, project structure |
| [Architecture](architecture.md) | System design, file map, data flow, module boundaries |
| [Simulation](simulation.md) | All simulation mechanics: tick loop, production, population, needs, decisions, relationships, events |
| [UI](ui.md) | Rendering pipeline, state management, map canvas, panels, CSS theming |
| [Balance](balance.md) | Tuning constants, rate tables, known dynamics, and how to adjust them |

## Quick Start

```bash
nvm use 24        # requires Node 24+
npm install
npm run dev        # opens http://localhost:3000
```

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Bundler:** Vite 5
- **Framework:** None — vanilla DOM, canvas, template literals
- **Fonts:** Cinzel (display), Crimson Pro (body) via Google Fonts
- **Dependencies:** Zero runtime dependencies

## Key Design Principles

1. **Simulation is headless.** All sim code lives in `src/sim/` with no DOM or UI imports. You can run the simulation programmatically without any browser.
2. **No framework.** The UI is vanilla TypeScript with HTML template literals and a canvas map. This keeps the bundle tiny and avoids framework churn.
3. **Seeded determinism.** All randomness flows through a seeded PRNG (mulberry32). Given the same seed, every run produces identical results.
4. **Agents are autonomous.** Clans evaluate their needs, then make decisions (labor, building, migration) based on those needs and their personality. The player observes; there is no required input.
