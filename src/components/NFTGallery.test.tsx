import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { Nft } from "@/lib/client";
import { getClient } from "@/lib/client";

import { NFTCard, NFTGallery } from "./NFTGallery";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

function makeNft(overrides: Partial<Nft> = {}): Nft {
  return {
    id: "nft-1",
    tokenId: "1",
    contractId: "CABC",
    collectionId: "col-1",
    collectionName: "Cool Cats",
    owner: VALID_ADDRESS,
    metadata: {
      name: "Cool Cat #1",
      description: "A cool cat",
      image: "https://example.com/cat1.png",
      attributes: [
        { traitType: "Background", value: "Blue", rarityPct: 10 },
        { traitType: "Eyes", value: "Laser", rarityPct: 2 },
      ],
    },
    floorPrice: "100",
    rarityRank: 50,
    collectionSize: 1000,
    ...overrides,
  };
}

function makeConnectedContext(extra = {}) {
  return {
    address: VALID_ADDRESS,
    isConnected: true, get client() { return getClient(); },
    ...extra,
  } as unknown as ReturnType<typeof useSorokit>;
}

function makeClient(getNftsResult = { data: [], error: null }, extra = {}) {
  return {
    nft: {
      getNfts: vi.fn().mockResolvedValue(getNftsResult),
      sendNft: vi.fn().mockResolvedValue({ data: { successful: true, hash: "abc", ledger: 1 }, error: null }),
      listNftForSale: vi.fn().mockResolvedValue({ data: { successful: true, hash: "def", ledger: 2 }, error: null }),
      ...extra,
    },
  };
}

// ─── NFTCard ──────────────────────────────────────────────────────────────────

