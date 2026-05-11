// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalImportDialog } from '../LocalImportDialog';
import type { SavedPlan } from '../../types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params) return `${key}:${JSON.stringify(params)}`;
            return key;
        },
    }),
}));

vi.mock('../../i18n', () => ({
    default: { language: 'ja' },
}));

vi.mock('../../hooks/useSkillsData', () => ({
    useJobs: () => [
        { id: 'PLD', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '/icons/pld.png' },
        { id: 'WAR', name: { ja: '戦士', en: 'Warrior' }, role: 'tank', icon: '/icons/war.png' },
    ],
}));

vi.mock('../../lib/scroll/useSmoothWheelScroll', () => ({
    useSmoothWheelScroll: () => {},
}));

vi.mock('../../data/contentRegistry', () => ({
    getContentById: (id: string) => {
        const map: Record<string, { name: { ja: string; en: string } }> = {
            fru: { name: { ja: '絶もうひとつの未来', en: 'FRU' } },
            m9s: { name: { ja: 'M9S', en: 'M9S' } },
        };
        return map[id];
    },
}));

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'plan_1',
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'FRU 練習',
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: {
            currentLevel: 100,
            timelineEvents: [],
            timelineMitigations: [],
            phases: [],
            partyMembers: [
                { id: 'MT', jobId: 'PLD', role: 'tank', stats: {} as any, computedValues: {} },
                { id: 'ST', jobId: 'WAR', role: 'tank', stats: {} as any, computedValues: {} },
            ],
            aaSettings: { damage: 0, type: 'physical', target: 'MT' },
            schAetherflowPatterns: {},
        },
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('LocalImportDialog (Revision 3: explicit import + progress)', () => {
    it('isOpen=false のときは何も描画しない', () => {
        const { container } = render(
            <LocalImportDialog
                isOpen={false}
                plans={[makePlan({})]}
                onImport={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('idle フェーズでタイトル + プランタイトル + コンテンツ名 + 取り込みボタンが表示される', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1', title: 'My Plan A', contentId: 'fru' })]}
                onImport={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        expect(screen.getByText('local_import.title')).toBeDefined();
        expect(screen.getByText('My Plan A')).toBeDefined();
        expect(screen.getByText('[絶もうひとつの未来]')).toBeDefined();
        expect(screen.getByRole('button', { name: /local_import\.confirm/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /local_import\.cancel/i })).toBeDefined();
    });

    it('取り込みボタン押下で onImport が呼ばれる (デフォルト全 ON)', async () => {
        const onImport = vi.fn().mockResolvedValue([
            { id: 'p1', status: 'success' },
            { id: 'p2', status: 'success' },
        ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(onImport).toHaveBeenCalled();
        });
        expect(onImport.mock.calls[0][0]).toEqual(['p1', 'p2']);
    });

    it('チェック外したプランは onImport に渡されない', async () => {
        const onImport = vi.fn().mockResolvedValue([{ id: 'p2', status: 'success' }]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        // 「次回から表示しない」チェックは廃止済みなので、checkbox はすべてプラン行のもの
        const planCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        // p1 のチェックを外す
        fireEvent.click(planCheckboxes[0]);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(onImport).toHaveBeenCalled();
        });
        expect(onImport.mock.calls[0][0]).toEqual(['p2']);
    });

    it('全チェック外して取り込みボタン押すと onClose が呼ばれる (onImport は呼ばれない)', async () => {
        const onImport = vi.fn();
        const onClose = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                onImport={onImport}
                onClose={onClose}
            />,
        );
        const planCheckbox = (screen.getAllByRole('checkbox') as HTMLInputElement[])[0];
        fireEvent.click(planCheckbox);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onImport).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledWith();
    });

    it('「あとで」クリックで onClose() を呼ぶ', () => {
        const onClose = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                onImport={vi.fn()}
                onClose={onClose}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.cancel/i }));
        expect(onClose).toHaveBeenCalledWith();
    });

    it('「次回から表示しない」チェックボックスは廃止されており、描画されない', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                onImport={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        // i18n キー文言・英語訳・日本語訳いずれも残っていないこと
        expect(screen.queryByText('local_import.dont_show_again')).toBeNull();
        expect(screen.queryByText(/次回から表示しない|don.*show again/i)).toBeNull();
    });

    it('uploading フェーズでチェックボックスが進捗アイコンに置き換わり、キャンセルボタンが消える', async () => {
        // onImport が解決しない状態を作る
        let resolveImport: (results: { id: string; status: 'success' | 'failed' }[]) => void;
        const onImport = vi.fn().mockImplementation((_ids: string[], onProgress: (e: any) => void) => {
            // すぐに uploading 状態を進捗通知
            onProgress({ id: 'p1', status: 'uploading' });
            return new Promise<{ id: string; status: 'success' | 'failed' }[]>((resolve) => {
                resolveImport = resolve;
            });
        });
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        // uploading フェーズに入る
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /local_import\.cancel/i })).toBeNull();
            expect(screen.queryByRole('button', { name: /local_import\.confirm/i })).toBeNull();
        });
        // ステータスメッセージ
        expect(screen.getByText('local_import.uploading_in_progress')).toBeDefined();
        // 解決して終了
        resolveImport!([{ id: 'p1', status: 'success' }]);
    });

    it('全成功で summary success パネルと「閉じる」ボタンが表示される (自動クローズしない)', async () => {
        const onClose = vi.fn();
        const onImport = vi.fn().mockResolvedValue([{ id: 'p1', status: 'success' }]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                onImport={onImport}
                onClose={onClose}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        // PER_PLAN_MS (1000ms) + SWEEP_TO_SUMMARY_MS (350ms) を待つ
        await waitFor(() => {
            expect(screen.getByText(/local_import\.summary_success_title/i)).toBeDefined();
        }, { timeout: 2500 });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /local_import\.close/i })).toBeDefined();
    });

    it('一部失敗時はサマリーパネルが残り「失敗分を再試行」ボタンが出る', async () => {
        const onImport = vi.fn()
            .mockResolvedValueOnce([
                { id: 'p1', status: 'success' },
                { id: 'p2', status: 'failed', error: 'permission-denied' },
            ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByText(/local_import\.summary_partial_title/i)).toBeDefined();
            expect(screen.getByRole('button', { name: /local_import\.retry_failed/i })).toBeDefined();
            expect(screen.getByRole('button', { name: /local_import\.close/i })).toBeDefined();
        }, { timeout: 2500 });
    });

    it('全失敗時はサマリーパネルが残り「再試行」ボタンが出る', async () => {
        const onImport = vi.fn().mockResolvedValueOnce([
            { id: 'p1', status: 'failed', error: 'unavailable' },
        ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByText(/local_import\.summary_all_failed_title/i)).toBeDefined();
        }, { timeout: 2500 });
        // 全失敗時は retry (not retry_failed) ボタン
        const retryBtn = screen.getByText('local_import.retry');
        expect(retryBtn).toBeDefined();
    });

    it('PLAN_LIMIT_max_total エラーで feedback に上限件数を含む文言が出る', async () => {
        const onImport = vi.fn().mockResolvedValueOnce([
            { id: 'p1', status: 'failed', error: 'PLAN_LIMIT_max_total|current=50|max=50' },
        ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            // feedback_max_total キーが render されている (max=50 件数情報込み)
            expect(screen.getByText(/local_import\.feedback_max_total.*"max":50/i)).toBeDefined();
        }, { timeout: 2500 });
    });

    it('PLAN_LIMIT_max_per_content エラーで feedback にコンテンツ上限件数を含む文言が出る', async () => {
        const onImport = vi.fn().mockResolvedValueOnce([
            { id: 'p1', status: 'failed', error: 'PLAN_LIMIT_max_per_content|current=5|max=5' },
        ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByText(/local_import\.feedback_max_per_content.*"max":5/i)).toBeDefined();
        }, { timeout: 2500 });
    });

    it('「失敗分を再試行」押下で失敗分のみ onImport に渡される', async () => {
        const onImport = vi.fn()
            .mockResolvedValueOnce([
                { id: 'p1', status: 'success' },
                { id: 'p2', status: 'failed', error: 'permission-denied' },
            ])
            .mockResolvedValueOnce([
                { id: 'p2', status: 'success' },
            ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /local_import\.retry_failed/i })).toBeDefined();
        }, { timeout: 2500 });
        fireEvent.click(screen.getByRole('button', { name: /local_import\.retry_failed/i }));
        await waitFor(() => {
            expect(onImport).toHaveBeenCalledTimes(2);
        }, { timeout: 2500 });
        expect(onImport.mock.calls[1][0]).toEqual(['p2']);
    });

    it('パーティメンバーの jobIcon 画像が表示される', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                onImport={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        const images = screen.getAllByRole('img');
        const jobImages = images.filter(img =>
            (img as HTMLImageElement).src.includes('/icons/'),
        );
        expect(jobImages.length).toBe(2);
    });
});
