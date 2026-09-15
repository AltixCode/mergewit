import { TILE_THEMES, THEME_NAMES, tileStyle } from "../tiles";
import { contrastRatio } from "../color";

describe("every tile in every theme is readable", () => {
  // The number on a tile is the only thing that matters in this game. A step whose label
  // washes out against its own face is not a styling nitpick — the player cannot read the
  // board. Mid-ramp tones are where this happens, and they look deliberate.
  for (const [name, ramp] of Object.entries(TILE_THEMES)) {
    it(`${name} clears AA at every step`, () => {
      ramp.forEach((tile, i) => {
        const ratio = contrastRatio(tile.label, tile.face);
        // Named in the failure so a regression says which step, not just which theme.
        expect({ step: i, ratio: Math.round(ratio * 100) / 100 }).toEqual({
          step: i,
          ratio: expect.any(Number),
        });
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});

describe("tileStyle", () => {
  it("maps each value to its own step, so the ramp is actually used", () => {
    const seen = new Set<string>();
    for (const value of [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]) {
      seen.add(tileStyle("default", value).face);
    }
    expect(seen.size).toBe(11);
  });

  it("holds the last step for tiles beyond the ramp", () => {
    // A 4096 is reachable and must not fall off the end into undefined.
    const last = TILE_THEMES.default!.at(-1)!;
    expect(tileStyle("default", 4096)).toEqual(last);
    expect(tileStyle("default", 65536)).toEqual(last);
  });

  it("treats an empty cell as the first step rather than crashing", () => {
    expect(tileStyle("default", 0)).toEqual(TILE_THEMES.default![0]);
  });

  it("falls back to the default theme for a name it does not know", () => {
    expect(tileStyle("no-such-theme", 8)).toEqual(tileStyle("default", 8));
  });

  it("every ramp is the same length, so no theme has missing steps", () => {
    const lengths = THEME_NAMES.map((n) => TILE_THEMES[n]!.length);
    expect(new Set(lengths).size).toBe(1);
  });
});
