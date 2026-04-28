import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError: (error: Error) => void;
}

interface State {
  hasError: boolean;
}

export class RuntimeErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    try {
      this.props.onError(error);
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
