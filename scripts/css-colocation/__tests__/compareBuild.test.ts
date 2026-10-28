import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { ORDER_PREFIX, compareBuilds, compareCss, splitAccepted } from '../compare-build.mjs';

const BASE = '.housing-a{color:red} .housing-a{color:blue} .housing-b{margin:0} .housing-c{padding:0}';

describe('compareCss', () => {
  it('同じ CSS なら差なし', () => {
    expect(compareCss(BASE, BASE)).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('規則が消えたら missing', () => {
    const r = compareCss(BASE, BASE.replace('.housing-b{margin:0}', ''));
    expect(r.missing).toHaveLength(1);
    expect(r.extra).toHaveLength(0);
  });
  it('同じ規則が 2 回なら extra', () => {
    expect(compareCss(BASE, `${BASE} .housing-c{padding:0}`).extra).toHaveLength(1);
  });
  it('順番頼りの組が逆になったら flipped', () => {
    const next = '.housing-a{color:blue} .housing-a{color:red} .housing-b{margin:0} .housing-c{padding:0}';
    expect(compareCss(BASE, next).flipped).toHaveLength(1);
  });
  it('「A, B {}」を「A {} B {}」に分けても差なし', () => {
    const base = '.housing-x, .housing-y{color:red}';
    expect(compareCss(base, '.housing-x{color:red} .housing-y{color:red}')).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('組でない規則の入れ替えは flipped にならない', () => {
    const next = '.housing-c{padding:0} .housing-a{color:red} .housing-a{color:blue} .housing-b{margin:0}';
    expect(compareCss(BASE, next)).toEqual({ missing: [], extra: [], flipped: [] });
  });
});

describe('compareBuilds(起動時の CSS+後読みの CSS)', () => {
  const M = /^milspec-/;
  it('起動時の規則が後読みへ移っただけなら差なし', () => {
    const base = { eager: '.milspec-a{color:red} .milspec-b{margin:0}', lazy: [] };
    const next = { eager: '.milspec-b{margin:0}', lazy: [{ file: 'A.css', css: '.milspec-a{color:red}' }] };
    expect(compareBuilds(base, next, undefined, M)).toMatchObject({ missing: [], extra: [], flipped: [], lazyCross: 0 });
  });
  it('後読みの別々のファイルに分かれた組は flipped でなく lazyCross に数える', () => {
    const base = { eager: '.milspec-a{color:red}', lazy: [{ file: 'A.css', css: '.milspec-a{color:blue}' }] };
    const next = { eager: '', lazy: [{ file: 'A.css', css: '.milspec-a{color:blue}' }, { file: 'B.css', css: '.milspec-a{color:red}' }] };
    const r = compareBuilds(base, next, undefined, M);
    expect(r.flipped).toHaveLength(0);
    expect(r.lazyCross).toBe(1);
    expect(r.missing).toHaveLength(0);
  });
  it('基準で既に別々の後読みファイルにあった組は、 同じファイルに集めて並びが変わっても flipped にしない', () => {
    const base = { eager: '', lazy: [{ file: 'A.css', css: '.milspec-a{color:red}' }, { file: 'B.css', css: '.milspec-a{color:blue}' }] };
    const next = { eager: '', lazy: [{ file: 'K.css', css: '.milspec-a{color:blue} .milspec-a{color:red}' }] };
    expect(compareBuilds(base, next, undefined, M).flipped).toHaveLength(0);
  });
  it('起動時と後読みの間で動いた規則を toLazy / toEager に出す', () => {
    const base = { eager: '.milspec-a{color:red} .milspec-b{margin:0}', lazy: [{ file: 'A.css', css: '.milspec-c{padding:0}' }] };
    const next = { eager: '.milspec-c{padding:0}', lazy: [{ file: 'B.css', css: '.milspec-a{color:red} .milspec-b{margin:0}' }] };
    const r = compareBuilds(base, next, undefined, M);
    expect(r.toLazy).toHaveLength(2);
    expect(r.toEager).toHaveLength(1);
  });
  it('起動時の中で組が逆になったら flipped', () => {
    const base = { eager: '.milspec-a{color:red} .milspec-a{color:blue}', lazy: [] };
    const next = { eager: '.milspec-a{color:blue} .milspec-a{color:red}', lazy: [] };
    expect(compareBuilds(base, next, undefined, M).flipped).toHaveLength(1);
  });
  it('後読みから規則が消えたら missing', () => {
    const base = { eager: '', lazy: [{ file: 'A.css', css: '.milspec-a{color:red}' }] };
    expect(compareBuilds(base, { eager: '', lazy: [] }, undefined, M).missing).toHaveLength(1);
  });
});

describe('値の書き方の正規化(Tailwind の後処理を通る index.css ↔ 通らない部品の CSS)', () => {
  it('書き方だけの違いは同じ規則とみなす', () => {
    const base = '.a{transition:transform .3s var(--x), color .15s ease}';
    const next = '.a{transition: transform 0.3s var(--x), color 150ms ease}';
    expect(compareCss(base, next)).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('keyframes の書き方だけの違いも同じとみなす', () => {
    const base = '@keyframes k{0%{opacity:1}to{opacity:0}}';
    const next = '@keyframes k {\n  0% { opacity: 1; }\n  100% { opacity: 0; }\n}';
    expect(compareCss(base, next)).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('中身の違いは別の規則のまま', () => {
    const r = compareCss('.a{backdrop-filter:var(--tw-backdrop-blur,)}', '.a{backdrop-filter:blur(12px)}');
    expect(r.missing).toHaveLength(1);
    expect(r.extra).toHaveLength(1);
  });
  it('段が違えば別の規則のまま', () => {
    const r = compareCss('@layer components{.a{color:red}}', '.a{color:red}');
    expect(r.missing).toHaveLength(1);
  });
});

describe('セレクタと条件の書き方の正規化', () => {
  it('::before と :before・> の空白・属性値の引用符・@media の空白は同じとみなす', () => {
    const base = '@media (max-width:767px){.a:before,.b>.c[data-open=true]{color:red}}';
    const next = '@media (max-width: 767px) { .a::before, .b > .c[data-open="true"] { color: red } }';
    expect(compareCss(base, next)).toEqual({ missing: [], extra: [], flipped: [] });
  });
});

describe('順番頼りを探す対象(全部の対象の class)', () => {
  it('housing・milspec に加えて index.css から移した class も対象', () => {
    for (const c of ['housing-a', 'housinger-a', 'milspec-a', 'recast-icon', 'empty-plan-scrim']) expect(ORDER_PREFIX.test(c)).toBe(true);
    expect(ORDER_PREFIX.test('text-red-500')).toBe(false);
  });
});

describe('確認済みの差(accepted-diffs.json)', () => {
  const A = [{ rule: '.a:before', reason: 'r' }];
  it('欠けと重複が同じ条件・セレクタで対になっている時だけ accepted へ分ける', () => {
    const r = splitAccepted(['|.a:before{x:1}#0', '(max-width:767px)|.b{y:2}#0'], ['|.a:before{x:2}#0'], A);
    expect(r).toEqual({ missing: ['(max-width:767px)|.b{y:2}#0'], extra: [], accepted: 1 });
  });
  it('片方だけ(規則が消えた・増えた)なら accepted にしない', () => {
    expect(splitAccepted(['|.a:before{x:1}#0'], [], A)).toEqual({ missing: ['|.a:before{x:1}#0'], extra: [], accepted: 0 });
  });
  it('条件が違えば対にしない', () => {
    expect(splitAccepted(['|.a:before{x:1}#0'], ['(min-width:768px)|.a:before{x:2}#0'], A).accepted).toBe(0);
  });
  it('セレクタの前方一致では拾わない', () => {
    expect(splitAccepted(['|.a:before-x{x:1}#0'], ['|.a:before-x{x:2}#0'], A).accepted).toBe(0);
  });
});

describe('予備の行・接頭辞は書き方の正規化で消さない', () => {
  it('height:100vh の予備の行が消えたら別の規則', () => {
    expect(compareCss('.a{height:100vh;height:100dvh}', '.a{height:100dvh}').missing).toHaveLength(1);
  });
  it('-webkit-backdrop-filter が消えたら別の規則', () => {
    expect(compareCss('.a{-webkit-backdrop-filter:var(--b);backdrop-filter:var(--b)}', '.a{backdrop-filter:var(--b)}').missing).toHaveLength(1);
  });
});

describe('宣言の並び(後処理は効き方が同じ範囲で並べ替える)', () => {
  it('別の仲間の性質どうしの並びは同じとみなす', () => {
    expect(compareCss('.a{display:grid;opacity:0}', '.a{opacity:0;display:grid}')).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('同じ仲間(一括指定と個別指定)の並びが変われば別の規則', () => {
    expect(compareCss('.a{background:red;background-color:blue}', '.a{background-color:blue;background:red}').missing).toHaveLength(1);
  });
  it('inset と top・place と align など、 名前の頭が違う一括指定も同じ仲間', () => {
    expect(compareCss('.a{inset:0;top:4px}', '.a{top:4px;inset:0}').missing).toHaveLength(1);
    expect(compareCss('.a{place-items:center;align-items:start}', '.a{align-items:start;place-items:center}').missing).toHaveLength(1);
  });
});

describe('宣言の並び(仲間の中)', () => {
  it('互いに上書きしない個別指定どうし(top と left・font-family と font-size)は並びが違っても同じ', () => {
    expect(compareCss('.a{top:0;left:0;font-size:8px;font-family:x}', '.a{left:0;top:0;font-family:x;font-size:8px}').missing).toHaveLength(0);
  });
  it('border の仲間は個別指定どうしでも並びを保つ(border-color と border-top-color)', () => {
    expect(compareCss('.a{border-color:red;border-top-color:blue}', '.a{border-top-color:blue;border-color:red}').missing).toHaveLength(1);
  });
  it('同じ性質の予備の行は並びを保つ', () => {
    expect(compareCss('.a{height:100vh;height:100dvh}', '.a{height:100dvh;height:100vh}').missing).toHaveLength(1);
  });
});

describe('名前の頭が同じでも一括指定ではない組', () => {
  it('transform と transform-origin は並びが違っても同じ', () => {
    expect(compareCss('.a{transform-origin:0;transform:scaleX(0)}', '.a{transform:scaleX(0);transform-origin:left}').missing).toHaveLength(0);
  });
});
