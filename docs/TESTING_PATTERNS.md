# Component Testing Patterns

This guide documents the recommended patterns and best practices for testing components in the Sorokit UI library.

## Table of Contents

- [Basic Component Tests](#basic-component-tests)
- [Testing Connected Components](#testing-connected-components)
- [Testing Async Operations](#testing-async-operations)
- [Testing Error States](#testing-error-states)
- [Testing User Interactions](#testing-user-interactions)
- [Testing Accessibility](#testing-accessibility)
- [Testing Edge Cases](#testing-edge-cases)
- [Mock Data Patterns](#mock-data-patterns)

## Basic Component Tests

### Simple Render Test

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('expected content')).toBeInTheDocument();
  });
});
```

### Testing Props

```typescript
it('applies className prop', () => {
  render(<MyComponent className="custom-class" />);
  expect(screen.getByTestId('my-component')).toHaveClass('custom-class');
});

it('calls onClick callback when button clicked', () => {
  const onClick = vi.fn();
  render(<MyComponent onClick={onClick} />);
  fireEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalled();
});
```

## Testing Connected Components

### With SorokitProvider

Most components require `SorokitProvider` context. Create a mock client and use it:

```typescript
import { SorokitProvider } from '@/context/SorokitProvider';
import { initClient } from '@/lib/client';

describe('ConnectedComponent', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({
          data: { address: 'GBRP...' },
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
          data: [{ asset: 'XLM', balance: '100.0000000', assetType: 'native' }],
          error: null,
        }),
      },
    };

    initClient(mockClient);
  });

  it('should render with provider', () => {
    render(
      <SorokitProvider client={mockClient}>
        <ConnectedComponent />
      </SorokitProvider>,
    );
    expect(screen.getByTestId('connected-component')).toBeInTheDocument();
  });
});
```

### Helper Function for DRY Tests

```typescript
const renderWithProvider = (element, { client = mockClient } = {}) => {
  return render(
    <SorokitProvider client={client}>
      {element}
    </SorokitProvider>,
  );
};

// Usage
it('should fetch balances', async () => {
  renderWithProvider(<BalanceComponent />);
  await waitFor(() => {
    expect(screen.getByText('100.00')).toBeInTheDocument();
  });
});
```

## Testing Async Operations

### Waiting for Async Updates

```typescript
it('should display data after fetch', async () => {
  render(<MyComponent />);

  // Wait for the data to load
  await waitFor(() => {
    expect(screen.getByText('Loaded Data')).toBeInTheDocument();
  });
});
```

### Testing Delayed Operations

```typescript
it('should debounce input changes', async () => {
  const onChange = vi.fn();
  render(<SearchComponent onChange={onChange} />);

  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'search' } });
  fireEvent.change(input, { target: { value: 'search term' } });

  expect(onChange).not.toHaveBeenCalled();

  // Wait for debounce to complete
  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith('search term');
  });
});
```

### Using Fake Timers

```typescript
import { beforeEach, afterEach } from 'vitest';

