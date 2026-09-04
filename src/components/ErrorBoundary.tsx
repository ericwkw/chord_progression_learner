import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in the subtree so a thrown exception
 * (e.g. from the theory engine) shows a recoverable message instead of a
 * blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 p-6 text-center font-sans"
      >
        <div className="text-4xl">🎸💥</div>
        <h1 className="text-xl font-bold">Something hit a bum note.</h1>
        <p className="text-sm text-slate-400 max-w-md">
          The app ran into an unexpected error. Your progression wasn't saved, but
          you can try again.
        </p>
        <pre className="text-[11px] text-rose-300/80 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 max-w-md overflow-x-auto">
          {error.message}
        </pre>
        <div className="flex gap-3">
          <button
            onClick={this.reset}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-5 rounded-xl transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-5 rounded-xl transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
