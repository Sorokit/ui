import { validateStellarAddress } from "./utils";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a field is not empty, undefined, null, or whitespace-only.
 */
export function validateRequired(value: unknown, fieldName = "Field"): ValidationResult {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

/**
 * Validates standard email address format.
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim() === "") {
    return { valid: false, error: "Email is required" };
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
}

/**
 * Validates that a numeric value falls within [min, max] inclusive.
 */
export function validateNumericRange(
  value: number | string,
  min: number,
  max: number,
  fieldName = "Value",
): ValidationResult {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  if (num > max) {
    return { valid: false, error: `${fieldName} must not exceed ${max}` };
  }
  return { valid: true };
}

/**
 * Validates a Stellar account address (G... or SEP-23 M...).
 */
export function validateAddress(address: string): ValidationResult {
  if (!address || address.trim() === "") {
    return { valid: false, error: "Address is required" };
  }
  if (!validateStellarAddress(address)) {
    return { valid: false, error: "Invalid Stellar address" };
  }
  return { valid: true };
}
