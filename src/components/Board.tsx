import React, { useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { runOnJS, ZoomIn } from "react-native-reanimated";

import { Text } from "@/components/ui";
import { t } from "@/i18n";
import { GRID, type Direction, type Grid, changedCells } from "@/logic/board";
import { tileStyle } from "@/theme/tiles";
import { useTheme } from "@/theme";

/**
 * How long a tile's arrival pop takes. A tester asked for visible feedback on every swipe — a
 * slide-along-its-actual-path animation would need the board to track each tile's identity
 * across a move (today `src/logic/board.ts` only knows resulting values, not which physical
 * tile became which), which is a materially bigger change than this pass makes. This gives the
 * same "something just happened, and here" feedback with a contained one: `changedCells` marks
 * every cell a swipe touched — a slid tile landing, a merge, the tile it spawns — and each one
 * pops in on its own key change, so a player sees exactly which cells the swipe affected.
 */
const TILE_POP_MS = 180;

/** Below this the swipe is a tap that wandered, not a direction. */
const SWIPE_THRESHOLD = 24;

interface BoardProps {
  grid: Grid;
  theme: string;
  onSwipe: (direction: Direction) => void;
}

/** A GRID×GRID grid of zeros, for the counters below to start from. */
function zeroCounters(): number[][] {
  return Array.from({ length: GRID }, () => new Array<number>(GRID).fill(0));
}

export function Board({ grid, theme, onSwipe }: BoardProps) {
  const { colors, radius, spacing } = useTheme();
  const { width, height } = useWindowDimensions();

  // One counter per cell, bumped whenever that cell's value changes. Bumping it changes the
  // cell's React key, so only the cells a swipe actually touched remount and play their
  // `entering` animation — an unrelated cell keeps its key and its element instance, and
  // renders with no animation at all.
  //
  // This is the "adjust state during render" pattern React documents for deriving something
  // from a prop change without an effect: calling `setState` here, guarded by the `!==` check,
  // bails out and re-renders with the new counters before anything commits, rather than
  // flashing the un-bumped keys for a frame the way an effect would.
  const [lastGrid, setLastGrid] = useState(grid);
  const [ticks, setTicks] = useState(zeroCounters);
  if (lastGrid !== grid) {
    const mask = changedCells(lastGrid, grid);
    setTicks(
      ticks.map((row, r) =>
        row.map((tick, c) => (mask[r]?.[c] ? tick + 1 : tick)),
      ),
    );
    setLastGrid(grid);
  }

  // The board is square and sized from the narrower dimension so it never overflows on a
  // phone in landscape or on a small screen.
  //
  // 420 was that size on every device. On a 13" iPad it left the board -- which
  // is the entire game -- occupying 41% of a 1032pt width, a phone board
  // centred in a tablet. The cap now scales with the screen class, and the
  // height term keeps a square board from pushing the score row off a short
  // window however wide the display is.
  const isTablet = width >= 700;
  const side = Math.min(
    width - spacing.xl * 2,
    height * 0.55,
    isTablet ? 700 : 420,
  );
  const gap = Math.max(4, Math.round(side * 0.02));
  const cell = (side - gap * (GRID + 1)) / GRID;

  const pan = Gesture.Pan().onEnd((event) => {
    "worklet";
    const { translationX: dx, translationY: dy } = event;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD)
      return;
    const direction: Direction =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up";
    // The gesture callback runs on the UI thread; touching the store from there crashes.
    runOnJS(onSwipe)(direction);
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityLabel={t("boardLabel")}
        style={{
          width: side,
          height: side,
          padding: gap,
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        {grid.map((row, r) => (
          <View
            key={r}
            style={[
              styles.row,
              { height: cell, marginBottom: r === GRID - 1 ? 0 : gap },
            ]}
          >
            {row.map((value, c) => {
              const style = tileStyle(theme, value);
              return (
                <Animated.View
                  key={`${c}-${ticks[r]![c]}`}
                  entering={ZoomIn.duration(TILE_POP_MS)}
                  style={{
                    width: cell,
                    height: cell,
                    marginRight: c === GRID - 1 ? 0 : gap,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    // An empty cell is a recess in the board, not a tile with no number.
                    //
                    // The fill alone cannot carry that: `surface` is 1.15:1
                    // against the well, and the well is already the darkest
                    // thing available, so there is nowhere darker for a recess
                    // to go. The edge does the work instead.
                    //
                    // Checked on a device before changing it, because the
                    // measurement alone argued both ways -- the board IS
                    // visible as a panel and the game is played by swiping, so
                    // nobody aims at a cell. What settled it: in DARK mode a
                    // fresh 4x4 board reads as one solid rectangle unless you
                    // zoom in, and every store screenshot in this portfolio is
                    // captured dark. Light mode already read as a grid.
                    backgroundColor: value === 0 ? colors.surface : style.face,
                    borderWidth: value === 0 ? StyleSheet.hairlineWidth * 2 : 0,
                    borderColor:
                      value === 0 ? colors.borderStrong : "transparent",
                  }}
                >
                  {value === 0 ? null : (
                    <Text
                      variant={value >= 1024 ? "bodyStrong" : "numeric"}
                      color={style.label}
                      // Numbers are already announced by the board label; marking each tile
                      // would make a screen reader read sixteen cells on every swipe.
                      accessibilityElementsHidden
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {String(value)}
                    </Text>
                  )}
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
});
