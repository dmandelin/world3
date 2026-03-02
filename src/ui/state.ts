// ── UI State Management ─────────────────────────────────────────────

export type ViewType = 'world' | 'settlement' | 'clan' | 'history';

export interface UIState {
  currentView: ViewType;
  selectedSettlementId: string | null;
  selectedClanId: string | null;
  hoveredSettlementId: string | null;
  showEventLog: boolean;
  mapZoom: number;
  mapOffsetX: number;
  mapOffsetY: number;
  isPaused: boolean;
  autoPlaySpeed: number; // 0 = paused, 1-5 = ticks per second
  recentEvents: string[];
}

const listeners: Set<() => void> = new Set();

let state: UIState = {
  currentView: 'world',
  selectedSettlementId: null,
  selectedClanId: null,
  hoveredSettlementId: null,
  showEventLog: true,
  mapZoom: 1,
  mapOffsetX: 0,
  mapOffsetY: 0,
  isPaused: true,
  autoPlaySpeed: 0,
  recentEvents: [],
};

export function getState(): UIState {
  return state;
}

export function setState(partial: Partial<UIState>): void {
  state = { ...state, ...partial };
  notifyListeners();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

// ── Navigation Helpers ──────────────────────────────────────────────

export function navigateToWorld(): void {
  setState({
    currentView: 'world',
    selectedSettlementId: null,
    selectedClanId: null,
  });
}

export function navigateToSettlement(id: string): void {
  setState({
    currentView: 'settlement',
    selectedSettlementId: id,
    selectedClanId: null,
  });
}

export function navigateToClan(clanId: string, settlementId: string): void {
  setState({
    currentView: 'clan',
    selectedSettlementId: settlementId,
    selectedClanId: clanId,
  });
}

export function navigateToHistory(): void {
  setState({
    currentView: 'history',
    selectedSettlementId: null,
    selectedClanId: null,
  });
}
