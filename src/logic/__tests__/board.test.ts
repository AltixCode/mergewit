import {
  GRID,
  type Direction,
  type Grid,
  canMove,
  emptyGrid,
  gridsEqual,
  hasWon,
  isGameOver,
  maxTile,
  move,
  slideLine,
  spawn,
} from "../board";

/** Builds a grid from rows, padding to GRID×GRID so a test can write only what it cares about. */
const g = (rows: number[][]): Grid =>
  Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) => rows[r]?.[c] ?? 0),
  );

describe("slideLine — one row, the whole merge rule", () => {
  it("slides tiles to the front", () => {
    expect(slideLine([0, 2, 0, 4]).line).toEqual([2, 4, 0, 0]);
  });

  it("merges an equal pair", () => {
    expect(slideLine([2, 2, 0, 0]).line).toEqual([4, 0, 0, 0]);
  });

  it("merges each tile at most once: [2,2,2,2] is [4,4] and never [8]", () => {
    // The classic 2048 bug. Merging left to right without marking consumed tiles turns four
    // twos into a single eight, which doubles the score and changes the whole game.
    const result = slideLine([2, 2, 2, 2]);
    expect(result.line).toEqual([4, 4, 0, 0]);
    expect(result.gained).toBe(8);
  });

  it("merges the leading pair first: [2,2,4] is [4,4]", () => {
    expect(slideLine([2, 2, 4, 0]).line).toEqual([4, 4, 0, 0]);
  });

  it("does not merge across a different tile: [4,2,2] is [4,4]", () => {
    expect(slideLine([4, 2, 2, 0]).line).toEqual([4, 4, 0, 0]);
  });

  it("does not merge unequal neighbours", () => {
    expect(slideLine([2, 4, 8, 16]).line).toEqual([2, 4, 8, 16]);
  });

  it("closes gaps before merging: [2,0,0,2] is [4]", () => {
    expect(slideLine([2, 0, 0, 2]).line).toEqual([4, 0, 0, 0]);
  });

  it("reports the score gained as the sum of tiles created", () => {
    expect(slideLine([4, 4, 8, 8]).gained).toBe(8 + 16);
  });

  it("gains nothing when nothing merges", () => {
    expect(slideLine([2, 4, 8, 16]).gained).toBe(0);
  });
});

describe("move", () => {
  it("slides left", () => {
    const { grid } = move(g([[0, 0, 2, 2]]), "left");
    expect(grid[0]).toEqual([4, 0, 0, 0]);
  });

  it("slides right, merging toward the wall", () => {
    const { grid } = move(g([[2, 2, 0, 0]]), "right");
    expect(grid[0]).toEqual([0, 0, 0, 4]);
  });

  it("slides up", () => {
    const { grid } = move(g([[2], [2], [0], [0]]), "up");
    expect(grid.map((row) => row[0])).toEqual([4, 0, 0, 0]);
  });

  it("slides down", () => {
    const { grid } = move(g([[2], [2], [0], [0]]), "down");
    expect(grid.map((row) => row[0])).toEqual([0, 0, 0, 4]);
  });

  it("reports that nothing moved, so the caller does not spawn a tile", () => {
    // Spawning after a no-op move is how a board fills up without the player doing anything,
    // and it ends games that were not lost.
    const board = g([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    const result = move(board, "left");
    expect(result.moved).toBe(false);
    expect(gridsEqual(result.grid, board)).toBe(true);
  });

  it("does not mutate the grid it was given", () => {
    const board = g([[2, 2, 0, 0]]);
    const copy = board.map((row) => [...row]);
    move(board, "left");
    expect(board).toEqual(copy);
  });

  it("sums the score across every row", () => {
    const { gained } = move(
      g([
        [2, 2, 0, 0],
        [4, 4, 0, 0],
      ]),
      "left",
    );
    expect(gained).toBe(4 + 8);
  });
});

describe("spawn", () => {
  it("places a tile in an empty cell", () => {
    const board = emptyGrid();
    const next = spawn(board, () => 0);
    const filled = next.flat().filter((v) => v !== 0);
    expect(filled).toHaveLength(1);
  });

  it("spawns a 4 occasionally and a 2 usually", () => {
    // The standard distribution is 90% twos. A generator at the top of the range gives the 4.
    expect(
      spawn(emptyGrid(), () => 0.95)
        .flat()
        .filter(Boolean),
    ).toEqual([4]);
    expect(
      spawn(emptyGrid(), () => 0)
        .flat()
        .filter(Boolean),
    ).toEqual([2]);
  });

  it("returns the grid unchanged when there is no room", () => {
    const full = g([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(
      gridsEqual(
        spawn(full, () => 0.5),
        full,
      ),
    ).toBe(true);
  });

  it("never overwrites an occupied cell", () => {
    let board = emptyGrid();
    let seed = 1;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < GRID * GRID; i += 1) board = spawn(board, rng);
    // Sixteen spawns into a sixteen-cell grid must fill it exactly, with nothing lost.
    expect(board.flat().filter((v) => v === 0)).toHaveLength(0);
  });
});

describe("game over", () => {
  it("is not over while an empty cell remains", () => {
    expect(isGameOver(emptyGrid())).toBe(false);
  });

  it("is not over when a merge is still possible on a full board", () => {
    const board = g([
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [2, 4, 8, 16],
      [4, 8, 16, 32],
    ]);
    expect(isGameOver(board)).toBe(false);
  });

  it("is over when the board is full and no neighbours match", () => {
    const board = g([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(isGameOver(board)).toBe(true);
    for (const d of ["left", "right", "up", "down"] as Direction[]) {
      expect(canMove(board, d)).toBe(false);
    }
  });
});

describe("progress", () => {
  it("reports the largest tile", () => {
    expect(maxTile(g([[2, 1024, 0, 0]]))).toBe(1024);
  });

  it("is won at 2048", () => {
    expect(hasWon(g([[2048]]))).toBe(true);
    expect(hasWon(g([[1024]]))).toBe(false);
  });
});
