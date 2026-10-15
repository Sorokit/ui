import { useCallback, useEffect, useState } from "react";

import type { NavSection } from "./components/Sidebar";
import { SorokitProvider } from "./context/SorokitProvider";
import { useSorokit } from "./context/useSorokit";
import type { SorokitClient } from "./lib/client";
import { isKnownPath, SECTION_PATHS, sectionForPath } from "./lib/nav-routes";
import { ConnectScreen } from "./screens/ConnectScreen";
import { Dashboard } from "./screens/Dashboard";

interface AppProps {
  client: SorokitClient;
}

function AppContent() {
  const { isConnected } = useSorokit();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [section, setSection] = useState<NavSection>(() =>
    sectionForPath(window.location.pathname),
  );
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine === false : false,
  );

  // Listen for browser online / offline connectivity events (#966)
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Browser back/forward.
  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
      setSection(sectionForPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleSectionChange = useCallback((next: NavSection) => {
    setSection(next);
    const path = SECTION_PATHS[next];
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setPathname(path);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    window.history.pushState(null, "", "/");
    setPathname("/");
    setSection("wallet");
  }, []);

  // Dashboard section URLs are only meaningful once connected; bounce back
  // to "/" so a shared /soroban (etc.) link doesn't strand a signed-out user.
  useEffect(() => {
    if (!isConnected && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
      setPathname("/");
    }
  }, [isConnected]);

  const unknownRoute = isConnected && !isKnownPath(pathname);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-surface focus:text-ink focus:border focus:border-line"
      >
        Skip to main content
      </a>
      {isOffline && (
        <div
          role="alert"
          data-testid="offline-banner"
          className="w-full bg-error-dim text-red px-4 py-2 text-center text-[13px] font-medium border-b border-line"
        >
          You are currently offline. Transactions cannot be submitted until your internet connection is restored.
        </div>
      )}
      <div id="main-content" tabIndex={-1}>
        {!isConnected ? (
          <ConnectScreen />
        ) : unknownRoute ? (
          <div
            role="region"
            aria-label="Page not found"
            data-testid="not-found-card"
            className="flex flex-col items-center justify-center p-8 gap-4"
          >
            <h1 className="text-[20px] font-semibold text-ink">404 - Page Not Found</h1>
            <p className="text-[13px] text-ink-3">
              The page at <code>{pathname}</code> does not exist.
            </p>
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="px-4 py-2 rounded-lg bg-brand text-white text-[13px] font-medium"
            >
              Back to Dashboard
            </button>
          </div>
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
