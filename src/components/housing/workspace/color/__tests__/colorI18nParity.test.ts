import { describe, it, expect } from 'vitest';
import ja from '../../../../../locales/ja.json';
import en from '../../../../../locales/en.json';
import ko from '../../../../../locales/ko.json';
import zh from '../../../../../locales/zh.json';
import zhHant from '../../../../../locales/zh-Hant.json';

type Tree = { housing: { workspace: { filter: { color: Record<string, unknown> } } } };
const colorOf = (d: unknown): Record<string, unknown> => (d as Tree).housing.workspace.filter.color;

function leaves(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
        v !== null && typeof v === 'object' ? leaves(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    ).sort();
}

describe('housing.workspace.filter.color の5言語パリティ', () => {
    const jaKeys = leaves(colorOf(ja));
    it('丸の13系統の名前を含む(明るさの段は無い)', () => {
        expect(jaKeys.filter((k) => k.startsWith('family.'))).toHaveLength(13);
        expect(jaKeys.filter((k) => k.startsWith('tone.'))).toHaveLength(0);
    });
    for (const [name, data] of Object.entries({ en, ko, zh, 'zh-Hant': zhHant })) {
        it(`${name} は ja と同じキー`, () => {
            expect(leaves(colorOf(data))).toEqual(jaKeys);
        });
        it(`${name} に空文字が無い`, () => {
            const flat = JSON.stringify(colorOf(data));
            expect(flat).not.toContain('""');
        });
    }
});
