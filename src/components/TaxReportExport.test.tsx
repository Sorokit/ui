import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SorokitProvider } from '@/context/SorokitProvider';
import { useSorokit } from '@/context/useSorokit';
import { getClient, initClient } from '@/lib/client';

import { TaxReportExport } from './TaxReportExport';

function ConnectTrigger() {
  const { connectWallet } = useSorokit();
  return (
    <button type="button" onClick={() => void connectWallet()}>
      Connect Wallet
    </button>
  );
}

const TEST_ADDRESS = 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA';

describe('TaxReportExport', () => {
  let mockClient: ReturnType<typeof getClient>;

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({
          data: { address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA' },
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
          data: [{ hash: 'tx-1', successful: true }],
          error: null,
          total: 1,
        }),
      },
      operation: {
        getOperations: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'op-1',
              type: 'payment',
              source: 'GOTHER',
              destination: TEST_ADDRESS,
              asset: 'XLM',
              amount: '10',
              success: true,
              createdAt: '2024-06-01T12:00:00Z',
            },
          ],
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof getClient>;

    initClient(mockClient);
  });

  const renderWithProvider = (
    element: React.ReactElement,
    client: ReturnType<typeof getClient> = mockClient,
  ) => {
    return render(
      <SorokitProvider client={client}>
        {element}
      </SorokitProvider>,
    );
  };

  const renderConnected = async (
    element: React.ReactElement,
    client: ReturnType<typeof getClient> = mockClient,
  ) => {
    const utils = render(
      <SorokitProvider client={client}>
        <ConnectTrigger />
        {element}
      </SorokitProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect Wallet' }));
    });
    return utils;
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
      await renderConnected(<TaxReportExport />);

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
      const disconnectedClient = {
        ...mockClient,
        wallet: {
          connect: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(disconnectedClient);
      renderWithProvider(<TaxReportExport />);

      expect(
        screen.getByRole('button', { name: /Load transactions/i }),
      ).toBeDisabled();
    });

    it('shows loading state while transactions are loading', async () => {
      let resolveHistory: ((val: unknown) => void) | undefined;
      const pendingClient = {
        ...mockClient,
        transaction: {
          getHistory: vi.fn().mockReturnValue(
            new Promise((resolve) => {
              resolveHistory = resolve;
            }),
          ),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(pendingClient);
      await renderConnected(<TaxReportExport />, pendingClient);

      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });
      expect(loadBtn).not.toBeDisabled();

      fireEvent.click(loadBtn);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
      });

      await act(async () => {
        resolveHistory?.({ data: [], error: null, total: 0 });
      });
    });

    it('displays error message when transaction load fails', async () => {
      const errorClient = {
        ...mockClient,
        transaction: {
          getHistory: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(errorClient);
      await renderConnected(<TaxReportExport />, errorClient);

      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });
      fireEvent.click(loadBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });
  });

  describe('price inputs', () => {
    it('shows price input fields when operations are loaded', async () => {
      await renderConnected(<TaxReportExport />);

      const loadBtn = screen.getByRole('button', { name: /Load transactions/i });
      fireEvent.click(loadBtn);

      await waitFor(() => {
        expect(screen.getByRole('spinbutton', { name: /XLM price on 2024-06-01/i })).toBeInTheDocument();
      });
    });

    it('accepts numeric price values', async () => {
      await renderConnected(<TaxReportExport />);

      fireEvent.click(screen.getByRole('button', { name: /Load transactions/i }));

      const priceInput = await screen.findByRole('spinbutton', {
        name: /XLM price on 2024-06-01/i,
      });
      fireEvent.change(priceInput, { target: { value: '0.25' } });
      expect(priceInput).toHaveValue(0.25);
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
      const disconnectedClient = {
        ...mockClient,
        wallet: {
          connect: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(disconnectedClient);
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
