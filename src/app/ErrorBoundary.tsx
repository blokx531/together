import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort boundary for render errors. React still has no hook equivalent for error
 * boundaries, so this is the project's one deliberate class component.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Only the error name and component stack are logged: no user data is included.
    console.error('Render error:', error.name, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <main
        role="alert"
        className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-ink-muted">Your saved data is safe. Reload the app to continue.</p>
        <button
          type="button"
          className="min-h-11 rounded-control bg-accent px-5 font-medium text-on-accent"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
      </main>
    );
  }
}
