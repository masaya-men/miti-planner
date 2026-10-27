import React from 'react';

export type TransitionVariant = 'theme' | 'language' | 'plan' | 'default';

export interface TransitionContextValue {
    runTransition: (callback: () => void | Promise<void>, variant?: TransitionVariant) => void;
}

export const TransitionContext = React.createContext<TransitionContextValue | null>(null);

export function useTransitionOverlay() {
    const ctx = React.useContext(TransitionContext);
    if (!ctx) throw new Error('useTransitionOverlay must be used within TransitionOverlayProvider');
    return ctx;
}
