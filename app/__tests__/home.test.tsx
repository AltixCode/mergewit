import { act, fireEvent } from "@testing-library/react-native";
import React from "react";

import Home from "../index";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { type Grid, emptyGrid } from "@/logic/board";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { useBoardStore } from "@/store/useBoardStore";
import { usePremiumStore } from "@/store/usePremiumStore";

const g = (rows: number[][]): Grid =>
  Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => rows[r]?.[c] ?? 0),
  );

/** A full board with no equal neighbours: no move is possible. */
const DEAD = g([
  [2, 4, 2, 4],
  [4, 2, 4, 2],
  [2, 4, 2, 4],
  [4, 2, 4, 2],
]);

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
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

describe("the game screen", () => {
  it("shows the score and the board", async () => {
    useBoardStore.setState({ grid: g([[2, 4, 0, 0]]), score: 12 });
    const { getByText, getByLabelText } = await renderWithProviders(<Home />);
    expect(getByText("12")).toBeTruthy();
    expect(getByLabelText(t("boardLabel"))).toBeTruthy();
  });

  it("says it is free play until a day is chosen", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText(t("freePlayTitle"))).toBeTruthy();
  });

  it("names the day when one is being played", async () => {
    useBoardStore.setState({ dayKey: "2026-09-15" });
    const { getByText } = await renderWithProviders(<Home />);
    expect(getByText("2026-09-15")).toBeTruthy();
  });

  it("routes to the archive and to settings", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("dailyTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/daily");
    await fireEvent.press(getByText(t("settingsTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("starts a new game", async () => {
    useBoardStore.setState({ grid: g([[2, 4, 0, 0]]), score: 50 });
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("newGameCta")));
    expect(useBoardStore.getState().score).toBe(0);
  });

  it("says there is nothing to undo rather than offering the paywall", async () => {
    // These are different states and only one of them is a sales opportunity. Conflating them
    // shows a purchase prompt to a player who has simply not moved yet.
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("undoCta")));
    expect(alert).toHaveBeenCalledWith(t("nothingToUndo"));
    expect(testRouter.push).not.toHaveBeenCalledWith("/paywall");
  });

  it("offers the paywall once a free player has spent their undo", async () => {
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    useBoardStore.setState({
      grid: g([[4, 0, 0, 0]]),
      history: [
        { grid: g([[2, 2, 0, 0]]), score: 0 },
        { grid: g([[2, 0, 2, 0]]), score: 0 },
      ],
      undosUsed: 1,
    });

    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("undoCta")));
    expect(alert.mock.calls[0]![0]).toBe(t("undoLimitTitle"));
  });

  it("undoes for a free player who still has their step", async () => {
    const before = g([[2, 2, 0, 0]]);
    useBoardStore.setState({
      grid: g([[4, 0, 0, 0]]),
      history: [{ grid: before, score: 0 }],
    });
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("undoCta")));
    expect(useBoardStore.getState().grid).toEqual(before);
  });

  it("announces a finished game once, not on every render", async () => {
    // The effect must be guarded by a ref, not re-fire whenever the component re-renders.
    // `rerender` is not usable here: it replaces the provider tree, so the re-render is
    // driven through a real store change instead, which is what happens on a device.
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    useBoardStore.setState({ grid: DEAD, score: 400 });

    await renderWithProviders(<Home />);
    await act(async () => {
      useBoardStore.setState({ best: 401 });
      useBoardStore.setState({ best: 402 });
    });

    const overCalls = alert.mock.calls.filter((c) => c[0] === t("gameOverTitle"));
    expect(overCalls).toHaveLength(1);
  });

  it("records the day stat when a daily game ends", async () => {
    jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    useBoardStore.setState({ grid: DEAD, score: 400, dayKey: "2026-09-15" });
    await renderWithProviders(<Home />);
    expect(useBoardStore.getState().stats["2026-09-15"]).toEqual({
      score: 400,
      best: 4,
    });
  });

  it("announces a win and lets the player keep going", async () => {
    const alert = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    useBoardStore.setState({ grid: g([[2048, 0, 0, 0]]), score: 20000 });
    await renderWithProviders(<Home />);
    expect(alert.mock.calls[0]![0]).toBe(t("wonTitle"));
  });
});
