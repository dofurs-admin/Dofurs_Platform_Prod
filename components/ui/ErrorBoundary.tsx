'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-[#f2dfcf] bg-[#fffaf6] p-8 text-center">
            <div>
              <p className="text-base font-semibold text-ink">Something went wrong</p>
              <p className="mt-1 text-sm text-[#6b6b6b]">Please refresh the page to try again.</p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-4 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