describe("NFTCard", () => {
  const onSelect = vi.fn();
  const onSend = vi.fn();
  const onList = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("renders NFT name, collection, and rarity badge", () => {
    render(
      <NFTCard
        nft={makeNft()}
        selected={false}
        bulkMode={false}
        onSelect={onSelect}
        onSend={onSend}
        onList={onList}
      />
    );
    expect(screen.getByText("Cool Cat #1")).toBeInTheDocument();
    expect(screen.getByText("Cool Cats")).toBeInTheDocument();
    // rank 50/1000 = 5% → Legendary
    expect(screen.getByText("Legendary")).toBeInTheDocument();
  });

  it("shows floor price when present", () => {
    render(
      <NFTCard
        nft={makeNft({ floorPrice: "250" })}
        selected={false}
        bulkMode={false}
        onSelect={onSelect}
        onSend={onSend}
        onList={onList}
      />
    );
    expect(screen.getByText("250 XLM")).toBeInTheDocument();
  });

  it("does not render floor price row when absent", () => {
    render(
      <NFTCard
        nft={makeNft({ floorPrice: undefined })}
        selected={false}
        bulkMode={false}
        onSelect={onSelect}
        onSend={onSend}
        onList={onList}
      />
    );
    expect(screen.queryByText(/XLM/)).not.toBeInTheDocument();
  });

  it("shows rarity rank when present", () => {
    render(
      <NFTCard
        nft={makeNft({ rarityRank: 5, collectionSize: 1000 })}
        selected={false}
        bulkMode={false}
        onSelect={onSelect}
        onSend={onSend}
        onList={onList}
      />
    );
    expect(screen.getByText("#5 / 1000")).toBeInTheDocument();
  });

  it("renders trait values and rarity percentages", () => {
    render(
      <NFTCard
        nft={makeNft()}
        selected={false}
        bulkMode={false}
        onSelect={onSelect}
        onSend={onSend}
        onList={onList}
      />
    );
    expect(screen.getAllByText("Blue")[0]).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("Laser")).toBeInTheDocument();
    expect(screen.getByText("2%")).toBeInTheDocument();
  });

  it("shows +N overflow badge when more than 3 traits", () => {
    const nft = makeNft({
      metadata: {
        name: "Trait Heavy",
        attributes: [
          { traitType: "A", value: "1" },
          { traitType: "B", value: "2" },
          { traitType: "C", value: "3" },
          { traitType: "D", value: "4" },
          { traitType: "E", value: "5" },
        ],
      },
    });
    render(
      <NFTCard nft={nft} selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders NFT image when image URL present", () => {
    render(
      <NFTCard nft={makeNft()} selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    const img = screen.getByAltText("Cool Cat #1");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/cat1.png");
  });

  it("shows placeholder when no image", () => {
    render(
      <NFTCard
        nft={makeNft({ metadata: { name: "No Img", attributes: [], image: undefined } })}
        selected={false}
        bulkMode={false}
        onSelect={onSelect}
        onSend={onSend}
        onList={onList}
      />
    );
    expect(screen.getByText("No image")).toBeInTheDocument();
  });

  it("shows placeholder on image load error", () => {
    render(
      <NFTCard nft={makeNft()} selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    const img = screen.getByAltText("Cool Cat #1");
    fireEvent.error(img);
    expect(screen.getByText("No image")).toBeInTheDocument();
  });

  it("invokes onSend when Send button clicked", () => {
    const nft = makeNft();
    render(
      <NFTCard nft={nft} selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    fireEvent.click(screen.getByRole("button", { name: /send cool cat #1/i }));
    expect(onSend).toHaveBeenCalledWith(nft);
  });

  it("invokes onList when List button clicked", () => {
    const nft = makeNft();
    render(
      <NFTCard nft={nft} selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    fireEvent.click(screen.getByRole("button", { name: /list cool cat #1 for sale/i }));
    expect(onList).toHaveBeenCalledWith(nft);
  });

  it("hides Send/List buttons in bulk mode and shows checkbox", () => {
    render(
      <NFTCard nft={makeNft()} selected={false} bulkMode={true} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    expect(screen.queryByRole("button", { name: /send cool cat #1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /list/i })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /select cool cat #1/i })).toBeInTheDocument();
  });

  it("checkbox is checked when selected=true in bulk mode", () => {
    render(
      <NFTCard nft={makeNft()} selected={true} bulkMode={true} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    const checkbox = screen.getByRole("checkbox", { name: /select cool cat #1/i });
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("calls onSelect with nft.id when card clicked in bulk mode", () => {
    const nft = makeNft();
    render(
      <NFTCard nft={nft} selected={false} bulkMode={true} onSelect={onSelect} onSend={onSend} onList={onList} />
    );
    fireEvent.click(screen.getByRole("article"));
    expect(onSelect).toHaveBeenCalledWith("nft-1");
  });

  // ── Rarity label variants ──────────────────────────────────────────────────

  it("labels as Legendary when rank is ≤5% of collection", () => {
    render(
      <NFTCard
        nft={makeNft({ rarityRank: 1, collectionSize: 100 })}
        selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList}
      />
    );
    expect(screen.getByText("Legendary")).toBeInTheDocument();
  });

  it("labels as Epic when rank is between 5–15%", () => {
    render(
      <NFTCard
        nft={makeNft({ rarityRank: 10, collectionSize: 100 })}
        selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList}
      />
    );
    expect(screen.getByText("Epic")).toBeInTheDocument();
  });

  it("labels as Rare when rank is between 15–35%", () => {
    render(
      <NFTCard
        nft={makeNft({ rarityRank: 20, collectionSize: 100 })}
        selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList}
      />
    );
    expect(screen.getAllByText("Rare")[0]).toBeInTheDocument();
  });

  it("labels as Common when no rank info", () => {
    render(
      <NFTCard
        nft={makeNft({ rarityRank: undefined, collectionSize: undefined })}
        selected={false} bulkMode={false} onSelect={onSelect} onSend={onSend} onList={onList}
      />
    );
    expect(screen.getByText("Common")).toBeInTheDocument();
  });
});

// ─── NFTGallery — wallet not connected ───────────────────────────────────────

describe("NFTGallery — not connected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);
  });

  it("shows connect-wallet prompt when not connected", () => {
    render(<NFTGallery />);
    expect(screen.getByText(/connect your wallet to view your nft collection/i)).toBeInTheDocument();
  });

  it("renders the NFT Gallery heading", () => {
    render(<NFTGallery />);
    expect(screen.getByRole("heading", { name: /nft gallery/i })).toBeInTheDocument();
  });

  it("does not render the search bar when not connected", () => {
    render(<NFTGallery />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});

// ─── NFTGallery — connected, loading ─────────────────────────────────────────

describe("NFTGallery — loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    // Never resolves during these tests — stays in loading
    vi.mocked(getClient).mockReturnValue({
      nft: { getNfts: vi.fn().mockReturnValue(new Promise(() => {})) },
    } as unknown as ReturnType<typeof getClient>);
  });

  it("shows loading skeleton while fetching", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.getByTestId("nft-loading-skeleton")).toBeInTheDocument();
    });
  });
});

// ─── NFTGallery — connected, error ───────────────────────────────────────────

describe("NFTGallery — fetch error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: null, error: "Network failure" }) as unknown as ReturnType<typeof getClient>
    );
  });

  it("shows error message on fetch failure", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network failure");
    });
  });
});

// ─── NFTGallery — connected, empty ───────────────────────────────────────────

describe("NFTGallery — empty collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: [], error: null }) as unknown as ReturnType<typeof getClient>
    );
  });

  it("shows empty state when no NFTs", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.getByText(/no nfts found in this wallet/i)).toBeInTheDocument();
    });
  });

  it("does not show Select button with empty collection", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^select$/i })).not.toBeInTheDocument();
    });
  });
});

