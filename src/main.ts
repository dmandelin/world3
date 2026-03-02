import './styles.css';
import { createWorld } from './sim/init';
import { initializeRelationships } from './sim/init';
import { App } from './ui/app';

// ── Bootstrap ───────────────────────────────────────────────────────

function main() {
  const container = document.getElementById('app');
  if (!container) throw new Error('No #app container found');

  // Create the world
  const world = createWorld(6500);
  initializeRelationships(world);

  // Launch UI
  new App(world, container);

  console.log(
    `%cWorld III — Southern Mesopotamia%c\nStarting year: ${Math.abs(world.year)} BC\n` +
    `Settlements: ${Object.keys(world.settlements).length}\n` +
    `Clans: ${Object.keys(world.clans).length}`,
    'color: #e6a954; font-weight: bold; font-size: 14px;',
    'color: #9e8e70;'
  );
}

main();
