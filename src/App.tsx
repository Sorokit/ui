import { useCallback, useEffect, useState } from 'react';

import type { NavSection } from './components/Sidebar';
import { ToastContainer } from './components/ui/Toast';
import { SorokitProvider } from './context/SorokitProvider';
import { ToastProvider, useToast } from './context/ToastContext';
import { useSorokit } from './context/useSorokit';
import type { SorokitClient } from './lib/client';
import { SECTION_PATHS,sectionForPath } from './lib/nav-routes';
import { ConnectScreen } from './screens/ConnectScreen';
import { Dashboard } from './screens/Dashboard';

interface AppProps {
  client: SorokitClient;
}

function ToastRenderer() {
  const { toasts, removeToast } = useToast();
  return <ToastContainer toasts={toasts} onDismiss={removeToast} />;
}

function AppContent() {
  const { isConnected } = useSorokit();
  const [section, setSection] = useState<NavSection>(() =>
    sectionForPath(window.location.pathname),
  );

  // Browser back/forward.
  useEffect(() => {
    const onPopState = () => setSection(sectionForPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSectionChange = useCallback((next: NavSection) => {
    setSection(next);
    const path = SECTION_PATHS[next];
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Dashboard section URLs are only meaningful once connected; bounce back
  // to "/" so a shared /soroban (etc.) link doesn't strand a signed-out user.
  useEffect(() => {
    if (!isConnected && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, [isConnected]);

  if (!isConnected) {
    return <ConnectScreen />;
  }

  return <Dashboard activeSection={section} onSectionChange={handleSectionChange} />;
}

function App({ client }: AppProps) {
  return (
    <SorokitProvider client={client}>
      <ToastProvider>
        <AppContent />
        <ToastRenderer />
      </ToastProvider>
    </SorokitProvider>
  );
}

export default App;
