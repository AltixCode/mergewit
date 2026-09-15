import AsyncStorage from "@react-native-async-storage/async-storage";

import { BOARD_CACHE_KEY, FREE_UNDO, useBoardStore } from "../useBoardStore";
import { emptyGrid, type Grid } from "@/logic/board";

const g = (rows: number[][]): Grid =>
  Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => rows[r]?.[c] ?? 0),
  );

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useBoardStore.setState({
    grid: emptyGrid(),
    score: 0,
    best: 0,
    history: [],
    stats: {},
    theme: "default",
    dayKey: null,
    undosUsed: 0,
  });
});

describe("moving", () => {
  it("slides, scores and spawns a new tile", () => {
    useBoardStore.setState({ grid: g([[2, 2, 0, 0]]) });
    useBoardStore.getState().swipe("left", () => 0);

    const { grid, score } = useBoardStore.getState();
    expect(score).toBe(4);
    // The merged 4 plus one spawned tile.
    expect(grid.flat().filter((v) => v !== 0).length).toBe(2);
  });

  it("does nothing at all when the move changes nothing", () => {
    const board = g([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    useBoardStore.setState({ grid: board });
    useBoardStore.getState().swipe("left", () => 0);

    expect(useBoardStore.getState().grid).toEqual(board);
    expect(useBoardStore.getState().history).toHaveLength(0);
  });

  it("tracks the best score across games", () => {
    useBoardStore.setState({ grid: g([[2, 2, 0, 0]]) });
    useBoardStore.getState().swipe("left", () => 0);
    useBoardStore.getState().newGame(() => 0);
    expect(useBoardStore.getState().best).toBe(4);
    expect(useBoardStore.getState().score).toBe(0);
  });
});

describe("undo — one step free, unlimited paid", () => {
  it("restores the previous board and score", () => {
    const before = g([[2, 2, 0, 0]]);
    useBoardStore.setState({ grid: before });
    useBoardStore.getState().swipe("left", () => 0);
    expect(useBoardStore.getState().score).toBe(4);

    expect(useBoardStore.getState().undo(false)).toBe("undone");
    expect(useBoardStore.getState().grid).toEqual(before);
    expect(useBoardStore.getState().score).toBe(0);
  });

  it("gives a free player exactly one step back", () => {
    // Two moves that each genuinely change the board: left merges both rows, then up merges
    // the two 4s in column 0. A second left would be blocked and push no undo step.
    useBoardStore.setState({
      grid: g([
        [2, 2, 0, 0],
        [2, 2, 0, 0],
      ]),
    });
    expect(useBoardStore.getState().swipe("left", () => 0)).toBe("moved");
    expect(useBoardStore.getState().swipe("up", () => 0)).toBe("moved");

    expect(useBoardStore.getState().undo(false)).toBe("undone");
    // The second undo is the one the purchase sells.
    expect(useBoardStore.getState().undo(false)).toBe("limit-reached");
  });

  it("gives a paying player more than one", () => {
    useBoardStore.setState({
      grid: g([
        [2, 2, 0, 0],
        [2, 2, 0, 0],
      ]),
    });
    expect(useBoardStore.getState().swipe("left", () => 0)).toBe("moved");
    expect(useBoardStore.getState().swipe("up", () => 0)).toBe("moved");

    expect(useBoardStore.getState().undo(true)).toBe("undone");
    expect(useBoardStore.getState().undo(true)).toBe("undone");
  });

  it("says so when there is nothing to undo, rather than reporting a limit", () => {
    // These are different answers and the UI shows different things: one offers the paywall.
    expect(useBoardStore.getState().undo(false)).toBe("nothing-to-undo");
    expect(useBoardStore.getState().undo(true)).toBe("nothing-to-undo");
  });

  it("keeps only what a free player can use, so the stack cannot grow without bound", () => {
    useBoardStore.setState({ grid: g([[2, 2, 4, 4]]) });
    for (let i = 0; i < 50; i += 1)
      useBoardStore.getState().swipe("left", () => 0);
    expect(useBoardStore.getState().history.length).toBeLessThanOrEqual(100);
  });

  it("clears the stack on a new game", () => {
    useBoardStore.setState({ grid: g([[2, 2, 0, 0]]) });
    useBoardStore.getState().swipe("left", () => 0);
    useBoardStore.getState().newGame(() => 0);
    expect(useBoardStore.getState().history).toHaveLength(0);
  });
});

describe("themes", () => {
  it("starts on the default", () => {
    expect(useBoardStore.getState().theme).toBe("default");
  });

  it("is locked for a free player and open to a paying one", () => {
    useBoardStore.getState().setTheme("dusk", false);
    expect(useBoardStore.getState().theme).toBe("default");
    useBoardStore.getState().setTheme("dusk", true);
    expect(useBoardStore.getState().theme).toBe("dusk");
  });

  it("refuses a theme that does not exist, whoever asks", () => {
    useBoardStore.getState().setTheme("neon-chartreuse", true);
    expect(useBoardStore.getState().theme).toBe("default");
  });
});

describe("solve stats", () => {
  it("records a finished daily challenge", () => {
    useBoardStore.getState().recordSolve("2026-09-15", 1234, 512);
    expect(useBoardStore.getState().stats["2026-09-15"]).toEqual({
      score: 1234,
      best: 512,
    });
  });

  it("keeps the better result when a day is replayed", () => {
    useBoardStore.getState().recordSolve("2026-09-15", 1000, 256);
    useBoardStore.getState().recordSolve("2026-09-15", 800, 128);
    expect(useBoardStore.getState().stats["2026-09-15"]!.score).toBe(1000);
  });
});

describe("persistence", () => {
  it("round-trips a game in progress", async () => {
    useBoardStore.setState({
      grid: g([[2, 4, 0, 0]]),
      score: 42,
      best: 99,
      theme: "default",
    });
    await useBoardStore.getState().persist();

    useBoardStore.setState({ grid: emptyGrid(), score: 0, best: 0 });
    await useBoardStore.getState().hydrate();

    expect(useBoardStore.getState().score).toBe(42);
    expect(useBoardStore.getState().best).toBe(99);
    expect(useBoardStore.getState().grid[0]).toEqual([2, 4, 0, 0]);
  });

  it("starts a clean game on stored rubbish rather than refusing to launch", async () => {
    await AsyncStorage.setItem(
      BOARD_CACHE_KEY,
      '{"grid":"nope","score":"lots","theme":7}',
    );
    await useBoardStore.getState().hydrate();
    expect(useBoardStore.getState().score).toBe(0);
    expect(useBoardStore.getState().theme).toBe("default");
    expect(useBoardStore.getState().grid).toHaveLength(4);
  });

  it("rejects a grid of the wrong shape", async () => {
    await AsyncStorage.setItem(
      BOARD_CACHE_KEY,
      JSON.stringify({ grid: [[2, 2]], score: 5 }),
    );
    await useBoardStore.getState().hydrate();
    expect(useBoardStore.getState().grid).toHaveLength(4);
    expect(useBoardStore.getState().grid[0]).toHaveLength(4);
  });
});
