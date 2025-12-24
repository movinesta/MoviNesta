import { beforeEach, describe, expect, it } from "vitest";
import {
  buildInterleavedDeck,
  loadInitialSourceWeights,
  trimDeck,
  type SwipeCardData,
} from "../modules/swipe/useSwipeDeck";

describe("buildInterleavedDeck", () => {
  it("interleaves sources and stops at the limit", () => {
    const listA: SwipeCardData[] = [
      { id: "a1", title: "A1" },
      { id: "a2", title: "A2" },
    ];
    const listB: SwipeCardData[] = [{ id: "b1", title: "B1" }];
    const listC: SwipeCardData[] = [
      { id: "c1", title: "C1" },
      { id: "c2", title: "C2" },
    ];

    const result = buildInterleavedDeck([listA, listB, listC], 4);

    expect(result.map((c) => c.id)).toEqual(["a1", "b1", "c1", "a2"]);
  });
});

describe("trimDeck", () => {
  const cards: SwipeCardData[] = [
    { id: "x", title: "X" },
    { id: "y", title: "Y" },
  ];

  it("removes consumed cards and reports exhaustion", () => {
    const { remaining, exhausted } = trimDeck(cards, 3);

    expect(remaining).toEqual([]);
    expect(exhausted).toBe(true);
  });

  it("returns the original deck when nothing is consumed", () => {
    const { remaining, exhausted } = trimDeck(cards, 0);

    expect(remaining).toBe(cards);
    expect(exhausted).toBe(false);
  });
});

describe("loadInitialSourceWeights", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to defaults when storage is empty", () => {
    expect(loadInitialSourceWeights()).toEqual({
      "for-you": 1,
      "from-friends": 1,
      trending: 1,
    });
  });

  it("reads persisted weights when present", () => {
    window.localStorage.setItem(
      "mn_swipe_source_weights_v1",
      JSON.stringify({ "for-you": 2.5, trending: 0.5 }),
    );

    expect(loadInitialSourceWeights()).toEqual({
      "for-you": 2.5,
      "from-friends": 1,
      trending: 0.5,
    });
  });
});
