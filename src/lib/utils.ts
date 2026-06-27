import { type ClassValue,clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a Stellar address or tx hash for display */
export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address) return "";
  const chars = Array.from(address);
  if (chars.length <= start + end) return address;
  return `${chars.slice(0, start).join("")}...${chars.slice(-end).join("")}`;
}

export function friendlyError(message: string): string {
  const normalizedMessage = message.trim().toLowerCase();

  if (
    normalizedMessage.includes("op_underfunded") ||
    normalizedMessage.includes("underfunded")
  ) {
    return "Insufficient balance to submit this transaction. Add more XLM and try again.";
  }

  if (
    normalizedMessage.includes("tx_bad_seq") ||
    normalizedMessage.includes("bad sequence")
  ) {
    return "Your account sequence is out of date. Refresh and try again.";
  }

  if (
    normalizedMessage.includes("simulation failed") ||
    normalizedMessage.includes("simulate transaction") ||
    normalizedMessage.includes("rpc") ||
    normalizedMessage.includes("execution failed")
  ) {
    return "The contract call could not be simulated. Please review the inputs and try again.";
  }

  if (
    normalizedMessage.includes("account not found") ||
    normalizedMessage.includes("contract not found") ||
    normalizedMessage.includes("resource not found") ||
    normalizedMessage.includes("not found")
  ) {
    return "The account or contract could not be found on this network.";
  }

  if (
    normalizedMessage.includes("resource limit") ||
    normalizedMessage.includes("fee limit") ||
    normalizedMessage.includes("insufficient fee") ||
    normalizedMessage.includes("resource")
  ) {
    return "This transaction used too many network resources. Try again with a simpler request.";
  }

  return "Something went wrong while invoking the contract. Please try again.";
}
