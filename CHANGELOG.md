# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-27

### Added

- Initial stable release of Sorokit UI
- `SorobanPanel` component for contract interaction
- `TransactionPanel` component for transaction management
- `ErrorBoundary` error handling
- `FeeEstimator` component for fee calculation
- `ContractEventFeed` for contract event monitoring
- `SorokitProvider` context for Stellar wallet integration
- Full TypeScript support
- Comprehensive test suite

### Changed

- Improved performance in contract invocation
- Better error messages for wallet connection failures
- Enhanced accessibility for all components

### Fixed

- Memory leaks in event listeners
- Race conditions in wallet connection

### Known Issues

#### Race Conditions in Wallet Connection (#3)
When connecting to wallet, rapid successive calls to `getClient()` may cause race conditions. **Workaround**: Wait for connection confirmation before subsequent calls.

**Status**: High priority - will be fixed in 1.1.0

#### Eager Screen Mounting Issue (#2)
The `ErrorBoundary` component mounts aggressively on load, which may cause performance issues in slow environments. This is particularly noticeable on mobile devices with limited resources.

**Status**: Under investigation - potential fix in 1.0.1

#### Broken QR Code Scanner (#8)
The QR code scanner component in `ContractEventFeed` fails to decode certain contract addresses with complex metadata. This particularly affects contracts deployed on mainnet.

**Status**: Known limitation - use manual address entry as workaround

### Deprecations

None yet

## Installation

```bash
npm install sorokit-ui
```

## Quick Start

```typescript
import { SorokitProvider, SorobanPanel } from 'sorokit-ui';

function App() {
  return (
    <SorokitProvider>
      <SorobanPanel />
    </SorokitProvider>
  );
}
```

---

### Previous Releases

See GitHub releases for older versions.
