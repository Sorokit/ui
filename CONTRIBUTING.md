# Contributing to sorokit-ui

Thanks for taking the time to contribute. This guide covers everything you need to get set up, make changes, and submit a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Mocking getClient](#mocking-getclient)
- [Commit Convention](#commit-convention)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful. We welcome contributors of all experience levels. Harassment, discrimination, or dismissive behaviour toward any contributor will not be tolerated.

---

## Getting Started

### Prerequisites

- Node.js `>=18`
- npm `>=9`
- A GitHub account

### Fork and clone

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/ui.git
cd ui

# 2. Add the upstream remote
git remote add upstream https://github.com/Sorokit/ui.git

# 3. Install dependencies
npm install
```

### Run the dev server

```bash
npm run dev
```

Open `http://localhost:5173` to see the component playground.

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

---

## Project Structure

```
src/
├── components/        # All UI components
│   └── ui/            # Base primitives (Button, Card, Badge, Input, …)
├── context/           # SorokitProvider and useSorokit hook
├── lib/               # Client adapter, mock client, and utility functions
├── screens/           # Full-page screen compositions used in the demo app
└── assets/            # Static assets
```

**Key files:**

| File | Purpose |
|---|---|
| `src/context/SorokitProvider.tsx` | React context, wallet state, account + network loading |
| `src/lib/client.ts` | `SorokitClient` interface and `getClient()` singleton |
| `src/lib/utils.ts` | Shared utilities (`truncateAddress`, `cn`, etc.) |
| `src/components/index.ts` | Public component exports |

---

## Development Workflow

1. **Sync with upstream** before starting any work:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a branch** — use a short, descriptive name:

   ```bash
   # Bug fixes
   git checkout -b fix/transaction-history-race-condition

   # New features
   git checkout -b feat/claimable-balance-card

   # Documentation / chores
   git checkout -b docs/add-contributing-guide
   ```

3. **Make your changes.** Keep commits focused — one logical change per commit.

4. **Lint and build** before pushing:

   ```bash
   npm run lint
   npm run build
   ```

5. **Push your branch** and open a pull request against `main`.

---

## Coding Standards

### TypeScript

- Strict mode is enabled (`tsconfig.app.json`). All new code must be fully typed.
- Do not use `as unknown as X` casts to suppress type errors — fix the root cause instead.
- Prefer explicit return types on exported functions and components.

### React

- Functional components only. No new class components (the existing `ErrorBoundary` is the only exception).
- Keep components focused. If a component exceeds ~150 lines it's probably doing too much.
- All `useEffect` hooks must list every reactive value they use in their dependency array. Run `npm run lint` — the `react-hooks/exhaustive-deps` rule is enforced.
- Use `useCallback` and `useMemo` where appropriate, but don't add them pre-emptively.
- Guard async effects against stale responses using a cleanup flag or `AbortController`:

  ```tsx
  useEffect(() => {
    let cancelled = false;
    fetchSomething().then((data) => {
      if (!cancelled) setState(data);
    });
    return () => { cancelled = true; };
  }, [dep]);
  ```

### Styling

- Tailwind CSS utility classes only. Do not add raw CSS files for new components.
- Use the `cn()` helper from `src/lib/utils.ts` for conditional class merging.
- Follow the existing colour token conventions (`text-ink`, `bg-surface`, `border-line`, etc.).

### Accessibility

- Every interactive element must be keyboard-accessible and have a meaningful label.
- Buttons that contain only icons must have an `aria-label`.
- Form inputs must be associated with their label via `htmlFor` / `id` or `aria-labelledby`.

---

## Mocking getClient()

Components that call `getClient()` should use Vitest module mocks in tests. The
singleton throws when no client has been initialized, so return an explicit mock
client from the `@/lib/client` mock:

```tsx
import { vi } from "vitest";
import { createMockClient } from "@/lib/mock-client";

const mockClient = createMockClient();

vi.mock("@/lib/client", () => ({
  getClient: vi.fn().mockReturnValue(mockClient),
}));
```

For components that need `useSorokit()` context, prefer the shared
`renderWithProvider()` helper from `src/__tests__/utils.tsx`. It wraps the UI in
`SorokitProvider` with a `createMockClient()` instance, and accepts a custom
client when a test needs to override wallet, account, network, transaction, or
Soroban responses.

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

| Type | When to use |
|---|---|
| `feat` | A new component or user-visible feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `chore` | Build process, dependency updates, config |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace (no logic change) |

**Examples:**

```
feat(soroban): add ContractEventFeed polling toggle
fix(TransactionHistory): prevent stale fetch overwriting current page
docs: add CONTRIBUTING.md
chore: upgrade Tailwind to v4.3
```

Keep the summary under 72 characters and written in the imperative mood ("add", "fix", "remove" — not "added", "fixes", "removed").

---

## Submitting a Pull Request

1. Open your PR against the `main` branch of `Sorokit/ui`.
2. Fill in the pull request template completely — do not delete sections.
3. **Link the related issue** using a closing keyword in the PR description:
   ```
   Closes #3
   ```
4. Make sure all CI checks pass (`lint`, `build`).
5. Keep the PR focused. One issue per PR makes review faster.
6. Be responsive to review feedback. If you disagree with a suggestion, explain why — that's a valid response.

### What makes a good PR description

- **What** was changed (reference file paths and function names)
- **Why** it was needed (link to the issue, explain the root cause)
- **How** it was implemented (brief technical summary)
- **How** it was tested (manual steps, console output, screenshots where helpful)

---

## Reporting Bugs

Use the [bug report template](https://github.com/Sorokit/ui/issues/new?template=bug_report.md).

Please include:
- The component or file where the bug occurs
- Steps to reproduce
- Expected vs actual behaviour
- Browser and Node.js versions

---

## Requesting Features

Use the [feature request template](https://github.com/Sorokit/ui/issues/new?template=feature_request.md).

For significant changes, open an issue first and discuss the approach before writing any code. This avoids wasted effort if the direction isn't a fit for the project.

---

## Questions?

Open a [GitHub Discussion](https://github.com/Sorokit/ui/discussions) or drop a comment on the relevant issue. We're happy to help.