// ─── NFTGallery — connected, with NFTs ───────────────────────────────────────

const NFT_1 = makeNft({ id: "nft-1", collectionId: "col-1", collectionName: "Cool Cats", metadata: { name: "Cool Cat #1", attributes: [], image: undefined } });
const NFT_2 = makeNft({ id: "nft-2", tokenId: "2", collectionId: "col-1", collectionName: "Cool Cats", metadata: { name: "Cool Cat #2", attributes: [], image: undefined } });
const NFT_3 = makeNft({ id: "nft-3", tokenId: "3", collectionId: "col-2", collectionName: "Mutant Apes", metadata: { name: "Mutant Ape #1", attributes: [], image: undefined }, rarityRank: 1, collectionSize: 10 });

describe("NFTGallery — with NFTs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: [NFT_1, NFT_2, NFT_3], error: null }) as unknown as ReturnType<typeof getClient>
    );
  });

  it("renders all NFT cards", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(3);
    });
  });

  it("shows count summary in header", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.getByText(/3 nfts across 2 collections/i)).toBeInTheDocument();
    });
  });

  it("shows collection tabs when multiple collections present", async () => {
    render(<NFTGallery />);
    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: /collections/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /cool cats/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /mutant apes/i })).toBeInTheDocument();
    });
  });

  it("filters to a single collection when tab clicked", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("tab", { name: /cool cats/i }));
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(2);
      expect(screen.queryByText("Mutant Ape #1")).not.toBeInTheDocument();
    });
  });

  it("shows All tab that restores full list", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    // filter down first
    fireEvent.click(screen.getByRole("tab", { name: /cool cats/i }));
    // then back to all
    fireEvent.click(screen.getByRole("tab", { name: /^all/i }));
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(3);
    });
  });
});

// ─── NFTGallery — search ──────────────────────────────────────────────────────

describe("NFTGallery — search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: [NFT_1, NFT_2, NFT_3], error: null }) as unknown as ReturnType<typeof getClient>
    );
  });

  it("filters cards by NFT name search", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search nfts/i }), {
      target: { value: "Mutant" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(1);
      expect(screen.getByText("Mutant Ape #1")).toBeInTheDocument();
    });
  });

  it("filters by collection name", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search nfts/i }), {
      target: { value: "Cool Cats" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(2);
    });
  });

  it("shows no-match message when search yields no results", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search nfts/i }), {
      target: { value: "zzznomatch" },
    });
    await waitFor(() => {
      expect(screen.getByText(/no nfts match your filters/i)).toBeInTheDocument();
    });
  });
});

// ─── NFTGallery — filters ─────────────────────────────────────────────────────

