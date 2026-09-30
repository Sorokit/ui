import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { createMockClient, MOCK_ADDRESS } from "@/lib/mock-client";

import { NFTScreen } from "./NFTScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("NFTScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSorokitState(client = createMockClient(), overrides = {}) {
    vi.mocked(useSorokit).mockReturnValue({
      address: MOCK_ADDRESS,
      isConnected: true,
      client,
      ...overrides,
    } as ReturnType<typeof useSorokit>);
  }

  it("renders the screen title and gallery heading", () => {
    mockSorokitState();
    render(<NFTScreen />);
    expect(screen.getAllByRole("heading", { name: "NFT Gallery" })).toHaveLength(2);
    expect(screen.getByText("Browse and manage your NFT collection")).toBeInTheDocument();
  });

  it("shows the gallery loading state while NFTs are fetched", async () => {
    const loadingClient = createMockClient();
    loadingClient.nft.getNfts = vi.fn().mockReturnValue(new Promise(() => {}));
    mockSorokitState(loadingClient);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("nft-loading-skeleton")).toBeInTheDocument();
    });
  });

  it("shows the gallery error state when loading NFTs fails", async () => {
    const errorClient = createMockClient();
    errorClient.nft.getNfts = vi.fn().mockResolvedValue({
      data: null,
      error: "Network failure",
    });
    mockSorokitState(errorClient);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network failure");
    });
  });

  it("shows the gallery empty state when no NFTs are found", async () => {
    const emptyClient = createMockClient();
    emptyClient.nft.getNfts = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSorokitState(emptyClient);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(screen.getByText(/no nfts found in this wallet/i)).toBeInTheDocument();
    });
  });

  it("shows the gallery success state when NFTs are loaded", async () => {
    const successClient = createMockClient();
    successClient.nft.getNfts = vi.fn().mockResolvedValue({
      data: [
        {
          id: "nft-1",
          tokenId: "1",
          contractId: "CABC",
          collectionId: "col-1",
          collectionName: "Cool Cats",
          owner: "GABC",
          metadata: {
            name: "Cool Cat #1",
            description: "A cool cat",
            image: "https://example.com/cat1.png",
            attributes: [],
          },
          floorPrice: "100",
        },
      ],
      error: null,
    });
    mockSorokitState(successClient);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(1);
    });
  });
});
