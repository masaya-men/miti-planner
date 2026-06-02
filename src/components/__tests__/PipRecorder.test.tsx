// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, opt?: any) => (opt?.count !== undefined ? `${key}:${opt.count}` : key), i18n: { language: 'ja' } }),
}));

import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import PipRecorder from '../PipRecorder';

beforeEach(() => {
    usePlanStore.setState({ currentPlanId: 'plan_test' } as any);
    useMitigationStore.setState({ timelineEvents: [] } as any);
});

describe('PipRecorder', () => {
    it('プラン未選択時は案内を表示し、イベント追加ボタンを出さない', () => {
        usePlanStore.setState({ currentPlanId: null } as any);
        render(<PipRecorder />);
        expect(screen.getByText('timeline.recorder.no_plan')).toBeTruthy();
        expect(screen.queryByText('timeline.recorder.add_event')).toBeNull();
    });

    it('タイマー画面でスタート/イベント追加ボタンが見える', () => {
        render(<PipRecorder />);
        expect(screen.getByText('timeline.recorder.start')).toBeTruthy();
        expect(screen.getByText('timeline.recorder.add_event')).toBeTruthy();
    });

    it('イベント追加→フォームで保存すると addEvent され timelineEvents が増える', () => {
        render(<PipRecorder />);
        fireEvent.click(screen.getByText('timeline.recorder.add_event'));
        const writeBtn = screen.getByText('timeline.recorder.write');
        const nameInput = document.querySelector('[data-tutorial="event-name-input"]') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'テスト攻撃' } });
        fireEvent.click(writeBtn);
        expect(useMitigationStore.getState().timelineEvents.length).toBe(1);
    });
});
