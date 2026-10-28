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

vi.mock('../../store/useTutorialStore', () => ({
    useTutorialStore: { getState: () => ({ isActive: false }) },
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

describe('LocalImportDialog (フィードバック・チェック切替)', () => {
    it('全失敗 (その他エラー) では network / relogin / wait の 3 項目が retry 付きで出る', async () => {
        const onImport = vi.fn().mockResolvedValueOnce([
            { id: 'p1', status: 'failed', error: 'unavailable' },
        ]);
        render(<LocalImportDialog isOpen={true} plans={[makePlan({ id: 'p1' })]} onImport={onImport} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByText(/local_import\.feedback_network/)).toBeDefined();
        }, { timeout: 2500 });
        expect(screen.getByText(/local_import\.feedback_relogin/)).toBeDefined();
        expect(screen.getByText(/local_import\.feedback_wait/)).toBeDefined();
        expect(screen.getByText(/local_import\.feedback_network.*local_import\.retry/)).toBeDefined();
    });

    it('一部失敗 (その他エラー) では relogin が出ず retry_failed 付きで network / wait が出る', async () => {
        const onImport = vi.fn().mockResolvedValueOnce([
            { id: 'p1', status: 'success' },
            { id: 'p2', status: 'failed', error: 'unavailable' },
        ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2', title: 'second' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => {
            expect(screen.getByText(/local_import\.feedback_network.*local_import\.retry_failed/)).toBeDefined();
        }, { timeout: 2500 });
        expect(screen.queryByText(/local_import\.feedback_relogin/)).toBeNull();
        expect(screen.getByText(/local_import\.feedback_wait/)).toBeDefined();
    });

    it('チェックを外して付け直すと onImport に渡される', async () => {
        const onImport = vi.fn().mockResolvedValue([
            { id: 'p1', status: 'success' },
            { id: 'p2', status: 'success' },
        ]);
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2', title: 'second' })]}
                onImport={onImport}
                onClose={vi.fn()}
            />,
        );
        const boxes = screen.getAllByRole('checkbox');
        fireEvent.click(boxes[1]);
        fireEvent.click(boxes[1]);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        await waitFor(() => expect(onImport).toHaveBeenCalled());
        expect(onImport.mock.calls[0][0]).toEqual(['p1', 'p2']);
    });
});
