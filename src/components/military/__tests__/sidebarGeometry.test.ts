import { describe, it, expect } from 'vitest';
import { SB_FRAME, SB_PANELS, SB_KEY_ROWS, SB_TRACES, SB_TREE_BOX, SB_DECOR, sbY, sbPath } from '../sidebarGeometry';
import { stretchPlaced } from '../armor/stretch';
import type { PanelSpec } from '../armor/types';

const s1 = SB_PANELS[0], s2 = SB_PANELS[1], s3 = SB_PANELS[3];

describe('sidebarGeometry(サイドバーの座標表)', () => {
  it('受け皿がパネルに入る', () => {
    expect((s1.spec as PanelSpec).pockets?.length).toBe(2);
    expect((s3.spec as PanelSpec).pockets?.length).toBe(2);
    expect((s2.spec as PanelSpec).pockets?.length).toBe(1);
    expect((s2.spec as PanelSpec).pockets?.[0].fill).toBe('var(--ma-pcb)');
  });
  it('キーの数', () => {
    const n = (id: string) => SB_KEY_ROWS.find((r) => r.id === id)!.caps.length;
    expect([n('content'), n('actions'), n('service'), n('dock')]).toEqual([4, 3, 1, 2]);
    expect(SB_KEY_ROWS.find((r) => r.id === 'content')!.caps.every((c) => c.lip)).toBe(true);
  });
  it('パス命令が絶対座標だけ', () => {
    const ds = [...SB_PANELS.flatMap((p) => [...((p.spec as PanelSpec).scribes ?? []), ...((p.spec as PanelSpec).seams ?? [])]), ...SB_TRACES.map((t) => t.d)];
    expect(ds.length).toBeGreaterThan(8);
    ds.forEach((d) => expect(d).toMatch(/^[MLHV0-9 .\-]+$/));
  });
  it('高さ 1080 で S3 が 401px 下がり S1 は動かない', () => {
    expect(stretchPlaced(s3, SB_FRAME, 274, 1080).y).toBe(1013);
    expect(stretchPlaced(s1, SB_FRAME, 274, 1080).y).toBe(0);
    expect(stretchPlaced(s2, SB_FRAME, 274, 1080).h).toBe(893);
  });
  it('sbY と sbPath', () => {
    expect(sbY(619, 1080)).toBe(1020);
    expect(sbY(17, 1080)).toBe(17);
    expect(sbPath('M 8 609 H 230 L 237 616 H 272', 1080)).toBe('M 8 1010 H 230 L 237 1017 H 272');
    expect(sbPath('M 275 118 V 604', 1080)).toBe('M 275 118 V 1005');
  });
  it('木の枠と飾りの数', () => {
    expect(SB_TREE_BOX).toEqual({ x: 12, y: 138, w: 250, h0: 452 });
    expect(SB_DECOR.rivets.length).toBe(2);
    expect(SB_DECOR.screws.length).toBe(2);
  });
});
