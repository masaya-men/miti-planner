import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { planColocation, removeCssImport } from '../planColocation.mjs';
// @ts-expect-error mjs の共通部品(型定義なし)
import { militaryPlanOptions } from '../scopes/military.mjs';

// MIL-SPEC の持ち主判定(docs/superpowers/specs/2026-10-28-military-css-colocation-design.md §4.1・§4.2)
const M = 'src/components/military';
const S = 'src/styles/military';
const jsxBase = [
  { file: `${M}/header/MilspecHeader.tsx`, text: "import { MilspecLogo } from './MilspecLogo';\n<div className=\"milspec-hdr\"><MilspecLogo /></div>" },
  { file: `${M}/header/MilspecLogo.tsx`, text: '<div className="milspec-logo" />' },
  { file: `${M}/MilspecStyleToggle.tsx`, text: '<button className="milspec-toggle" />' },
  { file: 'src/components/RecastRow.tsx', text: '<div className="recast-row" />' },
];
const plan = (css: string, { jsx = jsxBase, staticFiles = [] as string[], importersOf = {} as Record<string, string[]>, file = `${S}/pending-1.css`, role = 'pending' } = {}) =>
  planColocation({
    sources: [{ file, css, role }],
    jsx,
    shared: role === 'shared' ? [file.split('/').pop()] : [],
    frame: role === 'frame' ? [file.split('/').pop()] : [],
    overrides: {},
    componentsDir: M,
    sharedDir: S,
    unusedDir: `${S}/unused`,
    prefixRe: /^milspec-/,
    ...militaryPlanOptions({ staticFiles: new Set(staticFiles), importersOf: (f: string) => importersOf[f] ?? [], jsx }),
  });
