import { World, Settlement, Clan, SKILL_NAMES, NEED_NAMES, LABOR_CATEGORIES, FACILITY_INFO, NeedName, SkillName, GameEvent } from '../sim/types';
import { getClanPopulation, getWorkerCount } from '../sim/production';
import { getOverallSatisfaction } from '../sim/needs';
import { formatYear, formatNeed, needColor, formatPercent } from '../sim/utils';
import { getState, navigateToSettlement, navigateToClan, navigateToWorld, navigateToHistory } from './state';

// ── Helper: Need bar ────────────────────────────────────────────────

function needBar(name: string, value: number): string {
  const color = value >= 80 ? 'var(--color-excellent)' : value >= 60 ? 'var(--color-good)' : value >= 40 ? 'var(--color-adequate)' : value >= 20 ? 'var(--color-poor)' : 'var(--color-critical)';
  return `
    <div class="need-row">
      <span class="need-label">${name}</span>
      <div class="need-bar-track">
        <div class="need-bar-fill" style="width:${value}%;background:${color}"></div>
      </div>
      <span class="need-value" style="color:${color}">${Math.round(value)}</span>
    </div>`;
}

function skillBar(name: string, value: number): string {
  return `
    <div class="need-row">
      <span class="need-label">${name}</span>
      <div class="need-bar-track">
        <div class="need-bar-fill" style="width:${value}%;background:var(--color-accent)"></div>
      </div>
      <span class="need-value">${value.toFixed(1)}</span>
    </div>`;
}

function laborBar(name: string, value: number): string {
  const pct = value * 100;
  return `
    <div class="need-row">
      <span class="need-label">${name}</span>
      <div class="need-bar-track">
        <div class="need-bar-fill" style="width:${pct}%;background:var(--color-text-secondary)"></div>
      </div>
      <span class="need-value">${pct.toFixed(0)}%</span>
    </div>`;
}

// ── World Panel ─────────────────────────────────────────────────────

