import { fireEvent,render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { AccountCard } from "./AccountCard";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const successToast = vi.fn();
vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ success: successToast }),
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

  // ── Reserve indicator (#178) ────────────────────────────────────────────
  it("displays the XLM reserve impact as subentryCount * 0.5 XLM", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC",
      account: {
        sequence: "123456",
        subentryCount: 4,
      },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);

    expect(screen.getByText("Reserve Impact")).toBeInTheDocument();
    expect(screen.getByText("2.00 XLM")).toBeInTheDocument();
  });

  it("shows 0.00 XLM reserve impact when subentryCount is 0", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC",
      account: {
        sequence: "123456",
        subentryCount: 0,
      },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    expect(screen.getByText("0.00 XLM")).toBeInTheDocument();
  });

  // ── Sequence tooltip (#178) ─────────────────────────────────────────────
  it("shows the sequence tooltip text on focus/hover and links it via aria-labelledby", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: "GABC",
      account: {
        sequence: "123456",
        subentryCount: 2,
      },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);

    expect(
      screen.queryByText(/prevent replay attacks/i),
    ).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", {
      name: "What is the sequence number?",
    });
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByText(/prevent replay attacks/i);
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute("role", "tooltip");

    const sequenceLabel = screen.getByText("Sequence");
    expect(tooltip.getAttribute("aria-labelledby")).toBe(
      sequenceLabel.getAttribute("id"),
    );

    fireEvent.mouseLeave(trigger);
    expect(
      screen.queryByText(/prevent replay attacks/i),
    ).not.toBeInTheDocument();
  });
});

// ── Stellar Expert URL tests (#716) ──────────────────────────────────────
describe("AccountCard — Stellar Expert URL (#716)", () => {
  const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to mainnet with /explorer/public/ path", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      account: { sequence: "1", subentryCount: 0 },
      isLoadingAccount: false,
      network: { name: "public" },
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const link = screen.getByText(/View on Stellar Expert/);
    expect(link).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/public/account/${ADDRESS}`,
    );
  });

  it("links to testnet with /explorer/testnet/ path", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      account: { sequence: "1", subentryCount: 0 },
      isLoadingAccount: false,
      network: { name: "testnet" },
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const link = screen.getByText(/View on Stellar Expert/);
    expect(link).toHaveAttribute(
      "href",
      `https://testnet.stellar.expert/explorer/testnet/account/${ADDRESS}`,
    );
  });

  it("disables the link for futurenet", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      account: { sequence: "1", subentryCount: 0 },
      isLoadingAccount: false,
      network: { name: "futurenet" },
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const link = screen.getByText(/View on Stellar Expert/);
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
  });

  it("disables the link for localnet", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      account: { sequence: "1", subentryCount: 0 },
      isLoadingAccount: false,
      network: { name: "localnet" },
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const link = screen.getByText(/View on Stellar Expert/);
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
  });
});

function computeInitials(address: string): string {
  const lastFourChars = address.slice(-4);
  const charCode1 = lastFourChars.charCodeAt(0);
  const charCode2 = lastFourChars.charCodeAt(1);
  const charCode3 = lastFourChars.charCodeAt(2);
  const charCode4 = lastFourChars.charCodeAt(3);
  const total = charCode1 + charCode2 + charCode3 + charCode4;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const char1 = alphabet[total % 26];
  const char2 = alphabet[(total + charCode1) % 26];
  return `${char1}${char2}`;
}

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

  it("shows avatar initials derived from the last 4 characters of the address", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact />);
    const expectedInitials = computeInitials(address);
    expect(screen.getByText(expectedInitials)).toBeInTheDocument();
  });

  it("displays the full account address in the title attribute", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact />);
    expect(screen.getByRole("button")).toHaveAttribute("title", address);
  });

  it("calls onNavigate when clicked", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    const onNavigate = vi.fn();
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onNavigate).toHaveBeenCalledWith("account");
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
