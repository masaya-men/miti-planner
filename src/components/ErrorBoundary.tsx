import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-4 m-4 bg-red-900/50 border border-red-500 rounded text-red-100">
                    <h2 className="font-bold">Something went wrong.</h2>
                    <details className="whitespace-pre-wrap mt-2 text-xs opacity-80">
                        {this.state.error && this.state.error.toString()}
                    </details>
                    <button
                        className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
