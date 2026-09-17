import React from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { runOnJS } from "react-native-reanimated";

import { Text } from "@/components/ui";
import { t } from "@/i18n";
import { GRID, type Direction, type Grid } from "@/logic/board";
import { tileStyle } from "@/theme/tiles";
import { useTheme } from "@/theme";

/** Below this the swipe is a tap that wandered, not a direction. */
const SWIPE_THRESHOLD = 24;

interface BoardProps {
  grid: Grid;
  theme: string;
  onSwipe: (direction: Direction) => void;
}

export function Board({ grid, theme, onSwipe }: BoardProps) {
  const { colors, radius, spacing } = useTheme();
  const { width, height } = useWindowDimensions();

  // The board is square and sized from the narrower dimension so it never overflows on a
  // phone in landscape or on a small screen.
  //
  // 420 was that size on every device. On a 13" iPad it left the board -- which
  // is the entire game -- occupying 41% of a 1032pt width, a phone board
  // centred in a tablet. The cap now scales with the screen class, and the
  // height term keeps a square board from pushing the score row off a short
  // window however wide the display is.
  const isTablet = width >= 700;
  const side = Math.min(width - spacing.xl * 2, height * 0.55, isTablet ? 700 : 420);
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
                <View
                  key={c}
                  style={{
                    width: cell,
                    height: cell,
                    marginRight: c === GRID - 1 ? 0 : gap,
                    borderRadius: radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    // An empty cell is a recess in the board, not a tile with no number.
                    backgroundColor: value === 0 ? colors.surface : style.face,
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
                </View>
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
