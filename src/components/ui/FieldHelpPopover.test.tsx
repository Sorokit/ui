import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldHelpPopover } from "./FieldHelpPopover";

describe("FieldHelpPopover", () => {
  it("opens from the question-mark button and closes on a second click", () => {
    render(
      <FieldHelpPopover label="Slippage tolerance">
        <p>Example: 0.5% accepts a small change in quoted output.</p>
      </FieldHelpPopover>,
    );

    const trigger = screen.getByRole("button", { name: "Help: Slippage tolerance" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Example: 0.5%");

    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dismisses with Escape and when the user clicks outside", () => {
    render(
      <>
        <FieldHelpPopover label="Reserve">Example: keep enough XLM for fees.</FieldHelpPopover>
        <button type="button">Outside</button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Help: Reserve" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Help: Reserve" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
