import { World, GameEvent } from '../sim/types';
import { formatYear } from '../sim/utils';
import { tick, tickMultiple } from '../sim/tick';
import { getClanPopulation } from '../sim/production';
import { MapRenderer } from './map-renderer';
import {
  getState, setState, subscribe,
  navigateToWorld, navigateToSettlement, navigateToClan, navigateToHistory,
} from './state';
import {
  renderWorldPanel, renderSettlementPanel, renderClanPanel,
  renderHistoryPanel, renderEventLog, drawHistoryChart,
} from './panels';

// ── Application Shell ───────────────────────────────────────────────

export class App {
  private world: World;
  private container: HTMLElement;
  private mapRenderer: MapRenderer | null = null;
  private autoPlayInterval: number | null = null;
  private lastTickEvents: GameEvent[] = [];

  constructor(world: World, container: HTMLElement) {
    this.world = world;
    this.container = container;

    this.buildLayout();
    subscribe(() => this.update());
    this.update();
  }

  private buildLayout(): void {
    this.container.innerHTML = `
      <div class="app-layout">
        <header class="app-header">
          <div class="header-left">
            <h1 class="app-title" data-action="world">World III</h1>
            <span class="header-year" id="header-year">${formatYear(this.world.year)}</span>
          </div>
          <div class="header-controls">
            <button class="btn btn-control" id="btn-step-1" title="Advance 1 year">▶ 1</button>
            <button class="btn btn-control" id="btn-step-10" title="Advance 10 years">▶▶ 10</button>
            <button class="btn btn-control" id="btn-step-50" title="Advance 50 years">▶▶▶ 50</button>
            <button class="btn btn-control" id="btn-auto" title="Auto-play">⏵ Auto</button>
          </div>
          <div class="header-right">
            <span class="header-stat" id="header-pop" title="Total Population">Pop: 0</span>
            <span class="header-stat" id="header-settlements" title="Settlement Count">Stl: 0</span>
            <span class="header-stat" id="header-clans" title="Clan Count">Cln: 0</span>
          </div>
        </header>

        <div class="app-body">
          <aside class="map-container" id="map-container"></aside>
          <main class="main-panel" id="main-panel"></main>
        </div>

        <footer class="event-log-bar" id="event-log-bar">
          <div class="event-log-header" id="event-log-toggle">
            <span>Events — ${formatYear(this.world.year)}</span>
            <span class="event-toggle-icon">▼</span>
          </div>
          <div class="event-log-content" id="event-log-content"></div>
        </footer>
      </div>
    `;

    // Setup map
    const mapContainer = document.getElementById('map-container')!;
    this.mapRenderer = new MapRenderer(mapContainer);

    // Setup controls
    this.setupControls();
    this.setupDelegatedEvents();
  }

  private setupControls(): void {
    document.getElementById('btn-step-1')!.addEventListener('click', () => this.step(1));
    document.getElementById('btn-step-10')!.addEventListener('click', () => this.step(10));
    document.getElementById('btn-step-50')!.addEventListener('click', () => this.step(50));
    document.getElementById('btn-auto')!.addEventListener('click', () => this.toggleAutoPlay());

    document.getElementById('event-log-toggle')!.addEventListener('click', () => {
      setState({ showEventLog: !getState().showEventLog });
    });

    document.querySelector('.app-title')!.addEventListener('click', () => navigateToWorld());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.step(1);
      } else if (e.key === 'ArrowRight') {
        this.step(1);
      } else if (e.key === 'Escape') {
        navigateToWorld();
      }
    });
  }

  private setupDelegatedEvents(): void {
    const mainPanel = document.getElementById('main-panel')!;

    mainPanel.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Row clicks
      const row = target.closest('.clickable-row') as HTMLElement;
      if (row) {
        const clanId = row.dataset.clanId;
        const settlementId = row.dataset.settlementId;
        if (clanId && settlementId) {
          navigateToClan(clanId, settlementId);
        } else if (settlementId) {
          navigateToSettlement(settlementId);
        }
        return;
      }

      // Breadcrumb links
      const breadcrumb = target.closest('.breadcrumb-link') as HTMLElement;
      if (breadcrumb) {
        const action = breadcrumb.dataset.action;
        if (action === 'world') navigateToWorld();
        else if (action === 'settlement') {
          const sid = breadcrumb.dataset.settlementId;
          if (sid) navigateToSettlement(sid);
        }
        return;
      }

      // Buttons
      const btn = target.closest('[data-action]') as HTMLElement;
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'history') navigateToHistory();
        else if (action === 'star') {
          const clanId = btn.dataset.clanId;
          if (clanId && this.world.clans[clanId]) {
            this.world.clans[clanId].starred = !this.world.clans[clanId].starred;
            this.update();
          }
        }
        return;
      }
    });
  }

  private step(count: number): void {
    if (count === 1) {
      this.lastTickEvents = tick(this.world);
    } else {
      this.lastTickEvents = tickMultiple(this.world, count);
    }
    this.update();
  }

  private toggleAutoPlay(): void {
    const btn = document.getElementById('btn-auto')!;
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
      btn.textContent = '⏵ Auto';
      btn.classList.remove('btn-active');
    } else {
      btn.textContent = '⏸ Stop';
      btn.classList.add('btn-active');
      this.autoPlayInterval = window.setInterval(() => {
        this.step(1);
      }, 400);
    }
  }

  // ── Update all UI ───────────────────────────────────────────────

  private update(): void {
    const state = getState();

    // Header
    document.getElementById('header-year')!.textContent = formatYear(this.world.year);

    const totalPop = Object.values(this.world.clans)
      .reduce((s, c) => s + getClanPopulation(c), 0);
    const activeSettlements = Object.values(this.world.settlements)
      .filter(s => s.clanIds.length > 0).length;

    document.getElementById('header-pop')!.textContent = `Pop: ${totalPop}`;
    document.getElementById('header-settlements')!.textContent = `Stl: ${activeSettlements}`;
    document.getElementById('header-clans')!.textContent = `Cln: ${Object.keys(this.world.clans).length}`;

    // Map
    this.mapRenderer?.render(this.world);

    // Main panel
    const mainPanel = document.getElementById('main-panel')!;
    switch (state.currentView) {
      case 'world':
        mainPanel.innerHTML = renderWorldPanel(this.world);
        break;
      case 'settlement':
        if (state.selectedSettlementId) {
          mainPanel.innerHTML = renderSettlementPanel(this.world, state.selectedSettlementId);
        }
        break;
      case 'clan':
        if (state.selectedClanId) {
          mainPanel.innerHTML = renderClanPanel(this.world, state.selectedClanId);
        }
        break;
      case 'history':
        mainPanel.innerHTML = renderHistoryPanel(this.world);
        // Draw chart after DOM is updated
        requestAnimationFrame(() => drawHistoryChart(this.world));
        break;
    }

    // Event log
    const eventLogContent = document.getElementById('event-log-content')!;
    const eventLogBar = document.getElementById('event-log-bar')!;

    if (state.showEventLog) {
      eventLogBar.classList.add('expanded');
      eventLogContent.innerHTML = renderEventLog(this.world.events, this.world.year);
    } else {
      eventLogBar.classList.remove('expanded');
    }

    // Update event log header
    const eventHeader = document.getElementById('event-log-toggle')!;
    const yearEvents = this.world.events.filter(e => e.year === this.world.year - 1);
    eventHeader.querySelector('span')!.textContent = `Events — ${formatYear(this.world.year - 1)} (${yearEvents.length})`;
  }
}
