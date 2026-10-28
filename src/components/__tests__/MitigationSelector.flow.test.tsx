// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, opt?: any) => (typeof opt === 'string' ? opt : opt?.defaultValue ?? k),
        i18n: { language: 'ja' },
    }),
}));

const m = (id: string, ja: string, extra: Record<string, unknown> = {}) => ({
    id, jobId: 'war', name: { ja, en: ja }, icon: `/icons/${id}.png`,
    recast: 60, duration: 10, type: 'all', value: 10, scope: 'self', ...extra,
});
const FIXTURE = [
    m('self_skill', '自分用'),
    m('target_skill', '対象指定', { scope: 'target' }),
    m('hidden_skill', '隠し', { hidden: true }),
    m('high_level', '高レベル', { minLevel: 120 }),
    m('needs_other', '前提あり', { requires: 'self_skill' }),
];
vi.mock('../../hooks/useSkillsData', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../hooks/useSkillsData')>()),
    useMitigations: () => FIXTURE,
    useJobs: () => [],
    getMitigationPriority: () => 0,
}));

import { MitigationSelector } from '../MitigationSelector';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useMitigationStore } from '../../store/useMitigationStore';

beforeEach(() => {
    useTutorialStore.setState({ isActive: false });
    useMitigationStore.setState({ partyMembers: [], currentLevel: 100, timelineMitigations: [] } as any);
});

const open = (props: Partial<React.ComponentProps<typeof MitigationSelector>> = {}) => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(<MitigationSelector isOpen onClose={onClose} onSelect={onSelect} jobId="war" position={{ x: 10, y: 10 }} {...props} />);
    return { onClose, onSelect };
};

describe('軽減追加の窓: 一覧と選択の流れ', () => {
    it('隠し・レベル外・前提が無い技は出ない', () => {
        open();
        expect(screen.getByText('自分用')).toBeTruthy();
        expect(screen.getByText('対象指定')).toBeTruthy();
        expect(screen.queryByText('隠し')).toBeNull();
        expect(screen.queryByText('高レベル')).toBeNull();
        expect(screen.queryByText('前提あり')).toBeNull();
    });

    it('前提の技が効いている時間なら、前提つきの技が出る', () => {
        open({ selectedTime: 5, activeMitigations: [{ id: 'a1', mitigationId: 'self_skill', time: 0, duration: 10, ownerId: 'x' } as any] });
        expect(screen.getByText('前提あり')).toBeTruthy();
    });

    it('技が無い職は「無い」の文言を出す', () => {
        open({ jobId: 'none' });
        expect(screen.getByText('mitigation.no_mitigations')).toBeTruthy();
    });

    it('自分用の技を押すとそのまま onSelect される', () => {
        const { onSelect } = open();
        fireEvent.click(screen.getByText('自分用'));
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0][0].id).toBe('self_skill');
    });

    it('対象指定の技を押すと見出しが変わり、戻るボタンと Escape で一覧に戻る。もう一度 Escape で閉じる', () => {
        const { onClose, onSelect } = open();
        expect(screen.getByText('mitigation.select')).toBeTruthy();
        fireEvent.click(screen.getByText('対象指定'));
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByText('対象を選択')).toBeTruthy();
        fireEvent.click(screen.getByText('対象を選択'));
        expect(screen.getByText('mitigation.select')).toBeTruthy();

        fireEvent.click(screen.getByText('対象指定'));
        expect(screen.getByText('対象を選択')).toBeTruthy();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByText('mitigation.select')).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('置いてある技を押すと onRemove が呼ばれる', () => {
        const onRemove = vi.fn();
        open({ onRemove, selectedTime: 3, activeMitigations: [{ id: 'placed1', mitigationId: 'self_skill', time: 3, duration: 10, ownerId: 'x' } as any] });
        fireEvent.click(screen.getByText('自分用'));
        expect(onRemove).toHaveBeenCalledWith('placed1');
    });

    it('閉じている時は何も描かない', () => {
        const { container } = render(<MitigationSelector isOpen={false} onClose={() => {}} onSelect={() => {}} jobId="war" position={{ x: 0, y: 0 }} />);
        expect(container.innerHTML).toBe('');
    });
});
