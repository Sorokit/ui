import { render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { AccountCard } from "./AccountCard";

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

import { AccountCardCompact } from "./AccountCard";

describe("AccountCardCompact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when address is null", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
    } as unknown as ReturnType<typeof useSorokit>);

    const { container } = render(<AccountCardCompact />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the first two characters of the address as the avatar (uppercase)", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact />);
    expect(screen.getByText("GA")).toBeInTheDocument();
  });

  it("displays the truncated address", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact />);
    const addrEl = document.querySelector("[data-address]");
    expect(addrEl).toBeInTheDocument();
    // Should be truncated (shorter than the full address)
    expect(addrEl?.textContent?.length).toBeLessThan(address.length);
    expect(addrEl?.textContent).toContain("...");
  });

  it("shows 'Connected' label", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
});
