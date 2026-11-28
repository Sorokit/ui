import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  validateAddress,
  validateEmail,
  validateNumericRange,
  validateRequired,
} from "@/lib/validation";
import { Input } from "./Input";

describe("FormInput Validation Tests (#1134)", () => {
  describe("Required Field Validation", () => {
    it.each([
      ["valid string", "hello", true, undefined],
      ["valid number", 123, true, undefined],
      ["empty string", "", false, "Username is required"],
      ["whitespace only", "   ", false, "Username is required"],
      ["null value", null, false, "Username is required"],
      ["undefined value", undefined, false, "Username is required"],
    ])("validates required input for %s", (_, input, expectedValid, expectedError) => {
      const result = validateRequired(input, "Username");
      expect(result.valid).toBe(expectedValid);
      expect(result.error).toBe(expectedError);
    });
  });

  describe("Email Format Validation", () => {
    it.each([
      ["standard email", "user@example.com", true],
      ["subdomain email", "contributor@mail.stellar.org", true],
      ["plus tag email", "alice+wave@domain.co", true],
      ["missing domain", "user@", false],
      ["missing username", "@example.com", false],
      ["missing at-symbol", "userexample.com", false],
      ["double dots", "user@domain..com", false],
      ["spaces in email", "user @example.com", false],
      ["empty email", "", false],
    ])("validates email '%s' correctly", (_, email, expectedValid) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(expectedValid);
      if (!expectedValid) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("Numeric Range Validation", () => {
    const MIN = 10;
    const MAX = 100;

    it.each([
      ["exact minimum", 10, true, undefined],
      ["exact maximum", 100, true, undefined],
      ["midpoint value", 50, true, undefined],
      ["numeric string in range", "75", true, undefined],
      ["below minimum", 9, false, "Amount must be at least 10"],
      ["above maximum", 101, false, "Amount must not exceed 100"],
      ["negative number", -5, false, "Amount must be at least 10"],
      ["non-numeric string", "not-a-number", false, "Amount must be a valid number"],
    ])("validates numeric range for %s", (_, value, expectedValid, expectedError) => {
      const result = validateNumericRange(value, MIN, MAX, "Amount");
      expect(result.valid).toBe(expectedValid);
      expect(result.error).toBe(expectedError);
    });
  });

  describe("Address Validation", () => {
    // Valid standard 56-char Stellar G-address (ED25519)
    const VALID_G_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    // Valid 69-char SEP-23 Muxed M-address
    const VALID_M_ADDRESS = "MAAAAAAAAAAAAC2K3H6PFEU727W64WODF7AXW7J74E64ODDF7AQXW7J74E64ODDDCXW63B";

    it.each([
      ["valid G-address", VALID_G_ADDRESS, true],
      ["valid M-address", VALID_M_ADDRESS, true],
      ["invalid length", "GBBD47IF6LWK7P7MDEV", false],
      ["invalid prefix", "ABBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", false],
      ["corrupted checksum", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA0", false],
      ["empty string", "", false],
      ["whitespace only", "   ", false],
    ])("validates Stellar address '%s' (%s)", (_, address, expectedValid) => {
      const result = validateAddress(address);
      expect(result.valid).toBe(expectedValid);
      if (!expectedValid) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe("Input UI Component Error Display", () => {
    it("renders with error message when validation fails", () => {
      const emailResult = validateEmail("invalid-email");
      render(
        <Input
          label="Email Address"
          value="invalid-email"
          error={emailResult.error}
          aria-invalid={!emailResult.valid}
          readOnly
        />,
      );

      expect(screen.getByText("Invalid email format")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    });
  });
});
