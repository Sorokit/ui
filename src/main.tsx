import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.tsx'
import { createClientAdapter } from './lib/adapter'

// Initialize client adapter (no hardcoded mock address)
const clientAdapter = createClientAdapter()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App adapter={clientAdapter} />
  </React.StrictMode>,
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App adapter={clientAdapter} />
  </React.StrictMode>,
)
