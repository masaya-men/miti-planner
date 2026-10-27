import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import allow from './rawStyleAllowlist.json';

// トークン外の生の色(Tailwind のパレット色・#直書き)と文字サイズの直書き(text-[Npx])は、
// 今ある数より増やしたら落ちる(2026-10-27 整頓⑦の再発防止)。新しく書くときは app トークンを使う。
// 減らしたら rawStyleAllowlist.json の数も下げる(下げないと後で同じ数まで増やせてしまう)。
// ハウジング・管理画面・MIL-SPEC は独自の見た目ルールなので対象外。
const SRC = resolve(__dirname, '../../');
const SKIP_DIRS = ['node_modules', '__tests__', 'housing', 'admin', 'military'];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return SKIP_DIRS.includes(name) ? [] : walk(full);
        return name.endsWith('.tsx') ? [full] : [];
    });
}

const PALETTE = /(?<![\w-])(?:bg|text|border|ring|fill|stroke|outline|decoration|divide|from|via|to|shadow|caret|placeholder|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?![\w-])/g;
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g;
const PX_TEXT = /(?<![\w-])text-\[\d+(?:\.\d+)?px\]/g;

type Counts = [palette: number, hex: number, pxText: number];
const LABELS = ['パレット色', '#直書き', 'text-[Npx]'];

function count(src: string): Counts {
    return [(src.match(PALETTE) ?? []).length, (src.match(HEX) ?? []).length, (src.match(PX_TEXT) ?? []).length];
}

const allowed: Record<string, number[]> = allow;

describe('生の色・文字サイズの直書きを増やさない', () => {
    it('どのファイルも許可リストの数を超えない', () => {
        const over: string[] = [];
        for (const file of walk(SRC)) {
            const key = relative(SRC, file).split(sep).join('/');
            const now = count(readFileSync(file, 'utf8'));
            const max = allowed[key] ?? [0, 0, 0];
            now.forEach((n, i) => {
                if (n > max[i]) over.push(`${key}: ${LABELS[i]} ${max[i]} → ${n}`);
            });
        }
        expect(over).toEqual([]);
    });

    it('許可リストは今の数どおり(減らしたら下げる・消えたファイルは消す)', () => {
        const stale: string[] = [];
        for (const [key, max] of Object.entries(allowed)) {
            const file = join(SRC, key);
            if (!existsSync(file)) {
                stale.push(`${key}: ファイルが無い`);
                continue;
            }
            const now = count(readFileSync(file, 'utf8'));
            now.forEach((n, i) => {
                if (n < max[i]) stale.push(`${key}: ${LABELS[i]} ${max[i]} → ${n}`);
            });
        }
        expect(stale).toEqual([]);
    });
});
