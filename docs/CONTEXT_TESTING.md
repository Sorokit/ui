# Context Provider Testing Guide

This guide covers testing patterns for React Context providers and hooks in the Sorokit UI library.

## Table of Contents

- [Basic Context Testing](#basic-context-testing)
- [Provider Testing](#provider-testing)
- [Hook Testing](#hook-testing)
- [Integration Testing](#integration-testing)
- [Error Scenarios](#error-scenarios)
- [Performance Testing](#performance-testing)
- [Common Patterns](#common-patterns)

## Basic Context Testing

### Setting Up Context Tests

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// Example context
const MyContext = createContext<{ value: string } | undefined>(undefined);

export function MyProvider({ children }: { children: ReactNode }) {
  return (
    <MyContext.Provider value={{ value: 'test' }}>
      {children}
    </MyContext.Provider>
  );
}

function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
}

// Consumer component for testing
function Consumer() {
  const { value } = useMyContext();
  return <div>{value}</div>;
}

describe('MyContext', () => {
  it('provides context value to consumers', () => {
    render(
      <MyProvider>
        <Consumer />
      </MyProvider>,
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('throws error when used outside provider', () => {
    expect(() => {
      render(<Consumer />);
    }).toThrow('useMyContext must be used within MyProvider');
  });
});
```

## Provider Testing

### Testing Provider Initialization

```typescript
describe('SorokitProvider', () => {
  let mockClient: ReturnType<typeof getClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useSorokit(), {
      wrapper: ({ children }) => (
        <SorokitProvider client={mockClient}>
          {children}
        </SorokitProvider>,
      ),
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.balances).toEqual([]);
  });

  it('provides client to consumers', () => {
    const { result } = renderHook(() => useSorokit(), {
      wrapper: ({ children }) => (
        <SorokitProvider client={mockClient}>
          {children}
        </SorokitProvider>,
      ),
    });

    expect(result.current.client).toBe(mockClient);
  });
});
```

### Testing Provider Props

```typescript
it('accepts and uses custom client', () => {
  const customClient = createMockClient({
    wallet: {
      connect: vi.fn().mockResolvedValue({
        data: { address: 'CUSTOM_ADDRESS' },
        error: null,
      }),
    },
  });

  const { result } = renderHook(() => useSorokit(), {
    wrapper: ({ children }) => (
      <SorokitProvider client={customClient}>
        {children}
      </SorokitProvider>,
    ),
  });

  expect(result.current.client).toBe(customClient);
});

it('updates context when client prop changes', () => {
  const client1 = createMockClient();
  const client2 = createMockClient();

  const { result, rerender } = renderHook(() => useSorokit(), {
    wrapper: ({ children, client = client1 }) => (
      <SorokitProvider client={client}>
        {children}
      </SorokitProvider>,
    ),
  });

  expect(result.current.client).toBe(client1);

  rerender({ client: client2 });
  expect(result.current.client).toBe(client2);
});
```

## Hook Testing

### Using renderHook for Custom Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react';

describe('useSorokit hook', () => {
  it('connects wallet on demand', async () => {
    const mockClient = createMockClient();

    const { result } = renderHook(() => useSorokit(), {
      wrapper: ({ children }) => (
        <SorokitProvider client={mockClient}>
          {children}
        </SorokitProvider>,
      ),
    });

    expect(result.current.isConnected).toBe(false);

    // Trigger wallet connection
    await act(async () => {
      await result.current.connectWallet();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.address).toBeDefined();
    });
  });

  it('disconnects wallet when disconnect is called', async () => {
    const mockClient = createMockClient();

    const { result } = renderHook(() => useSorokit(), {
      wrapper: ({ children }) => (
        <SorokitProvider client={mockClient}>
          {children}
        </SorokitProvider>,
      ),
    });

    // Connect first
    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.isConnected).toBe(true);

    // Disconnect
    await act(async () => {
      await result.current.disconnectWallet();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });
});
```

### Testing Hook Dependencies

```typescript
it('updates when dependencies change', () => {
  const mockClient = createMockClient();
  let trigger = { value: 1 };

  const { result, rerender } = renderHook(
    () => useDependentHook(trigger.value),
    {
      wrapper: ({ children }) => (
        <SorokitProvider client={mockClient}>
          {children}
        </SorokitProvider>,
      ),
    },
  );

  expect(result.current).toBe(1);

  trigger = { value: 2 };
  rerender();

  expect(result.current).toBe(2);
});
```

## Integration Testing

### Testing Multiple Providers Together

```typescript
it('works with multiple nested providers', () => {
  const { result } = renderHook(() => useSorokit(), {
    wrapper: ({ children }) => (
      <ErrorBoundary>
        <SorokitProvider client={mockClient}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SorokitProvider>
      </ErrorBoundary>,
    ),
  });

  expect(result.current).toBeDefined();
});
```

### Testing Consumer Components with Multiple Contexts

```typescript
function MultiContextConsumer() {
  const sorokit = useSorokit();
  const toast = useToast();

  return (
    <div>
      <p>{sorokit.address}</p>
      <button onClick={() => toast.success('Success')}>
        Show Toast
      </button>
    </div>
  );
}

it('renders with multiple contexts', () => {
  render(
    <SorokitProvider client={mockClient}>
      <ToastProvider>
        <MultiContextConsumer />
      </ToastProvider>
    </SorokitProvider>,
  );

  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

## Error Scenarios

### Testing Hook Error Handling

```typescript
describe('Error handling', () => {
  it('handles wallet connection failure gracefully', async () => {
    const errorClient = createMockClient({
      wallet: {
        connect: vi.fn().mockResolvedValue({
          data: null,
          error: 'User denied connection',
        }),
      },
    });

    const { result } = renderHook(() => useSorokit(), {
      wrapper: ({ children }) => (
        <SorokitProvider client={errorClient}>
          {children}
        </SorokitProvider>,
      ),
    });

    await act(async () => {
      await result.current.connectWallet();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('User denied connection');
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('provides error message to consumers', () => {
    const errorClient = createMockClient({
      account: {
        getAccount: vi.fn().mockResolvedValue({
          data: null,
          error: 'Network error',
        }),
      },
    });

    render(
      <SorokitProvider client={errorClient}>
        <ErrorDisplay />
      </SorokitProvider>,
    );

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('throws when hook is used outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useSorokit());
    }).toThrow();

    spy.mockRestore();
  });
});
```

### Testing Provider Error Boundaries

```typescript
it('renders error boundary when provider fails', () => {
  const ThrowingProvider = () => {
    throw new Error('Provider initialization failed');
  };

  expect(() => {
    render(
      <ErrorBoundary fallback={<div>Error</div>}>
        <ThrowingProvider />
      </ErrorBoundary>,
    );
  }).toThrow();
});
```

## Performance Testing

### Testing Unnecessary Re-renders

```typescript
it('does not cause unnecessary re-renders', () => {
  const renderSpy = vi.fn();

  function Consumer() {
    renderSpy();
    const { address } = useSorokit();
    return <div>{address}</div>;
  }

  const { rerender } = render(
    <SorokitProvider client={mockClient}>
      <Consumer />
    </SorokitProvider>,
  );

  expect(renderSpy).toHaveBeenCalledTimes(1);

  rerender(
    <SorokitProvider client={mockClient}>
      <Consumer />
    </SorokitProvider>,
  );

  // Should only re-render if props changed
  expect(renderSpy).toHaveBeenCalledTimes(1);
});
```

### Testing Memoization

```typescript
it('memoizes context value correctly', () => {
  let renderCount = 0;

  function CountingConsumer() {
    renderCount++;
    const context = useSorokit();
    return <div>{context.address}</div>;
  }

  const mockClient = createMockClient();

  const { rerender } = render(
    <SorokitProvider client={mockClient}>
      <CountingConsumer />
    </SorokitProvider>,
  );

  const firstRenderCount = renderCount;

  rerender(
    <SorokitProvider client={mockClient}>
      <CountingConsumer />
    </SorokitProvider>,
  );

  // Consumer should not re-render if context value is memoized
  expect(renderCount).toBe(firstRenderCount);
});
```

## Common Patterns

### Mock Provider Factory

```typescript
export function createMockProvider(overrides = {}) {
  const mockClient = createMockClient(overrides.client);

  return ({ children }: { children: ReactNode }) => (
    <SorokitProvider client={mockClient}>
      {children}
    </SorokitProvider>
  );
}

// Usage in tests
const { result } = renderHook(() => useSorokit(), {
  wrapper: createMockProvider(),
});
```

### Test Utility Wrapper

```typescript
export function renderWithProviders(
  ui: ReactElement,
  {
    client = createMockClient(),
    ...renderOptions
  } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SorokitProvider client={client}>
        {children}
      </SorokitProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Usage
renderWithProviders(<MyComponent />);
```

### Reusable Test Fixtures

```typescript
export const mockContextStates = {
  disconnected: {
    isConnected: false,
    address: null,
    balances: [],
  },
  connected: {
    isConnected: true,
    address: 'GBRP...',
    balances: [{ asset: 'XLM', balance: '100.00' }],
  },
  loading: {
    isConnected: true,
    isLoadingAccount: true,
    address: 'GBRP...',
    balances: [],
  },
  error: {
    isConnected: false,
    error: 'Connection failed',
    address: null,
    balances: [],
  },
};

// Usage
it('shows error state', () => {
  const mockClient = createMockClient();
  mockClient.account.getAccount = vi.fn().mockResolvedValue({
    data: null,
    error: mockContextStates.error.error,
  });

  const { result } = renderHook(() => useSorokit(), {
    wrapper: ({ children }) => (
      <SorokitProvider client={mockClient}>
        {children}
      </SorokitProvider>,
    ),
  });

  expect(result.current.error).toBe(mockContextStates.error.error);
});
```

---

## Best Practices for Context Testing

1. **Use renderHook for custom hooks**: Keeps tests focused on hook behavior
2. **Always provide necessary providers**: Use wrapper option in renderHook
3. **Test error paths**: Don't just test the happy path
4. **Mock external dependencies**: Mock API calls and child contexts
5. **Test state updates**: Use act() for async state updates
6. **Verify memoization**: Ensure context values are properly memoized
7. **Test cleanup**: Verify providers clean up resources on unmount
8. **Keep mocks reusable**: Use factory functions for common mock setup
9. **Test isolation**: Each test should be independent and not rely on others
10. **Use meaningful fixtures**: Create realistic mock data for comprehensive testing

---

For more information, see the [React Testing Library hooks documentation](https://testing-library.com/docs/react-testing-library/api#renderhook) and the [React Context documentation](https://react.dev/reference/react/useContext).
