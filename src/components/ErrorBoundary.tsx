import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { logger } from '@/lib/logger';
import { isChunkLoadError, attemptChunkRecovery } from '@/lib/chunkErrorRecovery';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRecovering: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, section } = this.props;
    
    // Log the error
    logger.error('ErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      section: section || 'unknown',
    });

    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    onError?.(error, errorInfo);

    // Check if this is a chunk load error and attempt automatic recovery
    if (isChunkLoadError(error)) {
      logger.warn('Chunk load error detected, attempting automatic recovery', {
        error: error.message,
        section: section || 'unknown',
      });
      
      this.setState({ isRecovering: true });
      
      // Attempt recovery (will reload page if successful)
      const willRecover = await attemptChunkRecovery();
      
      if (!willRecover) {
        // Max attempts reached, show error to user
        this.setState({ isRecovering: false });
      }
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    const { hasError, error, isRecovering } = this.state;
    const { children, fallback, section } = this.props;

    // If recovering from chunk error, show loading state
    if (isRecovering) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Atualizando aplicação...</p>
            <p className="text-xs text-muted-foreground/60">Limpando cache e recarregando</p>
          </div>
        </div>
      );
    }

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          error={error}
          section={section}
          onRetry={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  section?: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary section={section}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
