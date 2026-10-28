import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { planColocation } from '../planColocation.mjs';
// @ts-expect-error mjs の共通部品(型定義なし)
import { applyPlan } from '../applyPlan.mjs';

// 書き出しは「書く前に全部の行き先を検査」する。 行き先に書けない物が 1 つでもあれば、 何も書き換えない(途中で止まって半端に残さない)。
const C = 'src/components/housing';
const SHARED = 'src/styles/housing';
const sc = {
  componentsDir: C, sharedDir: SHARED, unusedDir: `${SHARED}/unused`, entry: 'src/styles/housing.css',
  sharedHeader: { primitives: '/* 共有 */' }, header: (n: string) => `/* ${n} */\n`,
  importLine: (f: string) => `@import "./${f.replace('src/styles/', '')}";`,
  addSharedImports: (t: string, l: string[]) => `${t}${l.join('\n')}\n`,
};
const jsx = [
  { file: `${C}/a/A.tsx`, text: '<div className="housing-a" />' },
  { file: `${C}/b/B.tsx`, text: '<div className="housing-b" />' },
];
const memFs = (init: Record<string, string>) => {
  const files = new Map(Object.entries(init));
  const writes: string[] = [];
  const io = {
    read: (f: string) => { if (!files.has(f)) throw new Error(`ENOENT ${f}`); return files.get(f)!; },
    write: (f: string, t: string) => { writes.push(f); files.set(f, t); },
    rm: (f: string) => { writes.push(`rm ${f}`); files.delete(f); },
    exists: (f: string) => files.has(f),
    mkdir: () => {},
    gitRmCached: () => {},
  };
  return { files, writes, io };
};
const SRC = '05-x.css';
const run = (init: Record<string, string>, overrides = {}) => {
  const m = memFs({ [SRC]: '.housing-a{color:red} .housing-b{color:blue}', 'src/styles/housing.css': '@import "./housing/05-x.css";\n', ...init });
  const sources = [{ file: SRC, css: m.files.get(SRC)!, importers: undefined }];
  const p = planColocation({ sources, jsx, shared: [], frame: [], overrides, componentsDir: C, sharedDir: SHARED, unusedDir: `${SHARED}/unused` });
  return { m, go: () => applyPlan({ p, sc, sources, io: m.io }) };
};

describe('applyPlan', () => {
  it('行き先が全部書ければ、 部品の隣に書いて元のファイルを消す', () => {
    const { m, go } = run({ [`${C}/a/A.tsx`]: 'export const A = 1;\n', [`${C}/b/B.tsx`]: 'export const B = 1;\n' });
    go();
    expect(m.files.has(SRC)).toBe(false);
    expect(m.files.get(`${C}/a/A.css`)).toContain('.housing-a');
    expect(m.files.get(`${C}/b/B.css`)).toContain('.housing-b');
  });
  it('行き先が 1 つでも書けなければ(部品が無い)、 何も書き換えずに止まる', () => {
    // B.tsx が無い=B.css を import させられない。 A 側は書ける状態でも、 先に A を書いて半端に残してはいけない
    const { m, go } = run({ [`${C}/a/A.tsx`]: 'export const A = 1;\n' });
    expect(go).toThrow(/何も書き換えずに/);
    expect(m.writes).toEqual([]);
    expect(m.files.has(SRC)).toBe(true);
  });
  it('共有の行き先が既にあって足せない時も、 何も書き換えずに止まる', () => {
    const { m, go } = run(
      { [`${C}/a/A.tsx`]: 'export const A = 1;\n', [`${C}/b/B.tsx`]: 'export const B = 1;\n', [`${SHARED}/primitives.css`]: '.keep{}' },
      { 'housing-b': 'shared:primitives' },
    );
    expect(go).toThrow(/primitives\.css が既にある/);
    expect(m.writes).toEqual([]);
  });
});
