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

    it('reason="max_total" のときリストは全コンテンツ横断で表示される', () => {
        useShareImportFlow.setState({
            limitContext: {
                reason: 'max_total',
                contentId: null,
                neededCount: 1,
                planId: null,
                resolve: () => {},
            },
        });
        usePlanStore.setState({
            plans: [
                { id: 'p1', title: 't1', contentId: 'm10s', ownerId: 'local', data: {} as any, updatedAt: 1 },
                { id: 'p2', title: 't2', contentId: 'm11s', ownerId: 'local', data: {} as any, updatedAt: 2 },
                { id: 'p3', title: 't3', contentId: 'm12s', ownerId: 'local', data: {} as any, updatedAt: 3 },
            ],
        } as any);
        render(<LimitResolutionSheet />);
        expect(screen.getByText('t1')).toBeInTheDocument();
        expect(screen.getByText('t2')).toBeInTheDocument();
        expect(screen.getByText('t3')).toBeInTheDocument();
    });

    it('reason="max_per_content" のときリストは contentId 一致のみ', () => {
        useShareImportFlow.setState({
            limitContext: {
                reason: 'max_per_content',
                contentId: 'm10s',
                neededCount: 1,
                planId: 'in1',
                resolve: () => {},
            },
        });
        usePlanStore.setState({
            plans: [
                { id: 'p1', title: 't1', contentId: 'm10s', ownerId: 'local', data: {} as any, updatedAt: 1 },
                { id: 'p2', title: 't2', contentId: 'm11s', ownerId: 'local', data: {} as any, updatedAt: 2 },
            ],
        } as any);
        render(<LimitResolutionSheet />);
        expect(screen.getByText('t1')).toBeInTheDocument();
        expect(screen.queryByText('t2')).toBeNull();
    });

    it('2 回目以降の上限ヒットで isDeleting / checkedIds がリセットされ操作可能 (#2 致命バグ回帰防止)', async () => {
        // 真因: handleDelete 成功パスで local state (isDeleting / checkedIds / activeId) を
        // リセットしないまま setLimitContext(null) する。 LimitResolutionSheet は ShareImportSheet
        // 側から無条件レンダリングされており、 limitContext===null で return null になっても
        // React コンポーネントインスタンスは生存 → useState の値が永続。
        // 結果、 2 回目の上限ヒットで isDeleting=true が引き継がれ、 チェック・キャンセル・削除
        // ボタン全てが死ぬ。
        const resolve1 = vi.fn();
        mockedExecutePlanDeletions.mockResolvedValue(undefined);

        usePlanStore.setState({
            plans: [
                { id: 'e1', contentId: 'fru', ownerId: 'u', title: 't1', updatedAt: 0, data: {} } as any,
                { id: 'e2', contentId: 'fru', ownerId: 'u', title: 't2', updatedAt: 1, data: {} } as any,
            ],
        } as any);
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: {
                reason: 'max_per_content',
                contentId: 'fru',
                neededCount: 1,
                planId: 'in1',
                resolve: resolve1,
            },
        });

        const { rerender } = render(<LimitResolutionSheet />);

        // 1 回目: チェック → 削除 → 成功 (handleDelete success path)
        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        fireEvent.click(
            screen.getByRole('button', { name: /button_delete_and_resume/i }),
        );

        await waitFor(() => {
            expect(mockedExecutePlanDeletions).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(useShareImportFlow.getState().limitContext).toBeNull();
        });

        // executeShareImport の for-loop が次の item で再度上限ヒットしたシミュレーション。
        // (実コードでは setLimitContext({ ...新ctx, resolve }) で再 set される)
        usePlanStore.setState({
            plans: [
                { id: 'e2', contentId: 'fru', ownerId: 'u', title: 't2', updatedAt: 1, data: {} } as any,
                { id: 'f1', contentId: 'm12s', ownerId: 'u', title: 'f1', updatedAt: 2, data: {} } as any,
            ],
        } as any);
        const resolve2 = vi.fn();
        useShareImportFlow.setState({
            status: 'limit_hit',
            limitContext: {
                reason: 'max_per_content',
                contentId: 'm12s',
                neededCount: 1,
                planId: 'in2',
                resolve: resolve2,
            },
        });
        rerender(<LimitResolutionSheet />);

        // ★ 観測対象 1: キャンセルボタンが操作可能 (isDeleting=false にリセットされている)
        await waitFor(() => {
            const cancelBtn = screen.getByRole('button', { name: /button_cancel/i });
            expect(cancelBtn).not.toBeDisabled();
        });

        // ★ 観測対象 2: 削除ボタンは「未チェック」のため disabled (checkedCount===0 由来)。
        //   ただし isDeleting=true 由来の disabled ではなく、 チェックすれば有効化されるはず。
        const deleteBtn = screen.getByRole('button', { name: /button_delete_and_resume/i });
        expect(deleteBtn).toBeDisabled();

        // ★ 観測対象 3: 新 limitContext のリスト (f1 のみ) のチェックボックスを ON にできる
        fireEvent.click(screen.getByRole('checkbox'));
        await waitFor(() => {
            expect(deleteBtn).not.toBeDisabled();
        });

        // ★ 観測対象 4: キャンセル押下で resolve2 が呼ばれる (handleCancel の isDeleting ガードに弾かれない)
        fireEvent.click(screen.getByRole('button', { name: /button_cancel/i }));
        expect(resolve2).toHaveBeenCalledWith('cancelled');
    });

    it('preview パネルは mobile でも描画される (hidden md:block 撤去確認)', () => {
        useShareImportFlow.setState({
            limitContext: {
                reason: 'max_per_content',
                contentId: 'm10s',
                neededCount: 1,
                planId: 'in1',
                resolve: () => {},
            },
        });
        usePlanStore.setState({
            plans: [
                { id: 'p1', title: 't1', contentId: 'm10s', ownerId: 'local', data: {} as any, updatedAt: 1 },
            ],
        } as any);
        render(<LimitResolutionSheet />);
        // preview スタブが必ず出る (hidden 修飾子が無いことを確認)
        expect(screen.getByTestId('preview')).toBeInTheDocument();
    });
});
