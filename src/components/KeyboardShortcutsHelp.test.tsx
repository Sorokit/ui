import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";

describe("KeyboardShortcutsHelp", () => {
  it("opens from the help button and lists the available shortcuts", () => {
    render(<KeyboardShortcutsHelp />);

    fireEvent.click(screen.getByRole("button", { name: /keyboard shortcuts/i }));

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Open this keyboard shortcuts guide")).toBeInTheDocument();
    expect(screen.getByText("Open the network selector")).toBeInTheDocument();
    expect(screen.getByText("Alt+N")).toBeInTheDocument();
  });

  it("opens the help dialog with the ? keyboard shortcut", () => {
    render(<KeyboardShortcutsHelp />);

    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("does not intercept ? while the user is typing", () => {
    render(
      <>
        <input aria-label="Search" />
        <KeyboardShortcutsHelp />
      </>,
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search" }), {
      key: "?",
      shiftKey: true,
    });

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });
});
