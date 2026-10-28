import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// `animation: logo-spin ...` の keyframes を消したまま気づかず、読み込み中の丸が回っていなかった
// (2026-10-28 発見・元の定義は未使用の App.css にあった)。CSS で使う animation 名が src の CSS に定義されているかをここで見る。
const SRC = resolve(__dirname, '../../');

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
        return name.endsWith('.css') ? [full] : [];
    });
}

// animation 一括指定のうち、名前ではない語
const NOT_NAME = new Set([
    'none', 'infinite', 'normal', 'reverse', 'alternate', 'alternate-reverse', 'forwards', 'backwards', 'both',
    'running', 'paused', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end',
    'initial', 'inherit', 'unset', 'revert', 'revert-layer',
]);
const isNameToken = (t: string) => /^-?[a-zA-Z_][\w-]*$/.test(t) && !NOT_NAME.has(t);

const files = walk(SRC).map((f) => ({ path: relative(SRC, f).replace(/\\/g, '/'), text: readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));
const defined = new Set(files.flatMap((f) => [...f.text.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])));

describe('animation の名前は定義済みの keyframes だけ使う', () => {
    it('未定義の keyframes を指す animation が無い', () => {
        const missing: string[] = [];
        for (const f of files) {
            for (const m of f.text.matchAll(/(?<![\w-])animation(-name)?\s*:\s*([^;}]+)/g)) {
                // 関数の中身(cubic-bezier(...)・var(...) など)を外し、カンマ区切りの各指定から名前を拾う
                const value = m[2].replace(/[\w-]*\([^()]*\)/g, ' ');
                for (const part of value.split(',')) {
                    const tokens = part.trim().split(/\s+/).filter(isNameToken);
                    const name = m[1] ? tokens[0] : tokens.find((t) => !/^\d/.test(t));
                    if (name && !defined.has(name)) missing.push(`${f.path}: ${name}`);
                }
            }
        }
        expect([...new Set(missing)]).toEqual([]);
    });
});
