# Contributing to Sorokit UI

## Setup

```bash
npm install
npm run dev
```

## Code Standards

- Write TypeScript with strict mode enabled
- Follow the existing code style (use ESLint)
- All components must be exported with full JSDoc comments
- Test all public APIs

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit changes: `git commit -m "feat: description"`
4. Push to fork: `git push origin feat/your-feature`
5. Open a Pull Request

## Testing

### Running Tests

Run the full test suite:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Test File Conventions

- Test files live alongside source files: `src/components/MyComponent.test.ts`
- Use `.test.ts` or `.test.tsx` extension
- Use Vitest for unit tests and Vitest's mocking utilities
- Use `@testing-library/react` for component tests

### Testing with SorokitProvider

Most components require `SorokitProvider` context. Use the `renderWithProvider` helper:

```typescript
import { render } from '@testing-library/react';
import { renderWithProvider } from './test-utils';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render with provider', () => {
    const { getByText } = renderWithProvider(<MyComponent />);
    expect(getByText('content')).toBeInTheDocument();
  });
});
```

### Mocking getClient()

Mock the Sorokit client for isolated component tests:

```typescript
import { vi } from 'vitest';
import { getClient } from '../lib/client';

vi.mock('../lib/client', () => ({
  getClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue('G...'),
    invokeContract: vi.fn().mockResolvedValue({ data: null }),
    getEvents: vi.fn().mockResolvedValue([]),
  })),
}));

describe('MyComponent', () => {
  it('should call client on mount', async () => {
    renderWithProvider(<MyComponent />);
    await waitFor(() => {
      expect(getClient).toHaveBeenCalled();
    });
  });
});
```

### Mocking SorokitProvider

For full integration tests, use `renderWithProvider`:

```typescript
import { renderWithProvider } from './test-utils';

const mockClient = {
  connect: vi.fn().mockResolvedValue('GBRP...'),
  invokeContract: vi.fn().mockResolvedValue({ data: { value: '123' } }),
};

describe('MyComponent', () => {
  it('should display contract data', async () => {
    const { getByText } = renderWithProvider(
      <MyComponent />,
      { client: mockClient }
    );
    
    await waitFor(() => {
      expect(getByText('123')).toBeInTheDocument();
    });
  });
});
```

## Code Review

- All PRs must have at least one approval
- CI checks must pass (tests, lint, build)
- New components must include JSDoc comments
- Breaking changes need documentation updates

## Questions?

Open an issue or ask in discussions. We're here to help!
