import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import i18next from 'i18next';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            const { error, errorInfo } = this.state;
            // スタックトレース + React コンポーネントスタックまで画面上に出す(error.toString() だけだと
            // 「TypeError: ...」の1行しか見えず、次に同じ事象が起きても原因箇所を特定できないため)。
            const detail = [error?.stack || error?.toString() || '', errorInfo?.componentStack || '']
                .filter(Boolean)
                .join('\n\n');
            return this.props.fallback || (
                <div className="p-4 m-4 bg-red-900/50 border border-red-500 rounded text-red-100">
                    <h2 className="font-bold">{i18next.t('error_boundary.title')}</h2>
                    <details className="whitespace-pre-wrap mt-2 text-app-lg opacity-80 max-h-80 overflow-auto" open>
                        {detail}
                    </details>
                    <button
                        className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded"
                        onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                    >
                        {i18next.t('error_boundary.retry')}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