const norm = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('planColocation(MIL-SPEC)', () => {
  it('後読みの部品が持ち主ならその隣へ', () => {
    const p = plan('.theme-military .milspec-logo{color:red}');
    expect(norm(p.outputs.get(`${M}/header/MilspecLogo.css`))).toContain('.milspec-logo{color:red}');
  });
  it('起動時の部品が持ち主なら boot-parts へ', () => {
    const p = plan('.theme-military .milspec-toggle{color:red}', { staticFiles: [`${M}/MilspecStyleToggle.tsx`] });
    expect([...p.outputs.keys()]).toEqual([`${S}/boot-parts.css`]);
  });
  it('標準の部品が持ち主なら standard-table へ(旧 standard-parts を 5 本に分けた後の既定)', () => {
    const p = plan('.theme-military .recast-row .milspec-x{color:red}', {
      jsx: [...jsxBase, { file: 'src/components/RecastRow.tsx', text: '<div className="recast-row milspec-x" />' }],
    });
    expect([...p.outputs.keys()]).toEqual([`${S}/standard-table.css`]);
  });
  it('標準の部品の要素を .milspec-* の下で描き変える規則は standard-table へ', () => {
    const jsx = [...jsxBase, { file: 'src/components/Timeline.tsx', text: '<div data-time-row={t} id="timeline-header-inner" />' }];
    const p = plan('.theme-military .milspec-hdr [data-time-row] > *{color:red} .theme-military .milspec-hdr #timeline-header-inner{color:blue}', { jsx });
    expect([...p.outputs.keys()]).toEqual([`${S}/standard-table.css`]);
  });
  it('値なしの JSX 属性(data-x だけの行)も「書いている」に数える', () => {
    const jsx = [...jsxBase, { file: 'src/components/Bands.tsx', text: '<div\n  data-phase-overlay\n  className="x"\n/>' }];
    const p = plan('.theme-military .milspec-hdr [data-phase-overlay] span{color:red}', { jsx });
    expect([...p.outputs.keys()]).toEqual([`${S}/standard-table.css`]);
  });
  it('セレクタ文字列で探しているだけの部品は「書いている」に数えない', () => {
    const jsx = [
      ...jsxBase,
      { file: 'src/components/Timeline.tsx', text: '<div data-time-row={t} />' },
      { file: `${M}/table/Reticle.tsx`, text: "t.closest('[data-time-row]'); row.getAttribute('data-time-row')" },
    ];
    const p = plan('.theme-military .milspec-hdr [data-time-row]{color:red}', { jsx });
    expect([...p.outputs.keys()]).toEqual([`${S}/standard-table.css`]);
  });
  it('MIL-SPEC の部品が描く要素なら .milspec-* が無くてもその部品へ', () => {
    const jsx = [...jsxBase, { file: `${M}/header/MilspecLogo.tsx`, text: '<div className="milspec-logo"><i className="brd" /></div>' }];
    const p = plan('.theme-military .milspec-logo .brd{color:red}', { jsx });
    expect([...p.outputs.keys()]).toEqual([`${M}/header/MilspecLogo.css`]);
  });
  it('.ts が組み立てる class は import している部品が持ち主', () => {
    const ts = `${M}/armor/plates.ts`;
    const jsx = [...jsxBase, { file: ts, text: "export const cls = 'milspec-plate';" }];
    const p = plan('.theme-military .milspec-plate{color:red}', { jsx, importersOf: { [ts]: [`${M}/header/MilspecLogo.tsx`] } });
    expect([...p.outputs.keys()]).toEqual([`${M}/header/MilspecLogo.css`]);
  });
  it('.tsx が class を書いていれば、 同じ class を探すだけの .ts は持ち主の候補にしない', () => {
    const ts = `${M}/fx/engine.ts`;
    const jsx = [...jsxBase, { file: ts, text: "querySelector('.milspec-logo')" }];
    const p = plan('.milspec-logo{color:red}', { jsx, importersOf: { [ts]: [`${M}/header/MilspecHeader.tsx`] } });
    expect([...p.outputs.keys()]).toEqual([`${M}/header/MilspecLogo.css`]);
  });
  it('.ts を複数の部品が使うなら一番外側(他方を描いている方)', () => {
    const ts = `${M}/armor/plates.ts`;
    const jsx = [...jsxBase, { file: ts, text: "export const cls = 'milspec-plate';" }];
    const p = plan('.milspec-plate{color:red}', { jsx, importersOf: { [ts]: [`${M}/header/MilspecLogo.tsx`, `${M}/header/MilspecHeader.tsx`] } });
    expect([...p.outputs.keys()]).toEqual([`${M}/header/MilspecHeader.css`]);
  });
  it('テンプレート文字列の接頭辞は使われている扱い', () => {
    const jsx = [...jsxBase, { file: `${M}/fx/Lamp.tsx`, text: 'className={`milspec-lamp-${tone}`}' }];
    const p = plan('.milspec-lamp-green{color:green}', { jsx });
    expect([...p.outputs.keys()]).toEqual([`${M}/fx/Lamp.css`]);
  });
  it('shared の規則は動かない', () => {
    const p = plan('.theme-military.theme-dark{--ms-x:1}', { file: `${S}/palette.css`, role: 'shared' });
    expect(p.outputs.size).toBe(0);
    expect(norm(p.kept.get(`${S}/palette.css`))).toContain('--ms-x:1');
  });
  it('frame は後読みの部品 1 つに決まる時だけ動く', () => {
    const css = '.milspec-logo{color:red} .milspec-toggle{color:blue} .milspec-nowhere{color:green}';
    const p = plan(css, { file: `${S}/primitives.css`, role: 'frame', staticFiles: [`${M}/MilspecStyleToggle.tsx`] });
    expect([...p.outputs.keys()]).toEqual([`${M}/header/MilspecLogo.css`]);
    const kept = norm(p.kept.get(`${S}/primitives.css`));
    expect(kept).toContain('.milspec-toggle');
    expect(kept).toContain('.milspec-nowhere');
  });
  it('3 つ以上の部品で同数に割れたら primitives へ', () => {
    const jsx = ['A', 'B', 'C'].map((n) => ({ file: `${M}/x/${n}.tsx`, text: '"milspec-hp"' }));
    const p = plan('.milspec-hp{color:red}', { jsx });
    expect([...p.outputs.keys()]).toEqual([`${S}/primitives.css`]);
  });
  it('見つからない class は unused/<元のファイル名> へ', () => {
    const p = plan('.milspec-gone{color:red}');
    expect([...p.outputs.keys()]).toEqual([`${S}/unused/pending-1.css`]);
  });
});

describe('removeCssImport', () => {
  it('元のファイルが空になったら、 その import の行を消す', () => {
    const src = "import a from 'a';\nimport './milspecH4.css';\nimport './Other.css';\n";
    expect(removeCssImport(src, 'milspecH4.css')).toBe("import a from 'a';\nimport './Other.css';\n");
  });
  it('import が無ければそのまま', () => {
    expect(removeCssImport("import a from 'a';\n", 'x.css')).toBe("import a from 'a';\n");
  });
});
