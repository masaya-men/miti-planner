// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, opt?: any) => (opt?.count !== undefined ? `${k}:${opt.count}` : k), i18n: { language: 'ja' } }),
}));
// 再生中 (isPlaying: true) を模擬 → 大ボタンは「戦闘開始！」になる。getCurrentTime は 15 固定。
vi.mock('../../hooks/useYouTubePlayer', () => ({
    useYouTubePlayer: () => ({ ready: true, isPlaying: true, play: () => {}, pause: () => {}, getCurrentTime: () => 15 }),
}));

import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import VideoRecorderModal from '../VideoRecorderModal';

beforeEach(() => {
    usePlanStore.setState({ currentPlanId: 'plan_test', plans: [] } as any);
    useMitigationStore.setState({ timelineEvents: [] } as any);
});

describe('VideoRecorderModal', () => {
    it('プラン未選択なら案内を表示', () => {
        usePlanStore.setState({ currentPlanId: null, plans: [] } as any);
        render(<VideoRecorderModal isOpen onClose={() => {}} />);
        expect(screen.getByText('timeline.recorder.no_plan')).toBeTruthy();
    });

    it('URL読込→戦闘開始→イベント追加→表に書き込む で addEvent される', () => {
        render(<VideoRecorderModal isOpen onClose={() => {}} />);
        const input = screen.getByPlaceholderText('timeline.recorder.video_url_placeholder') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
        fireEvent.click(screen.getByText('timeline.recorder.video_load'));
        // 再生中なので大ボタンは「戦闘開始！」→ 押下で戦闘開始マーク
        fireEvent.click(screen.getByText('timeline.recorder.combat_start_button'));
        fireEvent.click(screen.getByText('timeline.recorder.add_event'));
        const nameInput = document.querySelector('[data-tutorial="event-name-input"]') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'テスト攻撃' } });
        fireEvent.click(screen.getByText('timeline.recorder.write'));
        expect(useMitigationStore.getState().timelineEvents.length).toBe(1);
    });
});
