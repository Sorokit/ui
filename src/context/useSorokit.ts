import { useContext } from "react";

import { SorokitContext, type SorokitState } from "./sorokit-context";

export function useSorokit(): SorokitState {
  const ctx = useContext(SorokitContext);
  if (!ctx) {
    throw new Error(
      "[sorokit-ui] useSorokit must be used inside <SorokitProvider>",
    );
  }
  return ctx;
}