export function renderWorldPanel(world: World): string {
  const clans = Object.values(world.clans);
  const settlements = Object.values(world.settlements).filter(s => s.clanIds.length > 0);
  const totalPop = clans.reduce((s, c) => s + getClanPopulation(c), 0);
  const avgSatisfaction = clans.length > 0
    ? clans.reduce((s, c) => s + getOverallSatisfaction(c.needs), 0) / clans.length
    : 0;

  // Sort settlements by population
  const sortedSettlements = settlements
    .map(s => ({
      ...s,
      population: s.clanIds.map(id => world.clans[id]).filter(Boolean)
        .reduce((sum, c) => sum + getClanPopulation(c), 0),
    }))
    .sort((a, b) => b.population - a.population);

  // Top clans by population
  const topClans = [...clans]
    .sort((a, b) => getClanPopulation(b) - getClanPopulation(a))
    .slice(0, 8);

  return `
    <div class="panel-content">
      <h2 class="panel-title">World Overview</h2>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${totalPop}</div>
          <div class="stat-label">Total Population</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${settlements.length}</div>
          <div class="stat-label">Settlements</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${clans.length}</div>
          <div class="stat-label">Clans</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round(avgSatisfaction)}</div>
          <div class="stat-label">Avg Satisfaction</div>
        </div>
      </div>

      <h3 class="section-title">Settlements</h3>
      <table class="data-table">
        <thead>
          <tr><th>Name</th><th>Pop</th><th>Clans</th><th>Facilities</th><th>Tell</th></tr>
        </thead>
        <tbody>
          ${sortedSettlements.map(s => `
            <tr class="clickable-row" data-settlement-id="${s.id}">
              <td class="text-accent">${s.name}</td>
              <td>${s.population}</td>
              <td>${s.clanIds.length}</td>
              <td>${s.facilities.length}</td>
              <td>${s.tellHeight.toFixed(1)}m</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3 class="section-title">Top Clans</h3>
      <table class="data-table">
        <thead>
          <tr><th>Name</th><th>Pop</th><th>Settlement</th><th>Food</th><th>Mood</th></tr>
        </thead>
        <tbody>
          ${topClans.map(c => {
            const settlement = world.settlements[c.settlementId];
            const mood = getOverallSatisfaction(c.needs);
            return `
              <tr class="clickable-row" data-clan-id="${c.id}" data-settlement-id="${c.settlementId}">
                <td class="text-accent">${c.starred ? '★ ' : ''}${c.name}</td>
                <td>${getClanPopulation(c)}</td>
                <td>${settlement?.name || '—'}</td>
                <td>${Math.round(c.needs.food)}</td>
                <td style="color:${needColor(mood)}">${formatNeed(mood)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="panel-actions">
        <button class="btn btn-secondary" data-action="history">Population History</button>
      </div>
    </div>
  `;
}

// ── Settlement Panel ────────────────────────────────────────────────

export function renderSettlementPanel(world: World, settlementId: string): string {
  const settlement = world.settlements[settlementId];
  if (!settlement) return '<div class="panel-content"><p>Settlement not found.</p></div>';

  const clans = settlement.clanIds.map(id => world.clans[id]).filter(Boolean);
  const totalPop = clans.reduce((s, c) => s + getClanPopulation(c), 0);
  const tile = world.tiles[settlement.tileY]?.[settlement.tileX];

  const avgSatisfaction = clans.length > 0
    ? clans.reduce((s, c) => s + getOverallSatisfaction(c.needs), 0) / clans.length
    : 0;

  // Terrain description
  const terrainNames: Record<string, string> = {
    marsh: 'Marshland', riverPlain: 'River Plain', alluvialPlain: 'Alluvial Plain',
    drySteppe: 'Dry Steppe', desert: 'Desert', water: 'Open Water', irrigatedLand: 'Irrigated Land',
  };

  return `
    <div class="panel-content">
      <div class="breadcrumb">
        <span class="breadcrumb-link" data-action="world">World</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">${settlement.name}</span>
      </div>

      <h2 class="panel-title">${settlement.name}</h2>
      <p class="panel-subtitle">Founded ${formatYear(settlement.founded)} · ${terrainNames[tile?.terrain || ''] || 'Unknown'}</p>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${totalPop}</div>
          <div class="stat-label">Population</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${clans.length}</div>
          <div class="stat-label">Clans</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${settlement.tellHeight.toFixed(1)}m</div>
          <div class="stat-label">Tell Height</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round(avgSatisfaction)}</div>
          <div class="stat-label">Avg Mood</div>
        </div>
      </div>

      ${tile ? `
        <h3 class="section-title">Terrain</h3>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Arable Land</span><span class="detail-value">${(tile.arableLand * 100).toFixed(0)}%</span></div>
          <div class="detail-item"><span class="detail-label">Fertility</span><span class="detail-value">${(tile.fertility * 100).toFixed(0)}%</span></div>
          <div class="detail-item"><span class="detail-label">Water Access</span><span class="detail-value">${(tile.waterAccess * 100).toFixed(0)}%</span></div>
          <div class="detail-item"><span class="detail-label">Permanence</span><span class="detail-value">${settlement.permanence.toFixed(0)}%</span></div>
        </div>
      ` : ''}

      ${settlement.facilities.length > 0 ? `
        <h3 class="section-title">Facilities</h3>
        <div class="facility-list">
          ${settlement.facilities.map(f => {
            const info = FACILITY_INFO[f.type];
            return `
              <div class="facility-card" title="${info.description}">
                <span class="facility-icon">${info.icon}</span>
                <div class="facility-info">
                  <span class="facility-name">${info.name} ${f.level > 1 ? `Lv.${f.level}` : ''}</span>
                  <div class="need-bar-track" style="height:4px;margin-top:2px">
                    <div class="need-bar-fill" style="width:${f.condition}%;background:${f.condition > 50 ? 'var(--color-good)' : 'var(--color-poor)'}"></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<h3 class="section-title">No Facilities Yet</h3>'}

      <h3 class="section-title">Clans</h3>
      <table class="data-table">
        <thead>
          <tr><th>Name</th><th>Pop</th><th>Food</th><th>Stores</th><th>Mood</th></tr>
        </thead>
        <tbody>
          ${clans.sort((a, b) => getClanPopulation(b) - getClanPopulation(a)).map(c => {
            const mood = getOverallSatisfaction(c.needs);
            return `
              <tr class="clickable-row" data-clan-id="${c.id}" data-settlement-id="${settlementId}">
                <td class="text-accent">${c.starred ? '★ ' : ''}${c.name}</td>
                <td>${getClanPopulation(c)}</td>
                <td style="color:${needColor(c.needs.food)}">${Math.round(c.needs.food)}</td>
                <td>${c.foodStores.toFixed(0)}</td>
                <td style="color:${needColor(mood)}">${formatNeed(mood)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Clan Panel ──────────────────────────────────────────────────────

export function renderClanPanel(world: World, clanId: string): string {
  const clan = world.clans[clanId];
  if (!clan) return '<div class="panel-content"><p>Clan not found.</p></div>';

  const settlement = world.settlements[clan.settlementId];
  const pop = getClanPopulation(clan);
  const workers = getWorkerCount(clan);
  const satisfaction = getOverallSatisfaction(clan.needs);

  // Population breakdown
  const males = clan.population.filter(g => g.gender === 'male').reduce((s, g) => s + g.count, 0);
  const females = pop - males;
  const children = clan.population.filter(g => g.age === 'children').reduce((s, g) => s + g.count, 0);
  const youth = clan.population.filter(g => g.age === 'youth').reduce((s, g) => s + g.count, 0);
  const adults = clan.population.filter(g => g.age === 'adults').reduce((s, g) => s + g.count, 0);
  const elders = clan.population.filter(g => g.age === 'elders').reduce((s, g) => s + g.count, 0);

  // Relationships in settlement
  const otherClans = settlement
    ? settlement.clanIds.filter(id => id !== clanId).map(id => world.clans[id]).filter(Boolean)
    : [];

  return `
    <div class="panel-content">
      <div class="breadcrumb">
        <span class="breadcrumb-link" data-action="world">World</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-link" data-action="settlement" data-settlement-id="${clan.settlementId}">${settlement?.name || '—'}</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">${clan.name}</span>
      </div>

      <div class="clan-header">
        <h2 class="panel-title">${clan.name}</h2>
        <button class="btn btn-small ${clan.starred ? 'btn-accent' : ''}" data-action="star" data-clan-id="${clanId}">
          ${clan.starred ? '★ Starred' : '☆ Star'}
        </button>
      </div>
      <p class="panel-subtitle">Founded ${formatYear(clan.founded)}</p>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${pop}</div>
          <div class="stat-label">Population</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${workers.toFixed(0)}</div>
          <div class="stat-label">Workers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${clan.foodStores.toFixed(0)}</div>
          <div class="stat-label">Food Stores</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:${needColor(satisfaction)}">${Math.round(satisfaction)}</div>
          <div class="stat-label">Satisfaction</div>
        </div>
      </div>

      <h3 class="section-title">Demographics</h3>
      <div class="population-pyramid">
        <div class="pop-row">
          <span class="pop-label">Children</span>
          <div class="pop-bar-container">
            <div class="pop-bar pop-bar-male" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'male' && g.age === 'children')?.count || 0) / pop * 200 : 0}%"></div>
            <div class="pop-bar pop-bar-female" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'female' && g.age === 'children')?.count || 0) / pop * 200 : 0}%"></div>
          </div>
          <span class="pop-count">${children}</span>
        </div>
        <div class="pop-row">
          <span class="pop-label">Youth</span>
          <div class="pop-bar-container">
            <div class="pop-bar pop-bar-male" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'male' && g.age === 'youth')?.count || 0) / pop * 200 : 0}%"></div>
            <div class="pop-bar pop-bar-female" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'female' && g.age === 'youth')?.count || 0) / pop * 200 : 0}%"></div>
          </div>
          <span class="pop-count">${youth}</span>
        </div>
        <div class="pop-row">
          <span class="pop-label">Adults</span>
          <div class="pop-bar-container">
            <div class="pop-bar pop-bar-male" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'male' && g.age === 'adults')?.count || 0) / pop * 200 : 0}%"></div>
            <div class="pop-bar pop-bar-female" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'female' && g.age === 'adults')?.count || 0) / pop * 200 : 0}%"></div>
          </div>
          <span class="pop-count">${adults}</span>
        </div>
        <div class="pop-row">
          <span class="pop-label">Elders</span>
          <div class="pop-bar-container">
            <div class="pop-bar pop-bar-male" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'male' && g.age === 'elders')?.count || 0) / pop * 200 : 0}%"></div>
            <div class="pop-bar pop-bar-female" style="width:${pop > 0 ? (clan.population.find(g => g.gender === 'female' && g.age === 'elders')?.count || 0) / pop * 200 : 0}%"></div>
          </div>
          <span class="pop-count">${elders}</span>
        </div>
        <div class="pop-legend"><span class="pop-bar-male-swatch"></span> Male (${males}) <span class="pop-bar-female-swatch"></span> Female (${females})</div>
      </div>

      <h3 class="section-title">Needs</h3>
      <div class="needs-container">
        ${needBar('Food', clan.needs.food)}
        ${needBar('Food Security', clan.needs.foodSecurity)}
        ${needBar('Shelter', clan.needs.shelter)}
        ${needBar('Community', clan.needs.community)}
        ${needBar('Prestige', clan.needs.prestige)}
        ${needBar('Spiritual', clan.needs.spiritual)}
        ${needBar('Luxury', clan.needs.luxury)}
        ${needBar('Safety', clan.needs.safety)}
      </div>

      <h3 class="section-title">Skills</h3>
      <div class="needs-container">
        ${SKILL_NAMES.map(sk => skillBar(sk.charAt(0).toUpperCase() + sk.slice(1), clan.skills[sk])).join('')}
      </div>

      <h3 class="section-title">Labor Allocation</h3>
      <div class="needs-container">
        ${LABOR_CATEGORIES.map(lc => laborBar(lc.charAt(0).toUpperCase() + lc.slice(1), clan.laborAllocation[lc])).join('')}
      </div>

      <h3 class="section-title">Production</h3>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Last Food Produced</span><span class="detail-value">${clan.lastFoodProduction.toFixed(0)}</span></div>
        <div class="detail-item"><span class="detail-label">Last Food Consumed</span><span class="detail-value">${clan.lastFoodConsumption.toFixed(0)}</span></div>
        <div class="detail-item"><span class="detail-label">Surplus/Deficit</span><span class="detail-value" style="color:${clan.lastFoodProduction >= clan.lastFoodConsumption ? 'var(--color-good)' : 'var(--color-critical)'}">${(clan.lastFoodProduction - clan.lastFoodConsumption).toFixed(0)}</span></div>
        <div class="detail-item"><span class="detail-label">Wealth Goods</span><span class="detail-value">${clan.wealthGoods.toFixed(1)}</span></div>
        <div class="detail-item"><span class="detail-label">Shelter Quality</span><span class="detail-value">${clan.shelterQuality.toFixed(0)}%</span></div>
      </div>

      <h3 class="section-title">Personality</h3>
      <div class="personality-grid">
        ${Object.entries(clan.personality).map(([key, val]) => {
          const pctPos = ((val as number) + 1) / 2 * 100;
          const labels: Record<string, [string, string]> = {
            boldness: ['Cautious', 'Bold'],
            sociability: ['Solitary', 'Gregarious'],
            tradition: ['Innovative', 'Traditional'],
            ambition: ['Content', 'Ambitious'],
            spirituality: ['Pragmatic', 'Spiritual'],
            generosity: ['Selfish', 'Generous'],
          };
          const [lo, hi] = labels[key] || ['Low', 'High'];
          return `
            <div class="personality-item">
              <div class="personality-labels"><span>${lo}</span><span>${hi}</span></div>
              <div class="personality-track">
                <div class="personality-marker" style="left:${pctPos}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${otherClans.length > 0 ? `
        <h3 class="section-title">Relationships</h3>
        <table class="data-table">
          <thead>
            <tr><th>Clan</th><th>Affinity</th><th>Trust</th><th>Marriages</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${otherClans.map(other => {
              const rel = clan.relationships[other.id];
              if (!rel) return '';
              const affinityColor = rel.affinity > 20 ? 'var(--color-good)' : rel.affinity < -20 ? 'var(--color-critical)' : 'var(--color-text)';
              return `
                <tr class="clickable-row" data-clan-id="${other.id}" data-settlement-id="${other.settlementId}">
                  <td class="text-accent">${other.name}</td>
                  <td style="color:${affinityColor}">${rel.affinity.toFixed(0)}</td>
                  <td>${rel.trust.toFixed(0)}</td>
                  <td>${rel.marriageLinks}</td>
                  <td>${rel.statusDiff > 10 ? '↑' : rel.statusDiff < -10 ? '↓' : '='}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      ${clan.recentEvents.length > 0 ? `
        <h3 class="section-title">Recent Events</h3>
        <ul class="event-list-small">
          ${clan.recentEvents.map(e => `<li>${e}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
}

// ── History Panel ───────────────────────────────────────────────────

export function renderHistoryPanel(world: World): string {
  const history = world.history;
  if (history.length === 0) {
    return `<div class="panel-content"><h2 class="panel-title">History</h2><p>No history recorded yet. Advance the simulation first.</p></div>`;
  }

  // Draw a simple ASCII-style chart of population over time
  const maxPop = Math.max(...history.map(h => h.totalPopulation), 1);
  const chartWidth = 60;
  const recent = history.slice(-50);

  const chart = recent.map(h => {
    const barLen = Math.round((h.totalPopulation / maxPop) * chartWidth);
    const bar = '█'.repeat(barLen);
    return `${formatYear(h.year).padStart(10)} │${bar} ${h.totalPopulation}`;
  }).join('\n');

  return `
    <div class="panel-content">
      <div class="breadcrumb">
        <span class="breadcrumb-link" data-action="world">World</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">History</span>
      </div>

      <h2 class="panel-title">Population History</h2>

      <div class="history-chart">
        <canvas id="history-canvas" width="600" height="250"></canvas>
      </div>

      <h3 class="section-title">Settlement Timeline</h3>
      <table class="data-table">
        <thead>
          <tr><th>Year</th><th>Population</th><th>Settlements</th><th>Clans</th><th>Avg Food</th></tr>
        </thead>
        <tbody>
          ${history.slice(-20).reverse().map(h => `
            <tr>
              <td>${formatYear(h.year)}</td>
              <td>${h.totalPopulation}</td>
              <td>${h.settlementCount}</td>
              <td>${h.clanCount}</td>
              <td style="color:${needColor(h.avgFoodSatisfaction)}">${Math.round(h.avgFoodSatisfaction)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Event Log ───────────────────────────────────────────────────────

export function renderEventLog(events: GameEvent[], year: number): string {
  const yearEvents = events.filter(e => e.year === year - 1);
  if (yearEvents.length === 0) {
    return '<div class="event-log-empty">No events this year.</div>';
  }

  return yearEvents.map(e => {
    const severityClass = `event-${e.severity}`;
    const categoryIcon: Record<string, string> = {
      production: '🌾',
      population: '👥',
      social: '🤝',
      disaster: '⚡',
      discovery: '💡',
      construction: '🏗',
      migration: '🚶',
    };
    return `
      <div class="event-item ${severityClass}">
        <span class="event-icon">${categoryIcon[e.category] || '•'}</span>
        <span class="event-text">${e.description}</span>
      </div>
    `;
  }).join('');
}

// ── Draw History Chart ──────────────────────────────────────────────

export function drawHistoryChart(world: World): void {
  const canvas = document.getElementById('history-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement!.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 250 * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = '250px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = 250;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const history = world.history;
  if (history.length < 2) return;

  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const maxPop = Math.max(...history.map(h => h.totalPopulation), 1);
  const minYear = history[0].year;
  const maxYear = history[history.length - 1].year;
  const yearRange = maxYear - minYear || 1;

  // Background
  ctx.fillStyle = '#1e1914';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(100, 85, 60, 0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + plotH * (1 - i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = '#9e8e70';
    ctx.font = '10px "Crimson Pro", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxPop * i / 4).toString(), padding.left - 5, y + 3);
  }

  // Population line
  ctx.beginPath();
  ctx.strokeStyle = '#e6a954';
  ctx.lineWidth = 2;
  for (let i = 0; i < history.length; i++) {
    const x = padding.left + (history[i].year - minYear) / yearRange * plotW;
    const y = padding.top + plotH * (1 - history[i].totalPopulation / maxPop);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill under curve
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.lineTo(padding.left, padding.top + plotH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(230, 169, 84, 0.1)';
  ctx.fill();

  // Year labels
  ctx.fillStyle = '#9e8e70';
  ctx.font = '10px "Crimson Pro", sans-serif';
  ctx.textAlign = 'center';
  const yearStep = Math.max(1, Math.ceil(yearRange / 6));
  for (let yr = minYear; yr <= maxYear; yr += yearStep) {
    const x = padding.left + (yr - minYear) / yearRange * plotW;
    ctx.fillText(formatYear(yr), x, h - 5);
  }

  // Title
  ctx.fillStyle = '#d4c5a9';
  ctx.font = '12px "Cinzel", serif';
  ctx.textAlign = 'left';
  ctx.fillText('Total Population', padding.left, 14);
}
