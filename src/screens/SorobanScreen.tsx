import { useState } from "react";

import { ContractEventFeed } from "@/components/ContractEventFeed";
import { SorobanPanel } from "@/components/SorobanPanel";
import { SCREEN_LABELS } from "@/lib/nav-labels";

export function SorobanScreen() {
  const [contractId, setContractId] = useState("");
  const { title, sub } = SCREEN_LABELS.soroban;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink leading-none">
          {title}
        </h2>
        <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>
      </div>
      <SorobanPanel contractId={contractId} onContractIdChange={setContractId} />
      {contractId.trim() !== "" && (
        <ContractEventFeed contractId={contractId} />
      )}
    </div>
  );
}
