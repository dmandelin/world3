# UI Architecture

The UI is built entirely with vanilla TypeScript — no frameworks, no virtual DOM. It uses HTML template literals for panels, a `<canvas>` for the map, and a simple pub/sub state system for navigation.

## Application Shell (`app.ts`)

The `App` class is the main controller. It:

1. **Builds the layout** as a single HTML string injected into `#app`.
2. **Creates the `MapRenderer`** (canvas-based).
3. **Wires controls**: step buttons, auto-play toggle, keyboard shortcuts.
4. **Sets up delegated event handling** on `#main-panel` for all clicks (navigation, breadcrumbs, star button).
5. **Subscribes to state changes** and calls `update()` on every change.

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│  Header: Title | Year | Controls | Stats        │
├──────────────┬──────────────────────────────────┤
│              │                                   │
│   Map        │         Main Panel               │
│   (canvas)   │   (world / settlement / clan /   │
│   35% width  │    history view)                  │
│              │                                   │
├──────────────┴──────────────────────────────────┤
│  Event Log Footer (collapsible)                  │
└─────────────────────────────────────────────────┘
```

### Update Cycle

Every call to `update()`:
1. Updates header text (year, population, settlement count, clan count).
2. Calls `mapRenderer.render(world)` to redraw the canvas.
3. Reads `state.currentView` and renders the appropriate panel HTML into `#main-panel`.
4. Updates the event log content if expanded.

There is no diffing — the entire panel HTML is replaced on every update. At the current scale (~10-50 clans, ~4-20 settlements), this is fast enough that no optimization is needed.

### Delegated Event Handling

Instead of attaching click handlers to individual elements (which would be lost on re-render), `app.ts` uses a single delegated listener on `#main-panel`:

```typescript
mainPanel.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  // Check for clickable table rows
  const row = target.closest('.clickable-row') as HTMLElement;
  if (row) {
    const clanId = row.dataset.clanId;
    const settlementId = row.dataset.settlementId;
    // Navigate...
  }

  // Check for breadcrumb links
  const breadcrumb = target.closest('.breadcrumb-link');
  // ...

  // Check for action buttons
  const btn = target.closest('[data-action]');
  // ...
});
```

This pattern lets panels be re-rendered freely without losing interactivity.

### Auto-Play

Auto-play calls `step(1)` every 400ms via `setInterval`. The button toggles between "Auto" and "Stop" states.

## State Management (`state.ts`)

A minimal reactive state system:

```typescript
interface UIState {
  currentView: 'world' | 'settlement' | 'clan' | 'history';
  selectedSettlementId: string | null;
  selectedClanId: string | null;
  hoveredSettlementId: string | null;
  showEventLog: boolean;
  // ... plus zoom/offset fields (reserved for future use)
}
```

### API

- `getState()` — returns current state.
- `setState(partial)` — merges partial update, notifies all subscribers.
- `subscribe(callback)` — registers a listener, returns unsubscribe function.

### Navigation Helpers

Four convenience functions that set the view and selection:

```typescript
navigateToWorld()                           // World overview
navigateToSettlement(id)                    // Settlement detail
navigateToClan(clanId, settlementId)        // Clan detail
navigateToHistory()                         // Population history chart
```

Each clears irrelevant selection state (e.g., navigating to world clears selected clan/settlement).

## Map Renderer (`map-renderer.ts`)

A canvas-based renderer that draws the map of southern Mesopotamia.

### Coordinate System

- **Map coordinates**: miles from bottom-left origin. x=0 is west, y=0 is south.
- **Screen coordinates**: pixels from top-left. Standard canvas orientation.
- `toMapCoords(screenX, screenY)` and `toScreenCoords(mx, my)` convert between them.

The y-axis is inverted: increasing map-y goes north (up on screen), while increasing screen-y goes down.

### Rendering Layers (bottom to top)

1. **Background**: Solid dark fill.
2. **Terrain tiles**: Filled rectangles colored by terrain type, with subtle grid lines.
3. **Rivers**: Thick polylines with a wider translucent glow behind them. River names rendered at midpoint.
4. **Settlements**: Sized by population with radial gradients. Selected/hovered settlements get a glow. Labels above, population count below.
5. **Ruins**: Abandoned settlements with small, dim dots (only if tellHeight > 0.3).
6. **Tooltips**: On hover, shows name, population, clans, facilities, tell height.

