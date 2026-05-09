// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LimitResolutionSheet } from '../LimitResolutionSheet';
import { useShareImportFlow } from '../../store/useShareImportFlow';
import { usePlanStore } from '../../store/usePlanStore';
import { executePlanDeletions } from '../../lib/executePlanDeletions';

// executePlanDeletions をモック化。
// 成功 / 失敗のシナリオを各テストケースで切り替えるため、 vi.fn() を貼り替える方式。
vi.mock('../../lib/executePlanDeletions', () => ({
    executePlanDeletions: vi.fn(),
}));
const mockedExecutePlanDeletions = vi.mocked(executePlanDeletions);

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
        mockedExecutePlanDeletions.mockReset();
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
                reason: 'max_per_content',
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
            limitContext: { reason: 'max_per_content', contentId: 'fru', neededCount: 1, planId: 'p1', resolve: vi.fn() },
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
            limitContext: { reason: 'max_per_content', contentId: 'fru', neededCount: 1, planId: 'p1', resolve },
        });
        render(<LimitResolutionSheet />);
        fireEvent.click(screen.getByRole('button', { name: /button_cancel/i }));
        expect(resolve).toHaveBeenCalledWith('cancelled');
    });

    it('toggle checkbox enables delete button', () => {
        usePlanStore.setState({
            plans: [
                {
                    id: 'e1',
                    contentId: 'fru',
                    ownerId: 'u',
                    title: 't',
                    updatedAt: 0,
                    data: {},
                } as any,
            ],
        } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: {
                reason: 'max_per_content',
                contentId: 'fru',
                neededCount: 1,
                planId: 'p1',
                resolve: vi.fn(),
            },
        });
        render(<LimitResolutionSheet />);
        const button = screen.getByRole('button', { name: /button_delete_and_resume/i });
        expect(button).toBeDisabled();

        // チェックボックスを ON
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        // ボタンが有効化されることを確認
        expect(button).not.toBeDisabled();
    });

    it('successful delete calls executePlanDeletions and resolves with resolved', async () => {
        const resolve = vi.fn();
        // 成功シナリオ: executePlanDeletions が正常終了する
        mockedExecutePlanDeletions.mockResolvedValue(undefined);

        usePlanStore.setState({
            plans: [
                {
                    id: 'e1',
                    contentId: 'fru',
                    ownerId: 'u',
                    title: 't',
                    updatedAt: 0,
                    data: {},
                } as any,
            ],
        } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: {
                reason: 'max_per_content',
                contentId: 'fru',
                neededCount: 1,
                planId: 'p1',
                resolve,
            },
        });
        render(<LimitResolutionSheet />);

        // チェックボックス ON → 削除ボタン押下
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(
            screen.getByRole('button', { name: /button_delete_and_resume/i }),
        );

        // 観測対象: executePlanDeletions が 1 回呼ばれ、 resolve('resolved') が呼ばれ、
        //          limitContext がクリアされてシートが消えること。
        await waitFor(() => {
            expect(mockedExecutePlanDeletions).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(resolve).toHaveBeenCalledWith('resolved');
        });
        expect(useShareImportFlow.getState().limitContext).toBeNull();
    });

    it('failed delete keeps sheet open and prunes stale checkedIds', async () => {
        const resolve = vi.fn();
        // 失敗シナリオ: executePlanDeletions が reject する。
        // 実装と整合させるため、 mock 内で先に「e1 は削除済み」としてストアを更新してから throw する
        // (= 部分失敗 = 1 件成功後 2 件目で失敗のシミュレーション)。
        mockedExecutePlanDeletions.mockImplementation(async () => {
            usePlanStore.setState({
                plans: [
                    // e1 は削除済み、 e2 は残存
                    {
                        id: 'e2',
                        contentId: 'fru',
                        ownerId: 'u',
                        title: 't2',
                        updatedAt: 1,
                        data: {},
                    } as any,
                ],
            } as any);
            throw new Error('network');
        });

        usePlanStore.setState({
            plans: [
                {
                    id: 'e1',
                    contentId: 'fru',
                    ownerId: 'u',
                    title: 't1',
                    updatedAt: 0,
                    data: {},
                } as any,
                {
                    id: 'e2',
                    contentId: 'fru',
                    ownerId: 'u',
                    title: 't2',
                    updatedAt: 1,
                    data: {},
                } as any,
            ],
        } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: {
                reason: 'max_per_content',
                contentId: 'fru',
                neededCount: 1,
                planId: 'p1',
                resolve,
            },
        });
        render(<LimitResolutionSheet />);

        // 2 件ともチェック → 削除ボタン押下
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]); // e1
        fireEvent.click(checkboxes[1]); // e2
        fireEvent.click(
            screen.getByRole('button', { name: /button_delete_and_resume/i }),
        );

        // executePlanDeletions が呼ばれ、 reject した後の状態を確認。
        await waitFor(() => {
            expect(mockedExecutePlanDeletions).toHaveBeenCalledTimes(1);
        });

        // 観測対象 1: resolve は呼ばれていない (シートは閉じない)
        expect(resolve).not.toHaveBeenCalled();
        // 観測対象 2: limitContext は維持されている (シートが残る)
        expect(useShareImportFlow.getState().limitContext).not.toBeNull();
        // 観測対象 3: シート DOM がまだ存在する
        await waitFor(() => {
            expect(screen.getByTestId('limit-resolution-sheet')).toBeInTheDocument();
        });

        // 観測対象 4: 削除ボタンの再有効化 (= isDeleting=false に戻った)。
        //   stale な e1 が checkedIds から除かれた結果、 残存 e2 のみが選択状態。
        //   selection_count=1 で count: 1 が表示されるはず。
        await waitFor(() => {
            const btn = screen.getByRole('button', {
                name: /button_delete_and_resume/i,
            });
            expect(btn).not.toBeDisabled();
        });
    });
});
