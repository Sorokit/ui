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

## Continuous Integration

Every push and pull request runs `.github/workflows/test.yml`, which enforces
the following checks (all must pass before a PR can be merged):

| Step           | Command                                  | Purpose                                                              |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Lint           | `npm run lint`                           | ESLint over `.ts`/`.tsx` sources.                                    |
| Typecheck      | `npm run typecheck`                      | Catches type errors across the **full** source tree, not just the build entrypoint. |
| Build          | `npm run build`                          | Produces the library bundle in `dist/`.                             |
| Bundle size    | `npm run size`                           | Fails if the published bundle exceeds the **50 KB gzipped** budget. |
| Verify exports | `npm run test:exports`                   | Type-checks `src/verify-exports.ts` so the public API can't silently break. |
| Tests          | `npm test`                               | Runs the Vitest suite.                                              |

### Bundle size budget

Bundle size is tracked with [`size-limit`](https://github.com/ai/size-limit).
The budget is configured in the `size-limit` field of `package.json` and is
currently **50 KB gzipped** for each of the ES and CommonJS bundles. Run it
locally after a build:

```bash
npm run build
npm run size
```

If a change pushes the bundle over budget, the check fails with a clear message
showing the current size versus the limit. Avoid this by keeping runtime
dependencies in `devDependencies` where possible and lazy-loading heavy assets.

## Code Review

- All PRs must have at least one approval
- CI checks must pass (lint, typecheck, build, bundle size, exports, tests)
- New components must include JSDoc comments
- Breaking changes need documentation updates

## Release Process

For maintainers and contributors cutting a new release:
1. Ensure all CI checks pass on `main`.
2. Follow semantic versioning (`patch`, `minor`, `major`) and Keep a Changelog guidelines.
3. Detailed step-by-step release instructions are documented in [RELEASING.md](./RELEASING.md).

## Questions?

Open an issue or ask in discussions. We're here to help!
