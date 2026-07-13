import { describe, it, expect } from 'vitest';
import { clampExpandedCardOffset, CLAMP_EDGE_PADDING } from '../../lib/housing/mapCardClamp';

// 中央アンカー: 矩形 = [markerX±cardW/2, markerY±cardH/2]。maxEdge(右/下)超過を優先補正、
// 収まっていれば minEdge(左/上)を補正。CLAMP_EDGE_PADDING=8。
describe('clampExpandedCardOffset (中央アンカー)', () => {
  it('十分広いコンテナの中央付近では補正なし', () => {
    // left=310,right=590 (in 900), top=165,bottom=435 (in 600) → 0
    expect(clampExpandedCardOffset({ markerX: 450, markerY: 300, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 }))
      .toEqual({ dx: 0, dy: 0 });
  });

  it('下端はみ出しを上へ押し戻す', () => {
    // markerY=550: top=415,bottom=685。685 > 600-8=592 → dy=592-685=-93
    const o = clampExpandedCardOffset({ markerX: 450, markerY: 550, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dy).toBeCloseTo(-93, 9);
    expect(o.dx).toBe(0);
  });

  it('上端はみ出しを下へ押し戻す', () => {
    // markerY=20: top=-115,bottom=155。maxEdge OK, minEdge -115<8 → dy=8-(-115)=123
    const o = clampExpandedCardOffset({ markerX: 450, markerY: 20, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dy).toBeCloseTo(123, 9);
  });

  it('右端はみ出しを左へ押し戻す', () => {
    // markerX=800: left=660,right=940。940 > 900-8=892 → dx=892-940=-48
    const o = clampExpandedCardOffset({ markerX: 800, markerY: 300, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dx).toBeCloseTo(-48, 9);
  });

  it('左端はみ出しを右へ押し戻す', () => {
    // markerX=50: left=-90,right=190。minEdge -90<8 → dx=8-(-90)=98
    const o = clampExpandedCardOffset({ markerX: 50, markerY: 300, wrapW: 900, wrapH: 600, cardW: 280, cardH: 270 });
    expect(o.dx).toBeCloseTo(98, 9);
  });

  it('カードがコンテナより大きい極端ケースは下端(フッターCTA)優先で始端は補正しない', () => {
    // cardH=1000 > wrapH=100。markerY=50: top=-450,bottom=550。550 > 100-8=92 → dy=92-550=-458
    const o = clampExpandedCardOffset({ markerX: 450, markerY: 50, wrapW: 900, wrapH: 100, cardW: 280, cardH: 1000 });
    expect(o.dy).toBeCloseTo(100 - CLAMP_EDGE_PADDING - 550, 9);
    const top = 50 - 500;
    expect(top + o.dy).toBeLessThan(0); // 始端はコンテナ外に留まる
  });
});
