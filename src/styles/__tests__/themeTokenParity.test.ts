import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { militaryCssText } from './militaryCssText';
import { readCssBundle } from './readCssBundle';

// ダークとライトで定義しているトークン(--*)の名前が揃っているかを見る(2026-10-26 設計監査で新設)。
// 片側にしか無いトークンは、もう片方で var() が無効値になり見た目が静かに崩れる
// (MIL-SPEC ライトの --ms-cham-* がこれで初期値 3px になっていた)。
// 「:root, .theme-dark {」のようなセレクタのまとめ書きも、:root / 共通クラスとして両側に数える。

const read = (rel: string) => readFileSync(resolve(__dirname, '../..', rel), 'utf8');

/** CSS 全体から「セレクタ一覧 → その直下で定義している --* 名」を集める(ネストした @layer / @media の中も対象) */
function collectRules(rawCss: string): { selectors: string[]; names: string[] }[] {
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules: { selectors: string[]; names: string[] }[] = [];
    const stack: { selectors: string[]; body: string }[] = [];
    let buf = '';
    for (const ch of css) {
        if (ch === '{') {
            stack.push({ selectors: buf.trim().split(',').map((s) => s.trim()), body: '' });
            buf = '';
        } else if (ch === '}') {
            const rule = stack.pop();
            if (rule) {
                const body = rule.body + buf;
                rules.push({ selectors: rule.selectors, names: [...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]) });
            }
            buf = '';
        } else if (ch === ';') {
            if (stack.length) stack[stack.length - 1].body += buf + ';';
            buf = '';
        } else {
            buf += ch;
        }
    }
    return rules;
}

function namesFor(rules: ReturnType<typeof collectRules>, selectors: string[]): Set<string> {
    const out = new Set<string>();
    for (const r of rules) {
        if (r.selectors.some((s) => selectors.includes(s))) r.names.forEach((n) => out.add(n));
    }
    return out;
}

function diff(a: Set<string>, b: Set<string>): string[] {
    return [...a].filter((n) => !b.has(n)).sort();
}

const CASES = [
    {
        label: '標準テーマ (src/index.css)',
        file: 'index.css',
        text: () => readCssBundle(resolve(__dirname, '../../index.css')),
        shared: [':root'],
        dark: ['.theme-dark'],
        light: ['.theme-light'],
        knownDarkOnly: [] as string[],
        knownLightOnly: [] as string[],
    },
    {
        label: 'MIL-SPEC (src/styles/military.css+部品の隣の CSS)',
        file: 'styles/military.css',
        text: militaryCssText,
        shared: ['.theme-military', '.theme-military:root'],
        dark: ['.theme-military.theme-dark'],
        light: ['.theme-military.theme-light'],
        // ダーク専用: 斜め切りの形(--ms-sh*)とその寸法(--ms-n*)。使う側もダークのブロック内で閉じている
        knownDarkOnly: [
            '--ms-n1', '--ms-n2', '--ms-nb',
            '--ms-sh-bl', '--ms-sh-br', '--ms-sh-slab', '--ms-sh-tl', '--ms-sh-tl-br', '--ms-sh-tl-tr', '--ms-sh-tr', '--ms-sh-tr-br',
            '--ms-shb-bl', '--ms-shb-tl', '--ms-shb-tr',
        ],
        // ライト専用: 紙の粒・下地の擦れの強さ(ライトだけの質感)
        knownLightOnly: ['--ms-grain-alpha', '--ms-wear-substrate'],
    },
];

describe('テーマのトークンがダーク/ライトで揃っている', () => {
    for (const c of CASES) {
        const rules = collectRules(c.text ? c.text() : read(c.file));
        const dark = namesFor(rules, [...c.shared, ...c.dark]);
        const light = namesFor(rules, [...c.shared, ...c.light]);

        it(`${c.label}: 解析できている`, () => {
            expect(namesFor(rules, c.dark).size).toBeGreaterThan(20);
            expect(namesFor(rules, c.light).size).toBeGreaterThan(20);
        });

        it(`${c.label}: ダークにだけあるトークンが増えていない`, () => {
            expect(diff(dark, light)).toEqual([...c.knownDarkOnly].sort());
        });

        it(`${c.label}: ライトにだけあるトークンが増えていない`, () => {
            expect(diff(light, dark)).toEqual([...c.knownLightOnly].sort());
        });
    }
});