describe("NFTGallery — filters panel", () => {
  const NFT_LEGENDARY = makeNft({ id: "l1", rarityRank: 1, collectionSize: 100, floorPrice: "500", metadata: { name: "Legendary One", attributes: [], image: undefined } });
  const NFT_COMMON    = makeNft({ id: "c1", rarityRank: undefined, collectionSize: undefined, floorPrice: "50", metadata: { name: "Common One", attributes: [], image: undefined } });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: [NFT_LEGENDARY, NFT_COMMON], error: null }) as unknown as ReturnType<typeof getClient>
    );
  });

  async function openFilters() {
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    await waitFor(() => screen.getByTestId("filter-panel"));
  }

  it("toggles filter panel visibility", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    expect(screen.queryByTestId("filter-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    expect(screen.getByTestId("filter-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    expect(screen.queryByTestId("filter-panel")).not.toBeInTheDocument();
  });

  it("filters by rarity — Legendary", async () => {
    render(<NFTGallery />);
    await openFilters();
    fireEvent.change(screen.getByRole("combobox", { name: /filter by rarity/i }), {
      target: { value: "legendary" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(1);
      expect(screen.getByText("Legendary One")).toBeInTheDocument();
    });
  });

  it("filters by minimum floor price", async () => {
    render(<NFTGallery />);
    await openFilters();
    fireEvent.change(screen.getByRole("spinbutton", { name: /minimum floor price/i }), {
      target: { value: "200" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(1);
      expect(screen.getByText("Legendary One")).toBeInTheDocument();
    });
  });

  it("filters by maximum floor price", async () => {
    render(<NFTGallery />);
    await openFilters();
    fireEvent.change(screen.getByRole("spinbutton", { name: /maximum floor price/i }), {
      target: { value: "100" },
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("nft-card")).toHaveLength(1);
      expect(screen.getByText("Common One")).toBeInTheDocument();
    });
  });

  it("sorts by name (default)", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    const cards = screen.getAllByTestId("nft-card");
    expect(cards[0]).toHaveTextContent("Common One");
    expect(cards[1]).toHaveTextContent("Legendary One");
  });

  it("sorts by rarity rank", async () => {
    render(<NFTGallery />);
    await openFilters();
    fireEvent.change(screen.getByRole("combobox", { name: /sort nfts/i }), {
      target: { value: "rarity" },
    });
    await waitFor(() => {
      const cards = screen.getAllByTestId("nft-card");
      // rank 1 comes before rank Infinity (undefined)
      expect(cards[0]).toHaveTextContent("Legendary One");
    });
  });

  it("sorts by floor price descending", async () => {
    render(<NFTGallery />);
    await openFilters();
    fireEvent.change(screen.getByRole("combobox", { name: /sort nfts/i }), {
      target: { value: "floor" },
    });
    await waitFor(() => {
      const cards = screen.getAllByTestId("nft-card");
      expect(cards[0]).toHaveTextContent("Legendary One"); // floor 500
      expect(cards[1]).toHaveTextContent("Common One"); // floor 50
    });
  });
});

// ─── NFTGallery — bulk mode ───────────────────────────────────────────────────

describe("NFTGallery — bulk mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: [NFT_1, NFT_2, NFT_3], error: null }) as unknown as ReturnType<typeof getClient>
    );
  });

  it("enters bulk mode on Select button click", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bulk send/i })).toBeInTheDocument();
  });

  it("exits bulk mode on Cancel", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^select$/i })).toBeInTheDocument();
  });

  it("Select all selects all displayed cards", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    await waitFor(() => {
      expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
    });
  });

  it("Deselect all clears selection", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    await waitFor(() => screen.getByText(/3 selected/i));
    fireEvent.click(screen.getByRole("button", { name: /deselect all/i }));
    await waitFor(() => {
      expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    });
  });

  it("Bulk send button is disabled when nothing selected", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    expect(screen.getByRole("button", { name: /bulk send/i })).toBeDisabled();
  });

  it("opens bulk send dialog when Bulk send clicked with selection", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    await waitFor(() => screen.getByText(/3 selected/i));
    fireEvent.click(screen.getByRole("button", { name: /bulk send/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /bulk send/i })).toBeInTheDocument();
    });
  });
});

// ─── NFTGallery — send dialog ─────────────────────────────────────────────────

