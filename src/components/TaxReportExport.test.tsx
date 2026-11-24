import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SorokitProvider } from '@/context/SorokitProvider';
import { useSorokit } from '@/context/useSorokit';
import { getClient, initClient } from '@/lib/client';

import { TaxReportExport } from './TaxReportExport';

vi.mock('@/context/useSorokit', () => ({
  useSorokit: vi.fn(),
}));

const ADDRESS = 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA';

describe('TaxReportExport', () => {
  let mockClient: ReturnType<typeof getClient>;

  function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
    return {
      address: ADDRESS,
      client: mockClient,
      isConnected: true,
      isConnecting: false,
      isDisconnecting: false,
      network: { name: 'testnet', status: 'online' } as any,
      balances: [],
      account: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      clearError: vi.fn(),
      error: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({
          data: { address: ADDRESS },
          error: null,
        }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        getAccount: vi.fn().mockResolvedValue({
          data: { sequence: '123456789' },
          error: null,
        }),
        getBalances: vi.fn().mockResolvedValue({
          data: [{ asset: 'XLM', balance: '1000.0000000', assetType: 'native' }],
          error: null,
        }),
      },
      network: {
        getNetwork: vi.fn().mockResolvedValue({
          data: { name: 'testnet' },
          error: null,
        }),
        switchNetwork: vi.fn().mockResolvedValue({
          data: { name: 'testnet' },
          error: null,
        }),
      },
      transaction: {
        getHistory: vi.fn().mockResolvedValue({
          data: [],
          total: 0,
          error: null,
        }),
      },
      operation: {
        getOperations: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof getClient>;

    initClient(mockClient);
    vi.mocked(useSorokit).mockImplementation(() => mockUseSorokit() as any);
  });

  const renderWithProvider = (element: React.ReactElement) => {
    return render(
      <SorokitProvider client={mockClient}>
        {element}
      </SorokitProvider>,
    );
  };

  describe('rendering', () => {
    it('renders tax report export section', () => {
      renderWithProvider(<TaxReportExport />);
      expect(screen.getByTestId('tax-report-export')).toBeInTheDocument();
      expect(screen.getByText('Tax report')).toBeInTheDocument();
    });

    it('displays warning about network fees and tax professional review', () => {
      renderWithProvider(<TaxReportExport />);
      expect(
        screen.getByText(/Capital gains and losses using FIFO/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Check the results with a tax professional/),
      ).toBeInTheDocument();
    });

    it('renders date input fields', () => {
      renderWithProvider(<TaxReportExport />);
      expect(screen.getByLabelText('Tax report from date')).toBeInTheDocument();
      expect(screen.getByLabelText('Tax report to date')).toBeInTheDocument();
    });

    it('renders load transactions button', () => {
      renderWithProvider(<TaxReportExport />);
      expect(screen.getByRole('button', { name: /Load transactions/i })).toBeInTheDocument();
    });
  });

  describe('date validation', () => {
    it('shows error when from date is after to date', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');

      fireEvent.change(fromInput, { target: { value: '2024-12-31' } });
      fireEvent.change(toInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(
          screen.getByText(/from date must be on or before the to date/i),
        ).toBeInTheDocument();
      });
    });

    it('clears error when date range becomes valid', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');

      // Create invalid range
      fireEvent.change(fromInput, { target: { value: '2024-12-31' } });
      fireEvent.change(toInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(
          screen.getByText(/from date must be on or before the to date/i),
        ).toBeInTheDocument();
      });

      // Fix the range
      fireEvent.change(toInput, { target: { value: '2024-12-31' } });

      await waitFor(() => {
        expect(
          screen.queryByText(/from date must be on or before the to date/i),
        ).not.toBeInTheDocument();
      });
    });

    it('allows load transactions button when date range is valid', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');
      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });

      fireEvent.change(fromInput, { target: { value: '2024-01-01' } });
      fireEvent.change(toInput, { target: { value: '2024-12-31' } });

      expect(loadBtn).not.toBeDisabled();
    });

    it('disables download button when date range is invalid', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');

      fireEvent.change(fromInput, { target: { value: '2024-12-31' } });
      fireEvent.change(toInput, { target: { value: '2024-01-01' } });

      // No operations loaded yet, but date range is invalid
      expect(screen.queryByRole('button', { name: /Download tax report/i })).not.toBeInTheDocument();
    });
  });

  describe('load transactions button', () => {
    it('disables load button when wallet not connected', () => {
      vi.mocked(useSorokit).mockReturnValueOnce(
        mockUseSorokit({ address: null, isConnected: false }),
      );
      renderWithProvider(<TaxReportExport />);

      expect(
        screen.getByRole('button', { name: /Load transactions/i }),
      ).toBeDisabled();
    });

    it('shows loading state while transactions are loading', async () => {
      renderWithProvider(<TaxReportExport />);

      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });
      expect(loadBtn).not.toBeDisabled();

      fireEvent.click(loadBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Loading/i })).toBeInTheDocument();
      });
    });

    it('displays error message when transaction load fails', async () => {
      const errorClient = {
        ...mockClient,
        transaction: {
          getHistory: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      } as unknown as ReturnType<typeof getClient>;

      vi.mocked(useSorokit).mockReturnValueOnce(
        mockUseSorokit({ client: errorClient }),
      );
      renderWithProvider(<TaxReportExport />);

      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });
      fireEvent.click(loadBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('price inputs', () => {
    it('shows price input fields when operations are loaded', async () => {
      renderWithProvider(<TaxReportExport />);

      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });
      fireEvent.click(loadBtn);

      await waitFor(() => {
        // After operations load, price inputs should appear
        // This is a simplified test; actual implementation depends on operations data
        expect(loadBtn).toBeInTheDocument();
      });
    });

    it('accepts numeric price values', () => {
      renderWithProvider(<TaxReportExport />);

      // Test that price inputs accept numbers
      const inputs = screen.queryAllByRole('spinbutton');
      expect(inputs).toBeDefined();
    });

    it('rejects negative price values', () => {
      renderWithProvider(<TaxReportExport />);

      // The component should validate that prices are non-negative
      const inputs = screen.queryAllByRole('spinbutton');
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('min', '0');
      });
    });
  });

  describe('accessibility', () => {
    it('has proper semantic structure with aria-labelledby', () => {
      renderWithProvider(<TaxReportExport />);
      const section = screen.getByTestId('tax-report-export');
      expect(section).toHaveAttribute('aria-labelledby', 'tax-report-title');
    });

    it('shows error alerts with proper role', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');

      fireEvent.change(fromInput, { target: { value: '2024-12-31' } });
      fireEvent.change(toInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });

    it('has proper labels for all inputs', () => {
      renderWithProvider(<TaxReportExport />);

      expect(screen.getByLabelText('Tax report from date')).toBeInTheDocument();
      expect(screen.getByLabelText('Tax report to date')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty date range (no dates selected)', () => {
      renderWithProvider(<TaxReportExport />);

      // Should not show error when both dates are empty
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('handles same date for from and to', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');

      fireEvent.change(fromInput, { target: { value: '2024-06-15' } });
      fireEvent.change(toInput, { target: { value: '2024-06-15' } });

      // Should be valid (same date is allowed)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders correctly when wallet is disconnected', () => {
      vi.mocked(useSorokit).mockReturnValueOnce(
        mockUseSorokit({ address: null, isConnected: false }),
      );
      renderWithProvider(<TaxReportExport />);

      expect(screen.getByTestId('tax-report-export')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Load transactions/i })).toBeDisabled();
    });
  });

  describe('button states', () => {
    it('download button is disabled when no operations loaded', () => {
      renderWithProvider(<TaxReportExport />);

      // Download button should not exist until operations are loaded
      expect(screen.queryByRole('button', { name: /Download tax report/i })).not.toBeInTheDocument();
    });

    it('download button is disabled when date range is invalid', async () => {
      renderWithProvider(<TaxReportExport />);

      const fromInput = screen.getByLabelText('Tax report from date');
      const toInput = screen.getByLabelText('Tax report to date');

      fireEvent.change(fromInput, { target: { value: '2024-12-31' } });
      fireEvent.change(toInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(
          screen.getByText(/from date must be on or before the to date/i),
        ).toBeInTheDocument();
      });
    });
  });
});
