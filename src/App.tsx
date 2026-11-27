import { useCallback, useEffect, useState } from 'react';

import { OnboardingTutorial } from './components/OnboardingTutorial';
import type { NavSection } from './components/Sidebar';
import { ToastContainer } from './components/ui/Toast';
import { SorokitProvider } from './context/SorokitProvider';
import { ToastProvider, useToast } from './context/ToastContext';
import { useSorokit } from './context/useSorokit';
import { useAuditLogging } from './hooks/useAuditLogging';
import { I18nProvider } from './i18n';
import type { SorokitClient } from './lib/client';
import { SECTION_PATHS,sectionForPath } from './lib/nav-routes';
import { applyPreferences } from './lib/preferences';
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
  useAuditLogging();

  // Apply the saved font size and motion preferences on load, including on the
  // connect screen.
  useEffect(() => {
    applyPreferences();
  }, []);

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

  return (
    <>
      <Dashboard activeSection={section} onSectionChange={handleSectionChange} />
      <OnboardingTutorial />
    </>
  );
}

function App({ client }: AppProps) {
  return (
    <I18nProvider>
      <SorokitProvider client={client}>
        <ToastProvider>
          <AppContent />
          <ToastRenderer />
        </ToastProvider>
      </SorokitProvider>
    </I18nProvider>
  );
}

export default App;
