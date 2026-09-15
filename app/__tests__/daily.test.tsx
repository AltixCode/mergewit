import { fireEvent } from "@testing-library/react-native";
import React from "react";

import Daily from "../daily";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { emptyGrid } from "@/logic/board";
import { dateKey } from "@/logic/daily";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { useBoardStore } from "@/store/useBoardStore";
import { usePremiumStore } from "@/store/usePremiumStore";

const today = dateKey(new Date());
const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

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

describe("the archive", () => {
  it("marks today as today", async () => {
    const { getByText } = await renderWithProviders(<Daily />);
    expect(getByText(t("todayLabel"))).toBeTruthy();
  });

  it("lets a free player start today", async () => {
    const { getByLabelText } = await renderWithProviders(<Daily />);
    await fireEvent.press(getByLabelText(t("playDay", { date: today })));

    expect(useBoardStore.getState().dayKey).toBe(today);
    // The day's board is derived from its date, so it starts with the standard two tiles.
    expect(
      useBoardStore
        .getState()
        .grid.flat()
        .filter((v) => v !== 0),
    ).toHaveLength(2);
    expect(testRouter.back).toHaveBeenCalled();
  });

  it("sends a free player who taps a past day to the paywall, and starts nothing", async () => {
    const { getByLabelText } = await renderWithProviders(<Daily />);
    await fireEvent.press(getByLabelText(t("dayLocked", { date: yesterday })));

    expect(testRouter.push).toHaveBeenCalledWith("/paywall");
    expect(useBoardStore.getState().dayKey).toBeNull();
  });

  it("lets a paying player open a past day", async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByLabelText } = await renderWithProviders(<Daily />);
    await fireEvent.press(getByLabelText(t("playDay", { date: yesterday })));

    expect(useBoardStore.getState().dayKey).toBe(yesterday);
    expect(testRouter.push).not.toHaveBeenCalledWith("/paywall");
  });

  it("gives the same board for the same day, which is what makes it shared", async () => {
    usePremiumStore.setState({ isPremium: true });
    const first = await renderWithProviders(<Daily />);
    await fireEvent.press(
      first.getByLabelText(t("playDay", { date: yesterday })),
    );
    const a = useBoardStore.getState().grid;

    useBoardStore.setState({ grid: emptyGrid(), dayKey: null });
    const second = await renderWithProviders(<Daily />);
    await fireEvent.press(
      second.getByLabelText(t("playDay", { date: yesterday })),
    );

    expect(useBoardStore.getState().grid).toEqual(a);
  });

  it("shows a recorded score against the day it was set", async () => {
    useBoardStore.setState({ stats: { [today]: { score: 1234, best: 256 } } });
    const { getByLabelText } = await renderWithProviders(<Daily />);
    expect(
      getByLabelText(t("daySolved", { date: today, score: "1234" })),
    ).toBeTruthy();
  });
});
