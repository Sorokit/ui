import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

const CUSTOM_NETWORK: NetworkInfo = {
  name: "custom-net",
  rpcUrl: "http://custom-rpc:8000",
  passphrase: "Custom Network ; 2026",
  horizonUrl: "http://custom-horizon:8000",
};

describe("NetworkBanner", () => {
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
});
