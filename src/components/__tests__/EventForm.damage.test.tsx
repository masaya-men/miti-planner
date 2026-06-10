// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

const damagedEvent: TimelineEvent = {
    id: 'e1',
    time: 30,
    name: { ja: '強攻撃', en: 'Heavy Hit' },
    damageType: 'magical',
    damageAmount: 50000,
    target: 'MT',
};

describe('EventForm 編集時のダメージ保持 (回帰)', () => {
    it('damageAmount>0 のイベントを編集で開くと、直接入力欄に元のダメージが残る', () => {
        // バグ時: マウント直後の自動再計算が逆算モードのまま走り damageAmount を 0 上書き → 0 が表示される。
        // 修正後: lazy init で direct モード + 元の値で開くため 50000 が保持される。
        render(<EventForm initialData={damagedEvent} onSave={() => {}} />);
        expect(screen.getByDisplayValue('50000')).toBeTruthy();
    });
});
