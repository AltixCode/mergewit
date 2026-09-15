/**
 * The board in play, the undo stack, the tile theme and the daily-challenge stats.
 *
 * Three of the paywall's four claims are enforced here — unlimited undo, every theme, and the
 * archive's stats — so each takes `isPremium` explicitly at the call site rather than reaching
 * into another store. A gate you can see is a gate you can test.
 *
 * All the rules are in `src/logic/`; this only sequences them and persists the result.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  GRID,
  type Direction,
  type Grid,
  emptyGrid,
  move,
  newGrid,
  spawn,
} from "@/logic/board";
import { TILE_THEMES } from "@/theme/tiles";

export const BOARD_CACHE_KEY = "mergewit.state.v1";

/** Steps back a free player gets. The purchase sells the rest. */
export const FREE_UNDO = 1;
/**
 * A hard ceiling on the stack even for a paying player.
 *
 * Unlimited undo means "as far back as you like", not "keep every board of a thousand-move
 * game in memory and write it all to disk on every swipe".
 */
const MAX_HISTORY = 100;

type Rng = () => number;

interface Snapshot {
  grid: Grid;
  score: number;
}

export interface DayStat {
  score: number;
  /** Largest tile reached that day. */
  best: number;
}

interface BoardState {
  grid: Grid;
  score: number;
  best: number;
  history: Snapshot[];
  stats: Record<string, DayStat>;
  theme: string;
  /** The archive day being played, or null for a free-play game. */
  dayKey: string | null;
  /**
   * Undos taken in this game.
   *
   * Counted rather than derived from the stack length: the stack shrinks as it is used, so
   * "how many are left" cannot be read from it. Reset by newGame and startDay, which is what
   * makes the free allowance one per game rather than one ever.
   */
  undosUsed: number;

  swipe: (direction: Direction, rng?: Rng) => "moved" | "blocked";
  undo: (isPremium: boolean) => "undone" | "limit-reached" | "nothing-to-undo";
  newGame: (rng?: Rng) => void;
  startDay: (key: string, grid: Grid) => void;
  setTheme: (name: string, isPremium: boolean) => void;
  recordSolve: (key: string, score: number, best: number) => void;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/** A stored grid is trusted only when it is exactly GRID×GRID of finite non-negative numbers. */
function validGrid(value: unknown): Grid | null {
  if (!Array.isArray(value) || value.length !== GRID) return null;
  const out: Grid = [];
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== GRID) return null;
    const cells: number[] = [];
    for (const cell of row) {
      if (typeof cell !== "number" || !Number.isFinite(cell) || cell < 0)
        return null;
      cells.push(cell);
    }
    out.push(cells);
  }
  return out;
}

function validStats(value: unknown): Record<string, DayStat> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, DayStat> = {};
  for (const [key, stat] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (!stat || typeof stat !== "object") continue;
    const { score, best } = stat as DayStat;
    if (typeof score !== "number" || typeof best !== "number") continue;
    out[key] = { score, best };
  }
  return out;
}

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

export const useBoardStore = create<BoardState>((set, get) => ({
  grid: emptyGrid(),
  score: 0,
  best: 0,
  history: [],
  stats: {},
  theme: "default",
  dayKey: null,
  undosUsed: 0,

  swipe(direction, rng = Math.random) {
    const { grid, score, history } = get();
    const result = move(grid, direction);
    // A move that changes nothing must not spawn, must not score, and must not push an undo
    // step — otherwise swiping into a wall slowly fills the board and ends a game nobody lost.
    if (!result.moved) return "blocked";

    const next = spawn(result.grid, rng);
    const nextScore = score + result.gained;
    set((s) => ({
      grid: next,
      score: nextScore,
      best: Math.max(s.best, nextScore),
      history: [...history, { grid, score }].slice(-MAX_HISTORY),
    }));
    void get().persist();
    return "moved";
  },

  undo(isPremium) {
    const { history } = get();
    // "Nothing to undo" and "you have run out of undos" are different answers, and the screen
    // does different things with them — only one of them offers the paywall.
    if (history.length === 0) return "nothing-to-undo";
    if (!isPremium && get().undosUsed >= FREE_UNDO) return "limit-reached";

    const previous = history[history.length - 1]!;
    set((s) => ({
      grid: previous.grid,
      score: previous.score,
      history: s.history.slice(0, -1),
      undosUsed: s.undosUsed + 1,
    }));
    void get().persist();
    return "undone";
  },

  newGame(rng = Math.random) {
    set({
      grid: newGrid(rng),
      score: 0,
      history: [],
      dayKey: null,
      undosUsed: 0,
    });
    void get().persist();
  },

  startDay(key, grid) {
    set({ grid, score: 0, history: [], dayKey: key, undosUsed: 0 });
    void get().persist();
  },

  setTheme(name, isPremium) {
    if (!(name in TILE_THEMES)) return;
    if (!isPremium && name !== "default") return;
    set({ theme: name });
    void get().persist();
  },

  recordSolve(key, score, best) {
    set((s) => {
      const existing = s.stats[key];
      // A replayed day keeps the better result rather than the most recent one.
      if (existing && existing.score >= score) return s;
      return { stats: { ...s.stats, [key]: { score, best } } };
    });
    void get().persist();
  },

  async persist() {
    const { grid, score, best, stats, theme, dayKey } = get();
    try {
      await AsyncStorage.setItem(
        BOARD_CACHE_KEY,
        JSON.stringify({ grid, score, best, stats, theme, dayKey }),
      );
    } catch {
      // Losing a board is survivable; failing to start is not.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(BOARD_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;
      const grid = validGrid(record.grid);
      set({
        // A grid that fails validation starts a fresh board rather than a half-restored one.
        grid: grid ?? newGrid(),
        score: grid ? num(record.score) : 0,
        best: num(record.best),
        stats: validStats(record.stats),
        theme:
          typeof record.theme === "string" && record.theme in TILE_THEMES
            ? record.theme
            : "default",
        dayKey: typeof record.dayKey === "string" ? record.dayKey : null,
        // The undo stack is deliberately not persisted: restoring it would let a player
        // relaunch the app to rewind a game they had already committed to.
        history: [],
        undosUsed: 0,
      });
    } catch {
      // Unreadable storage starts a new game rather than preventing launch.
    }
  },
}));
