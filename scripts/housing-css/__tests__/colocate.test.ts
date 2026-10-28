import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { addCssImport, planColocation } from '../colocate.mjs';

const C = 'src/components/housing';
const base = {
  jsx: [
    { file: `${C}/a/A.tsx`, text: '<div className="housing-a housing-a2" />' },
    { file: `${C}/b/B.tsx`, text: '<div className="housing-b" />' },
    { file: `${C}/shell/Frame.tsx`, text: '<div className="housing-frame" />' },
  ],
  shared: ['00-tokens.css'],
  frame: ['01-shell-frame.css'],
  overrides: {},
};
const plan = (sources: Array<{ file: string; css: string }>, extra = {}) => planColocation({ ...base, sources, ...extra });
const norm = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('planColocation', () => {
  it('持ち主が 1 つならそこへ', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-a{color:red}' }]);
    expect(norm(p.outputs.get(`${C}/a/A.css`))).toContain('.housing-a{color:red}');
  });
  it('共有ファイルの規則は動かない', () => {
    const p = plan([{ file: '00-tokens.css', css: ':root{--x:1} .housing-a{--y:2}' }]);
    expect(p.outputs.size).toBe(0);
    expect(norm(p.kept.get('00-tokens.css'))).toContain(':root{--x:1}');
  });
  it('外枠ファイルは shell の部品と持ち主なしだけ残し、 他は移す', () => {
    const p = plan([{ file: '01-shell-frame.css', css: '.housing-frame{color:red} body{margin:0} .housing-b{color:blue}' }]);
    expect(norm(p.kept.get('01-shell-frame.css'))).toBe('.housing-frame{color:red} body{margin:0}');
    expect(norm(p.outputs.get(`${C}/b/B.css`))).toContain('.housing-b{color:blue}');
  });
  it('class が JSX に無い規則は「使われていない候補」へ', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-a{color:red} .housing-unused{color:red}' }]);
    expect(norm(p.outputs.get('src/styles/housing/unused/05-x.css'))).toContain('.housing-unused');
  });
  it('class の無い規則はファイル単位の指定 → 番号ファイルの主な持ち主へ', () => {
    const css = '.housing-a{color:red} .housing-a2{color:red} .housing-b{x:1} [data-x]{color:red}';
    expect(norm(plan([{ file: '05-x.css', css }]).outputs.get(`${C}/a/A.css`))).toContain('[data-x]');
    const p = plan([{ file: '05-x.css', css }], { fileFallback: { '05-x.css': 'shared:theme' } });
    expect(norm(p.outputs.get('src/styles/housing/theme.css'))).toContain('[data-x]');
  });
  it('id の規則は id を書いている部品へ', () => {
    const jsx = [...base.jsx, { file: `${C}/c/C.tsx`, text: 'id="housing-size"' }];
    const p = planColocation({ ...base, jsx, sources: [{ file: '05-x.css', css: '.housing-a{x:1} #housing-size:disabled{x:1}' }] });
    expect(norm(p.outputs.get(`${C}/c/C.css`))).toContain('#housing-size:disabled');
  });
  it('使われていない修飾 class は前半が一致する class の持ち主へ', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-b{x:1} .housing-a{x:1} .housing-b--active{color:red}' }]);
    expect(norm(p.outputs.get(`${C}/b/B.css`))).toContain('.housing-b--active');
  });
  it('使われていない class は 2 語の汎用名まで削って寄せない', () => {
    const jsx = [...base.jsx, { file: `${C}/c/C.tsx`, text: '"housing-register"' }];
    const p = planColocation({ ...base, jsx, sources: [{ file: '12-x.css', css: '.housing-register-checklist{x:1}' }] });
    expect([...p.outputs.keys()]).toEqual(['src/styles/housing/unused/12-x.css']);
  });
  it('元の並びを保つ', () => {
    const p = plan([
      { file: '05-x.css', css: '.housing-a{color:red}' },
      { file: '10-y.css', css: '.housing-a2{color:blue}' },
    ]);
    const out = norm(p.outputs.get(`${C}/a/A.css`));
    expect(out.indexOf('.housing-a{')).toBeLessThan(out.indexOf('.housing-a2{'));
  });
  it('@media を包み直す', () => {
    const p = plan([{ file: '62-m.css', css: '@media (max-width: 767px){ .housing-a{color:red} .housing-b{color:blue} }' }]);
    expect(norm(p.outputs.get(`${C}/a/A.css`))).toMatch(/@media \(max-width: 767px\)\s*\{\s*\.housing-a\{color:red\}\s*\}/);
    expect(norm(p.outputs.get(`${C}/b/B.css`))).toMatch(/@media \(max-width: 767px\)\s*\{\s*\.housing-b\{color:blue\}\s*\}/);
  });
  it('keyframes は使う規則の持ち主へ', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-a{x:1} .housing-b{animation: spin 1s} @keyframes spin{from{opacity:0}to{opacity:1}}' }]);
    expect(norm(p.outputs.get(`${C}/b/B.css`))).toContain('@keyframes spin');
  });
  it('同名 keyframes が 2 つあれば止まる', () => {
    expect(() => plan([{ file: '05-x.css', css: '@keyframes spin{to{opacity:1}} .housing-a{x:1}' }, { file: '06-y.css', css: '@keyframes spin{to{opacity:0}}' }])).toThrow(/spin/);
  });
  it('直前のコメントも一緒に動く', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-a{x:1}\n/* B の説明 */\n.housing-b{color:blue}' }]);
    expect(norm(p.outputs.get(`${C}/b/B.css`))).toContain('/* B の説明 */');
    expect(norm(p.outputs.get(`${C}/a/A.css`))).not.toContain('B の説明');
  });
  it('部品をまたぐ順番頼りを crossPairs に出す', () => {
    const p = plan([
      { file: '05-x.css', css: '.housing-a .housing-b{color:red}' },
      { file: '06-y.css', css: '.housing-b .housing-b{color:blue}' },
    ], { overrides: { 'housing-b': `${C}/b/B.tsx` } });
    // 1 つ目は対象 class が housing-b なので B へ、 2 つ目も B へ=組は同じファイル内
    expect(p.crossPairs).toHaveLength(0);
    const q = plan([
      { file: '05-x.css', css: '.housing-a{color:red}' },
      { file: '06-y.css', css: '.housing-b .housing-a{color:blue} .housing-x .housing-a{color:green}' },
    ], { overrides: { 'housing-a': `${C}/a/A.tsx` } });
    expect(q.crossPairs).toHaveLength(0);
  });
  it('セレクタごとに持ち主が違う規則は持ち主ごとに分ける', () => {
    const p = plan([{ file: '05-x.css', css: '@media (max-width: 767px){ .housing-a, .housing-b { color: red } }' }]);
    expect(norm(p.outputs.get(`${C}/a/A.css`))).toMatch(/@media \(max-width: 767px\)\s*\{\s*\.housing-a \{ color: red \}\s*\}/);
    expect(norm(p.outputs.get(`${C}/b/B.css`))).toMatch(/@media \(max-width: 767px\)\s*\{\s*\.housing-b \{ color: red \}\s*\}/);
  });
  it('同じ class の持ち主は番号ファイルが違っても 1 つ', () => {
    const jsx = [...base.jsx, { file: `${C}/b/B2.tsx`, text: '"housing-a" "housing-b"' }];
    const p = planColocation({ ...base, jsx, sources: [
      { file: '05-x.css', css: '.housing-a{x:1} .housing-a2{x:1}' },
      { file: '06-y.css', css: '.housing-b{x:1} .housing-a{y:1}' },
    ] });
    const owners = [...p.outputs].filter(([, css]) => css.includes('.housing-a{') || css.includes('.housing-a {')).map(([k]) => k);
    expect(owners).toHaveLength(1);
  });
  it('override で持ち主を決められ、 割れた class は ambiguous に出る', () => {
    const jsx = [...base.jsx, { file: `${C}/b/B2.tsx`, text: '"housing-a"' }];
    const p = planColocation({ ...base, jsx, sources: [{ file: '05-x.css', css: '.housing-a{x:1}' }] });
    expect(p.ambiguous.map((a: { cls: string }) => a.cls)).toContain('housing-a');
    const q = planColocation({ ...base, jsx, overrides: { 'housing-a': `${C}/b/B2.tsx` }, sources: [{ file: '05-x.css', css: '.housing-a{x:1}' }] });
    expect(q.outputs.has(`${C}/b/B2.css`)).toBe(true);
  });
});

