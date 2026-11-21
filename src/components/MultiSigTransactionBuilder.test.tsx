import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiSigTransactionBuilder } from "./MultiSigTransactionBuilder";

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    addToast: vi.fn(),
    removeToast: vi.fn(),
    dismissAll: vi.fn(),
    clearAll: vi.fn(),
    toasts: [],
  }),
}));

describe("MultiSigTransactionBuilder", () => {
  beforeEach(() => {
    const storage = window.localStorage;
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem("sorokit-multisig-builder-state");
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("walks through the wizard steps and validates threshold configuration", () => {
    render(<MultiSigTransactionBuilder />);

    expect(screen.getAllByText(/signer configuration/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/signer 1 address/i), { target: { value: "GABC" } });
    fireEvent.change(screen.getByLabelText(/signer 1 weight/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getAllByText(/build transaction/i).length).toBeGreaterThan(0);
  });

  it("shows copy button in step 3 (final confirmation)", () => {
    render(<MultiSigTransactionBuilder />);

    // Configure signers and move to step 1
    fireEvent.change(screen.getByLabelText(/signer 1 address/i), { target: { value: "GABC" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Move to step 2 (signatures)
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Move to step 3 (final confirmation)
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Verify copy button exists
    expect(screen.getByRole("button", { name: /Copy XDR/i })).toBeInTheDocument();
  });

  it("saves and loads transactions from localStorage", async () => {
    const { rerender } = render(<MultiSigTransactionBuilder />);

    fireEvent.change(screen.getByLabelText(/signer 1 address/i), { target: { value: "GABC" } });
    fireEvent.change(screen.getByLabelText(/signer 1 weight/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /save json/i }));

    const storage = window.localStorage;
    const saved = storage && typeof storage.getItem === "function" ? storage.getItem("sorokit-multisig-builder-state") : null;
    expect(saved).toBeTruthy();

    rerender(<MultiSigTransactionBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /load saved/i }));
    expect(screen.getByText(/loaded saved transaction/i)).toBeInTheDocument();
  });

  it("blocks Next while the threshold exceeds total signer weight", () => {
    render(<MultiSigTransactionBuilder />);

    // Default: one signer of weight 1; threshold 2 is invalid.
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "2" } });

    expect(
      screen.getByText(/Threshold exceeds available weight/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("rejects a threshold greater than the number of configured signers", () => {
    render(<MultiSigTransactionBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "3" } });

    expect(screen.getByText(/Threshold exceeds available weight/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "2" } });

    expect(screen.queryByText(/Threshold exceeds available weight/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });

  it("keeps signer keys unique when adding after removing a middle signer", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MultiSigTransactionBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[1]);
    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));

    const duplicateWarnings = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === "string" && msg.includes("same key"),
    );
    expect(duplicateWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it("does not redefine window.localStorage when saving", () => {
    const original = window.localStorage;
    render(<MultiSigTransactionBuilder />);

    expect(window.localStorage).toBe(original);
  });

  it("handles corrupt JSON in localStorage without crashing, clears storage and shows warning toast", () => {
    const storage = window.localStorage;
    if (storage && typeof storage.setItem === "function") {
      storage.setItem("sorokit-multisig-builder-state", "{corrupt-json");
    }

    render(<MultiSigTransactionBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /load saved/i }));

    expect(
      screen.getByText(/Saved state was corrupt or invalid and has been reset/i),
    ).toBeInTheDocument();
    expect(storage?.getItem("sorokit-multisig-builder-state")).toBeNull();
  });

  it("handles invalid schema shape in localStorage without crashing, clears storage and shows warning toast", () => {
    const storage = window.localStorage;
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(
        "sorokit-multisig-builder-state",
        JSON.stringify({ signers: "not-an-array", threshold: "invalid" }),
      );
    }

    render(<MultiSigTransactionBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /load saved/i }));

    expect(
      screen.getByText(/Saved state was corrupt or invalid and has been reset/i),
    ).toBeInTheDocument();
    expect(storage?.getItem("sorokit-multisig-builder-state")).toBeNull();
  });

  describe("schema versioning and migration (#900)", () => {
    it("migrates legacy saved state with no schemaVersion field instead of wiping it", () => {
      const storage = window.localStorage;
      const legacyState = {
        signers: [{ id: "signer-legacy", address: "GLEGACY123", weight: 1, signed: false }],
        threshold: 1,
        xdr: "<tx:legacy-xdr>",
        status: "Draft",
        notes: "Pre-#900 note",
      };
      if (storage && typeof storage.setItem === "function") {
        storage.setItem("sorokit-multisig-builder-state", JSON.stringify(legacyState));
      }

      render(<MultiSigTransactionBuilder />);
      fireEvent.click(screen.getByRole("button", { name: /load saved/i }));

      // A successful load moves to step 1 (Build transaction), where the xdr
      // textarea is visible; signer addresses live in step 0.
      expect(screen.getByText(/loaded saved transaction/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("<tx:legacy-xdr>")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /previous/i }));
      expect(screen.getByDisplayValue("GLEGACY123")).toBeInTheDocument();
    });

    it("re-saves migrated legacy state with the current schemaVersion stamped on it", () => {
      const storage = window.localStorage;
      const legacyState = {
        signers: [{ id: "signer-legacy", address: "GLEGACY123", weight: 1, signed: false }],
        threshold: 1,
        xdr: "<tx:legacy-xdr>",
        status: "Draft",
        notes: "",
      };
      if (storage && typeof storage.setItem === "function") {
        storage.setItem("sorokit-multisig-builder-state", JSON.stringify(legacyState));
      }

      render(<MultiSigTransactionBuilder />);
      fireEvent.click(screen.getByRole("button", { name: /load saved/i }));
      fireEvent.click(screen.getByRole("button", { name: /save json/i }));

      const saved = storage?.getItem("sorokit-multisig-builder-state");
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed.schemaVersion).toBe(1);
      // Confirms the re-save carried forward the actual migrated data, not
      // state that was reset to defaults because migration silently failed.
      expect(parsed.xdr).toBe("<tx:legacy-xdr>");
    });

    it("loads state already stamped with the current schemaVersion", () => {
      const storage = window.localStorage;
      const currentState = {
        schemaVersion: 1,
        signers: [{ id: "signer-current", address: "GCURRENT456", weight: 1, signed: false }],
        threshold: 1,
        xdr: "<tx:current-xdr>",
        status: "Draft",
        notes: "",
      };
      if (storage && typeof storage.setItem === "function") {
        storage.setItem("sorokit-multisig-builder-state", JSON.stringify(currentState));
      }

      render(<MultiSigTransactionBuilder />);
      fireEvent.click(screen.getByRole("button", { name: /load saved/i }));

      expect(screen.getByText(/loaded saved transaction/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("<tx:current-xdr>")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /previous/i }));
      expect(screen.getByDisplayValue("GCURRENT456")).toBeInTheDocument();
    });

    it("rejects state from an unrecognized future schemaVersion rather than guessing its shape", () => {
      const storage = window.localStorage;
      const futureState = {
        schemaVersion: 999,
        signers: [{ id: "signer-future", address: "GFUTURE789", weight: 1, signed: false }],
        threshold: 1,
        xdr: "<tx:future-xdr>",
        status: "Draft",
        notes: "",
      };
      if (storage && typeof storage.setItem === "function") {
        storage.setItem("sorokit-multisig-builder-state", JSON.stringify(futureState));
      }

      render(<MultiSigTransactionBuilder />);
      fireEvent.click(screen.getByRole("button", { name: /load saved/i }));

      expect(
        screen.getByText(/Saved state was corrupt or invalid and has been reset/i),
      ).toBeInTheDocument();
      expect(storage?.getItem("sorokit-multisig-builder-state")).toBeNull();
    });
  });

  describe("duplicate signer address detection (#900)", () => {
    it("blocks Next and shows an inline error when two signers share the same address", () => {
      render(<MultiSigTransactionBuilder />);

      fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
      fireEvent.change(screen.getByLabelText(/signer 1 address/i), {
        target: { value: "GABC123" },
      });
      fireEvent.change(screen.getByLabelText(/signer 2 address/i), {
        target: { value: "GABC123" },
      });

      expect(
        screen.getAllByText(/This address is already used by another signer/i),
      ).toHaveLength(2);
      expect(
        screen.getByText(/Duplicate signer addresses must be resolved before continuing/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("treats addresses as duplicates after trimming surrounding whitespace", () => {
      render(<MultiSigTransactionBuilder />);

      fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
      fireEvent.change(screen.getByLabelText(/signer 1 address/i), {
        target: { value: "GABC123" },
      });
      fireEvent.change(screen.getByLabelText(/signer 2 address/i), {
        target: { value: "  GABC123  " },
      });

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("does not flag blank addresses as duplicates of each other", () => {
      render(<MultiSigTransactionBuilder />);

      fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
      fireEvent.change(screen.getByLabelText(/signer 1 weight/i), {
        target: { value: "1" },
      });
      fireEvent.change(screen.getByLabelText(/signer 2 weight/i), {
        target: { value: "1" },
      });
      fireEvent.change(screen.getByLabelText(/threshold/i), {
        target: { value: "1" },
      });

      expect(
        screen.queryByText(/This address is already used by another signer/i),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });

    it("clears the duplicate error once one of the addresses is changed", () => {
      render(<MultiSigTransactionBuilder />);

      fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
      fireEvent.change(screen.getByLabelText(/signer 1 address/i), {
        target: { value: "GABC123" },
      });
      fireEvent.change(screen.getByLabelText(/signer 2 address/i), {
        target: { value: "GABC123" },
      });
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/signer 2 address/i), {
        target: { value: "GXYZ999" },
      });

      expect(
        screen.queryByText(/This address is already used by another signer/i),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });
  });
});
