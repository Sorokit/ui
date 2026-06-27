import { render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { NetworkSwitcher } from "./NetworkSwitcher";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

// Radix DropdownMenu.Portal renders into document.body by default.
// Mock it to render inline so RTL assertions can find the content.
vi.mock("@radix-ui/react-dropdown-menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radix-ui/react-dropdown-menu")>();
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("NetworkSwitcher", () => {
  let switchNetwork: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    switchNetwork = vi.fn().mockResolvedValue(undefined);
  });

  it("displays the active network label in the trigger button", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: { name: "mainnet" },
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    expect(screen.getByRole("button", { name: /mainnet/i })).toBeInTheDocument();
  });

  it("falls back to Testnet label when network is null", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: null,
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    expect(screen.getByRole("button", { name: /testnet/i })).toBeInTheDocument();
  });

  it("applies the orange dot class for testnet", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: { name: "testnet" },
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    const { container } = render(<NetworkSwitcher />);
    // The trigger button contains a coloured dot span
    const triggerButton = container.querySelector("button");
    expect(triggerButton?.querySelector(".bg-orange")).toBeInTheDocument();
  });

  it("applies the green dot class for mainnet", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: { name: "mainnet" },
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    const { container } = render(<NetworkSwitcher />);
    const triggerButton = container.querySelector("button");
    expect(triggerButton?.querySelector(".bg-green")).toBeInTheDocument();
  });

  it("applies the purple dot class for futurenet", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: { name: "futurenet" },
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    const { container } = render(<NetworkSwitcher />);
    const triggerButton = container.querySelector("button");
    expect(triggerButton?.querySelector(".bg-purple")).toBeInTheDocument();
  });
});
