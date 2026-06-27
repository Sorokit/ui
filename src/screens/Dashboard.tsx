import { type ComponentType,useState } from "react";

import { NetworkBanner } from "@/components/NetworkBanner";
import { type NavSection,Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AccountScreen } from "@/screens/AccountScreen";
import { NetworkScreen } from "@/screens/NetworkScreen";
import { SorobanScreen } from "@/screens/SorobanScreen";
import { TransactionsScreen } from "@/screens/TransactionsScreen";
import { WalletScreen } from "@/screens/WalletScreen";

const SCREENS: Record<NavSection, ComponentType> = {
  wallet: WalletScreen,
  account: AccountScreen,
  transactions: TransactionsScreen,
  soroban: SorobanScreen,
  network: NetworkScreen,
};

export function Dashboard() {
  const [active, setActive] = useState<NavSection>("wallet");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const ActiveScreen = SCREENS[active];

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar
        active={active}
        onNavigate={setActive}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          active={active}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />
        <NetworkBanner />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[700px] mx-auto px-6 py-8 sm:px-10 sm:py-10 min-h-[300px]">
            <ActiveScreen />
          </div>
        </main>
      </div>
    </div>
  );
}
