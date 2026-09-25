import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { NetworkInfo } from "@/lib/client";

import { NetworkBanner } from "./NetworkBanner";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function mockNetwork(network: NetworkInfo | null) {
  vi.mocked(useSorokit).mockReturnValue({
    network,
  } as unknown as ReturnType<typeof useSorokit>);
}

const MAINNET_NETWORK: NetworkInfo = {
  name: "mainnet",
  rpcUrl: "https://soroban.stellar.org",
  passphrase: "Public Global Stellar Network ; September 2015",
  horizonUrl: "https://horizon.stellar.org",
};

const TESTNET_NETWORK: NetworkInfo = {
  name: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  passphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
};

const FUTURENET_NETWORK: NetworkInfo = {
  name: "futurenet",
  rpcUrl: "https://rpc-futurenet.stellar.org",
  passphrase: "Test SDF Future Network ; October 2022",
  horizonUrl: "https://horizon-futurenet.stellar.org",
};

const LOCALNET_NETWORK: NetworkInfo = {
  name: "localnet",
  rpcUrl: "http://localhost:8000/soroban/rpc",
  passphrase: "Standalone Network ; February 2017",
  horizonUrl: "http://localhost:8000",
};

const STANDALONE_NETWORK: NetworkInfo = {
  name: "standalone",
  rpcUrl: "http://localhost:8000/soroban/rpc",
  passphrase: "Standalone Network ; February 2017",
  horizonUrl: "http://localhost:8000",
};

const CUSTOM_NETWORK: NetworkInfo = {
  name: "custom-net",
  rpcUrl: "http://custom-rpc:8000",
  passphrase: "Custom Network ; 2026",
  horizonUrl: "http://custom-horizon:8000",
};

