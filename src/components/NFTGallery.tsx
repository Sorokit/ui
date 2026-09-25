/**
 * NFTGallery — displays a user's NFT collection with grid view,
 * collection filtering, search, trait/rarity display, floor pricing,
 * send/list-for-sale dialogs, and bulk operations. (#278)
 */

import {
  Album01Icon,
  Cancel01Icon,
  FilterIcon,
  Search01Icon,
  SentIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import type { Nft, NftCollection } from "@/lib/client";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Group a flat Nft[] into NftCollection[] keyed by collectionId. */
function groupByCollection(nfts: Nft[]): NftCollection[] {
  const map = new Map<string, NftCollection>();
  for (const nft of nfts) {
    const existing = map.get(nft.collectionId);
    if (existing) {
      existing.nfts.push(nft);
    } else {
      map.set(nft.collectionId, {
        id: nft.collectionId,
        name: nft.collectionName,
        contractId: nft.contractId,
        floorPrice: nft.floorPrice,
        nfts: [nft],
      });
    }
  }
  return Array.from(map.values());
}

/** Rarity label derived from rank/size or trait rarities. */
function rarityLabel(nft: Nft): { label: string; variant: "error" | "warning" | "primary" | "default" } {
  if (nft.rarityRank && nft.collectionSize) {
    const pct = (nft.rarityRank / nft.collectionSize) * 100;
    if (pct <= 5) return { label: "Legendary", variant: "error" };
    if (pct <= 15) return { label: "Epic", variant: "warning" };
    if (pct <= 35) return { label: "Rare", variant: "primary" };
  }
  return { label: "Common", variant: "default" };
}

const ALL_COLLECTION_ID = "__all__";

// ─── NFTCard ──────────────────────────────────────────────────────────────────

interface NFTCardProps {
  nft: Nft;
  selected: boolean;
  bulkMode: boolean;
  onSelect: (id: string) => void;
  onSend: (nft: Nft) => void;
  onList: (nft: Nft) => void;
}

export function NFTCard({ nft, selected, bulkMode, onSelect, onSend, onList }: NFTCardProps) {
  const [imgError, setImgError] = useState(false);
  const rarity = rarityLabel(nft);
  const hasImage = !!nft.metadata.image && !imgError;

  return (
    <article
      aria-label={`NFT: ${nft.metadata.name}`}
      data-testid="nft-card"
      className={cn(
        "relative rounded-xl border bg-surface overflow-hidden flex flex-col transition-all duration-150",
        "focus-within:ring-1 focus-within:ring-brand",
        selected ? "border-brand ring-1 ring-brand" : "border-line hover:border-line-2",
        bulkMode && "cursor-pointer",
      )}
      onClick={bulkMode ? () => onSelect(nft.id) : undefined}
    >
      {/* Bulk select checkbox */}
      {bulkMode && (
        <div className="absolute top-2 left-2 z-10">
          <div
            aria-checked={selected}
            role="checkbox"
            aria-label={`Select ${nft.metadata.name}`}
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
              selected ? "bg-brand border-brand" : "bg-surface border-line-2",
            )}
          >
            {selected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Image */}
      <div className="aspect-square w-full bg-surface-2 flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <img
            src={nft.metadata.image}
            alt={nft.metadata.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-4">
            <HugeiconsIcon icon={Album01Icon} size={32} color="currentColor" strokeWidth={1} />
            <span className="text-[10px]">No image</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-ink truncate">{nft.metadata.name}</p>
            <p className="text-[10px] text-ink-4 truncate">{nft.collectionName}</p>
          </div>
          <Badge variant={rarity.variant} className="shrink-0 text-[9px] px-1.5 py-0.5">
            {rarity.label}
          </Badge>
        </div>

        {/* Floor price */}
        {nft.floorPrice && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ink-4 uppercase tracking-wider">Floor</span>
            <span className="text-[11px] font-semibold text-ink tabular-nums">{nft.floorPrice} XLM</span>
          </div>
        )}

        {/* Rarity rank */}
        {nft.rarityRank && nft.collectionSize && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ink-4 uppercase tracking-wider">Rank</span>
            <span className="text-[11px] text-ink-2 tabular-nums">#{nft.rarityRank} / {nft.collectionSize}</span>
          </div>
        )}

        {/* Top traits (up to 3) */}
        {nft.metadata.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {nft.metadata.attributes.slice(0, 3).map((attr) => (
              <span
                key={attr.traitType}
                title={attr.rarityPct !== undefined ? `${attr.rarityPct.toFixed(1)}% have this trait` : attr.traitType}
                className="inline-flex items-center rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[9px] text-ink-3"
              >
                {attr.value}
                {attr.rarityPct !== undefined && (
                  <span className="ml-1 text-brand font-semibold">{attr.rarityPct.toFixed(0)}%</span>
                )}
              </span>
            ))}
            {nft.metadata.attributes.length > 3 && (
              <span className="inline-flex items-center rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-[9px] text-ink-4">
                +{nft.metadata.attributes.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action buttons (hidden in bulk mode) */}
        {!bulkMode && (
          <div className="flex gap-1.5 mt-auto pt-1">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-[11px] h-7 px-2"
              onClick={(e) => { e.stopPropagation(); onSend(nft); }}
              aria-label={`Send ${nft.metadata.name}`}
            >
              <HugeiconsIcon icon={SentIcon} size={11} color="currentColor" strokeWidth={1.5} />
              Send
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-[11px] h-7 px-2"
              onClick={(e) => { e.stopPropagation(); onList(nft); }}
              aria-label={`List ${nft.metadata.name} for sale`}
            >
              <HugeiconsIcon icon={Tag01Icon} size={11} color="currentColor" strokeWidth={1.5} />
              List
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── SendNftDialog ─────────────────────────────────────────────────────────────

interface SendNftDialogProps {
  nft: Nft | null;
  open: boolean;
  onClose: () => void;
}

function SendNftDialog({ nft, open, onClose }: SendNftDialogProps) {
  const { address, client } = useSorokit();
  const [recipient, setRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setRecipient("");
      setRecipientError("");
      setLoading(false);
      setSuccess(false);
      setTxError(null);
    }
  }

  const validate = () => {
    if (!recipient.trim()) { setRecipientError("Recipient address is required"); return false; }
    if (!recipient.trim().startsWith("G") || recipient.trim().length < 56) {
      setRecipientError("Enter a valid Stellar address (starts with G, 56 chars)");
      return false;
    }
    setRecipientError("");
    return true;
  };

  const handleSend = async () => {
    if (!nft || !address || !client || !validate()) return;
    setLoading(true);
    setTxError(null);
    try {
      const { data, error } = await client.nft.sendNft({
        tokenId: nft.tokenId,
        contractId: nft.contractId,
        recipient: recipient.trim(),
        sourceAccount: address,
      });
      if (error) { setTxError(error); return; }
      if (data?.successful) setSuccess(true);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl p-6 focus:outline-none animate-in fade-in zoom-in-95"
          aria-describedby="send-nft-desc"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[14px] font-semibold text-ink">
              Send NFT
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Close">
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>

          {nft && (
            <p id="send-nft-desc" className="text-[12px] text-ink-3 mb-4">
              Sending <span className="font-semibold text-ink">{nft.metadata.name}</span> from{" "}
              <span className="font-semibold text-ink">{nft.collectionName}</span>
            </p>
          )}

          {success ? (
            <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-10 h-10 rounded-full bg-success-dim flex items-center justify-center">
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <path d="M1.5 7L6.5 12L16.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-ink">NFT sent successfully</p>
              <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                label="Recipient address"
                placeholder="GABC…"
                value={recipient}
                error={recipientError}
                onChange={(e) => { setRecipient(e.target.value); setRecipientError(""); }}
              />
              {txError && (
                <p role="alert" className="text-[12px] text-red">{txError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button size="md" className="flex-1" loading={loading} onClick={() => void handleSend()}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── ListForSaleDialog ────────────────────────────────────────────────────────

interface ListForSaleDialogProps {
  nft: Nft | null;
  open: boolean;
  onClose: () => void;
}

function ListForSaleDialog({ nft, open, onClose }: ListForSaleDialogProps) {
  const { address, client } = useSorokit();
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setPrice("");
      setPriceError("");
      setLoading(false);
      setSuccess(false);
      setTxError(null);
    }
  }

  const validate = () => {
    const n = parseFloat(price);
    if (!price.trim() || isNaN(n) || n <= 0) {
      setPriceError("Enter a valid price in XLM (greater than 0)");
      return false;
    }
    setPriceError("");
    return true;
  };

  const handleList = async () => {
    if (!nft || !address || !client || !validate()) return;
    setLoading(true);
    setTxError(null);
    try {
      const { data, error } = await client.nft.listNftForSale({
        tokenId: nft.tokenId,
        contractId: nft.contractId,
        price: price.trim(),
        sourceAccount: address,
      });
      if (error) { setTxError(error); return; }
      if (data?.successful) setSuccess(true);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl p-6 focus:outline-none animate-in fade-in zoom-in-95"
          aria-describedby="list-nft-desc"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[14px] font-semibold text-ink">List for Sale</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Close">
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>

          {nft && (
            <p id="list-nft-desc" className="text-[12px] text-ink-3 mb-4">
              List <span className="font-semibold text-ink">{nft.metadata.name}</span> on the marketplace.
              {nft.floorPrice && (
                <> Floor price is <span className="font-semibold text-ink">{nft.floorPrice} XLM</span>.</>
              )}
            </p>
          )}

          {success ? (
            <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-10 h-10 rounded-full bg-success-dim flex items-center justify-center">
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <path d="M1.5 7L6.5 12L16.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-ink">NFT listed successfully</p>
              <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                label="Listing price (XLM)"
                placeholder="e.g. 150"
                type="number"
                min="0"
                step="0.01"
                value={price}
                error={priceError}
                onChange={(e) => { setPrice(e.target.value); setPriceError(""); }}
              />
              {txError && (
                <p role="alert" className="text-[12px] text-red">{txError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button size="md" className="flex-1" loading={loading} onClick={() => void handleList()}>
                  List for sale
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── BulkSendDialog ───────────────────────────────────────────────────────────

interface BulkSendDialogProps {
  nfts: Nft[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function BulkSendDialog({ nfts, open, onClose, onSuccess }: BulkSendDialogProps) {
  const { address, client } = useSorokit();
  const [recipient, setRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [txError, setTxError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setRecipient("");
      setRecipientError("");
      setLoading(false);
      setProgress(0);
      setTxError(null);
    }
  }

  useEffect(() => {
    if (!open) {
      abortRef.current = false;
    }
  }, [open]);

  const validate = () => {
    if (!recipient.trim()) { setRecipientError("Recipient address is required"); return false; }
    if (!recipient.trim().startsWith("G") || recipient.trim().length < 56) {
      setRecipientError("Enter a valid Stellar address");
      return false;
    }
    setRecipientError("");
    return true;
  };

  const handleBulkSend = async () => {
    if (!address || !client || !validate()) return;
    setLoading(true);
    setTxError(null);
    abortRef.current = false;
    for (let i = 0; i < nfts.length; i++) {
      if (abortRef.current) break;
      try {
        const { error } = await client.nft.sendNft({
          tokenId: nfts[i].tokenId,
          contractId: nfts[i].contractId,
          recipient: recipient.trim(),
          sourceAccount: address,
        });
        if (error) { setTxError(`Failed on ${nfts[i].metadata.name}: ${error}`); break; }
      } catch (e) {
        setTxError(e instanceof Error ? e.message : "Unknown error");
        break;
      }
      setProgress(i + 1);
    }
    setLoading(false);
    if (!abortRef.current && !txError) onSuccess();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-line bg-surface shadow-2xl p-6 focus:outline-none animate-in fade-in zoom-in-95"
          aria-describedby="bulk-send-desc"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[14px] font-semibold text-ink">
              Bulk Send ({nfts.length} NFTs)
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Close">
                <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </div>
          <p id="bulk-send-desc" className="text-[12px] text-ink-3 mb-4">
            Send all {nfts.length} selected NFTs to the same recipient.
          </p>
          <div className="flex flex-col gap-4">
            <Input
              label="Recipient address"
              placeholder="GABC…"
              value={recipient}
              error={recipientError}
              disabled={loading}
              onChange={(e) => { setRecipient(e.target.value); setRecipientError(""); }}
            />
            {loading && (
              <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-ink-3">
                  <span>Sending…</span>
                  <span>{progress} / {nfts.length}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-300"
                    style={{ width: `${(progress / nfts.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {txError && <p role="alert" className="text-[12px] text-red">{txError}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="md" className="flex-1" loading={loading} onClick={() => void handleBulkSend()}>
                Send all
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── NFTDetailDialog ──────────────────────────────────────────────────────────

interface NFTDetailDialogProps {
  nft: Nft | null;
  open: boolean;
  onClose: () => void;
  onSend: (nft: Nft) => void;
  onList: (nft: Nft) => void;
}

function NFTDetailDialog({ nft, open, onClose, onSend, onList }: NFTDetailDialogProps) {
  const [imgError, setImgError] = useState(false);
  if (!nft) return null;
  const rarity = rarityLabel(nft);
  const hasImage = !!nft.metadata.image && !imgError;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-line bg-surface shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 overflow-y-auto max-h-[90vh]"
          aria-label={`NFT detail: ${nft.metadata.name}`}
        >
          {/* Image */}
          <div className="aspect-square w-full bg-surface-2 overflow-hidden">
            {hasImage ? (
              <img src={nft.metadata.image} alt={nft.metadata.name} onError={() => setImgError(true)} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-4">
                <HugeiconsIcon icon={Album01Icon} size={48} color="currentColor" strokeWidth={0.8} />
              </div>
            )}
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Dialog.Title className="text-[16px] font-semibold text-ink">{nft.metadata.name}</Dialog.Title>
                <p className="text-[12px] text-ink-4 mt-0.5">{nft.collectionName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rarity.variant}>{rarity.label}</Badge>
                <Dialog.Close asChild>
                  <button type="button" className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Close">
                    <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {nft.metadata.description && (
              <p className="text-[12px] text-ink-3 leading-relaxed">{nft.metadata.description}</p>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {nft.floorPrice && (
                <StatCell label="Floor price" value={`${nft.floorPrice} XLM`} />
              )}
              {nft.rarityRank && nft.collectionSize && (
                <StatCell label="Rarity rank" value={`#${nft.rarityRank} / ${nft.collectionSize}`} />
              )}
              {nft.userValuation && (
                <StatCell label="Your valuation" value={`${nft.userValuation} XLM`} />
              )}
            </div>

            {/* Attributes */}
            {nft.metadata.attributes.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-2">
                  Traits
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {nft.metadata.attributes.map((attr) => (
                    <div key={attr.traitType} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-4">{attr.traitType}</p>
                      <p className="text-[12px] font-semibold text-ink mt-0.5">{attr.value}</p>
                      {attr.rarityPct !== undefined && (
                        <p className="text-[10px] text-brand">{attr.rarityPct.toFixed(1)}% have this</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="md" className="flex-1" onClick={() => { onClose(); onSend(nft); }}>
                <HugeiconsIcon icon={SentIcon} size={13} color="currentColor" strokeWidth={1.5} />
                Send
              </Button>
              <Button variant="secondary" size="md" className="flex-1" onClick={() => { onClose(); onList(nft); }}>
                <HugeiconsIcon icon={Tag01Icon} size={13} color="currentColor" strokeWidth={1.5} />
                List for sale
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-4">{label}</span>
      <span className="text-[12px] font-semibold text-ink tabular-nums">{value}</span>
    </div>
  );
}

// ─── NFTGallery (main) ────────────────────────────────────────────────────────

export interface NFTGalleryProps {
  className?: string;
}

type SortKey = "name" | "rarity" | "floor";
type RarityFilter = "all" | "legendary" | "epic" | "rare" | "common";

export function NFTGallery({ className }: NFTGalleryProps) {
  const { address, isConnected, client } = useSorokit();

  // ── Data state ────────────────────────────────────────────────────────────
  const [allNfts, setAllNfts] = useState<Nft[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Filter / search state ─────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [activeCollection, setActiveCollection] = useState(ALL_COLLECTION_ID);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [minFloor, setMinFloor] = useState("");
  const [maxFloor, setMaxFloor] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection state ───────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [sendTarget, setSendTarget] = useState<Nft | null>(null);
  const [listTarget, setListTarget] = useState<Nft | null>(null);
  const [detailTarget, setDetailTarget] = useState<Nft | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);

  // ── Fetch NFTs ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!address || !client) return;
    let active = true;
    const timerId = window.setTimeout(() => {
      setLoading(true);
      client
        .nft.getNfts(address)
        .then(({ data, error }) => {
          if (!active) return;
          if (error) { setFetchError(error); return; }
          setAllNfts(data ?? []);
          setFetchError(null);
        })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timerId); };
  }, [address, client]);

  // ── Derived collections ───────────────────────────────────────────────────
  const collections = useMemo(() => groupByCollection(allNfts), [allNfts]);

  // ── Filtered & sorted NFTs ────────────────────────────────────────────────
  const displayedNfts = useMemo(() => {
    let nfts = activeCollection === ALL_COLLECTION_ID
      ? allNfts
      : allNfts.filter((n) => n.collectionId === activeCollection);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      nfts = nfts.filter(
        (n) =>
          n.metadata.name.toLowerCase().includes(q) ||
          n.collectionName.toLowerCase().includes(q),
      );
    }

    if (rarityFilter !== "all") {
      nfts = nfts.filter((n) => {
        const { label } = rarityLabel(n);
        return label.toLowerCase() === rarityFilter;
      });
    }

    if (minFloor) {
      const min = parseFloat(minFloor);
      if (!isNaN(min)) nfts = nfts.filter((n) => n.floorPrice ? parseFloat(n.floorPrice) >= min : false);
    }
    if (maxFloor) {
      const max = parseFloat(maxFloor);
      if (!isNaN(max)) nfts = nfts.filter((n) => n.floorPrice ? parseFloat(n.floorPrice) <= max : false);
    }

    return [...nfts].sort((a, b) => {
      if (sortKey === "rarity") {
        return (a.rarityRank ?? Infinity) - (b.rarityRank ?? Infinity);
      }
      if (sortKey === "floor") {
        return (parseFloat(b.floorPrice ?? "0")) - (parseFloat(a.floorPrice ?? "0"));
      }
      return a.metadata.name.localeCompare(b.metadata.name);
    });
  }, [allNfts, activeCollection, search, rarityFilter, minFloor, maxFloor, sortKey]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === displayedNfts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedNfts.map((n) => n.id)));
    }
  }, [selectedIds.size, displayedNfts]);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectedNfts = useMemo(
    () => allNfts.filter((n) => selectedIds.has(n.id)),
    [allNfts, selectedIds],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line gap-3 flex-wrap">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">NFT Gallery</h2>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {isConnected
              ? allNfts.length > 0
                ? `${allNfts.length} NFT${allNfts.length !== 1 ? "s" : ""} across ${collections.length} collection${collections.length !== 1 ? "s" : ""}`
                : "Your NFT collection"
              : "Connect your wallet to view NFTs"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="w-4 h-4 border border-ink-3 border-t-transparent rounded-full animate-spin" />
          )}
          {isConnected && !bulkMode && allNfts.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setBulkMode(true)}>
              Select
            </Button>
          )}
          {bulkMode && (
            <>
              <span className="text-[12px] text-ink-3">{selectedIds.size} selected</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setBulkSendOpen(true)}
              >
                <HugeiconsIcon icon={SentIcon} size={12} color="currentColor" strokeWidth={1.5} />
                Bulk send
              </Button>
              <Button variant="ghost" size="sm" onClick={exitBulkMode}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-16">
          Connect your wallet to view your NFT collection
        </p>
      ) : fetchError ? (
        <p role="alert" className="text-[13px] text-red text-center py-16">{fetchError}</p>
      ) : (
        <>
          {/* ── Search & filter bar ─────────────────────────────────────── */}
          <div className="px-5 py-3 border-b border-line flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"
                />
                <input
                  type="search"
                  placeholder="Search NFTs or collections…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3.5 text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim transition-colors"
                  aria-label="Search NFTs"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((f) => !f)}
                aria-label="Toggle filters"
                aria-expanded={showFilters}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-lg border transition-colors",
                  showFilters ? "border-brand bg-brand-dim text-brand" : "border-line bg-surface-2 text-ink-3 hover:text-ink-2",
                )}
              >
                <HugeiconsIcon icon={FilterIcon} size={14} color="currentColor" strokeWidth={1.5} />
              </button>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-3" data-testid="filter-panel">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">Rarity</label>
                  <select
                    value={rarityFilter}
                    onChange={(e) => setRarityFilter(e.target.value as RarityFilter)}
                    className="h-8 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-ink outline-none focus:border-line-2"
                    aria-label="Filter by rarity"
                  >
                    <option value="all">All</option>
                    <option value="legendary">Legendary</option>
                    <option value="epic">Epic</option>
                    <option value="rare">Rare</option>
                    <option value="common">Common</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">Floor (min XLM)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={minFloor}
                    onChange={(e) => setMinFloor(e.target.value)}
                    className="h-8 w-24 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-ink outline-none focus:border-line-2"
                    aria-label="Minimum floor price"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">Floor (max XLM)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={maxFloor}
                    onChange={(e) => setMaxFloor(e.target.value)}
                    className="h-8 w-24 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-ink outline-none focus:border-line-2"
                    aria-label="Maximum floor price"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">Sort by</label>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-8 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-ink outline-none focus:border-line-2"
                    aria-label="Sort NFTs"
                  >
                    <option value="name">Name</option>
                    <option value="rarity">Rarity</option>
                    <option value="floor">Floor price</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Collection tabs ─────────────────────────────────────────── */}
          {collections.length > 1 && (
            <div
              role="tablist"
              aria-label="Collections"
              className="flex gap-1 overflow-x-auto px-5 py-2.5 border-b border-line"
            >
              <button
                role="tab"
                aria-selected={activeCollection === ALL_COLLECTION_ID}
                onClick={() => setActiveCollection(ALL_COLLECTION_ID)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors shrink-0",
                  activeCollection === ALL_COLLECTION_ID
                    ? "bg-brand text-white"
                    : "bg-surface-2 text-ink-3 hover:text-ink-2 border border-line",
                )}
              >
                All ({allNfts.length})
              </button>
              {collections.map((col) => (
                <button
                  key={col.id}
                  role="tab"
                  aria-selected={activeCollection === col.id}
                  onClick={() => setActiveCollection(col.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors shrink-0",
                    activeCollection === col.id
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-ink-3 hover:text-ink-2 border border-line",
                  )}
                >
                  {col.name} ({col.nfts.length})
                </button>
              ))}
            </div>
          )}

          {/* ── Bulk select-all bar ─────────────────────────────────────── */}
          {bulkMode && displayedNfts.length > 0 && (
            <div className="flex items-center justify-between px-5 py-2 border-b border-line bg-surface-2/40">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[12px] text-brand font-medium hover:underline"
              >
                {selectedIds.size === displayedNfts.length ? "Deselect all" : "Select all"}
              </button>
              <span className="text-[11px] text-ink-3">
                {selectedIds.size} / {displayedNfts.length}
              </span>
            </div>
          )}

          {/* ── Grid ───────────────────────────────────────────────────── */}
          <div className="p-5">
            {loading && allNfts.length === 0 ? (
              <div
                data-testid="nft-loading-skeleton"
                className="grid grid-cols-2 sm:grid-cols-3 gap-4"
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-xl border border-line overflow-hidden">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-3 flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedNfts.length === 0 ? (
              <p className="text-[13px] text-ink-3 text-center py-16">
                {allNfts.length === 0 ? "No NFTs found in this wallet" : "No NFTs match your filters"}
              </p>
            ) : (
              <div
                role="list"
                aria-label="NFT grid"
                className="grid grid-cols-2 sm:grid-cols-3 gap-4"
              >
                {displayedNfts.map((nft) => (
                  <div
                    key={nft.id}
                    role="listitem"
                    onClick={!bulkMode ? () => setDetailTarget(nft) : undefined}
                    className={!bulkMode ? "cursor-pointer" : undefined}
                  >
                    <NFTCard
                      nft={nft}
                      selected={selectedIds.has(nft.id)}
                      bulkMode={bulkMode}
                      onSelect={toggleSelect}
                      onSend={setSendTarget}
                      onList={setListTarget}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <NFTDetailDialog
        nft={detailTarget}
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        onSend={setSendTarget}
        onList={setListTarget}
      />
      <SendNftDialog
        nft={sendTarget}
        open={!!sendTarget}
        onClose={() => setSendTarget(null)}
      />
      <ListForSaleDialog
        nft={listTarget}
        open={!!listTarget}
        onClose={() => setListTarget(null)}
      />
      <BulkSendDialog
        nfts={selectedNfts}
        open={bulkSendOpen}
        onClose={() => setBulkSendOpen(false)}
        onSuccess={exitBulkMode}
      />
    </div>
  );
}