describe("NFTGallery — Send NFT dialog", () => {
  const mockSendNft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    mockSendNft.mockResolvedValue({ data: { successful: true, hash: "tx1", ledger: 1 }, error: null });
    vi.mocked(getClient).mockReturnValue({
      nft: {
        getNfts: vi.fn().mockResolvedValue({ data: [NFT_1], error: null }),
        sendNft: mockSendNft,
        listNftForSale: vi.fn(),
      },
    } as unknown as ReturnType<typeof getClient>);
  });

  async function openSendDialog() {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /send cool cat #1/i }));
    await waitFor(() => screen.getByRole("dialog", { name: /send nft/i }));
  }

  it("opens Send dialog with NFT name shown", async () => {
    await openSendDialog();
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getAllByText("Cool Cat #1").length).toBeGreaterThan(0);
  });

  it("shows validation error when recipient is empty", async () => {
    await openSendDialog();
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => {
      expect(screen.getByText(/recipient address is required/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid address format", async () => {
    await openSendDialog();
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: "BADINVALID" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid stellar address/i)).toBeInTheDocument();
    });
  });

  it("calls sendNft with correct params on valid submit", async () => {
    await openSendDialog();
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: VALID_ADDRESS },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    });
    await waitFor(() => {
      expect(mockSendNft).toHaveBeenCalledWith({
        tokenId: NFT_1.tokenId,
        contractId: NFT_1.contractId,
        recipient: VALID_ADDRESS,
        sourceAccount: VALID_ADDRESS,
      });
    });
  });

  it("shows success state after send", async () => {
    await openSendDialog();
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: VALID_ADDRESS },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/nft sent successfully/i)).toBeInTheDocument();
    });
  });

  it("shows error from API response", async () => {
    mockSendNft.mockResolvedValue({ data: null, error: "Insufficient balance" });
    await openSendDialog();
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: VALID_ADDRESS },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Insufficient balance");
    });
  });

  it("closes dialog on Cancel", async () => {
    await openSendDialog();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /send nft/i })).not.toBeInTheDocument();
    });
  });
});

// ─── NFTGallery — list for sale dialog ───────────────────────────────────────

describe("NFTGallery — List for Sale dialog", () => {
  const mockListNft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    mockListNft.mockResolvedValue({ data: { successful: true, hash: "tx2", ledger: 2 }, error: null });
    vi.mocked(getClient).mockReturnValue({
      nft: {
        getNfts: vi.fn().mockResolvedValue({ data: [NFT_1], error: null }),
        sendNft: vi.fn(),
        listNftForSale: mockListNft,
      },
    } as unknown as ReturnType<typeof getClient>);
  });

  async function openListDialog() {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /list cool cat #1 for sale/i }));
    await waitFor(() => screen.getByRole("dialog", { name: /list for sale/i }));
  }

  it("opens List dialog showing NFT name and floor price", async () => {
    await openListDialog();
    expect(screen.getAllByText(/cool cat #1/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/100 xlm/i)[0]).toBeInTheDocument();
  });

  it("shows validation error when price is empty", async () => {
    await openListDialog();
    fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid price in xlm/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for zero price", async () => {
    await openListDialog();
    fireEvent.change(screen.getByLabelText(/listing price/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid price in xlm/i)).toBeInTheDocument();
    });
  });

  it("calls listNftForSale with correct params", async () => {
    await openListDialog();
    fireEvent.change(screen.getByLabelText(/listing price/i), { target: { value: "200" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));
    });
    await waitFor(() => {
      expect(mockListNft).toHaveBeenCalledWith({
        tokenId: NFT_1.tokenId,
        contractId: NFT_1.contractId,
        price: "200",
        sourceAccount: VALID_ADDRESS,
      });
    });
  });

  it("shows success state after listing", async () => {
    await openListDialog();
    fireEvent.change(screen.getByLabelText(/listing price/i), { target: { value: "200" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));
    });
    await waitFor(() => {
      expect(screen.getByText(/nft listed successfully/i)).toBeInTheDocument();
    });
  });

  it("shows API error in list dialog", async () => {
    mockListNft.mockResolvedValue({ data: null, error: "Marketplace unavailable" });
    await openListDialog();
    fireEvent.change(screen.getByLabelText(/listing price/i), { target: { value: "200" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Marketplace unavailable");
    });
  });
});

// ─── NFTGallery — detail dialog ───────────────────────────────────────────────

