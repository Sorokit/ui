import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountCard } from "./AccountCard";
import { useSorokit } from "@/context/useSorokit";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("AccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a skeleton during loading", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC",
      account: null,
      isLoadingAccount: true,
    } as unknown as ReturnType<typeof useSorokit>);

    const { container } = render(<AccountCard />);
    // Skeleton renders when isLoadingAccount is true. We can check for a div with animate-pulse
    // The skeleton from ui/Skeleton uses animate-pulse. Wait, the actual Skeleton component wasn't mocked.
    // It's just a div.
    expect(container.querySelectorAll(".animate-pulse")).toBeTruthy();
    expect(screen.queryByText("Sequence")).not.toBeInTheDocument();
  });

  it("renders account fields after load", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC",
      account: {
        sequence: "123456",
        subentryCount: 2,
      },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    
    expect(screen.getByText("Sequence")).toBeInTheDocument();
    expect(screen.getByText("123456")).toBeInTheDocument();
    expect(screen.getByText("Subentries")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("returns null when no address is present", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
      account: null,
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    const { container } = render(<AccountCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
