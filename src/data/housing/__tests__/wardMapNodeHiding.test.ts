import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ワードマップの Node 赤丸 (#FF0000) 隠蔽の回帰テスト。
 *
 * 背景 (root cause):
 *   ナビ経路計算用の「Node」と「ナビ赤線」は表示 SVG 内で stroke="#FF0000" が目印。
 *   これらは housing.css で display:none にして裏データとしてだけ使う設計。
 *   ところが Mist/MistSub は Figma で Node を <path> として書き出し、他 8 エリア
 *   (ラベンダー/ゴブレット/エンピレアム/シロガネ ×本街/拡張) は <circle> で書き出す。
 *   隠蔽セレクタが `path[stroke="#FF0000"]` と要素を path に限定していたため、
 *   <circle> の Node 赤丸が他エリアで可視のまま残っていた (本バグ)。
 *
 * 不変条件: 隠蔽セレクタは要素非依存 `[stroke="#FF0000"]` であり、全 10 マップの
 *   #FF0000 要素 (path でも circle でも) を漏れなく隠す。
 */

const ROOT = process.cwd();
const CSS_PATH = join(ROOT, 'src/styles/housing.css');
const MAP_DIR = join(ROOT, 'src/data/housing');

// 表示 SVG を inline 展開する 2 つのホスト (MapView / WardMapPreview)
const HOSTS = ['housing-map-svg-host', 'housing-ward-preview-svg-host'] as const;

// WARD_MAP_LOADERS に載る全 10 マップの表示 SVG (本街 + 拡張)
const MAP_FILES = [
  'mist.generated.svg',
  'mistSub.generated.svg',
  'goblet.generated.svg',
  'gobletSub.generated.svg',
  'lavender.generated.svg',
  'lavenderSub.generated.svg',
  'shirogane.generated.svg',
  'shiroganeSub.generated.svg',
  'empyreum.generated.svg',
  'empyreumSub.generated.svg',
];

const css = readFileSync(CSS_PATH, 'utf8');

/** housing.css から `.<host> svg <SELECTOR> { display: none }` の SELECTOR を取り出す */
function hidingSelectorFor(host: string): string | null {
  const re = new RegExp(
    `\\.${host}\\s+svg\\s+([^\\s{][^{]*?)\\s*\\{\\s*display:\\s*none`,
  );
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

/** `path[stroke="#FF0000"]` → 'path' / `[stroke="#FF0000"]` → null (要素非依存) */
function tagQualifierOf(selector: string): string | null {
  const m = selector.match(/^([a-zA-Z]+)?\[stroke="#FF0000"\]$/);
  if (!m) throw new Error(`予期しない隠蔽セレクタ形状: ${selector}`);
  return m[1] ?? null;
}

/** SVG テキスト内で stroke="#FF0000" を持つ要素のタグ名一覧 */
function redStrokeTags(svg: string): string[] {
  return [...svg.matchAll(/<([a-zA-Z]+)\b[^>]*\bstroke="#FF0000"/g)].map((m) => m[1]);
}

describe('ward map の Node/ナビ赤線 (#FF0000) 隠蔽', () => {
  it('両ホストの隠蔽セレクタは要素非依存 [stroke="#FF0000"] (path 限定に戻すと circle Node が漏れる)', () => {
    for (const host of HOSTS) {
      const sel = hidingSelectorFor(host);
      expect(sel, `${host} の隠蔽ルールが housing.css に見当たらない`).toBe('[stroke="#FF0000"]');
    }
  });

  it.each(MAP_FILES)('%s: 全ての #FF0000 要素が WardMapPreview の隠蔽セレクタで隠れる', (file) => {
    const svg = readFileSync(join(MAP_DIR, file), 'utf8');
    const tags = redStrokeTags(svg);
    // どのマップにも Node + ナビ赤線があるはず (0 なら素材破損 or セレクタ前提崩れ)
    expect(tags.length).toBeGreaterThan(0);

    const qualifier = tagQualifierOf(hidingSelectorFor('housing-ward-preview-svg-host')!);
    // qualifier=null (要素非依存) なら全タグを覆う。path 限定に退行すると circle が覆えず fail。
    for (const tag of tags) {
      const covered = qualifier === null || qualifier === tag;
      expect(covered, `${file} の <${tag} stroke="#FF0000"> が隠蔽セレクタに漏れている`).toBe(true);
    }
  });

  it('他エリア (lavender) の Node は <circle stroke="#FF0000">、Mist は <path stroke="#FF0000"> (退行の発生源)', () => {
    const lavender = readFileSync(join(MAP_DIR, 'lavender.generated.svg'), 'utf8');
    const mist = readFileSync(join(MAP_DIR, 'mist.generated.svg'), 'utf8');
    // 他エリアは circle Node を持つ → path 限定セレクタでは取りこぼす
    expect(/<circle\b[^>]*\bstroke="#FF0000"/.test(lavender)).toBe(true);
    // Mist は circle を持たず path のみ → 旧セレクタでも隠せていた
    expect(/<circle\b[^>]*\bstroke="#FF0000"/.test(mist)).toBe(false);
    expect(/<path\b[^>]*\bstroke="#FF0000"/.test(mist)).toBe(true);
  });
});
