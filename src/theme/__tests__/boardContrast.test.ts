import { darkPalette, lightPalette } from "../tokens";

/**
 * The empty board has to read as a grid.
 *
 * An empty cell is a recess: `surface` on a `surfaceAlt` well, which is 1.15:1.
 * That is deliberate -- the pieces carry the energy -- but a recess that cannot
 * be seen is not a recess, and there is nowhere darker for the fill to go
 * because the well is already near the bottom of the palette. The edge does the
 * work.
 *
 * This was measured, argued both ways, and then checked on a device. In LIGHT
 * mode a fresh 4x4 board already read as a grid. In DARK mode it read as one
 * solid rectangle unless you zoomed in -- and every store screenshot in this
 * portfolio is captured dark, so dark is the appearance that reaches a listing.
 *
 * WCAG AA asks 3:1 for the boundary of a non-text UI component.
 */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const MIN_COMPONENT_CONTRAST = 3;

describe("the empty board reads as a grid", () => {
  it("outlines an empty cell against the well in dark mode", () => {
    expect(
      contrastRatio(darkPalette.borderStrong, darkPalette.surfaceAlt),
    ).toBeGreaterThanOrEqual(MIN_COMPONENT_CONTRAST);
  });

  it("outlines an empty cell against the well in light mode", () => {
    expect(
      contrastRatio(lightPalette.borderStrong, lightPalette.surfaceAlt),
    ).toBeGreaterThanOrEqual(MIN_COMPONENT_CONTRAST);
  });
});
