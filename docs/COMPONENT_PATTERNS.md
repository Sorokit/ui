# Component Design Patterns

This guide documents the recommended patterns and best practices for designing components in the Sorokit UI library.

## Table of Contents

- [Component Structure](#component-structure)
- [Props Design](#props-design)
- [State Management](#state-management)
- [Error Handling](#error-handling)
- [Loading States](#loading-states)
- [Accessibility](#accessibility)
- [Performance Optimization](#performance-optimization)
- [Testing Strategy](#testing-strategy)
- [Documentation](#documentation)

## Component Structure

### Basic Component Template

```typescript
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MyComponentProps {
  /** Description of the prop */
  children: ReactNode;
  /** Optional CSS class names */
  className?: string;
}

/**
 * MyComponent — a brief description of what this component does and when to use it.
 * 
 * @example
 * ```tsx
 * <MyComponent>
 *   Content goes here
 * </MyComponent>
 * ```
 */
export function MyComponent({
  children,
  className,
}: MyComponentProps) {
  return (
    <div className={cn('base-styles', className)}>
      {children}
    </div>
  );
}
```

### File Organization

```
src/components/
├── MyComponent.tsx          # Component implementation
├── MyComponent.test.tsx     # Component tests
├── MyComponent.stories.tsx  # Optional: Storybook stories
└── index.ts                 # Export in components/index.ts
```

## Props Design

### Follow the React Conventions

```typescript
// Good: Props interface with clear types and JSDoc
export interface ButtonProps {
  /** Content to display inside the button */
  children: ReactNode;
  /** Button variant: primary, secondary, or tertiary */
  variant?: 'primary' | 'secondary' | 'tertiary';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Callback when button is clicked */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Additional CSS classes */
  className?: string;
}

// Bad: No documentation, unclear naming
export interface BtnProps {
  c?: string;
  d?: boolean;
  v?: string;
  handler?: () => void;
}
```

### Avoid Prop Drilling

Instead of passing props through multiple levels:

```typescript
// Avoid this
<Parent>
  <Child user={user} theme={theme} locale={locale} />
</Parent>

// Use context instead
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
    <LocaleContext.Provider value={locale}>
      <Parent>
        <Child />
      </Parent>
    </LocaleContext.Provider>
  </ThemeContext.Provider>
</UserContext.Provider>
```

### Use Semantic Props

```typescript
// Good: Clear semantic meaning
<Button variant="primary" size="lg" disabled={isLoading}>
  Submit
</Button>

// Avoid: Vague prop names
<Button p="primary" s="lg" d={isLoading}>
  Submit
</Button>
```

## State Management

### Use Hooks for Local State

```typescript
export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

### Use Context for Shared State

```typescript
// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Memoize Expensive Computations

```typescript
export function ExpensiveComponent({ data }: { data: Item[] }) {
  const sortedData = useMemo(() => {
    return data.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return <ItemList items={sortedData} />;
}
```

## Error Handling

### Always Provide Error Boundaries

```typescript
export function MyFeature() {
  return (
    <ErrorBoundary fallback={<ErrorScreen />}>
      <FeatureContent />
    </ErrorBoundary>
  );
}
```

### Handle Null and Undefined

```typescript
export function UserProfile({ userId }: { userId?: string }) {
  if (!userId) {
    return <EmptyState message="No user selected" />;
  }

  const user = useUser(userId);

  if (!user) {
    return <Skeleton />;
  }

  return <ProfileContent user={user} />;
}
```

### Use Error.tsx for Error Rendering

```typescript
export function MyComponent() {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div role="alert" className="text-red-600">
        <p>An error occurred: {error}</p>
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  return <Content />;
}
```

## Loading States

### Skeleton Pattern

```typescript
export function ProfileCard({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId);

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded" />;
  }

  if (!user) {
    return <EmptyState />;
  }

  return <UserContent user={user} />;
}
```

### Spinner Pattern

```typescript
export function AsyncButton() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Button disabled={isLoading}>
      {isLoading ? (
        <>
          <Spinner className="mr-2" />
          Loading...
        </>
      ) : (
        'Submit'
      )}
    </Button>
  );
}
```

## Accessibility

### Use Semantic HTML

```typescript
// Good: Semantic HTML elements
export function Navigation() {
  return (
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  );
}

// Avoid: Generic divs
export function Navigation() {
  return (
    <div>
      <div>
        <span onClick={() => navigate('/')}>Home</span>
        <span onClick={() => navigate('/about')}>About</span>
      </div>
    </div>
  );
}
```

### Use ARIA Labels Appropriately

```typescript
export function ToggleButton({ isExpanded, onToggle }: Props) {
  return (
    <button
      aria-expanded={isExpanded}
      aria-label="Toggle navigation menu"
      onClick={onToggle}
    >
      {isExpanded ? '▾' : '▸'}
    </button>
  );
}
```

### Form Accessibility

```typescript
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <form>
      <label htmlFor="email">Email:</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? 'email-error' : undefined}
      />
      {error && (
        <p id="email-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
```

## Performance Optimization

### Code Splitting

```typescript
// Use lazy loading for large components
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));

export function Dashboard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyChart />
    </Suspense>
  );
}
```

### useCallback for Event Handlers

```typescript
export function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    },
    [onSearch],
  );

  return <input onChange={handleChange} />;
}
```

### useTransition for Non-blocking Updates

```typescript
export function FilterList({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = items.filter((item) => item.name.includes(filter));

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => startTransition(() => setFilter(e.target.value))}
        aria-busy={isPending}
      />
      {isPending && <Spinner />}
      <ItemList items={filtered} />
    </div>
  );
}
```

## Testing Strategy

### Test Behavior, Not Implementation

```typescript
// Good: Tests behavior
it('submits form with valid data', async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'test@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
  });
});

// Bad: Tests implementation details
it('calls handleSubmit function', () => {
  const component = new LoginFormClass();
  expect(component.handleSubmit).toBeDefined();
});
```

### Test User Interactions

```typescript
it('toggles visibility on button click', () => {
  render(<Toggle />);

  expect(screen.getByTestId('content')).toHaveClass('hidden');
  fireEvent.click(screen.getByRole('button', { name: /toggle/i }));
  expect(screen.getByTestId('content')).not.toHaveClass('hidden');
});
```

## Documentation

### JSDoc for All Public APIs

```typescript
/**
 * Formats a date according to the user's locale.
 * 
 * @param date - The date to format
 * @param locale - The locale code (e.g., 'en-US', 'fr-FR')
 * @param options - Formatting options
 * @returns Formatted date string
 * 
 * @example
 * ```tsx
 * const formatted = formatDate(new Date(), 'en-US', { 
 *   month: 'long', 
 *   day: 'numeric' 
 * });
 * // Output: "January 15"
 * ```
 */
export function formatDate(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}
```

### README for Complex Components

Create a `ComponentName.md` file for complex components:

```markdown
# DataTable Component

## Purpose
Displays tabular data with sorting, filtering, and pagination.

## Usage
```tsx
<DataTable
  columns={columns}
  data={data}
  sortable={true}
  filterable={true}
  paginated={true}
/>
```

## Props
- `columns`: Array of column definitions
- `data`: Array of data rows
- `sortable`: Enable column sorting
- `filterable`: Enable column filtering
- `paginated`: Enable pagination

## Examples
See `DataTable.stories.tsx` for interactive examples.
```

---

## Best Practices Summary

1. **Keep Components Small**: Each component should have a single responsibility
2. **Use TypeScript**: Define clear interfaces for props and state
3. **Document Everything**: JSDoc comments for public APIs
4. **Test Behavior**: Focus on user interactions, not implementation
5. **Handle Errors**: Always provide error boundaries and error states
6. **Optimize Performance**: Use memoization, code splitting, and lazy loading
7. **Accessibility First**: Use semantic HTML and ARIA attributes
8. **Follow Conventions**: Stick to established patterns in the codebase
9. **Reuse Components**: Don't duplicate functionality across components
10. **Keep Props Simple**: Avoid deeply nested prop objects; use context if needed

---

For more information, see the [React documentation](https://react.dev/) and the existing components in the `src/components/` directory.
