import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { planColocation } from '../planColocation.mjs';
// @ts-expect-error mjs の設定(型定義なし)
import { indexPlanOptions, prefixRe, componentsDir, sharedDir, unusedDir } from '../scopes/index.mjs';

// index.css の移す待ちを部品へ配る時の持ち主判定(docs/superpowers/specs/2026-10-28-index-css-colocation-design.md §4.1〜4.3)
const C = 'src/components';
const B = 'src/styles/base';
const plan = (css: string, jsx: { file: string; text: string }[]) =>
  planColocation({
    sources: [{ file: `${B}/to-move-1.css`, css, role: 'pending' }],
    jsx,
    shared: [],
    frame: [],
    overrides: {},
    componentsDir,
    sharedDir,
    unusedDir,
    prefixRe,
    ...indexPlanOptions({ jsx }),
  });
const norm = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('planColocation(index.css)', () => {
  it('@layer components の規則は移し先でも @layer components に包まれる', () => {
    const p = plan('@layer components { .btn-tactile{color:red} }', [{ file: `${C}/PartySettingsModal.tsx`, text: '<button className="btn-tactile" />' }]);
    expect(norm(p.outputs.get(`${C}/PartySettingsModal.css`))).toMatch(/^@layer components \{/);
  });
  it('.ts が組み立てる class は使っている部品が持ち主', () => {
    const jsx = [
      { file: `${C}/timeline/useTimelinePreviewHighlight.ts`, text: "export const cls = 'phase-select-preview preview-highlight';" },
      { file: `${C}/Timeline.tsx`, text: "import { cls } from './timeline/useTimelinePreviewHighlight';\n<div className={cls} data-phase-col />" },
    ];
    const p = plan('.phase-select-preview .preview-highlight [data-phase-col]{color:red}', jsx);
    expect([...p.outputs.keys()]).toEqual([`${C}/Timeline.css`]);
  });
  it('3 部品以上が使う class は共有に残る', () => {
    const jsx = ['A', 'B', 'C'].map((n) => ({ file: `${C}/${n}.tsx`, text: '<div className="recast-icon" />' }));
    const p = plan('.recast-icon{color:red}', jsx);
    const u = p.units.find((x: { rule: unknown }) => x.rule);
    expect(u.dest.out).toBeUndefined();
    expect(u.dest.kept).toBe(`${B}/to-move-1.css`);
  });
  it('0 部品の class は unused へ', () => {
    const p = plan('.water-drop{color:red}', [{ file: `${C}/A.tsx`, text: '<div className="x" />' }]);
    expect([...p.outputs.keys()]).toEqual([`${B}/unused/to-move-1.css`]);
  });
});
