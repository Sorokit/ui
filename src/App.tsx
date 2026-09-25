import { useCallback, useEffect, useState } from 'react';

import type { NavSection } from './components/Sidebar';
import { SorokitProvider } from './context/SorokitProvider';
import { useSorokit } from './context/useSorokit';
import type { SorokitClient } from './lib/client';
import { SECTION_PATHS,sectionForPath } from './lib/nav-routes';
import { ConnectScreen } from './screens/ConnectScreen';
import { Dashboard } from './screens/Dashboard';

interface AppProps {
  client: SorokitClient;
}

export function AppContent() {
  const { isConnected, isInitializing } = useSorokit();

  if (isInitializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-base px-4"
        data-testid="loading-screen"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12C19 15.87 15.87 19 12 19"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 19C10.34 19 9 17.66 9 16C9 14.34 10.34 13 12 13"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="1.5" fill="white" />
            </svg>
          </div>

          <div className="text-center">
            <h1 className="text-[22px] font-semibold text-ink tracking-tight">
              sorokit
            </h1>
            <p className="text-[13px] text-ink-3 mt-1">
              Stellar control dashboard
            </p>
          </div>

          <div
            className="flex items-center gap-3 text-ink-3 text-[13px] mt-4"
            aria-live="polite"
            role="status"
          >
            <svg
              className="animate-spin h-5 w-5 text-brand"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
              data-testid="loading-spinner"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return <ConnectScreen />;
  }

  return <Dashboard activeSection={section} onSectionChange={handleSectionChange} />;
}

function App({ client }: AppProps) {
  return (
    <SorokitProvider client={client}>
      <AppContent />
    </SorokitProvider>
  );
}

export default App;
