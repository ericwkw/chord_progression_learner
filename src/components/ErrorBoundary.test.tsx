import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

const Boom = ({ explode }: { explode: boolean }) => {
  if (explode) throw new Error('bum note');
  return <div>all good</div>;
};

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows the fallback with the error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/bum note/);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('"Try again" re-renders the subtree', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // The underlying condition is fixed, then the boundary is reset.
    rerender(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('uses a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <p>custom: {err.message}</p>}>
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom: bum note')).toBeInTheDocument();
  });
});
