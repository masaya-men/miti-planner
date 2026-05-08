// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalImportDialog } from '../LocalImportDialog';
import type { SavedPlan } from '../../types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
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
        ownerId: 'discord:U1',
        ownerDisplayName: 'Tester',
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

describe('LocalImportDialog (Revision 2: list UI)', () => {
    it('isOpen=false のときは何も描画しない', () => {
        const { container } = render(
            <LocalImportDialog
                isOpen={false}
                plans={[makePlan({})]}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('isOpen=true でタイトル + プランタイトル + コンテンツ名が表示される', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1', title: 'My Plan A', contentId: 'fru' })]}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.getByText('local_import.title')).toBeDefined();
        expect(screen.getByText('My Plan A')).toBeDefined();
        expect(screen.getByText('[絶もうひとつの未来]')).toBeDefined();
    });

    it('「これで OK」クリックで onConfirm({ uncheckedPlanIds: [], dontShow: false }) を呼ぶ (デフォルト全 ON)', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ uncheckedPlanIds: [], dontShow: false });
    });

    it('チェック外したプランの ID が uncheckedPlanIds として渡される', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({ id: 'p1' }), makePlan({ id: 'p2' })]}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const planCheckboxes = checkboxes.filter(cb => {
            const label = cb.closest('label');
            return label && !label.textContent?.includes('local_import.dont_show_again');
        });
        // 最初のプラン (p1) のチェックを外す
        fireEvent.click(planCheckboxes[0]);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ uncheckedPlanIds: ['p1'], dontShow: false });
    });

    it('「キャンセル」クリックで onCancel({ dontShow: false }) を呼ぶ', () => {
        const onCancel = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.cancel/i }));
        expect(onCancel).toHaveBeenCalledWith({ dontShow: false });
    });

    it('ignoreDontShow=true で「次回から表示しない」チェックボックスを表示しない', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={true}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.queryByText('local_import.dont_show_again')).toBeNull();
    });

    it('「次回から表示しない」チェックすると onConfirm に dontShow: true が渡される', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const dontShowCheckbox = checkboxes.find(cb => {
            const label = cb.closest('label');
            return label?.textContent?.includes('local_import.dont_show_again');
        });
        expect(dontShowCheckbox).toBeDefined();
        fireEvent.click(dontShowCheckbox!);
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ uncheckedPlanIds: [], dontShow: true });
    });

    it('パーティメンバーの jobIcon 画像が表示される', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                plans={[makePlan({})]}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        const images = screen.getAllByRole('img');
        const jobImages = images.filter(img =>
            (img as HTMLImageElement).src.includes('/icons/'),
        );
        expect(jobImages.length).toBe(2);
    });
});
