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
                ignoreDontShow={false}
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
                ignoreDontShow={false}
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
                ignoreDontShow={false}
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
                ignoreDontShow={false}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const planCheckboxes = checkboxes.filter(cb => {
            const label = cb.closest('label');
            return label && !label.textContent?.includes('local_import.dont_show_again');
        });
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
                ignoreDontShow={false}
                onImport={onImport}
                onClose={onClose}
            />,
        );
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const planCheckbox = checkboxes.find(cb => {
            const label = cb.closest('label');
            return label && !label.textContent?.includes('local_import.dont_show_again');
        })!;
        fireEvent.click(planCheckbox);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onImport).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledWith({ dontShow: false });
    });

    it('「あとで」クリックで onClose({ dontShow: false }) を呼ぶ', () => {
        const onClose = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={false}
                onImport={vi.fn()}
                onClose={onClose}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.cancel/i }));
        expect(onClose).toHaveBeenCalledWith({ dontShow: false });
    });

    it('ignoreDontShow=true で「次回から表示しない」チェックボックスを表示しない', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={true}
                onImport={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        expect(screen.queryByText('local_import.dont_show_again')).toBeNull();
    });

    it('「次回から表示しない」チェックすると onClose に dontShow: true が渡される', () => {
        const onClose = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={false}
                onImport={vi.fn()}
                onClose={onClose}
            />,
        );
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const dontShowCheckbox = checkboxes.find(cb => {
            const label = cb.closest('label');
            return label?.textContent?.includes('local_import.dont_show_again');
        });
        expect(dontShowCheckbox).toBeDefined();
        fireEvent.click(dontShowCheckbox!);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.cancel/i }));
        expect(onClose).toHaveBeenCalledWith({ dontShow: true });
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
                ignoreDontShow={false}
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

    it('全成功で onClose が呼ばれる (自動クローズ)', async () => {
        const onClose = vi.fn();
        const onImport = vi.fn().mockResolvedValue([{ id: 'p1', status: 'success' }]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' })]}
                ignoreDontShow={false}
                onImport={onImport}
                onClose={onClose}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        }, { timeout: 1000 });
    });

    it('一部失敗時はダイアログが残り「再試行」ボタンが出る', async () => {
        const onImport = vi.fn()
            .mockResolvedValueOnce([
                { id: 'p1', status: 'success' },
                { id: 'p2', status: 'failed', error: 'permission-denied' },
            ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                ignoreDontShow={false}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /local_import\.retry_failed/i })).toBeDefined();
            expect(screen.getByRole('button', { name: /local_import\.close/i })).toBeDefined();
        });
    });

    it('「再試行」押下で失敗分のみ onImport に渡される', async () => {
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
                ignoreDontShow={false}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /local_import\.retry_failed/i })).toBeDefined();
        });
        fireEvent.click(screen.getByRole('button', { name: /local_import\.retry_failed/i }));
        await waitFor(() => {
            expect(onImport).toHaveBeenCalledTimes(2);
        });
        expect(onImport.mock.calls[1][0]).toEqual(['p2']);
    });

    it('パーティメンバーの jobIcon 画像が表示される', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={false}
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
