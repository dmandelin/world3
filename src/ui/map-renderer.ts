import { World, Settlement } from '../sim/types';
import { TERRAIN_COLORS, MAP_TILES_WIDE, MAP_TILES_HIGH, TILE_SIZE_MILES } from '../sim/map-data';
import { getClanPopulation } from '../sim/production';
import { getState, navigateToSettlement } from './state';

// ── Map Renderer ────────────────────────────────────────────────────

export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: World | null = null;
  private width = 0;
  private height = 0;
  private hoveredSettlement: string | null = null;
  private pixelsPerMile = 1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);

    this.setupEvents();
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calculate scale to fit map
    const mapWidth = MAP_TILES_WIDE * TILE_SIZE_MILES;
    const mapHeight = MAP_TILES_HIGH * TILE_SIZE_MILES;
    this.pixelsPerMile = Math.min(
      this.width / mapWidth,
      this.height / mapHeight,
    ) * 0.92;

    if (this.world) this.render(this.world);
  }

  private setupEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredSettlement = null;
      if (this.world) this.render(this.world);
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.handleClick(x, y);
    }, { passive: true });
  }

  private toMapCoords(screenX: number, screenY: number): { mx: number; my: number } {
    const offsetX = (this.width - MAP_TILES_WIDE * TILE_SIZE_MILES * this.pixelsPerMile) / 2;
    const offsetY = (this.height - MAP_TILES_HIGH * TILE_SIZE_MILES * this.pixelsPerMile) / 2;
    return {
      mx: (screenX - offsetX) / this.pixelsPerMile,
      my: (this.height - screenY - offsetY) / this.pixelsPerMile,
    };
  }

  private toScreenCoords(mx: number, my: number): { sx: number; sy: number } {
    const offsetX = (this.width - MAP_TILES_WIDE * TILE_SIZE_MILES * this.pixelsPerMile) / 2;
    const offsetY = (this.height - MAP_TILES_HIGH * TILE_SIZE_MILES * this.pixelsPerMile) / 2;
    return {
      sx: mx * this.pixelsPerMile + offsetX,
      sy: this.height - my * this.pixelsPerMile - offsetY,
    };
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.world) return;
    const rect = this.canvas.getBoundingClientRect();
    const { mx, my } = this.toMapCoords(e.clientX - rect.left, e.clientY - rect.top);

    // Check if hovering over a settlement
    let found: string | null = null;
    for (const settlement of Object.values(this.world.settlements)) {
      const dist = Math.sqrt((settlement.x - mx) ** 2 + (settlement.y - my) ** 2);
      if (dist < 5) {
        found = settlement.id;
        break;
      }
    }

    if (found !== this.hoveredSettlement) {
      this.hoveredSettlement = found;
      this.canvas.style.cursor = found ? 'pointer' : 'default';
      this.render(this.world);
    }
  }

  private onClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.handleClick(e.clientX - rect.left, e.clientY - rect.top);
  }

  private handleClick(screenX: number, screenY: number): void {
    if (!this.world) return;
    const { mx, my } = this.toMapCoords(screenX, screenY);

    for (const settlement of Object.values(this.world.settlements)) {
      const dist = Math.sqrt((settlement.x - mx) ** 2 + (settlement.y - my) ** 2);
      if (dist < 5) {
        navigateToSettlement(settlement.id);
        return;
      }
    }
  }

  // ── Rendering ───────────────────────────────────────────────────

  render(world: World): void {
    this.world = world;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1a1814';
    ctx.fillRect(0, 0, w, h);

    // Draw terrain tiles
    this.drawTerrain(ctx, world);

    // Draw rivers
    this.drawRivers(ctx, world);

    // Draw settlements
    this.drawSettlements(ctx, world);

    // Draw tooltip for hovered settlement
    if (this.hoveredSettlement) {
      this.drawTooltip(ctx, world, this.hoveredSettlement);
    }
  }

  private drawTerrain(ctx: CanvasRenderingContext2D, world: World): void {
    for (let ty = 0; ty < world.tilesHigh; ty++) {
      for (let tx = 0; tx < world.tilesWide; tx++) {
        const tile = world.tiles[ty][tx];
        const { sx: x1, sy: y1 } = this.toScreenCoords(tx * TILE_SIZE_MILES, (ty + 1) * TILE_SIZE_MILES);
        const { sx: x2, sy: y2 } = this.toScreenCoords((tx + 1) * TILE_SIZE_MILES, ty * TILE_SIZE_MILES);

        ctx.fillStyle = TERRAIN_COLORS[tile.terrain];
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
  }

  private drawRivers(ctx: CanvasRenderingContext2D, world: World): void {
    for (const river of world.rivers) {
      ctx.beginPath();
      ctx.strokeStyle = '#3a6e8f';
      ctx.lineWidth = Math.max(2, river.width * this.pixelsPerMile * 3);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < river.points.length; i++) {
        const { sx, sy } = this.toScreenCoords(river.points[i].x, river.points[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // River highlight
      ctx.strokeStyle = 'rgba(74, 140, 180, 0.3)';
      ctx.lineWidth = Math.max(4, river.width * this.pixelsPerMile * 6);
      ctx.beginPath();
      for (let i = 0; i < river.points.length; i++) {
        const { sx, sy } = this.toScreenCoords(river.points[i].x, river.points[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // River name
      if (river.points.length > 2) {
        const mid = river.points[Math.floor(river.points.length / 2)];
        const { sx, sy } = this.toScreenCoords(mid.x + 3, mid.y);
        ctx.save();
        ctx.font = `italic ${Math.max(9, this.pixelsPerMile * 4)}px "Crimson Pro", serif`;
        ctx.fillStyle = 'rgba(100, 170, 210, 0.7)';
        ctx.fillText(river.name, sx, sy);
        ctx.restore();
      }
    }
  }

  private drawSettlements(ctx: CanvasRenderingContext2D, world: World): void {
    const state = getState();

    for (const settlement of Object.values(world.settlements)) {
      const pop = settlement.clanIds
        .map(id => world.clans[id])
        .filter(Boolean)
        .reduce((s, c) => s + getClanPopulation(c), 0);

      if (pop === 0) {
        // Draw as ruin
        this.drawRuin(ctx, settlement);
        continue;
      }

      const { sx, sy } = this.toScreenCoords(settlement.x, settlement.y);

      // Size based on population
      const radius = Math.max(3, Math.sqrt(pop) * 0.7 + settlement.tellHeight * 0.3);

      const isSelected = state.selectedSettlementId === settlement.id;
      const isHovered = this.hoveredSettlement === settlement.id;

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(sx, sy, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? 'rgba(230, 169, 84, 0.3)'
          : 'rgba(230, 169, 84, 0.15)';
        ctx.fill();
      }

      // Tell mound (brown base)
      ctx.beginPath();
      ctx.arc(sx, sy, radius + 1, 0, Math.PI * 2);
      ctx.fillStyle = '#7a6548';
      ctx.fill();

      // Settlement dot
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, radius);
      gradient.addColorStop(0, '#e6a954');
      gradient.addColorStop(1, '#c4813a');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? '#fff' : '#2a2218';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Label
      const fontSize = Math.max(9, this.pixelsPerMile * 3.5);
      ctx.font = `600 ${fontSize}px "Cinzel", serif`;
      ctx.textAlign = 'center';

      // Text shadow
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(settlement.name, sx + 1, sy - radius - 4);

      ctx.fillStyle = isSelected ? '#e6a954' : '#d4c5a9';
      ctx.fillText(settlement.name, sx, sy - radius - 5);

      // Population count
      ctx.font = `${Math.max(8, fontSize - 2)}px "Crimson Pro", sans-serif`;
      ctx.fillStyle = '#9e8e70';
      ctx.fillText(`${pop}`, sx, sy + radius + fontSize + 2);
    }
  }

  private drawRuin(ctx: CanvasRenderingContext2D, settlement: Settlement): void {
    if (settlement.tellHeight < 0.3) return;
    const { sx, sy } = this.toScreenCoords(settlement.x, settlement.y);
    const radius = 2 + settlement.tellHeight * 0.2;

    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120, 100, 70, 0.4)';
    ctx.fill();

    ctx.font = `italic 8px "Crimson Pro", serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(150, 130, 100, 0.5)';
    ctx.fillText(settlement.name, sx, sy - radius - 3);
  }

  private drawTooltip(ctx: CanvasRenderingContext2D, world: World, settlementId: string): void {
    const settlement = world.settlements[settlementId];
    if (!settlement) return;

    const pop = settlement.clanIds
      .map(id => world.clans[id])
      .filter(Boolean)
      .reduce((s, c) => s + getClanPopulation(c), 0);

    const { sx, sy } = this.toScreenCoords(settlement.x, settlement.y);

    const lines = [
      settlement.name,
      `Population: ${pop}`,
      `Clans: ${settlement.clanIds.length}`,
      `Facilities: ${settlement.facilities.length}`,
      `Tell Height: ${settlement.tellHeight.toFixed(1)}m`,
    ];

    const padding = 8;
    const lineHeight = 16;
    ctx.font = '12px "Crimson Pro", sans-serif';

    const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxWidth + padding * 2;
    const boxH = lines.length * lineHeight + padding * 2;

    let tx = sx + 15;
    let ty = sy - boxH / 2;
    if (tx + boxW > this.width) tx = sx - boxW - 15;
    if (ty < 0) ty = 5;
    if (ty + boxH > this.height) ty = this.height - boxH - 5;

    // Background
    ctx.fillStyle = 'rgba(30, 25, 18, 0.92)';
    ctx.strokeStyle = '#5a4a32';
    ctx.lineWidth = 1;
    roundRect(ctx, tx, ty, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 0 ? '#e6a954' : '#d4c5a9';
      ctx.font = i === 0 ? 'bold 12px "Cinzel", serif' : '12px "Crimson Pro", sans-serif';
      ctx.fillText(lines[i], tx + padding, ty + padding + (i + 1) * lineHeight - 3);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
