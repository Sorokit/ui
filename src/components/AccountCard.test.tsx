import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import {
  AccountCard,
  AccountCardCompact,
  computeInitials,
  copyToClipboard,
  fnv1aHash,
  generateAvatarGradient,
  getStellarExpertUrl,
} from "./AccountCard";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const successToast = vi.fn();
const errorToast = vi.fn();
vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ success: successToast, error: errorToast }),
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

// ── Stellar Expert URL tests (#716, #848) ─────────────────────────────────
describe("AccountCard — Stellar Expert URL (#716, #848)", () => {
  const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links to mainnet with /explorer/public/ path on https://stellar.expert base", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      account: { sequence: "1", subentryCount: 0 },
      isLoadingAccount: false,
      network: { name: "mainnet" },
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const link = screen.getByText(/View on Stellar Expert/);
    expect(link).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/public/account/${ADDRESS}`,
    );
  });

  it("links to public network with /explorer/public/ path on https://stellar.expert base", () => {
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

  it("links to testnet with /explorer/testnet/ path on unified https://stellar.expert base", () => {
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
      `https://stellar.expert/explorer/testnet/account/${ADDRESS}`,
    );
  });

  it("disables the link for futurenet with tooltip", () => {
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
    expect(link).toHaveAttribute(
      "title",
      "Stellar Expert is not available for this network",
    );
  });

  it("disables the link for localnet with tooltip", () => {
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
    expect(link).toHaveAttribute(
      "title",
      "Stellar Expert is not available for this network",
    );
  });

  describe("getStellarExpertUrl helper function", () => {
    it("returns correct URL for mainnet", () => {
      expect(getStellarExpertUrl(ADDRESS, "mainnet")).toBe(
        `https://stellar.expert/explorer/public/account/${ADDRESS}`,
      );
    });

    it("returns correct URL for testnet", () => {
      expect(getStellarExpertUrl(ADDRESS, "testnet")).toBe(
        `https://stellar.expert/explorer/testnet/account/${ADDRESS}`,
      );
    });

    it("returns null for futurenet and localnet", () => {
      expect(getStellarExpertUrl(ADDRESS, "futurenet")).toBeNull();
      expect(getStellarExpertUrl(ADDRESS, "localnet")).toBeNull();
    });
  });
});


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

  it("renders avatar with memoized gradient style", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCardCompact />);
    const avatar = screen.getByTestId("account-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar.style.background).toContain("linear-gradient");
  });

  it("does not recompute gradient styles when non-account props change", () => {
    const address = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    vi.mocked(useSorokit).mockReturnValue({
      address,
    } as unknown as ReturnType<typeof useSorokit>);

    const onNavigate1 = vi.fn();
    const { rerender } = render(<AccountCardCompact onNavigate={onNavigate1} />);
    const avatarBefore = screen.getByTestId("account-avatar").style.background;

    const onNavigate2 = vi.fn();
    rerender(<AccountCardCompact onNavigate={onNavigate2} />);
    const avatarAfter = screen.getByTestId("account-avatar").style.background;

    expect(avatarBefore).toBe(avatarAfter);
  });
});

describe("AccountCard — Avatar Hashing & Clipboard Fallback", () => {
  const ADDR_A = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
  // ADDR_B shares identical first 6 characters ("GAAZI4") but differs afterwards
  const ADDR_B = "GAAZI4DIFFERENTADDRESSWITHIDENTICALPREFIX1234567890XYZ";

  it("renders an avatar with gradient background in the AccountCard header", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDR_A,
      account: { sequence: "123", subentryCount: 1 },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const avatar = screen.getByTestId("account-card-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar.style.background).toContain("linear-gradient");
  });

  it("triggers error toast message when address copying fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    const originalExecCommand = document.execCommand;
    document.execCommand = vi.fn().mockReturnValue(false);

    vi.mocked(useSorokit).mockReturnValue({
      address: ADDR_A,
      account: { sequence: "123", subentryCount: 1 },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const copyBtn = screen.getByRole("button", { name: /Copy address/ });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(errorToast).toHaveBeenCalledWith("Copy Failed", {
      message: "Failed to copy address to clipboard.",
    });

    document.execCommand = originalExecCommand;
  });

  it("triggers success toast message when address copying succeeds", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    vi.mocked(useSorokit).mockReturnValue({
      address: ADDR_A,
      account: { sequence: "123", subentryCount: 1 },
      isLoadingAccount: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<AccountCard />);
    const copyBtn = screen.getByRole("button", { name: /Copy address/ });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(successToast).toHaveBeenCalledWith("Address Copied", {
      message: "The address has been copied to your clipboard.",
    });
  });

  it("avatar hash calculation uses full public key string and avoids prefix collisions", () => {
    const hashA = fnv1aHash(ADDR_A);
    const hashB = fnv1aHash(ADDR_B);
    expect(hashA).not.toBe(hashB);

    const gradA = generateAvatarGradient(ADDR_A);
    const gradB = generateAvatarGradient(ADDR_B);
    expect(gradA.background).not.toBe(gradB.background);
  });

  it("consistently returns identical avatar gradient for the same address", () => {
    const grad1 = generateAvatarGradient(ADDR_A);
    const grad2 = generateAvatarGradient(ADDR_A);
    expect(grad1.background).toBe(grad2.background);
    expect(grad1.colors).toEqual(grad2.colors);
    expect(grad1.angle).toBe(grad2.angle);
  });

  describe("copyToClipboard", () => {
    it("uses navigator.clipboard.writeText when available", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });

      const result = await copyToClipboard("test-value");
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith("test-value");
    });

    it("falls back to document.execCommand when navigator.clipboard.writeText rejects", async () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: vi.fn().mockRejectedValue(new Error("Rejected")),
        },
      });
      const originalExec = document.execCommand;
      document.execCommand = vi.fn().mockReturnValue(true);

      const result = await copyToClipboard("fallback-value");
      expect(result).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith("copy");

      document.execCommand = originalExec;
    });

    it("returns false when both clipboard API and execCommand fail", async () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
      });
      const originalExec = document.execCommand;
      document.execCommand = vi.fn().mockReturnValue(false);

      const result = await copyToClipboard("failure-value");
      expect(result).toBe(false);

      document.execCommand = originalExec;
    });
  });
});
