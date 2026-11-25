import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecoveryGuide } from "./RecoveryGuide";

describe("RecoveryGuide", () => {
  it("opens step-by-step instructions", () => {
    render(<RecoveryGuide />);
    expect(screen.queryByText("Review and sign the XDR")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open guide" }));
    expect(screen.getByText("Review and sign the XDR")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(7);
  });

  it("opens external resources safely in a new tab", () => {
    render(<RecoveryGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Open guide" }));
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