describe('Debounced Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces api calls', () => {
    const mockApi = vi.fn();
    render(<DebounceComponent onSearch={mockApi} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'query' },
    });

    expect(mockApi).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(mockApi).toHaveBeenCalledWith('query');
  });
});
```

## Testing Error States

### Network Errors

```typescript
it('should display error message on network failure', async () => {
  const errorClient = {
    account: {
      getAccount: vi.fn().mockResolvedValue({
        data: null,
        error: 'Network connection failed',
      }),
    },
  };

  renderWithProvider(<MyComponent />, { client: errorClient });

  await waitFor(() => {
    expect(
      screen.getByText(/Network connection failed/i),
    ).toBeInTheDocument();
  });
});
```

### Retry Logic

```typescript
it('allows retry after failure', async () => {
  const mockFn = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: 'Failed' })
    .mockResolvedValueOnce({ data: { result: 'success' }, error: null });

  const errorClient = {
    account: { getAccount: mockFn },
  };

  renderWithProvider(<MyComponent />, { client: errorClient });

  await waitFor(() => {
    expect(screen.getByText(/Failed/i)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: /retry/i }));

  await waitFor(() => {
    expect(screen.getByText('success')).toBeInTheDocument();
  });
});
```

### Error Boundaries

```typescript
it('should catch errors and display fallback UI', () => {
  const ThrowComponent = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary fallback={<div>Error occurred</div>}>
      <ThrowComponent />
    </ErrorBoundary>,
  );

  expect(screen.getByText('Error occurred')).toBeInTheDocument();
});
```

## Testing User Interactions

### Form Submission

```typescript
it('submits form with valid data', async () => {
  const onSubmit = vi.fn();
  render(<PaymentForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '100' },
  });
  fireEvent.change(screen.getByLabelText('Destination'), {
    target: { value: 'GBRP...' },
  });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      amount: '100',
      destination: 'GBRP...',
    });
  });
});
```

### Click Events

```typescript
it('toggles visibility on button click', () => {
  render(<ToggleComponent />);

  expect(screen.getByTestId('content')).toHaveClass('hidden');

  fireEvent.click(screen.getByRole('button', { name: /show/i }));
  expect(screen.getByTestId('content')).not.toHaveClass('hidden');

  fireEvent.click(screen.getByRole('button', { name: /hide/i }));
  expect(screen.getByTestId('content')).toHaveClass('hidden');
});
```

### Keyboard Events

```typescript
it('closes modal on Escape key', () => {
  render(<Modal isOpen={true} />);

  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

## Testing Accessibility

### ARIA Labels and Roles

```typescript
it('has proper semantic structure', () => {
  render(<MyComponent />);

  // Check for proper roles
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('navigation')).toBeInTheDocument();

  // Check for labels
  expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
});
```

### Aria-Invalid and Aria-Describedby

```typescript
it('marks input as invalid with error message', async () => {
  render(<PaymentForm />);

  const input = screen.getByLabelText('Amount');
  fireEvent.change(input, { target: { value: '-100' } });

  await waitFor(() => {
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute(
      'aria-describedby',
      screen.getByTestId('amount-error').id,
    );
  });
});
```

## Testing Edge Cases

### Empty States

```typescript
it('displays empty state when no items', () => {
  const emptyClient = {
    account: { getBalances: vi.fn().mockResolvedValue({ data: [], error: null }) },
  };

  renderWithProvider(<BalanceList />, { client: emptyClient });

  expect(screen.getByText('No balances found')).toBeInTheDocument();
});
```

### Boundary Values

```typescript
it('handles zero balance correctly', async () => {
  renderWithProvider(<BalanceDisplay balance="0.0000000" />);
  expect(screen.getByText('0.00')).toBeInTheDocument();
});

it('handles very large balances', async () => {
  renderWithProvider(<BalanceDisplay balance="999999999.9999999" />);
  expect(screen.getByText(/999999999/)).toBeInTheDocument();
});
```

### Null/Undefined Props

```typescript
it('handles undefined optional props', () => {
  render(<MyComponent subtitle={undefined} />);
  expect(screen.queryByText('Subtitle')).not.toBeInTheDocument();
});
```

## Mock Data Patterns

### Standard Mock Client

```typescript
export const createMockClient = (overrides = {}) => ({
  wallet: {
    connect: vi.fn().mockResolvedValue({
      data: { address: 'GBRP...' },
      error: null,
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides.wallet,
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
    ...overrides.account,
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
    ...overrides.network,
  },
  transaction: {
    submit: vi.fn().mockResolvedValue({
      data: { hash: 'txhash...', ledger: 123 },
      error: null,
    }),
    estimateFee: vi.fn().mockResolvedValue({
      data: { baseFee: '100', recommended: '100' },
      error: null,
    }),
    ...overrides.transaction,
  },
});

// Usage
const mockClient = createMockClient({
  wallet: {
    connect: vi.fn().mockRejectedValue('User denied connection'),
  },
});
```

### Reusable Test Fixtures

```typescript
export const VALID_DESTINATION = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';
export const MOCK_ADDRESS = 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA';
export const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const MOCK_BALANCES = [
  { asset: 'XLM', balance: '1000.0000000', assetType: 'native' },
  { asset: 'USDC', balance: '500.0000000', assetType: 'credit_alphanum4', assetIssuer: USDC_ISSUER },
];
```

## Best Practices Summary

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it.
2. **Use Semantic Queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`.
3. **Wait for Async Updates**: Always use `waitFor` for asynchronous operations.
4. **Mock External Dependencies**: Mock API calls and context providers.
5. **Test Error Paths**: Don't just test the happy path; test error and edge cases.
6. **Keep Tests DRY**: Use helper functions and fixtures to reduce duplication.
7. **Test Accessibility**: Include tests for ARIA labels, roles, and keyboard interactions.
8. **Use Fake Timers for Timing**: Use `vi.useFakeTimers()` for deterministic testing of delays.
9. **Clean Up After Tests**: Always restore mocks and timers in `afterEach` hooks.
10. **Use Descriptive Test Names**: Test names should clearly describe what they're testing.

---

For more information, see the [Vitest docs](https://vitest.dev/) and [React Testing Library docs](https://testing-library.com/docs/react-testing-library/intro/).
