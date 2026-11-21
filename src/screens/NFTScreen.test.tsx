import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("requests NFTs for the connected wallet address", async () => {
    const client = createMockClient();
    client.nft.getNfts = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSorokitState(client);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(client.nft.getNfts).toHaveBeenCalledWith(MOCK_ADDRESS);
    });
  });

  it("shows the connect prompt when the wallet is disconnected", () => {
    mockSorokitState(createMockClient(), {
      isConnected: false,
      address: null,
    });

    render(<NFTScreen />);

    expect(
      screen.getByText(/connect your wallet to view your nft collection/i),
    ).toBeInTheDocument();
  });

  describe("transfer flow", () => {
    const VALID_RECIPIENT = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
    const LONG_VALUE = `https://example.com/${"a".repeat(120)}/metadata.json`;

    const NFT = {
      id: "nft-1",
      tokenId: "1",
      contractId: "CABC",
      collectionId: "col-1",
      collectionName: "Cool Cats",
      owner: MOCK_ADDRESS,
      metadata: {
        name: "Cool Cat #1",
        description: "A cool cat",
        attributes: [{ traitType: "Source", value: LONG_VALUE }],
      },
      floorPrice: "100",
    };

    function setup(sendNft = vi.fn().mockResolvedValue({
      data: { successful: true, hash: "abc", ledger: 1 },
      error: null,
    })) {
      const client = createMockClient();
      client.nft.getNfts = vi.fn().mockResolvedValue({ data: [NFT], error: null });
      client.nft.sendNft = sendNft;
      mockSorokitState(client);
      render(<NFTScreen />);
      return sendNft;
    }

    async function openSendDialog() {
      await waitFor(() => screen.getByRole("button", { name: "Send Cool Cat #1" }));
      fireEvent.click(screen.getByRole("button", { name: "Send Cool Cat #1" }));
      await waitFor(() => screen.getByLabelText("Recipient address"));
    }


    it("disables the transfer button until a valid Stellar address is entered", async () => {
      setup();
      await openSendDialog();

      const sendButton = screen.getAllByRole("button", { name: /^send$/i }).at(-1)!;
      expect(sendButton).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Recipient address"), { target: { value: "not-an-address" } });
      expect(sendButton).toBeDisabled();
      expect(screen.getByText(/enter a valid stellar address/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Recipient address"), { target: { value: VALID_RECIPIENT } });
      expect(sendButton).toBeEnabled();
      expect(screen.queryByText(/enter a valid stellar address/i)).not.toBeInTheDocument();
    });

    it("does not invoke the contract for an invalid recipient", async () => {
      const sendNft = setup();
      await openSendDialog();

      fireEvent.change(screen.getByLabelText("Recipient address"), { target: { value: "GINVALID" } });
      const sendButton = screen.getAllByRole("button", { name: /^send$/i }).at(-1)!;
      fireEvent.click(sendButton);

      expect(sendNft).not.toHaveBeenCalled();
    });

    it("transfers the NFT to a valid recipient and shows success", async () => {
      const sendNft = setup();
      await openSendDialog();

      fireEvent.change(screen.getByLabelText("Recipient address"), {
        target: { value: `  ${VALID_RECIPIENT}  ` },
      });
      await act(async () => {
        fireEvent.click(screen.getAllByRole("button", { name: /^send$/i }).at(-1)!);
      });

      expect(sendNft).toHaveBeenCalledWith({
        tokenId: "1",
        contractId: "CABC",
        recipient: VALID_RECIPIENT,
        sourceAccount: MOCK_ADDRESS,
      });
      await waitFor(() => {
        expect(screen.getByText("NFT sent successfully")).toBeInTheDocument();
      });
    });

    it("shows the contract error when the transfer fails", async () => {
      const sendNft = setup(vi.fn().mockResolvedValue({ data: null, error: "Transfer rejected by contract" }));
      await openSendDialog();

      fireEvent.change(screen.getByLabelText("Recipient address"), { target: { value: VALID_RECIPIENT } });
      await act(async () => {
        fireEvent.click(screen.getAllByRole("button", { name: /^send$/i }).at(-1)!);
      });

      expect(sendNft).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Transfer rejected by contract");
      });
      expect(screen.queryByText("NFT sent successfully")).not.toBeInTheDocument();
    });

    it("wraps long trait values in the detail view instead of overflowing", async () => {
      setup();
      await waitFor(() => screen.getByRole("listitem"));
      fireEvent.click(screen.getByRole("listitem"));
      await waitFor(() => screen.getByRole("dialog", { name: /Cool Cat #1/i }));

      const value = screen.getByTestId("nft-trait-value");
      expect(value).toHaveTextContent(LONG_VALUE);
      expect(value.className).toMatch(/break-words|overflow-wrap/);
      expect(value.parentElement?.className).toMatch(/overflow-hidden/);
      expect(value.parentElement?.className).toMatch(/min-w-0/);
    });
  });
});
