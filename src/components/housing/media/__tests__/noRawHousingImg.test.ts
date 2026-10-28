/**
 * 再発防止: src/components/housing/** で家の写真に素の <img> を書くと落ちる。
 * 家の写真・動画サムネは必ず HousingImage (サイズ変換 + YouTube 予備 + 失敗時代替) を使う。
 * アバター等の画像でない / 写真でないものだけ ALLOW に理由つきで追加する。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

const ALLOW: Record<string, string> = {
  'media/HousingImage.tsx': '部品本体',
  'housinger/HousingerAvatar.tsx': 'アバター',
  'login/HousingAccountModal.tsx': 'アバター',
  'shell/AppHeader.tsx': 'アバター',
  'shell/HousingBottomNav.tsx': 'アバター',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n === '__tests__') continue;
      walk(p, out);
    } else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('housing 写真は HousingImage 経由', () => {
  it('許可リスト以外に素の <img が無い', () => {
    const bad = walk(ROOT)
      .map((f) => relative(ROOT, f).split(sep).join('/'))
      .filter((rel) => !(rel in ALLOW))
      .filter((rel) => {
        const src = readFileSync(join(ROOT, rel), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        return /<img[\s>]/.test(src);
      });
    expect(bad).toEqual([]);
  });
});