### DPR-Aware Rendering

The canvas is sized at `width × devicePixelRatio` for crisp rendering on Retina/HiDPI displays. The CSS size stays at the logical size, and `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` scales all drawing.

### Interactivity

- **Hover**: `mousemove` checks distance to each settlement. If within 5 map-miles, shows tooltip and sets cursor to pointer.
- **Click**: Navigates to settlement detail.
- **Touch**: `touchstart` handler for mobile.
- **Resize**: `window.resize` recalculates scale and redraws.

## Panels (`panels.ts`)

All panel rendering functions return HTML strings. They import simulation data types and formatting utilities.

### World Panel (`renderWorldPanel`)

- Stat grid: total population, settlements, clans, avg satisfaction.
- Settlements table: sorted by population. Clickable rows navigate to settlement.
- Top 8 clans table: sorted by population. Clickable rows navigate to clan.
- "Population History" button navigates to history view.

### Settlement Panel (`renderSettlementPanel`)

- Breadcrumb: World > Settlement Name.
- Stat grid: population, clans, tell height, avg mood.
- Terrain details: arable land, fertility, water access, permanence.
- Facilities: cards with icons, names, levels, condition bars.
- Clans table: sorted by population. Clickable rows.

### Clan Panel (`renderClanPanel`)

The most detailed panel:
- Breadcrumb: World > Settlement > Clan Name. Star button.
- Stat grid: population, workers, food stores, satisfaction.
- **Demographics**: Population pyramid showing male/female bars per age group.
- **Needs**: 8 colored bars (green → red based on satisfaction level).
- **Skills**: 9 bars showing skill levels (0-100).
- **Labor Allocation**: 8 bars showing percentage allocation.
- **Production**: Food produced, consumed, surplus/deficit, wealth, shelter.
- **Personality**: 6 slider tracks with markers showing position on bipolar scales (e.g., Cautious ↔ Bold).
- **Relationships**: Table of neighboring clans with affinity, trust, marriages, relative status.
- **Recent Events**: Last 5 events involving this clan.

### History Panel (`renderHistoryPanel`)

- Canvas chart: Population over time with filled area under the curve. Grid lines and axis labels.
- Timeline table: Last 20 snapshots showing population, settlements, clans, avg food satisfaction.

### Event Log (`renderEventLog`)

Rendered in the collapsible footer. Shows events from the most recent year with category icons and severity-based coloring:
- Minor: dim text
- Notable: normal text
- Major: accent (gold) text
- Critical: red bold text

Category icons: production 🌾, population 👥, social 🤝, disaster ⚡, discovery 💡, construction 🏗, migration 🚶.

## CSS (`styles.css`)

### Color Palette

Dark, earthy Mesopotamian theme:

| Variable | Color | Usage |
|---|---|---|
| `--color-bg` | `#12100d` | Page background |
| `--color-bg-panel` | `#1e1914` | Panel backgrounds |
| `--color-bg-card` | `#2a2218` | Cards, buttons |
| `--color-accent` | `#e6a954` | Gold accent (titles, highlights) |
| `--color-text` | `#d4c5a9` | Primary text |
| `--color-text-secondary` | `#9e8e70` | Labels, secondary info |
| `--color-excellent` | `#7ab856` | Need bar: 80-100 |
| `--color-good` | `#6b9e4f` | Need bar: 60-79 |
| `--color-adequate` | `#b8a63a` | Need bar: 40-59 |
| `--color-poor` | `#c47e3a` | Need bar: 20-39 |
| `--color-critical` | `#b85450` | Need bar: 0-19 |

### Typography

- **Cinzel**: Display font for titles, headers, stat labels. Serif with ancient feel.
- **Crimson Pro**: Body font for text, tables, descriptions. Readable serif.
- **System monospace**: Stats, numbers, code.

### Responsive Breakpoints

| Width | Changes |
|---|---|
| ≤ 768px | Stack map above panel (column layout). Hide header stats. 2-column stat grid. |
| ≤ 480px | Smaller fonts and buttons. Shorter map height. |
| `hover: none` | Larger touch targets for buttons and table rows. |
