/**
 * The merge board: a 4×4 grid, four directions, and the rule that decides everything.
 *
 * Pure and dependency-free with the random source injected, like the rest of `src/logic/`.
 * Every function returns a new grid; nothing here mutates its argument, which is what lets the
 * store keep an undo stack by simply holding previous values.
 *
 * The rule that matters, and the one almost every implementation gets wrong at least once:
 * **a tile may take part in at most one merge per move.** A row of four twos becomes two
 * fours, never a single eight. Sliding and merging in one pass without marking the tiles that
 * have already merged produces the eight, doubles the score, and quietly makes the game easier
 * than it should be.
 */

export const GRID = 4;
/** The tile that wins. Play continues afterwards — winning is not losing. */
export const WIN_TILE = 2048;
/** How often a spawn is a four rather than a two. The standard distribution. */
const FOUR_CHANCE = 0.1;

export type Grid = number[][];
export type Direction = "left" | "right" | "up" | "down";
type Rng = () => number;

export function emptyGrid(): Grid {
  return Array.from({ length: GRID }, () => new Array<number>(GRID).fill(0));
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  return a.every((row, r) => row.every((value, c) => value === b[r]?.[c]));
}

export interface LineResult {
  line: number[];
  /** Score from this line: the sum of the tiles created, as in the original game. */
  gained: number;
}

/**
 * Slides one line toward index 0 and merges it.
 *
 * Written as compress → merge → compress rather than as a single pass. The two-phase form is
 * what makes "each tile merges once" structural instead of a flag someone has to remember:
 * after a pair is merged the second tile is removed outright, so it cannot be looked at again.
 */
export function slideLine(input: readonly number[]): LineResult {
  const compact = input.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;

  for (let i = 0; i < compact.length; i += 1) {
    const value = compact[i]!;
    if (value === compact[i + 1]) {
      const merged = value * 2;
      out.push(merged);
      gained += merged;
      // Skip the partner. It is consumed, so the next iteration cannot merge it again.
      i += 1;
    } else {
      out.push(value);
    }
  }

  while (out.length < input.length) out.push(0);
  return { line: out, gained };
}

/** Rows as the mover sees them: every direction is `slideLine` over a different view. */
function linesFor(grid: Grid, direction: Direction): number[][] {
  switch (direction) {
    case "left":
      return grid.map((row) => [...row]);
    case "right":
      return grid.map((row) => [...row].reverse());
    case "up":
      return grid[0]!.map((_, c) => grid.map((row) => row[c]!));
    case "down":
      return grid[0]!.map((_, c) => grid.map((row) => row[c]!).reverse());
  }
}

function gridFrom(lines: number[][], direction: Direction): Grid {
  const out = emptyGrid();
  lines.forEach((line, i) => {
    line.forEach((value, j) => {
      switch (direction) {
        case "left":
          out[i]![j] = value;
          break;
        case "right":
          out[i]![GRID - 1 - j] = value;
          break;
        case "up":
          out[j]![i] = value;
          break;
        case "down":
          out[GRID - 1 - j]![i] = value;
          break;
      }
    });
  });
  return out;
}

export interface MoveResult {
  grid: Grid;
  gained: number;
  /**
   * Whether anything actually changed.
   *
   * The caller must not spawn a tile when this is false. Spawning after a no-op is how a board
   * fills up while the player is doing nothing, and it ends games that were never lost.
   */
  moved: boolean;
}

export function move(grid: Grid, direction: Direction): MoveResult {
  let gained = 0;
  const lines = linesFor(grid, direction).map((line) => {
    const result = slideLine(line);
    gained += result.gained;
    return result.line;
  });
  const next = gridFrom(lines, direction);
  return { grid: next, gained, moved: !gridsEqual(next, grid) };
}

/** Whether a direction would change anything, without committing to it. */
export function canMove(grid: Grid, direction: Direction): boolean {
  return move(grid, direction).moved;
}

/** Adds one tile to a random empty cell. Returns the grid unchanged when there is no room. */
export function spawn(grid: Grid, rng: Rng = Math.random): Grid {
  const empty: [number, number][] = [];
  grid.forEach((row, r) =>
    row.forEach((value, c) => value === 0 && empty.push([r, c])),
  );
  if (empty.length === 0) return grid;

  // Two draws, so the cell and the value are independent — a single draw reused for both makes
  // fours appear only in the last cells of the board.
  const cell =
    empty[Math.min(empty.length - 1, Math.floor(rng() * empty.length))]!;
  const value = rng() < 1 - FOUR_CHANCE ? 2 : 4;

  const next = grid.map((row) => [...row]);
  next[cell[0]]![cell[1]] = value;
  return next;
}

/** No empty cell and no equal neighbour in any direction. */
export function isGameOver(grid: Grid): boolean {
  if (grid.some((row) => row.includes(0))) return false;
  return (["left", "right", "up", "down"] as Direction[]).every(
    (d) => !canMove(grid, d),
  );
}

export function maxTile(grid: Grid): number {
  return Math.max(...grid.flat());
}

export function hasWon(grid: Grid): boolean {
  return maxTile(grid) >= WIN_TILE;
}

/** A fresh board: two tiles, as the original game starts. */
export function newGrid(rng: Rng = Math.random): Grid {
  return spawn(spawn(emptyGrid(), rng), rng);
}
