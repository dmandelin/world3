# Getting Started

## Prerequisites

- **Node.js 24+** (see `.nvmrc`). Use `nvm use` to activate.
- npm (bundled with Node)

## Installation

```bash
npm install
```

This installs two dev dependencies: `typescript` and `vite`. There are zero runtime dependencies.

## Running

```bash
npm run dev       # Start Vite dev server on port 3000
npm run build     # Type-check with tsc, then production build to dist/
npm run preview   # Serve the production build locally
```

The dev server supports hot module replacement. Editing any `.ts` or `.css` file will instantly reflect in the browser.

## Project Structure

```
.
├── doc/                    # Developer documentation (you are here)
├── src/
│   ├── main.ts             # Entry point: creates world, launches UI
│   ├── styles.css          # All CSS (single file, ~790 lines)
│   ├── sim/                # Simulation engine (no DOM dependencies)
│   │   ├── types.ts        # All interfaces, type aliases, constants
│   │   ├── utils.ts        # Seeded PRNG, math helpers, formatting
│   │   ├── map-data.ts     # Geography: terrain grid, rivers, name pools
│   │   ├── init.ts         # World creation and initial settlement setup
│   │   ├── production.ts   # Food/goods production and skill improvement
│   │   ├── population.ts   # Birth, death, aging, epidemics
│   │   ├── needs.ts        # Need evaluation (8 categories)
│   │   ├── decisions.ts    # AI: labor allocation, building, migration, splitting
│   │   ├── relationships.ts# Inter-clan social dynamics
│   │   ├── events.ts       # World events: floods, droughts, discoveries
│   │   └── tick.ts         # Main simulation loop orchestrator
│   └── ui/                 # User interface (depends on sim/)
│       ├── state.ts        # Reactive UI state and navigation
│       ├── app.ts          # Application shell, controls, event wiring
│       ├── map-renderer.ts # Canvas-based map rendering
│       └── panels.ts       # HTML panel rendering (world, settlement, clan, history)
├── index.html              # HTML shell (loads fonts, mounts #app)
├── package.json
├── tsconfig.json           # Strict TS config, path aliases @sim/* and @ui/*
├── vite.config.ts          # Aliases and dev server config
├── vision.md               # Original design document
└── .nvmrc                  # Node version: 24
```

## Path Aliases

The `tsconfig.json` defines two path aliases for cleaner imports:

- `@sim/*` → `src/sim/*`
- `@ui/*` → `src/ui/*`

These are mirrored in `vite.config.ts` so both TypeScript and Vite resolve them correctly.

## Development Workflow

1. **Run `npm run dev`** to start the dev server.
2. **Edit files in `src/`**. Changes hot-reload instantly.
3. **Run `npm run build`** before committing to catch type errors. The build runs `tsc` (type-check only, no emit) then `vite build`.

### Adding a New Simulation Module

1. Create a new file in `src/sim/`.
2. Import types from `./types` and utilities from `./utils`.
3. Export your functions and wire them into `tick.ts` at the appropriate phase.
4. **Do not import anything from `src/ui/`** — the simulation must remain headless.

### Adding a New UI Panel

1. Add a render function in `src/ui/panels.ts` that returns an HTML string.
2. Add a new `ViewType` case in `src/ui/state.ts` if needed.
3. Wire the rendering into the `update()` method in `src/ui/app.ts`.
4. Add navigation (breadcrumb links, clickable rows) using `data-*` attributes and the delegated event handler in `app.ts`.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Space | Advance 1 year |
| Right Arrow | Advance 1 year |
| Escape | Return to World Overview |
