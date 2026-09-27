import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { NFTScreen } from "./NFTScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    getClient: vi.fn(),
  };
});

const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

describe("NFTScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the screen title and gallery heading", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NFTScreen />);

    expect(screen.getAllByRole("heading", { name: "NFT Gallery" })).toHaveLength(2);
    expect(screen.getByText("Browse and manage your NFT collection")).toBeInTheDocument();
  });

  it("shows the gallery loading state while NFTs are fetched", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: VALID_ADDRESS,
      isConnected: true,
      get client() {
        return getClient();
      },
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      nft: { getNfts: vi.fn().mockReturnValue(new Promise(() => {})) },
    } as unknown as ReturnType<typeof getClient>);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("nft-loading-skeleton")).toBeInTheDocument();
    });
  });

  it("shows the gallery error state when loading NFTs fails", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: VALID_ADDRESS,
      isConnected: true,
      get client() {
        return getClient();
      },
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      nft: {
        getNfts: vi.fn().mockResolvedValue({ data: null, error: "Network failure" }),
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<NFTScreen />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network failure");
    });
  });
});
