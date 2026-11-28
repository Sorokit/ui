import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NotificationEntry } from "@/context/ToastContext";

import { NotificationHistory } from "./NotificationHistory";

const items: NotificationEntry[] = [
  { id: "1", type: "error", title: "Payment failed", timestamp: 1_700_000_000_000, read: false },
  { id: "2", type: "success", title: "Payment sent", timestamp: 1_700_000_100_000, read: true },
];

describe("NotificationHistory", () => {
  it("shows a timestamp on each notification", () => {
    const { container } = render(
      <NotificationHistory notifications={items} onDismiss={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container.querySelectorAll("time")).toHaveLength(2);
  });

  it("filters by type", () => {
    render(<NotificationHistory notifications={items} onDismiss={vi.fn()} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Errors" }));
    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.queryByText("Payment sent")).not.toBeInTheDocument();
  });

  it("dismisses one and clears all", () => {
    const onDismiss = vi.fn();
    const onClear = vi.fn();
    render(<NotificationHistory notifications={items} onDismiss={onDismiss} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification: Payment sent" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onDismiss).toHaveBeenCalledWith("2");
    expect(onClear).toHaveBeenCalledOnce();
  });
});
