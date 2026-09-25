# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initializing splash loading state in `App` and `SorokitProvider` (`isInitializing: boolean`) with brand logo, spinner, and accessible screen-reader announcement (`aria-live="polite"`) (#500).
- Release documentation in `RELEASING.md` and `CONTRIBUTING.md` outlining the semantic versioning and publication workflow (#501).
- Bundle size tracking with `size-limit` and a 50 KB gzipped budget for the published ES and CommonJS bundles (`npm run size`).
- `npm run test:exports` script to type-check the public API surface in CI.

### Changed

- CI (`test.yml`) now runs the bundle-size check after the build and wires up the `size` and `test:exports` scripts it previously referenced.

### Fixed

- `NetworkBanner` no longer renders on the Network screen, removing the redundant "You are on <Network>" banner when the active network is already shown in the screen's content (#170).
- Added copy-to-clipboard buttons to the Passphrase, RPC URL, and Horizon URL `InfoCell`s on the Network screen, matching the existing `AddressDisplay` copy pattern, so developers can copy values for custom infrastructure setup (#170).
- `NetworkBanner` now transitions smoothly (`transition-all duration-300`) when colour and text change on network switch, instead of updating instantly (#170).

## [1.0.0] - 2026-06-27

### Added

- Initial stable release of Sorokit UI.
- `SorobanPanel` component for contract interaction.
- `TransactionPanel` component for transaction management.
- `ErrorBoundary` error handling component.
- `FeeEstimator` component for fee calculation.
- `ContractEventFeed` for contract event monitoring.
- `SorokitProvider` context for Stellar wallet integration.
- Full TypeScript support and strict type-checking.
- Comprehensive unit and integration test suites.

### Changed

- Improved performance in contract invocation.
- Better error messages and diagnostics for wallet connection failures.
- Enhanced accessibility for all components.

### Fixed

- Memory leaks in event listeners.
- Race conditions in wallet connection state.

## [0.1.0] - 2026-04-15

### Added

- Initial public preview release of Sorokit UI library for Stellar and Soroban development.
- `SorokitProvider` and `useSorokit` React context hooks for wallet connection and network management.
- Core UI components: `AccountCard`, `AddressDisplay`, `AssetBadge`, `BalanceList`, `NetworkSwitcher`, `WalletConnectModal`, `PaymentModal`, and `TransactionHistoryTable`.
- Support for Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`) and `sorokit-core`.
- Tailwind CSS styling and theme configuration with custom tokens.

[Unreleased]: https://github.com/Sorokit/ui/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Sorokit/ui/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Sorokit/ui/releases/tag/v0.1.0
