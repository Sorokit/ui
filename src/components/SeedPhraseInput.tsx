import { EyeIcon, EyeOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type SeedPhraseLength = 12 | 24;

interface SeedPhraseInputProps {
  /** Number of words in the phrase. Defaults to 12. */
  wordCount?: SeedPhraseLength;
  /** Called with the normalized phrase once it passes BIP-39 validation. */
  onSubmit?: (mnemonic: string) => void;
  className?: string;
}

const WORD_COUNTS: SeedPhraseLength[] = [12, 24];

/** Splits pasted text on any whitespace and drops empty tokens. */
export function splitPhrase(text: string): string[] {
  return text.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Validates a list of words against the BIP-39 English wordlist and checksum.
 * Returns a human-readable error, or `null` when the phrase is valid.
 */
export function validateSeedWords(
  words: string[],
  expectedLength: SeedPhraseLength,
): string | null {
  const missing = words.filter((w) => !w).length;
  if (missing > 0) {
    return `Enter all ${expectedLength} words (${missing} still empty).`;
  }
  const unknown = words.findIndex((w) => !wordlist.includes(w));
  if (unknown !== -1) {
    return `Word ${unknown + 1} ("${words[unknown]}") is not in the BIP-39 word list.`;
  }
  if (!validateMnemonic(words.join(" "), wordlist)) {
    return "Invalid seed phrase: the BIP-39 checksum does not match. Check the word order and spelling.";
  }
  return null;
}

export function SeedPhraseInput({
  wordCount = 12,
  onSubmit,
  className,
}: SeedPhraseInputProps) {
  const [count, setCount] = useState<SeedPhraseLength>(wordCount);
  const [words, setWords] = useState<string[]>(() =>
    Array(wordCount).fill(""),
  );
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const reset = (next: string[]) => {
    setWords(next);
    setError(null);
    setVerified(false);
  };

  const handleCountChange = (next: SeedPhraseLength) => {
    setCount(next);
    reset(Array.from({ length: next }, (_, i) => words[i] ?? ""));
  };

  const handleWordChange = (index: number, value: string) => {
    // A multi-word value (e.g. autofill) is treated like a paste.
    const tokens = splitPhrase(value);
    if (tokens.length > 1) {
      distribute(index, tokens);
      return;
    }
    const next = [...words];
    next[index] = value.trim().toLowerCase();
    reset(next);
  };

  const distribute = (start: number, tokens: string[]) => {
    // Pasting a full phrase always fills from the first cell.
    const from = tokens.length >= 12 ? 0 : start;
    const nextCount: SeedPhraseLength =
      tokens.length > 12 && tokens.length <= 24 ? 24 : count;
    const next = Array.from(
      { length: nextCount },
      (_, i) => words[i] ?? "",
    );
    tokens.slice(0, nextCount - from).forEach((token, i) => {
      next[from + i] = token;
    });
    setCount(nextCount);
    reset(next);
    const focusIndex = Math.min(from + tokens.length, nextCount - 1);
    requestAnimationFrame(() => inputRefs.current[focusIndex]?.focus());
  };

  const handlePaste = (
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const tokens = splitPhrase(e.clipboardData.getData("text"));
    if (tokens.length <= 1) return; // single word: let the browser paste normally
    e.preventDefault();
    distribute(index, tokens);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = validateSeedWords(words, count);
    setError(message);
    setVerified(!message);
    if (!message) onSubmit?.(words.join(" "));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-3", className)}
      data-testid="seed-phrase-form"
      autoComplete="off"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Seed phrase length"
          className="flex gap-1.5"
        >
          {WORD_COUNTS.map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={count === n ? "primary" : "secondary"}
              aria-pressed={count === n}
              onClick={() => handleCountChange(n)}
            >
              {n} words
            </Button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded"
        >
          <HugeiconsIcon
            icon={visible ? EyeOffIcon : EyeIcon}
            size={15}
            color="currentColor"
            strokeWidth={1.5}
          />
          {visible ? "Hide seed phrase" : "Show seed phrase"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {words.map((word, i) => (
          <div key={i} className="relative flex items-center">
            <span
              aria-hidden="true"
              className="absolute left-2.5 text-[10px] text-ink-4 pointer-events-none"
            >
              {i + 1}
            </span>
            <input
              ref={(node) => {
                inputRefs.current[i] = node;
              }}
              type={visible ? "text" : "password"}
              value={word}
              onChange={(e) => handleWordChange(i, e.target.value)}
              onPaste={(e) => handlePaste(i, e)}
              aria-label={`Seed word ${i + 1}`}
              aria-invalid={!!error}
              aria-describedby={error ? "seed-phrase-error" : undefined}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                "h-9 w-full rounded-lg border bg-surface-2 pl-7 pr-2 text-[13px] text-ink",
                "outline-none transition-colors",
                error
                  ? "border-error-dim-input focus:border-red"
                  : "border-line focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
              )}
            />
          </div>
        ))}
      </div>

      <p
        id="seed-phrase-error"
        role="alert"
        data-testid="seed-phrase-error"
        className={cn("text-[11px] text-red", !error && "hidden")}
      >
        {error}
      </p>
      {verified && (
        <p role="status" className="text-[11px] text-brand">
          Seed phrase checksum is valid.
        </p>
      )}

      <Button type="submit" variant="secondary" className="w-full">
        Verify Seed Phrase
      </Button>
    </form>
  );
}
