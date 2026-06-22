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

const baseEvent: TimelineEvent = {
    id: 'e1',
    time: 30,
    name: { ja: 'ホリゾンタル', en: 'Horizontal' },
    damageType: 'magical',
    damageAmount: 50000,
    target: 'MT',
};

function submitForm() {
    const form = document.getElementById('event-modal-form') as HTMLFormElement;
    form.requestSubmit
        ? form.requestSubmit()
        : form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('EventForm altName(2択攻撃)', () => {
    it('altName を入力して保存すると onSave に altName が乗る', () => {
        let saved: any = null;
        render(<EventForm initialData={baseEvent} onSave={(e) => { saved = e; }} />);
        const alt = screen.getByTestId('event-altname-input') as HTMLInputElement;
        fireEvent.change(alt, { target: { value: 'ヴァーティカル' } });
        submitForm();
        expect(saved?.altName).toBeTruthy();
        expect(Object.values(saved.altName)).toContain('ヴァーティカル');
    });

    it('altName 空のまま保存すると altName は付かない(undefined)', () => {
        let saved: any = null;
        render(<EventForm initialData={baseEvent} onSave={(e) => { saved = e; }} />);
        submitForm();
        expect(saved).toBeTruthy();
        expect(saved.altName).toBeUndefined();
    });

    it('initialData.altName があると入力欄に初期表示される', () => {
        render(
            <EventForm
                initialData={{ ...baseEvent, altName: { ja: 'ヴァーティカル', en: 'Vertical' } }}
                onSave={() => {}}
            />,
        );
        const alt = screen.getByTestId('event-altname-input') as HTMLInputElement;
        expect(alt.value).toMatch(/ヴァーティカル|Vertical/);
    });
});