describe('行き先の書き方', () => {
  it('shared: は共有フォルダ・> は同じフォルダの別名ファイル', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-a{x:1} .housing-a2{x:1} .housing-b{x:1}' }], {
      overrides: { 'housing-a2': `${C}/a/A.tsx>AParts.css`, 'housing-b': 'shared:primitives' },
    });
    expect([...p.outputs.keys()].sort()).toEqual([`${C}/a/A.css`, `${C}/a/AParts.css`, 'src/styles/housing/primitives.css']);
  });
  it('セレクタ丸ごとの上書き', () => {
    const p = plan([{ file: '05-x.css', css: '.housing-a:focus, .housing-b:focus{outline:0} .housing-a{x:1}' }], {
      selectorOverrides: { '.housing-a:focus, .housing-b:focus': 'shared:primitives' },
    });
    expect(norm(p.outputs.get('src/styles/housing/primitives.css'))).toContain('.housing-b:focus');
  });
});

describe('addCssImport', () => {
  it('最後の import の後に足す(複数行 import 対応)', () => {
    const src = "import a from 'a';\nimport {\n  b,\n} from 'b';\n\nexport const X = 1;\n";
    expect(addCssImport(src, 'X.css')).toBe("import a from 'a';\nimport {\n  b,\n} from 'b';\nimport './X.css';\n\nexport const X = 1;\n");
  });
  it('既にあれば何もしない', () => {
    const src = "import './X.css';\nexport const X = 1;\n";
    expect(addCssImport(src, 'X.css')).toBe(src);
  });
});
