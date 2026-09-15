/**
 * Tile palettes.
 *
 * In `src/theme/` because every colour literal in the app is, and because that is what lets
 * the contrast test see them. Each theme is a ramp of eleven steps — 2 through 2048, plus one
 * bucket for anything beyond — and each step carries its own label colour.
 *
 * The label is stored rather than derived. A single fixed label colour is readable across most
 * of a ramp and unreadable in the middle of it, which is exactly where a mid-tone teal or
 * amber sits: it looks deliberate and cannot be read. Every pairing here was computed against
 * a 4.5:1 target and is asserted by `__tests__/tiles.test.ts`; one face had to be nudged off
 * its nominal hue to reach it, which is not something the eye catches.
 *
 * `default` is free. The other three are what the paywall means by "every theme pack".
 */

export interface Tile {
  face: string;
  label: string;
}

export const TILE_THEMES: Record<string, Tile[]> = {
  default: [
    { face: '#EEE4DA', label: '#0F1115' },
    { face: '#EDE0C8', label: '#0F1115' },
    { face: '#F2B179', label: '#0F1115' },
    { face: '#F59563', label: '#0F1115' },
    { face: '#F67C5F', label: '#0F1115' },
    { face: '#F65E3B', label: '#0F1115' },
    { face: '#EDCF72', label: '#0F1115' },
    { face: '#EDCC61', label: '#0F1115' },
    { face: '#EDC850', label: '#0F1115' },
    { face: '#EDC53F', label: '#0F1115' },
    { face: '#3C3A32', label: '#FFFFFF' },
  ],
  dusk: [
    { face: '#E5E4F0', label: '#0F1115' },
    { face: '#CFCCE8', label: '#0F1115' },
    { face: '#A9A2DB', label: '#0F1115' },
    { face: '#8E82CE', label: '#0F1115' },
    { face: '#7765C2', label: '#FFFFFF' },
    { face: '#6249B5', label: '#FFFFFF' },
    { face: '#5137A3', label: '#FFFFFF' },
    { face: '#432B8C', label: '#FFFFFF' },
    { face: '#371F75', label: '#FFFFFF' },
    { face: '#2C1660', label: '#FFFFFF' },
    { face: '#1E0E45', label: '#FFFFFF' },
  ],
  reef: [
    { face: '#E0F2F1', label: '#0F1115' },
    { face: '#B2DFDB', label: '#0F1115' },
    { face: '#80CBC4', label: '#0F1115' },
    { face: '#4DB6AC', label: '#0F1115' },
    { face: '#26A69A', label: '#0F1115' },
    { face: '#009688', label: '#0F1115' },
    { face: '#0A8E80', label: '#0F1115' },
    { face: '#00796B', label: '#FFFFFF' },
    { face: '#00695C', label: '#FFFFFF' },
    { face: '#004D40', label: '#FFFFFF' },
    { face: '#00332A', label: '#FFFFFF' },
  ],
  ember: [
    { face: '#FFF3E0', label: '#0F1115' },
    { face: '#FFE0B2', label: '#0F1115' },
    { face: '#FFCC80', label: '#0F1115' },
    { face: '#FFB74D', label: '#0F1115' },
    { face: '#FFA726', label: '#0F1115' },
    { face: '#FB8C00', label: '#0F1115' },
    { face: '#F57C00', label: '#0F1115' },
    { face: '#EF6C00', label: '#0F1115' },
    { face: '#E65100', label: '#0F1115' },
    { face: '#BF360C', label: '#FFFFFF' },
    { face: '#8A2500', label: '#FFFFFF' },
  ],
};

export const THEME_NAMES = Object.keys(TILE_THEMES);

/** The palette step for a tile value. Anything past the ramp uses the final bucket. */
export function tileStyle(theme: string, value: number): Tile {
  const ramp = TILE_THEMES[theme] ?? TILE_THEMES.default!;
  if (value <= 0) return ramp[0]!;
  // 2 -> 0, 4 -> 1, 8 -> 2 ... capped at the last entry.
  const step = Math.round(Math.log2(value)) - 1;
  return ramp[Math.min(Math.max(step, 0), ramp.length - 1)]!;
}
