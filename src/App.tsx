import { Compass01Icon, WifiDisconnected01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useCallback, useEffect, useState } from 'react';

import type { NavSection } from './components/Sidebar';
import { Button } from './components/ui/Button';
import { SorokitProvider } from './context/SorokitProvider';
import { useSorokit } from './context/useSorokit';
import type { SorokitClient } from './lib/client';
import { isKnownPath,SECTION_PATHS, sectionForPath } from './lib/nav-routes';
import { ConnectScreen } from './screens/ConnectScreen';
import { Dashboard } from './screens/Dashboard';

interface AppProps {
  client: SorokitClient;
}

/** Persistent banner shown while the browser reports no network connection. */
function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-medium text-orange bg-[rgba(249,115,22,0.06)] border-b border-[rgba(249,115,22,0.15)]"
    >
      <HugeiconsIcon icon={WifiDisconnected01Icon} size={14} strokeWidth={1.5} />
      <span>
        You&apos;re offline — some actions may not work until your connection is
        restored.
      </span>
    </div>
  );
}

/** Fallback shown when the URL doesn't match any known dashboard section. */
function NotFoundCard({ onBackToDashboard }: { onBackToDashboard: () => void }) {
  return (
    <div
      role="main"
      className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center"
    >
      <HugeiconsIcon icon={Compass01Icon} size={40} strokeWidth={1.5} className="text-ink-3" />
      <div className="flex flex-col gap-1">
        <h1 className="text-[18px] font-semibold text-ink">Page not found</h1>
        <p className="text-[13px] text-ink-3">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onBackToDashboard}>
        Back to Dashboard
      </Button>
    </div>
  );
}

function AppContent() {
  const { isConnected } = useSorokit();
  const [section, setSection] = useState<NavSection>(() =>
    sectionForPath(window.location.pathname),
  );
  const [isUnknownPath, setIsUnknownPath] = useState(
    () => !isKnownPath(window.location.pathname),
  );

  // Browser back/forward.
  useEffect(() => {
    const onPopState = () => {
      setSection(sectionForPath(window.location.pathname));
      setIsUnknownPath(!isKnownPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSectionChange = useCallback((next: NavSection) => {
    setSection(next);
    setIsUnknownPath(false);
    const path = SECTION_PATHS[next];
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Dashboard section URLs are only meaningful once connected; bounce back
  // to "/" so a shared /soroban (etc.) link doesn't strand a signed-out user.
  // An unknown path is left alone here so it can show the 404 card below
  // instead of silently redirecting.
  useEffect(() => {
    if (
      !isConnected &&
      window.location.pathname !== '/' &&
      isKnownPath(window.location.pathname)
    ) {
      window.history.replaceState(null, '', '/');
    }
  }, [isConnected]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      <div id="main-content" className="flex flex-1 flex-col">
        {isUnknownPath ? (
          <NotFoundCard onBackToDashboard={() => handleSectionChange('wallet')} />
        ) : !isConnected ? (
          <ConnectScreen />
        ) : (
          <Dashboard activeSection={section} onSectionChange={handleSectionChange} />
        )}
      </div>
    </>
  );
}

function App({ client }: AppProps) {
  return (
    <SorokitProvider client={client}>
      <AppContent />
    </SorokitProvider>
  );
}

export default App;
