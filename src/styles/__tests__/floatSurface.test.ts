import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCssBundle } from './readCssBundle';
import { militaryCssText } from './militaryCssText';

// 浮かぶもの(窓・シート・通知・帯・メニュー・ツールチップ)の素材 .float-surface(2026-10-28・見本の案 C)。
// 設計書 = docs/superpowers/specs/2026-10-28-floating-surface-unify-design.md
const ROOT = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const dark = read('src/styles/base/tokens-dark.css');
const light = read('src/styles/base/tokens-light.css');
const base = readCssBundle(resolve(ROOT, 'src/index.css')).replace(/\r\n/g, '\n');
const military = militaryCssText();

/** 選択子の並びに selector を含む節の中身 */
const ruleWith = (css: string, selector: string) => {
    const i = css.indexOf(selector);
    expect(i, `${selector} が無い`).toBeGreaterThanOrEqual(0);
    const open = css.indexOf('{', i);
    return css.slice(css.lastIndexOf('}', i) + 1, css.indexOf('\n}', open));
};

describe('浮かぶものの素材 float-surface', () => {
    it('ダークのトークンが案 C の値', () => {
        expect(dark).toContain('--float-bg: rgba(255, 255, 255, 0.04);');
        expect(dark).toContain('--float-blur: 12px;');
        expect(dark).toContain('--float-border: rgba(255, 255, 255, 0.18);');
        expect(dark).toContain('--float-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);');
        expect(dark).toContain('--float-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);');
    });

    it('ライトのトークンが案 C の値', () => {
        expect(light).toContain('--float-bg: rgba(255, 255, 255, 0.55);');
        expect(light).toContain('--float-blur: 20px;');
        expect(light).toContain('--float-border: rgba(0, 0, 0, 0.08);');
        expect(light).toContain('--float-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);');
        expect(light).toContain('--float-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);');
    });

    it('.float-surface はぼかしを --tw-backdrop-blur 経由で掛け、blur( を backdrop-filter に直書きしない', () => {
        const rule = ruleWith(base, '.float-surface {');
        expect(rule).toContain('--tw-backdrop-blur: blur(var(--float-blur));');
        expect(rule).toContain('var(--float-bg)');
        expect(rule).toContain('var(--float-border)');
        expect(rule).toContain('var(--float-shadow), var(--float-inset)');
        expect(base).not.toMatch(/\.float-surface[^{]*\{[^}]*backdrop-filter:\s*blur\(/);
        expect(ruleWith(base, '.float-surface::before')).toContain('backdrop-filter: var(--tw-backdrop-blur,)');
    });

    it('index.css が float-surface.css を読み込む', () => {
        expect(read('src/index.css')).toContain('@import "./styles/base/float-surface.css";');
    });

    it('MIL-SPEC のボードの中でも、掛け戻しの節と文字・書体の節が float-surface に効く', () => {
        const revert = ruleWith(military, '.theme-military .milspec-app .float-surface');
        expect(revert).toContain('.theme-military .milspec-app .glass-tier3');
        expect(revert).toContain('--color-app-text: var(--color-text-primary);');
        expect(military).toMatch(/:where\([^)]*\.theme-military \.milspec-app \.float-surface[^)]*\)\s*\{/);
    });
});
