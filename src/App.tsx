import './App.css'

import { useState } from 'react'

import { ClientAdapter } from './lib/adapter'

interface AppProps {
  adapter: ClientAdapter
}

function App({ adapter }: AppProps) {
  const [address, setAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    
    const result = await adapter.connect()
    
    if (result.status === 'error') {
      setError(result.error)
    } else {
      setAddress(result.data)
    }
    
    setLoading(false)
  }

  return (
    <div className="App">
      <h1>Sorokit UI</h1>
      
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}
      
      {address ? (
        <div className="connected">
          <p>Connected: {address.substring(0, 8)}...</p>
          <button onClick={() => adapter.disconnect()}>Disconnect</button>
        </div>
      ) : (
        <button onClick={handleConnect} disabled={loading}>
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  )
}

export default App
