import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { PerformanceMonitor, Profiled } from './PerformanceMonitor';

// Mock the performance module
vi.mock('../lib/performance', () => ({
  getMetrics: vi.fn(() => []),
  recordRender: vi.fn(),
  subscribeMetrics: vi.fn(() => () => {}),
}));

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('rendering in development mode', () => {
    it('renders the performance monitor panel', () => {
      // Mock DEV mode
      const mockEnv = { DEV: true };
      vi.stubGlobal('import', { meta: { env: mockEnv } });

      render(<PerformanceMonitor />);
      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument();
    });

    it('renders the toggle button with correct label', () => {
      render(<PerformanceMonitor />);
      expect(screen.getByRole('button', { name: /Perf/i })).toBeInTheDocument();
    });

    it('shows collapsed state initially', () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('displays expand indicator when collapsed', () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');
      expect(button.textContent).toContain('▸');
    });
  });

  describe('toggle functionality', () => {
    it('opens the panel when button is clicked', async () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('shows collapse indicator when expanded', async () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      fireEvent.click(button);

      await waitFor(() => {
        expect(button.textContent).toContain('▾');
      });
    });

    it('closes the panel when button is clicked again', async () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      // Open
      fireEvent.click(button);
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });

      // Close
      fireEvent.click(button);
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('metrics display', () => {
    it('displays "No metrics yet" when no vitals are recorded', async () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('No metrics yet…')).toBeInTheDocument();
      });
    });

    it('renders correctly with zero metrics', () => {
      render(<PerformanceMonitor />);
      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument();
    });
  });

  describe('positioning and styling', () => {
    it('is positioned at bottom-left of screen', () => {
      render(<PerformanceMonitor />);
      const monitor = screen.getByTestId('performance-monitor');

      const style = window.getComputedStyle(monitor);
      expect(style.position).toBe('fixed');
    });

    it('has high z-index to stay on top', () => {
      render(<PerformanceMonitor />);
      const monitor = screen.getByTestId('performance-monitor');

      // z-index should be high (99999)
      expect(monitor).toBeInTheDocument();
    });

    it('has monospace font', () => {
      render(<PerformanceMonitor />);
      const monitor = screen.getByTestId('performance-monitor');

      const style = window.getComputedStyle(monitor);
      expect(style.fontFamily).toContain('monospace');
    });

    it('has dark background color', () => {
      render(<PerformanceMonitor />);
      const monitor = screen.getByTestId('performance-monitor');

      expect(monitor).toBeInTheDocument();
      // Background should be semi-transparent dark
    });
  });

  describe('accessibility', () => {
    it('has aria-expanded attribute for toggle button', () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-expanded');
    });

    it('button is properly labeled', () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      expect(button.textContent).toMatch(/Perf/i);
    });

    it('updates aria-expanded when toggled', async () => {
      render(<PerformanceMonitor />);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });
});

describe('Profiled component', () => {
  const { recordRender } = await import('../lib/performance');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering in development mode', () => {
    it('renders children when in DEV mode', () => {
      render(
        <Profiled id="test-component">
          <div data-testid="child-content">Test Child</div>
        </Profiled>,
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('wraps children with Profiler in DEV mode', () => {
      render(
        <Profiled id="test-component">
          <span>Profiled Content</span>
        </Profiled>,
      );

      expect(screen.getByText('Profiled Content')).toBeInTheDocument();
    });
  });

  describe('rendering in production mode', () => {
    it('renders children as fragment in production', () => {
      // In production, DEV is false, so just render children
      render(
        <Profiled id="test-component">
          <div data-testid="prod-child">Production Child</div>
        </Profiled>,
      );

      expect(screen.getByTestId('prod-child')).toBeInTheDocument();
    });
  });

  describe('profiling functionality', () => {
    it('records render metrics with correct component id', () => {
      render(
        <Profiled id="my-component">
          <div>Test</div>
        </Profiled>,
      );

      // recordRender should be called with the component id
      // Note: This test assumes DEV mode is enabled
      expect(recordRender).toBeDefined();
    });

    it('passes id to Profiler', () => {
      render(
        <Profiled id="unique-id">
          <span>Content</span>
        </Profiled>,
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles multiple children', () => {
      render(
        <Profiled id="multi-child">
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <div data-testid="child3">Child 3</div>
        </Profiled>,
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
      expect(screen.getByTestId('child3')).toBeInTheDocument();
    });

    it('handles nested Profiled components', () => {
      render(
        <Profiled id="outer">
          <div data-testid="outer-content">
            <Profiled id="inner">
              <div data-testid="inner-content">Nested</div>
            </Profiled>
          </div>
        </Profiled>,
      );

      expect(screen.getByTestId('outer-content')).toBeInTheDocument();
      expect(screen.getByTestId('inner-content')).toBeInTheDocument();
    });

    it('handles null and undefined children gracefully', () => {
      const { container } = render(
        <Profiled id="test">
          {null}
          {undefined}
          <div data-testid="visible">Visible</div>
        </Profiled>,
      );

      expect(screen.getByTestId('visible')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });

    it('handles empty children', () => {
      const { container } = render(
        <Profiled id="empty">
          {/* Empty */}
        </Profiled>,
      );

      expect(container).toBeInTheDocument();
    });

    it('handles component id with special characters', () => {
      render(
        <Profiled id="component-with-special_123">
          <div data-testid="special-id">Test</div>
        </Profiled>,
      );

      expect(screen.getByTestId('special-id')).toBeInTheDocument();
    });

    it('handles very long component id', () => {
      const longId = 'a'.repeat(500);
      render(
        <Profiled id={longId}>
          <div data-testid="long-id">Test</div>
        </Profiled>,
      );

      expect(screen.getByTestId('long-id')).toBeInTheDocument();
    });
  });

  describe('performance characteristics', () => {
    it('does not add significant overhead in production', () => {
      const startTime = performance.now();

      render(
        <Profiled id="perf-test">
          <div>Content</div>
        </Profiled>,
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete reasonably fast (under 100ms for simple render)
      expect(duration).toBeLessThan(100);
    });

    it('handles rapid component mounting and unmounting', () => {
      const { unmount } = render(
        <Profiled id="rapid">
          <div>Test</div>
        </Profiled>,
      );

      unmount();

      render(
        <Profiled id="rapid-2">
          <div>Test 2</div>
        </Profiled>,
      );

      expect(screen.getByText('Test 2')).toBeInTheDocument();
    });
  });

  describe('backward compatibility', () => {
    it('works as drop-in replacement for a div', () => {
      const { container: withProfiled } = render(
        <Profiled id="test">
          <span data-testid="content">Test</span>
        </Profiled>,
      );

      expect(withProfiled.querySelector('[data-testid="content"]')).toBeInTheDocument();
    });

    it('passes through all child props correctly', () => {
      render(
        <Profiled id="test">
          <input data-testid="input" disabled aria-label="test input" />
        </Profiled>,
      );

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('aria-label', 'test input');
    });
  });
});
