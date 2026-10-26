// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_STYLE_CLASS } from '../useThemeStore';

// index.html の起動時スクリプト(React より前にテーマクラスを付けてちらつきを防ぐ)は store と別のコピー。
// スタイルを足して片方だけ直すと、初回描画だけ旧い見た目になる。両者のずれをここで止める(2026-10-26 設計監査)。
const html = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8');

describe('テーマのスタイル別クラスが index.html の起動時スクリプトと揃っている', () => {
    it('保存キーが同じ', () => {
        expect(html).toContain("localStorage.getItem('theme-storage')");
    });

    for (const [style, cls] of Object.entries(THEME_STYLE_CLASS)) {
        if (!cls) continue;
        it(`${style} → ${cls} を起動時スクリプトでも付けている`, () => {
            expect(html).toContain(`s.themeStyle === '${style}'`);
            expect(html).toContain(`classList.add('${cls}')`);
        });
    }

    it('起動時スクリプトが store に無いスタイルを参照していない', () => {
        const referenced = [...html.matchAll(/s\.themeStyle === '([\w-]+)'/g)].map((m) => m[1]);
        expect(referenced.length).toBeGreaterThan(0);
        for (const style of referenced) expect(Object.keys(THEME_STYLE_CLASS)).toContain(style);
    });
});
