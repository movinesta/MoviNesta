import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import SegmentedControl from "./SegmentedControl";

const segments = [
  { key: "one", label: "One" },
  { key: "two", label: "Two" },
  { key: "three", label: "Three" },
] as const;

type SegmentKey = (typeof segments)[number]["key"];

const StatefulSegmentedControl = () => {
  const [active, setActive] = useState<SegmentKey>(segments[0].key);

  return (
    <SegmentedControl
      segments={segments}
      active={active}
      ariaLabel="Demo tabs"
      idPrefix="demo-tab"
      getPanelId={(key) => `demo-tabpanel-${key}`}
      onChange={setActive}
    />
  );
};

describe("SegmentedControl", () => {
  it("exposes accessible tab semantics", () => {
    render(<StatefulSegmentedControl />);

    const tablist = screen.getByRole("tablist", { name: "Demo tabs" });
    expect(tablist).toHaveAttribute("aria-orientation", "horizontal");

    const [tabOne] = screen.getAllByRole("tab", { name: "One" });
    const [tabTwo] = screen.getAllByRole("tab", { name: "Two" });
    const [tabThree] = screen.getAllByRole("tab", { name: "Three" });

    expect(tabOne).toHaveAttribute("id", "demo-tab-one");
    expect(tabTwo).toHaveAttribute("aria-controls", "demo-tabpanel-two");
    expect(tabThree).toHaveAttribute("aria-controls", "demo-tabpanel-three");
  });

  it("supports roving focus with arrow keys", async () => {
    render(<StatefulSegmentedControl />);
    const user = userEvent.setup();

    const [tabOne] = screen.getAllByRole("tab", { name: "One" });
    const [tabTwo] = screen.getAllByRole("tab", { name: "Two" });

    tabOne.focus();
    expect(tabOne).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(tabTwo).toHaveAttribute("aria-selected", "true");
    expect(tabTwo).toHaveFocus();

    await user.keyboard("{End}");
    const [tabThree] = screen.getAllByRole("tab", { name: "Three" });
    expect(tabThree).toHaveAttribute("aria-selected", "true");
    expect(tabThree).toHaveFocus();
  });
});
