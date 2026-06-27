/**
 * Sorokit UI - React components for Stellar/Soroban development
 * 
 * @packageDocumentation
 * 
 * @example
 * ```tsx
 * import { SorokitProvider, SorobanPanel } from 'sorokit-ui';
 * 
 * export function App() {
 *   return (
 *     <SorokitProvider>
 *       <SorobanPanel />
 *     </SorokitProvider>
 *   );
 * }
 * ```
 */

// Export all components
export { SorobanPanel } from './SorobanPanel';
export { TransactionPanel } from './TransactionPanel';
export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';
export { FeeEstimator } from './FeeEstimator';
export type { FeeEstimatorProps } from './FeeEstimator';
export { ContractEventFeed } from './ContractEventFeed';
export type { ContractEventFeedProps } from './ContractEventFeed';

// Export providers and hooks
export { SorokitProvider } from './providers/SorokitProvider';
export { useClient } from './hooks/useClient';

// Export types
export type { SorokitClient } from '../lib/client';
export type { Transaction, ContractEvent } from '../lib/types';
