import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SeedPhraseInput, splitPhrase, validateSeedWords } from "./SeedPhraseInput";

describe("SeedPhraseInput", () => {
  describe("splitPhrase utility", () => {
    it("splits pasted text on whitespace and trims", () => {
      expect(splitPhrase("  word1  word2  word3  ")).toEqual([
        "word1",
        "word2",
        "word3",
      ]);
    });

    it("handles multiple types of whitespace", () => {
      expect(splitPhrase("word1\nword2\tword3  word4")).toEqual([
        "word1",
        "word2",
        "word3",
        "word4",
      ]);
    });

    it("lowercases input", () => {
      expect(splitPhrase("WORD1 Word2")).toEqual(["word1", "word2"]);
    });

    it("filters empty tokens", () => {
      expect(splitPhrase("word1    word2")).toEqual(["word1", "word2"]);
    });
  });

  describe("validateSeedWords utility", () => {
    // Valid 12-word BIP-39 seed phrase
    const valid12Words =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const valid12Array = valid12Words.split(" ");

    // Valid 24-word BIP-39 seed phrase
    const valid24Words =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    const valid24Array = valid24Words.split(" ");

    it("returns null for a valid 12-word phrase", () => {
      expect(validateSeedWords(valid12Array, 12)).toBeNull();
    });

    it("returns null for a valid 24-word phrase", () => {
      expect(validateSeedWords(valid24Array, 24)).toBeNull();
    });

    it("returns error for empty words", () => {
      const incomplete = Array(12).fill("");
      const error = validateSeedWords(incomplete, 12);
      expect(error).toMatch(/Enter all 12 words/);
    });

    it("returns error for partially filled words", () => {
      const partial = [...valid12Array.slice(0, 6), ...Array(6).fill("")];
      const error = validateSeedWords(partial, 12);
      expect(error).toMatch(/Enter all 12 words.*6 still empty/);
    });

    it("returns error for unknown words", () => {
      const withInvalid = [...valid12Array.slice(0, 11), "invalidword"];
      const error = validateSeedWords(withInvalid, 12);
      expect(error).toMatch(/Word 12.*invalidword.*not in the BIP-39 word list/);
    });

    it("returns error for invalid checksum", () => {
      const wrongOrder = [...valid12Array.slice(1), valid12Array[0]];
      const error = validateSeedWords(wrongOrder, 12);
      expect(error).toMatch(/Invalid seed phrase.*checksum does not match/);
    });

    it("detects first invalid word position", () => {
      const withMultipleInvalid = [
        "abandon",
        "badword",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "abandon",
        "about",
      ];
      const error = validateSeedWords(withMultipleInvalid, 12);
      expect(error).toMatch(/Word 2/);
    });
  });

  describe("SeedPhraseInput component", () => {
    const valid12Words =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const valid24Words =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

    it("renders with 12 word inputs by default", () => {
      render(<SeedPhraseInput />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      expect(inputs).toHaveLength(12);
    });

    it("renders with 24 word inputs when specified", () => {
      render(<SeedPhraseInput wordCount={24} />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      expect(inputs).toHaveLength(24);
    });

    it("allows switching between 12 and 24 word modes", async () => {
      render(<SeedPhraseInput wordCount={12} />);
      let inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      expect(inputs).toHaveLength(12);

      fireEvent.click(screen.getByRole("button", { name: "24 words" }));

      await waitFor(() => {
        inputs = screen.getAllByLabelText(/^Seed word \d+$/);
        expect(inputs).toHaveLength(24);
      });
    });

    it("shows seed phrase when show button is clicked", async () => {
      render(<SeedPhraseInput />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      expect(inputs[0]).toHaveAttribute("type", "password");

      fireEvent.click(screen.getByRole("button", { name: /Show seed phrase/i }));

      await waitFor(() => {
        const updatedInputs = screen.getAllByLabelText(/^Seed word \d+$/);
        expect(updatedInputs[0]).toHaveAttribute("type", "text");
      });
    });

    it("hides seed phrase when hide button is clicked", async () => {
      render(<SeedPhraseInput />);
      const showBtn = screen.getByRole("button", { name: /Show seed phrase/i });

      fireEvent.click(showBtn);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Hide seed phrase/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Hide seed phrase/i }));
      await waitFor(() => {
        const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
        expect(inputs[0]).toHaveAttribute("type", "password");
      });
    });

    it("calls onSubmit with valid 12-word phrase", async () => {
      const onSubmit = vi.fn();
      render(<SeedPhraseInput onSubmit={onSubmit} />);

      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      valid12Words.split(" ").forEach((word, i) => {
        fireEvent.change(inputs[i], { target: { value: word } });
      });

      fireEvent.click(screen.getByRole("button", { name: "Verify Seed Phrase" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(valid12Words);
      });
    });

    it("calls onSubmit with valid 24-word phrase", async () => {
      const onSubmit = vi.fn();
      render(<SeedPhraseInput wordCount={24} onSubmit={onSubmit} />);

      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      valid24Words.split(" ").forEach((word, i) => {
        fireEvent.change(inputs[i], { target: { value: word } });
      });

      fireEvent.click(screen.getByRole("button", { name: "Verify Seed Phrase" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(valid24Words);
      });
    });

    it("displays error message for invalid phrase", async () => {
      render(<SeedPhraseInput />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);

      // Fill with valid words but wrong checksum
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about about"
        .split(" ")
        .forEach((word, i) => {
          fireEvent.change(inputs[i], { target: { value: word } });
        });

      fireEvent.click(screen.getByRole("button", { name: "Verify Seed Phrase" }));

      await waitFor(() => {
        expect(screen.getByTestId("seed-phrase-error")).toHaveTextContent(
          /Invalid seed phrase/,
        );
      });
    });

    it("shows success message for valid phrase", async () => {
      render(<SeedPhraseInput />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
      valid12Words.split(" ").forEach((word, i) => {
        fireEvent.change(inputs[i], { target: { value: word } });
      });

      fireEvent.click(screen.getByRole("button", { name: "Verify Seed Phrase" }));

      await waitFor(() => {
        expect(screen.getByText(/Seed phrase checksum is valid/)).toBeInTheDocument();
      });
    });

    it("handles pasting a full 12-word phrase", async () => {
      render(<SeedPhraseInput wordCount={12} />);
      const firstInput = screen.getAllByLabelText(/^Seed word \d+$/)[0];

      fireEvent.change(firstInput, { target: { value: valid12Words } });
      // jsdom in this runner has no ClipboardEvent/DataTransfer constructor;
      // fireEvent.paste builds the event and takes the clipboard payload.
      fireEvent.paste(firstInput, {
        clipboardData: { getData: () => valid12Words },
      });

      await waitFor(() => {
        const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
        expect(inputs[0]).toHaveValue("abandon");
        expect(inputs[1]).toHaveValue("abandon");
      });
    });

    it("auto-switches to 24 words when pasting 24-word phrase into 12-word mode", async () => {
      render(<SeedPhraseInput wordCount={12} />);
      const firstInput = screen.getAllByLabelText(/^Seed word \d+$/)[0];

      fireEvent.change(firstInput, { target: { value: valid24Words } });
      // jsdom in this runner has no ClipboardEvent/DataTransfer constructor;
      // fireEvent.paste builds the event and takes the clipboard payload.
      fireEvent.paste(firstInput, {
        clipboardData: { getData: () => valid24Words },
      });

      await waitFor(() => {
        const inputs = screen.getAllByLabelText(/^Seed word \d+$/);
        expect(inputs.length).toBe(24);
      });
    });

    it("clears error when user modifies input", async () => {
      render(<SeedPhraseInput />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);

      // Create invalid phrase
      inputs.forEach((input) => {
        fireEvent.change(input, { target: { value: "abandon" } });
      });

      fireEvent.click(screen.getByRole("button", { name: "Verify Seed Phrase" }));

      await waitFor(() => {
        expect(screen.getByTestId("seed-phrase-error")).not.toHaveClass("hidden");
      });

      // Modify an input
      fireEvent.change(inputs[0], { target: { value: "about" } });

      await waitFor(() => {
        expect(screen.getByTestId("seed-phrase-error")).toHaveClass("hidden");
      });
    });

    it("respects className prop", () => {
      render(<SeedPhraseInput className="custom-class" />);
      const form = screen.getByTestId("seed-phrase-form");
      expect(form).toHaveClass("custom-class");
    });

    it("sets aria-invalid on inputs when error exists", async () => {
      render(<SeedPhraseInput />);
      const inputs = screen.getAllByLabelText(/^Seed word \d+$/);

      inputs.forEach((input) => {
        fireEvent.change(input, { target: { value: "abandon" } });
      });

      fireEvent.click(screen.getByRole("button", { name: "Verify Seed Phrase" }));

      await waitFor(() => {
        inputs.forEach((input) => {
          expect(input).toHaveAttribute("aria-invalid", "true");
        });
      });
    });

    it("lowercases input automatically", () => {
      render(<SeedPhraseInput />);
      const firstInput = screen.getAllByLabelText(/^Seed word \d+$/)[0];

      fireEvent.change(firstInput, { target: { value: "ABANDON" } });
      expect(firstInput).toHaveValue("abandon");
    });

    it("trims whitespace from input", () => {
      render(<SeedPhraseInput />);
      const firstInput = screen.getAllByLabelText(/^Seed word \d+$/)[0];

      fireEvent.change(firstInput, { target: { value: "  abandon  " } });
      expect(firstInput).toHaveValue("abandon");
    });
  });
});