describe("NFTGallery — NFT Detail dialog", () => {
  const NFT_FULL = makeNft({
    id: "detail-1",
    metadata: {
      name: "Detail Cat",
      description: "A detailed NFT",
      image: undefined,
      attributes: [
        { traitType: "Eyes", value: "Laser", rarityPct: 5 },
        { traitType: "Fur", value: "Gold", rarityPct: 1 },
      ],
    },
    floorPrice: "300",
    rarityRank: 10,
    collectionSize: 500,
    userValuation: "350",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    vi.mocked(getClient).mockReturnValue(
      makeClient({ data: [NFT_FULL], error: null }) as unknown as ReturnType<typeof getClient>
    );
  });

  it("opens detail dialog on card click", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("listitem"));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /Detail Cat/i })).toBeInTheDocument();
    });
  });

  it("shows description, floor price, rarity rank, and valuation in detail", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("listitem"));
    await waitFor(() => screen.getByRole("dialog", { name: /Detail Cat/i }));
    expect(screen.getByText("A detailed NFT")).toBeInTheDocument();
    expect(screen.getAllByText("300 XLM")[0]).toBeInTheDocument();
    expect(screen.getAllByText("#10 / 500")[0]).toBeInTheDocument();
    expect(screen.getAllByText("350 XLM")[0]).toBeInTheDocument();
  });

  it("shows all trait types and rarities in detail", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("listitem"));
    await waitFor(() => screen.getByRole("dialog", { name: /Detail Cat/i }));
    expect(screen.getByText("Eyes")).toBeInTheDocument();
    expect(screen.getByText("5.0% have this")).toBeInTheDocument();
    expect(screen.getByText("Fur")).toBeInTheDocument();
    expect(screen.getByText("1.0% have this")).toBeInTheDocument();
  });

  it("closes detail dialog on Close button", async () => {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("listitem"));
    await waitFor(() => screen.getByRole("dialog", { name: /Detail Cat/i }));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Detail Cat/i })).not.toBeInTheDocument();
    });
  });
});

// ─── NFTGallery — bulk send dialog ───────────────────────────────────────────

describe("NFTGallery — Bulk Send dialog", () => {
  const mockSendNft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(makeConnectedContext());
    mockSendNft.mockResolvedValue({ data: { successful: true, hash: "t1", ledger: 1 }, error: null });
    vi.mocked(getClient).mockReturnValue({
      nft: {
        getNfts: vi.fn().mockResolvedValue({ data: [NFT_1, NFT_2], error: null }),
        sendNft: mockSendNft,
        listNftForSale: vi.fn(),
      },
    } as unknown as ReturnType<typeof getClient>);
  });

  async function openBulkSendDialog() {
    render(<NFTGallery />);
    await waitFor(() => screen.getAllByTestId("nft-card"));
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    await waitFor(() => screen.getByText(/2 selected/i));
    fireEvent.click(screen.getByRole("button", { name: /bulk send/i }));
    await waitFor(() => screen.getByRole("dialog", { name: /bulk send/i }));
  }

  it("shows correct NFT count in dialog title", async () => {
    await openBulkSendDialog();
    expect(screen.getByText(/bulk send \(2 nfts\)/i)).toBeInTheDocument();
  });

  it("shows validation error for empty recipient", async () => {
    await openBulkSendDialog();
    fireEvent.click(screen.getByRole("button", { name: /send all/i }));
    await waitFor(() => {
      expect(screen.getByText(/recipient address is required/i)).toBeInTheDocument();
    });
  });

  it("calls sendNft for each selected NFT", async () => {
    await openBulkSendDialog();
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: VALID_ADDRESS },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send all/i }));
    });
    await waitFor(() => {
      expect(mockSendNft).toHaveBeenCalledTimes(2);
    });
  });

  it("shows error when one send fails", async () => {
    mockSendNft.mockResolvedValueOnce({ data: null, error: "Tx failed" });
    await openBulkSendDialog();
    fireEvent.change(screen.getByLabelText(/recipient address/i), {
      target: { value: VALID_ADDRESS },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send all/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Tx failed/);
    });
  });
});

// ─── exports smoke test ───────────────────────────────────────────────────────

describe("NFTGallery exports", () => {
  it("exports NFTCard and NFTGallery as named exports", async () => {
    const mod = await import("./NFTGallery");
    expect(mod.NFTCard).toBeDefined();
    expect(mod.NFTGallery).toBeDefined();
  });
});
