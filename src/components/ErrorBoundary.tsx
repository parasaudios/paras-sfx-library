import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1017] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-white text-2xl mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-6">
              The app encountered an unexpected error. Please reload the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#10b981] hover:bg-[#0d9668] text-white rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
