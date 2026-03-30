import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

/**
 * React Error Boundary — catches render crashes and
 * auto-recovers instead of showing a white screen.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crash:', error, info.componentStack);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-6 text-center"
          style={{ background: '#0f172a', color: '#e2e8f0' }}>
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-semibold">Something went wrong</p>
          <p className="text-xs opacity-60 max-w-[280px]">{this.state.error}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={this.handleRecover}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 transition-colors">
              Try Again
            </button>
            <button onClick={this.handleReload}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 transition-colors">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
