import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SorokitProvider } from './context/SorokitProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initClient } from './lib/client'
import { createMockClient } from './lib/mock-client'

// Initialize the client singleton
const client = createMockClient()
initClient(client)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SorokitProvider client={client}>
        <App />
      </SorokitProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
