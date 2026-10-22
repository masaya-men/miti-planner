// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));
vi.mock('../../../store/useThemeStore', () => ({
    useThemeStore: (sel?: any) => {
        const st = { contentLanguage: 'ja' };
        return sel ? sel(st) : st;
    },
}));

import { SheetColumnHeader } from '../sheet/SheetColumnHeader';
import type { Mitigation } from '../../../types';

const def = (id: string): Mitigation => ({
    id, jobId: 'WAR', name: { ja: id, en: id }, icon: `/i/${id}.png`, duration: 10, recast: 60,
    type: 'all', value: 10, scope: 'self',
} as any);

describe('SheetColumnHeader', () => {
    it('列ごとに data-sheet-col=mitigationId のアイコンが列数ぶん並ぶ', () => {
        const members = [{ id: 'MT', jobId: 'WAR', role: 'tank' }, { id: 'H1', jobId: null, role: 'healer' }] as any[];
        const map = new Map([
            ['MT', [{ mitigationId: 'a', def: def('a') }, { mitigationId: 'b', def: def('b') }, { mitigationId: 'c', def: def('c') }]],
            ['H1', []],
        ]);
        const { container } = render(<SheetColumnHeader members={members} sheetColumnMap={map as any} />);
        const boxes = container.querySelectorAll('[data-sheet-member]');
        expect(boxes).toHaveLength(2);
        const cols = boxes[0].querySelectorAll('[data-sheet-col]');
        expect(Array.from(cols).map(c => c.getAttribute('data-sheet-col'))).toEqual(['a', 'b', 'c']);
        expect(boxes[0].querySelectorAll('img[data-mit-icon]')).toHaveLength(3);
    });
});
