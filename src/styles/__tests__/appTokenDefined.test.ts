import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// `text-app-yellow` のように定義の無い app トークンを書くと、Tailwind は何も出さず色が当たらないまま気づけない
// (2026-10-26 整頓⑦で 10 か所見つかった)。src の .tsx/.ts で使う `*-app-*` が CSS に定義されているかをここで見る。
const SRC = resolve(__dirname, '../../');

function walk(dir: string, exts: string[]): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full, exts);
        return exts.some((e) => name.endsWith(e)) ? [full] : [];
    });
}

const css = walk(SRC, ['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
const defined = new Set([...css.matchAll(/--(color|text|font|radius|shadow)-app-([a-z0-9-]+)\s*:/g)].map((m) => `${m[1]}:${m[2]}`));

// 色として読む接頭辞と、文字サイズとして読む接頭辞
const COLOR_PREFIX = ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'outline', 'decoration', 'accent', 'divide', 'from', 'via', 'to', 'shadow', 'caret', 'placeholder'];
const USE = new RegExp(`(?<![\\w-])(${COLOR_PREFIX.join('|')})-app-([a-z0-9-]+?)(?:/[\\d.]+)?(?![\\w-])`, 'g');

const isDefined = (prefix: string, name: string) =>
    defined.has(`color:${name}`) ||
    (prefix === 'text' && defined.has(`text:${name}`)) ||
    (prefix === 'shadow' && defined.has(`shadow:${name}`));

describe('app トークンは定義済みのものだけ使う', () => {
    it('未定義の *-app-* が無い', () => {
        const missing: string[] = [];
        for (const file of walk(SRC, ['.tsx', '.ts'])) {
            if (file.includes('__tests__')) continue;
            const src = readFileSync(file, 'utf8');
            for (const m of src.matchAll(USE)) {
                if (!isDefined(m[1], m[2])) missing.push(`${relative(SRC, file).replace(/\\/g, '/')}: ${m[0]}`);
            }
        }
        expect([...new Set(missing)]).toEqual([]);
    });
});
