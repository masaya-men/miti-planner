// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LimitResolutionSheet } from '../LimitResolutionSheet';
import { useShareImportFlow } from '../../store/useShareImportFlow';
import { usePlanStore } from '../../store/usePlanStore';

// Firebase mock block — usePlanStore -> planService -> firebase の依存を遮断する。
vi.mock('../../lib/firebase', () => ({
    auth: { currentUser: null },
    db: {},
    appCheck: null,
}));
vi.mock('../../lib/appCheck', () => ({
    appCheckReady: Promise.resolve(),
    ensureAppCheckToken: vi.fn().mockResolvedValue(''),
}));
// useAuthStore は内部で firebase/auth の onAuthStateChanged 等を直接呼ぶので
// モジュール全体をスタブ化する必要がある。
vi.mock('firebase/auth', () => ({
    onAuthStateChanged: () => () => {},
    signInWithCustomToken: vi.fn(),
    signOut: vi.fn(),
    deleteUser: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    collection: vi.fn(),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    writeBatch: vi.fn(),
    updateDoc: vi.fn(),
}));
vi.mock('firebase/app-check', () => ({
    getToken: vi.fn(),
}));

// MitigationSheetPreview は内部で useSkillsData などを使うのでこのテストでは不要。
// data-testid="preview" のスタブに置き換える。
vi.mock('../MitigationSheetPreview', () => ({
    MitigationSheetPreview: () => <div data-testid="preview" />,
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) => {
            // Provide values for placeholders
            if (opts && typeof opts === 'object') {
                let result = key;
                Object.keys(opts).forEach(k => {
                    result = result.replace(`{{${k}}}`, String(opts[k]));
                });
                return result;
            }
            return key;
        },
    }),
}));

describe('LimitResolutionSheet', () => {
    beforeEach(() => {
        useShareImportFlow.setState({
            status: 'idle',
            limitContext: null,
            deleteProgressMap: new Map(),
        });
        usePlanStore.setState({
            plans: [],
        } as any);
    });

    it('renders nothing when no limitContext', () => {
        const { container } = render(<LimitResolutionSheet />);
        expect(container.querySelector('[data-testid="limit-resolution-sheet"]')).toBeNull();
    });

    it('renders 5 user plans for the contentId when limit hit', () => {
        usePlanStore.setState({
            plans: Array.from({ length: 5 }, (_, i) => ({
                id: `existing${i}`,
                contentId: 'fru',
                title: `Plan ${i}`,
                ownerId: 'testUid',
                updatedAt: Date.now() - i * 86400000,
                data: {},
            })) as any,
        } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: {
                contentId: 'fru',
                neededCount: 1,
                planId: 'p1',
                resolve: vi.fn(),
            },
        });
        render(<LimitResolutionSheet />);
        expect(screen.getByTestId('limit-resolution-sheet')).toBeInTheDocument();
        expect(screen.getAllByTestId('share-plan-card')).toHaveLength(5);
    });

    it('disables delete button when no checkbox selected', () => {
        usePlanStore.setState({
            plans: [{ id: 'e1', contentId: 'fru', ownerId: 'u', title: 't', updatedAt: 0, data: {} } as any],
        } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: { contentId: 'fru', neededCount: 1, planId: 'p1', resolve: vi.fn() },
        });
        render(<LimitResolutionSheet />);
        // Find the delete-and-resume button (not the cancel button)
        const button = screen.getByRole('button', { name: /button_delete_and_resume/i });
        expect(button).toBeDisabled();
    });

    it('cancels and resolves with cancelled', () => {
        const resolve = vi.fn();
        usePlanStore.setState({ plans: [] } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: { contentId: 'fru', neededCount: 1, planId: 'p1', resolve },
        });
        render(<LimitResolutionSheet />);
        fireEvent.click(screen.getByRole('button', { name: /button_cancel/i }));
        expect(resolve).toHaveBeenCalledWith('cancelled');
    });
});
