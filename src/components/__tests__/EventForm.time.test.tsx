// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (k: string, opt?: any) => (typeof opt === 'string' ? opt : opt?.defaultValue ?? k),
        i18n: { language: 'ja' },
    }),
}));

import { useMitigationStore } from '../../store/useMitigationStore';
import { EventForm } from '../EventForm';
import type { TimelineEvent } from '../../types';

beforeEach(() => {
    useMitigationStore.setState({ partyMembers: [], currentLevel: 100 } as any);
});

const ev = (time: number): TimelineEvent => ({
    id: 'e1', time,
    name: { ja: '攻撃', en: 'Hit' },
    damageType: 'magical', damageAmount: 0, target: 'AoE',
});

/** form を submit して onSave を発火させる。 */
function submit() {
    const form = document.getElementById('event-modal-form') as HTMLFormElement;
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('EventForm 時刻 MM:SS 入力', () => {
    it('既存イベントを開くと時刻欄が M:SS で表示される', () => {
        render(<EventForm initialData={ev(375)} onSave={() => {}} />);
        expect((screen.getByTestId('event-time-input') as HTMLInputElement).value).toBe('6:15');
    });

    it('"6:15" と入力して保存すると time=375 で onSave される', () => {
        let saved: any = null;
        render(<EventForm initialData={ev(0)} onSave={(e) => { saved = e; }} />);
        fireEvent.change(screen.getByTestId('event-time-input'), { target: { value: '6:15' } });
        submit();
        expect(saved?.time).toBe(375);
    });

    it('裸の秒数 "375" でも time=375 になる（両形式OK）', () => {
        let saved: any = null;
        render(<EventForm initialData={ev(0)} onSave={(e) => { saved = e; }} />);
        fireEvent.change(screen.getByTestId('event-time-input'), { target: { value: '375' } });
        submit();
        expect(saved?.time).toBe(375);
    });

    it('全角 "６：１５" を入力しても time=375 になる', () => {
        let saved: any = null;
        render(<EventForm initialData={ev(0)} onSave={(e) => { saved = e; }} />);
        fireEvent.change(screen.getByTestId('event-time-input'), { target: { value: '６：１５' } });
        submit();
        expect(saved?.time).toBe(375);
    });
});