describe("NetworkBanner", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    document.documentElement.style.removeProperty("--banner-height");
  });

  it("renders nothing when network is null", () => {
    mockNetwork(null);
    const { container } = render(<NetworkBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when active section is 'network'", () => {
    mockNetwork(TESTNET_NETWORK);
    const { container } = render(<NetworkBanner active="network" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing on mainnet by default", () => {
    mockNetwork(MAINNET_NETWORK);
    const { container } = render(<NetworkBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a visible banner on testnet with the correct label and disclaimer", () => {
    mockNetwork(TESTNET_NETWORK);
    const { container } = render(<NetworkBanner />);

    expect(screen.getByText("Testnet")).toBeInTheDocument();
    expect(
      screen.getByText(/You are on/i),
    ).toHaveTextContent("You are on Testnet — transactions use test funds only");

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveClass("bg-orange");

    const textSpan = container.querySelector(".text-orange");
    expect(textSpan).toBeInTheDocument();
  });

  it("renders a visible banner on futurenet", () => {
    mockNetwork(FUTURENET_NETWORK);
    const { container } = render(<NetworkBanner />);

    expect(screen.getByText("Futurenet")).toBeInTheDocument();
    expect(
      screen.getByText(/You are on/i),
    ).toHaveTextContent("You are on Futurenet — transactions use test funds only");

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveClass("bg-purple");

    const textSpan = container.querySelector(".text-purple");
    expect(textSpan).toBeInTheDocument();
  });

  it("renders a visible banner on localnet", () => {
    mockNetwork(LOCALNET_NETWORK);
    const { container } = render(<NetworkBanner />);

    expect(screen.getByText("Localnet")).toBeInTheDocument();
    expect(
      screen.getByText(/You are on/i),
    ).toHaveTextContent("You are on Localnet — transactions use test funds only");

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveClass("bg-ink-3");
  });

  it("renders custom network name and test funds disclaimer for custom networks", () => {
    mockNetwork(CUSTOM_NETWORK);
    render(<NetworkBanner />);

    expect(screen.getByText("custom-net")).toBeInTheDocument();
    expect(
      screen.getByText(/You are on/i),
    ).toHaveTextContent("You are on custom-net — transactions use test funds only");
  });

  it("merges per-network config overrides with the defaults", () => {
    mockNetwork(TESTNET_NETWORK);
    render(
      <NetworkBanner config={{ testnet: { label: "Staging" } }} />,
    );
    expect(screen.getByText("Staging")).toBeInTheDocument();
    expect(screen.getByText(/test funds only/i)).toBeInTheDocument();
  });

  it("shows a generic non-mainnet banner for unknown networks", () => {
    mockNetwork({
      name: "private-testnet",
      rpcUrl: "http://private-rpc:8000",
      passphrase: "Private Test Network",
      horizonUrl: "http://private-horizon:8000",
    });
    render(<NetworkBanner />);
    expect(screen.getByText("private-testnet")).toBeInTheDocument();
    expect(screen.getByText(/test funds only/i)).toBeInTheDocument();
  });

  it("does not render when active section is 'network'", () => {
    mockNetwork(TESTNET_NETWORK);
    const { container } = render(
      <NetworkBanner active="network" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("merges custom className when supplied", () => {
    mockNetwork(TESTNET_NETWORK);
    const { container } = render(<NetworkBanner className="custom-banner-class" />);
    expect(container.firstChild).toHaveClass("custom-banner-class");
  });

  describe("Layout offset and positioning", () => {
    it("uses relative positioning by default to prevent overlapping top-level navigation", () => {
      mockNetwork(TESTNET_NETWORK);
      const { container } = render(<NetworkBanner />);
      expect(container.firstChild).toHaveClass("relative");
      expect(container.firstChild).not.toHaveClass("fixed");
    });

    it("supports sticky and fixed positioning strategies via position prop", () => {
      mockNetwork(TESTNET_NETWORK);
      const { container: stickyContainer } = render(
        <NetworkBanner position="sticky" />,
      );
      expect(stickyContainer.firstChild).toHaveClass("sticky");

      const { container: fixedContainer } = render(
        <NetworkBanner position="fixed" />,
      );
      expect(fixedContainer.firstChild).toHaveClass("fixed");
    });

    it("injects --banner-height CSS custom property on documentElement when rendered", () => {
      mockNetwork(TESTNET_NETWORK);
      render(<NetworkBanner />);
      const height = document.documentElement.style.getPropertyValue("--banner-height");
      expect(height).toBeTruthy();
      expect(height).toMatch(/^\d+px$/);
    });

    it("resets --banner-height to 0px when unmounted", () => {
      mockNetwork(TESTNET_NETWORK);
      const { unmount } = render(<NetworkBanner />);
      expect(document.documentElement.style.getPropertyValue("--banner-height")).not.toBe("0px");

      unmount();
      expect(document.documentElement.style.getPropertyValue("--banner-height")).toBe("0px");
    });
  });

  describe("Session dismiss behavior", () => {
    it("renders dismiss button by default", () => {
      mockNetwork(TESTNET_NETWORK);
      render(<NetworkBanner />);
      expect(
        screen.getByRole("button", { name: /dismiss banner/i }),
      ).toBeInTheDocument();
    });

    it("hides banner and persists to sessionStorage when dismiss button is clicked", () => {
      mockNetwork(TESTNET_NETWORK);
      const onDismiss = vi.fn();
      render(<NetworkBanner onDismiss={onDismiss} />);

      const button = screen.getByRole("button", { name: /dismiss banner/i });
      fireEvent.click(button);

      expect(screen.queryByText("Testnet")).not.toBeInTheDocument();
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.getItem("sorokit-banner-dismissed-testnet")).toBe("true");
      expect(document.documentElement.style.getPropertyValue("--banner-height")).toBe("0px");
    });

    it("does not render when banner has been dismissed in current session", () => {
      window.sessionStorage.setItem("sorokit-banner-dismissed-testnet", "true");
      mockNetwork(TESTNET_NETWORK);
      const { container } = render(<NetworkBanner />);

      expect(container).toBeEmptyDOMElement();
      expect(document.documentElement.style.getPropertyValue("--banner-height")).toBe("0px");
    });

    it("supports custom storageKey for session dismissal", () => {
      mockNetwork(TESTNET_NETWORK);
      render(<NetworkBanner storageKey="custom-dismiss-key" />);

      const button = screen.getByRole("button", { name: /dismiss banner/i });
      fireEvent.click(button);

      expect(window.sessionStorage.getItem("custom-dismiss-key")).toBe("true");
    });

    it("does not render dismiss button when dismissible is false", () => {
      mockNetwork(TESTNET_NETWORK);
      render(<NetworkBanner dismissible={false} />);
      expect(
        screen.queryByRole("button", { name: /dismiss banner/i }),
      ).not.toBeInTheDocument();
    });

    it("dismissing one network does not dismiss another network in same session", () => {
      window.sessionStorage.setItem("sorokit-banner-dismissed-testnet", "true");
      mockNetwork(FUTURENET_NETWORK);
      render(<NetworkBanner />);

      expect(screen.getByText("Futurenet")).toBeInTheDocument();
    });
  });

  describe("Standalone mode and configurable colors", () => {
    it("renders standalone network banner with default Standalone label", () => {
      mockNetwork(STANDALONE_NETWORK);
      render(<NetworkBanner />);

      expect(screen.getByText("Standalone")).toBeInTheDocument();
      expect(
        screen.getByText(/transactions use test funds only/i),
      ).toBeInTheDocument();
    });

    it("supports configurable background and border colors via direct props", () => {
      mockNetwork(STANDALONE_NETWORK);
      const { container } = render(
        <NetworkBanner
          backgroundColor="#1e293b"
          borderColor="#334155"
          textColor="#f8fafc"
          dotColor="#38bdf8"
        />,
      );

      const banner = container.firstChild as HTMLElement;
      expect(banner.style.backgroundColor).toBe("rgb(30, 41, 59)");
      expect(banner.style.borderColor).toBe("rgb(51, 65, 85)");

      const dot = screen.getByTestId("network-banner-dot");
      expect(dot.style.backgroundColor).toBe("rgb(56, 189, 248)");
    });

    it("supports configurable colors and labels via config prop for standalone and localnet", () => {
      mockNetwork(STANDALONE_NETWORK);
      const { container } = render(
        <NetworkBanner
          config={{
            standalone: {
              label: "Private Sandbox",
              backgroundColor: "#0f172a",
              borderColor: "#1e293b",
            },
          }}
        />,
      );

      expect(screen.getByText("Private Sandbox")).toBeInTheDocument();
      const banner = container.firstChild as HTMLElement;
      expect(banner.style.backgroundColor).toBe("rgb(15, 23, 42)");
      expect(banner.style.borderColor).toBe("rgb(30, 41, 59)");
    });
  });
});
