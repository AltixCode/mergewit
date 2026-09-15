import { GRID } from "../board";
import {
  ARCHIVE_DAYS,
  archiveDates,
  dailySeed,
  dateKey,
  isPlayable,
  seededRng,
  startingGrid,
} from "../daily";

describe("dateKey", () => {
  it("is the local calendar day, not UTC", () => {
    // A UTC-based key rolls over at midnight UTC, which for most of the world is the middle of
    // the afternoon or the small hours — the player's "today" would change while they played.
    const d = new Date(2026, 8, 15, 23, 30);
    expect(dateKey(d)).toBe("2026-09-15");
  });

  it("pads months and days", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("seededRng", () => {
  it("is deterministic for a seed", () => {
    const a = seededRng(12345);
    const b = seededRng(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs between seeds", () => {
    expect(seededRng(1)()).not.toBe(seededRng(2)());
  });

  it("stays inside [0, 1)", () => {
    const rng = seededRng(99);
    for (let i = 0; i < 5000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is roughly uniform, so a seeded board is not a degenerate one", () => {
    const rng = seededRng(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i += 1) buckets[Math.floor(rng() * 10)]! += 1;
    for (const count of buckets)
      expect(Math.abs(count - 1000)).toBeLessThan(200);
  });
});

describe("dailySeed", () => {
  it("is stable for a date", () => {
    expect(dailySeed("2026-09-15")).toBe(dailySeed("2026-09-15"));
  });

  it("differs between adjacent days", () => {
    expect(dailySeed("2026-09-15")).not.toBe(dailySeed("2026-09-16"));
  });
});

describe("startingGrid", () => {
  it("is identical for everyone on the same day — that is what makes it a shared challenge", () => {
    expect(startingGrid("2026-09-15")).toEqual(startingGrid("2026-09-15"));
  });

  it("differs between days", () => {
    expect(startingGrid("2026-09-15")).not.toEqual(startingGrid("2026-09-16"));
  });

  it("starts with exactly two tiles, like a normal game", () => {
    const filled = startingGrid("2026-09-15")
      .flat()
      .filter((v) => v !== 0);
    expect(filled).toHaveLength(2);
    for (const value of filled) expect([2, 4]).toContain(value);
  });

  it("is the right size", () => {
    const grid = startingGrid("2026-09-15");
    expect(grid).toHaveLength(GRID);
    for (const row of grid) expect(row).toHaveLength(GRID);
  });
});

describe("the archive", () => {
  const today = new Date(2026, 8, 15);

  it("offers today plus the days before it, newest first", () => {
    const dates = archiveDates(today);
    expect(dates[0]).toBe("2026-09-15");
    expect(dates[1]).toBe("2026-09-14");
    expect(dates).toHaveLength(ARCHIVE_DAYS);
  });

  it("never offers a future date — there is nothing to play yet", () => {
    // A seeded generator will happily produce tomorrow's board, which would let a player
    // finish a challenge before the day it belongs to.
    for (const date of archiveDates(today)) {
      expect(date <= dateKey(today)).toBe(true);
    }
  });

  it("lets a free player play today and a paying one play any archived day", () => {
    expect(isPlayable("2026-09-15", today, false)).toBe(true);
    expect(isPlayable("2026-09-14", today, false)).toBe(false);
    expect(isPlayable("2026-09-14", today, true)).toBe(true);
  });

  it("refuses a future date to everyone, paying or not", () => {
    expect(isPlayable("2026-09-16", today, true)).toBe(false);
    expect(isPlayable("2026-09-16", today, false)).toBe(false);
  });

  it("refuses a date older than the archive", () => {
    expect(isPlayable("2020-01-01", today, true)).toBe(false);
  });
});
