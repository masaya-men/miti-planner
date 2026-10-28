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

const ev: TimelineEvent = {
    id: 'e1',
    time: 30,
    name: { ja: '強攻撃', en: 'Heavy Hit' },
    damageType: 'magical',
    damageAmount: 50000,
    target: 'MT',
};

function submitForm() {
    const form = document.getElementById('event-modal-form') as HTMLFormElement;
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('EventForm 画面の切り替えと入力', () => {
    it('新規は逆算モードで開き、直接入力に切り替えると金額欄が出る', () => {
        render(<EventForm onSave={() => {}} />);
        expect(screen.getByText('mechanic_modal.actual_damage')).toBeTruthy();
        expect(screen.queryByText('modal.damage_amount')).toBeNull();
        fireEvent.click(screen.getByText('直接入力 (Direct)'));
        expect(screen.getByText('modal.damage_amount')).toBeTruthy();
        expect(screen.queryByText('mechanic_modal.actual_damage')).toBeNull();
    });

    it('reverseOnly では切り替えボタンが出ない', () => {
        render(<EventForm onSave={() => {}} reverseOnly />);
        expect(screen.queryByText('直接入力 (Direct)')).toBeNull();
        expect(screen.getByText('mechanic_modal.actual_damage')).toBeTruthy();
    });

    it('攻撃名・ダメージ種別・対象を変えて保存すると onSave に反映される', () => {
        let saved: any = null;
        render(<EventForm initialData={ev} onSave={(e) => { saved = e; }} />);
        fireEvent.change(screen.getByPlaceholderText('mechanic_modal.placeholder'), { target: { value: '新しい名前' } });
        fireEvent.click(screen.getByText('modal.physical'));
        fireEvent.click(screen.getByText('modal.st'));
        submitForm();
        expect(saved.name.ja).toBe('新しい名前');
        expect(saved.damageType).toBe('physical');
        expect(saved.target).toBe('ST');
        expect(saved.damageAmount).toBe(50000);
    });

    it('variant=pip でキャンセルを渡すとキャンセルボタンが押せる', () => {
        const onCancel = vi.fn();
        render(<EventForm initialData={ev} onSave={() => {}} onCancel={onCancel} variant="pip" />);
        const btns = Array.from(document.querySelectorAll('button[type="button"]'));
        const cancel = btns.find(b => /cancel/i.test(b.textContent ?? ''));
        expect(cancel).toBeTruthy();
        fireEvent.click(cancel!);
        expect(onCancel).toHaveBeenCalled();
    });
});
