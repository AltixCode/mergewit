import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { BannerAdSlot } from "@/components/BannerAdSlot";
import { Board } from "@/components/Board";
import { Button, Screen, Text } from "@/components/ui";
import { t } from "@/i18n";
import { type Direction, hasWon, isGameOver, maxTile } from "@/logic/board";
import { useBoardStore } from "@/store/useBoardStore";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";

export default function Game() {
  const router = useRouter();
  const { colors, spacing, radius } = useTheme();

  const isPremium = usePremiumStore((s) => s.isPremium);
  const grid = useBoardStore((s) => s.grid);
  const score = useBoardStore((s) => s.score);
  const best = useBoardStore((s) => s.best);
  const theme = useBoardStore((s) => s.theme);
  const dayKey = useBoardStore((s) => s.dayKey);
  const swipe = useBoardStore((s) => s.swipe);
  const undo = useBoardStore((s) => s.undo);
  const newGame = useBoardStore((s) => s.newGame);
  const recordSolve = useBoardStore((s) => s.recordSolve);

  // A win is announced once per game, not on every swipe after 2048 appears.
  const announcedWin = useRef(false);
  const announcedOver = useRef(false);

  const onSwipe = useCallback(
    (direction: Direction) => {
      if (swipe(direction) === "moved") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [swipe],
  );

  // Announcements live in an effect rather than in the swipe handler: a handler that fires an
  // Alert can do so after the component has gone, and the timer leaks past unmount.
  useEffect(() => {
    if (!announcedWin.current && hasWon(grid)) {
      announcedWin.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("wonTitle"), t("wonBody"), [{ text: t("keepGoingCta") }]);
      return;
    }
    if (!announcedOver.current && isGameOver(grid)) {
      announcedOver.current = true;
      if (dayKey) recordSolve(dayKey, score, maxTile(grid));
      Alert.alert(
        t("gameOverTitle"),
        t("gameOverBody", {
          score: String(score),
          tile: String(maxTile(grid)),
        }),
      );
    }
  }, [grid, score, dayKey, recordSolve]);

  const doNewGame = useCallback(() => {
    announcedWin.current = false;
    announcedOver.current = false;
    newGame();
  }, [newGame]);

  const doUndo = useCallback(() => {
    const outcome = undo(isPremium);
    if (outcome === "nothing-to-undo") {
      Alert.alert(t("nothingToUndo"));
      return;
    }
    if (outcome === "limit-reached") {
      Alert.alert(t("undoLimitTitle"), t("undoLimitBody"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("removeAdsCta"), onPress: () => router.push("/paywall") },
      ]);
      return;
    }
    // Undoing revives a finished board, so the announcements must be armed again.
    announcedOver.current = false;
  }, [undo, isPremium, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen scroll>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="display">{t("appName")}</Text>
            <Text variant="caption" tone="muted">
              {dayKey ?? t("freePlayTitle")}
            </Text>
          </View>
          <View
            style={{
              alignItems: "flex-end",
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            }}
          >
            <Text variant="micro" tone="faint">
              {t("scoreLabel").toUpperCase()}
            </Text>
            <Text variant="numeric">{String(score)}</Text>
          </View>
        </View>

        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          {`${t("bestLabel")} ${best}`}
        </Text>

        <View style={{ alignItems: "center", marginTop: spacing.lg }}>
          <Board grid={grid} theme={theme} onSwipe={onSwipe} />
        </View>

        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.lg }]}>
          <Button
            label={t("undoCta")}
            variant="secondary"
            onPress={doUndo}
            style={{ flex: 1 }}
          />
          <Button
            label={t("newGameCta")}
            variant="secondary"
            onPress={doNewGame}
            style={{ flex: 1 }}
          />
        </View>

        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.sm }]}>
          <Button
            label={t("dailyTitle")}
            variant="ghost"
            onPress={() => router.push("/daily")}
            style={{ flex: 1 }}
          />
          <Button
            label={t("settingsTitle")}
            variant="ghost"
            onPress={() => router.push("/settings")}
            style={{ flex: 1 }}
          />
        </View>
      </Screen>
      <BannerAdSlot />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center" },
});

