import { useEffect, useRef } from "react";

import { useSorokit } from "@/context/useSorokit";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * Records wallet connects and disconnects in the audit log by watching the
 * connected address. Switching straight from one account to another counts as
 * a disconnect followed by a connect.
 */
export function useAuditLogging(): void {
  const { address } = useSorokit();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const before = previous.current;
    if (before === address) return;
    previous.current = address;
    if (before) logAuditEvent("disconnect", before);
    if (address) logAuditEvent("connect", address);
  }, [address]);
}
