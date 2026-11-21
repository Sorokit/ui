import './index.css'

import React, { useCallback,useState } from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { SorokitClient } from './lib/client'
import { createMockClient } from './lib/mock-client'

const createClient = (): SorokitClient => {
  try {
    return createMockClient() as SorokitClient
  } catch (err) {
    document.getElementById('root')!.innerHTML = '<div>Failed to initialize Sorokit: ' +(err instanceof Error ? err.message : String(err)) + '</div>'
    throw err
  }
}

function Root() {
  const [client, setClient] = useState<SorokitClient>(createClient)

  // Retrying re-attempts client creation, so a boundary tripped by a failed
  // initialisation comes back with a fresh client instead of the broken one.
  const handleRetry = useCallback(() => {
    setClient(createClient())
  }, [])

  return (
    <ErrorBoundary onRetry={handleRetry}>
      <App client={client} />
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
