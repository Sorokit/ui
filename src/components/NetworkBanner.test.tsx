import { screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { renderWithProvider } from "@/__tests__/utils";
import type { NetworkInfo, NetworkName } from "@/lib/client";
import { createMockClient } from "@/lib/mock-client";

import { NetworkBanner } from "./NetworkBanner";

function networkInfo(name: NetworkName): NetworkInfo {
  return {
    name,
    passphrase: `${name} passphrase`,
    rpcUrl: `https://${name}.example/rpc`,
    horizonUrl: `https://${name}.example/horizon`,
  };
}

function clientWithNetwork(name: NetworkName | null) {
  const client = createMockClient();
  client.network.getNetwork = vi.fn().mockResolvedValue({
    data: name ? networkInfo(name) : null,
    error: null,
  });
  return client;
}

function renderWithNetwork(name: NetworkName | null, ui = <NetworkBanner />) {
  const client = clientWithNetwork(name);
  return {
    client,
    ...renderWithProvider(ui, { client }),
  };
}

describe("NetworkBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when network is null", async () => {
    const { client, container } = renderWithNetwork(null);
    await waitFor(() => {
      expect(client.network.getNetwork).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden on mainnet by default (alwaysShow = false)", async () => {
    const { container } = renderWithNetwork("mainnet");
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("shows on mainnet when alwaysShow is true", async () => {
    renderWithNetwork("mainnet", <NetworkBanner alwaysShow />);
    expect(await screen.findByText(/mainnet/i)).toBeInTheDocument();
  });

  it("renders the testnet banner by default", async () => {
    renderWithNetwork("testnet");
    expect(await screen.findByText(/testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/test funds only/i)).toBeInTheDocument();
  });

  it("applies orange styling for testnet", async () => {
    const { container } = renderWithNetwork("testnet");
    // The dot span should carry the testnet orange class
    await waitFor(() => {
      expect(container.querySelector(".bg-orange")).toBeInTheDocument();
    });
  });

  it("renders the futurenet banner by default", async () => {
    renderWithNetwork("futurenet");
    expect(await screen.findByText(/futurenet/i)).toBeInTheDocument();
  });

  it("applies purple styling for futurenet", async () => {
    const { container } = renderWithNetwork("futurenet");
    await waitFor(() => {
      expect(container.querySelector(".bg-purple")).toBeInTheDocument();
    });
  });

  it("renders the localnet banner by default", async () => {
    renderWithNetwork("localnet");
    expect(await screen.findByText(/localnet/i)).toBeInTheDocument();
  });

  it("accepts a custom className", async () => {
    const { container } = renderWithNetwork(
      "testnet",
      <NetworkBanner className="my-class" />,
    );
    await waitFor(() => {
      const banner = container.firstElementChild;
      expect(banner?.classList.contains("my-class")).toBe(true);
    });
  });
});
