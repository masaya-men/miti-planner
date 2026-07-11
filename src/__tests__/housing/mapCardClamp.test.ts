import { describe, it, expect } from 'vitest';
import {
  clampExpandedCardOffset,
  EXPANDED_CARD_GAP,
  CLAMP_EDGE_PADDING,
} from '../../lib/housing/mapCardClamp';

describe('clampExpandedCardOffset', () => {
  it('十分広いコンテナの中央付近では補正なし (dx=dy=0)', () => {
    // markerY=300, flip無し(上向きに開く): top=300-14-270=16, bottom=300-14=286。
    // markerX=450, flip無し: left=450-140=310, right=450+140=590。いずれもコンテナ内に収まる。
    const offset = clampExpandedCardOffset({
      markerX: 450,
      markerY: 300,
      wrapW: 900,
      wrapH: 500,
      cardW: 280,
      cardH: 270,
      flipX: false,
      flipY: false,
    });
    expect(offset).toEqual({ dx: 0, dy: 0 });
  });

  it('review finding の再現: 上端寄りスポット(flipY=true)でコンテナが低いと下端(フッターCTA)がクランプで引き上げられる', () => {
    // markerY=15 (コンテナ上端に近い) → flip.y=true で下向きに開く。
    // top=15+14=29, bottom=29+300=329。コンテナ高さ300では 329 > 300-8=292 なのではみ出す。
    const offset = clampExpandedCardOffset({
      markerX: 400,
      markerY: 15,
      wrapW: 900,
      wrapH: 300,
      cardW: 280,
      cardH: 300,
      flipX: false,
      flipY: true,
    });
    expect(offset.dy).toBeCloseTo(-37, 9);
    // クランプ後、カード下端がちょうどコンテナ内 (下端余白ぶん内側) に収まることを確認。
    const top = 15 + EXPANDED_CARD_GAP;
    const bottom = top + 300;
    expect(bottom + offset.dy).toBeCloseTo(300 - CLAMP_EDGE_PADDING, 9);
  });

  it('下端(flipY=false、上向きに開く)がコンテナ上端をはみ出す場合、下へ押し戻す', () => {
    // markerY=40, 上向きに開く: top = 40 - 14 - 300 = -274 (大きくはみ出す)。
    const offset = clampExpandedCardOffset({
      markerX: 400,
      markerY: 40,
      wrapW: 900,
      wrapH: 500,
      cardW: 280,
      cardH: 300,
      flipX: false,
      flipY: false,
    });
    const top = 40 - EXPANDED_CARD_GAP - 300;
    expect(offset.dy).toBeCloseTo(CLAMP_EDGE_PADDING - top, 9);
    expect(top + offset.dy).toBeCloseTo(CLAMP_EDGE_PADDING, 9);
  });

  it('右端寄りスポット(flipX=true)がそれでもコンテナ右端をはみ出す場合、左へ押し戻す', () => {
    // markerX=850, flipX=true (左向きに畳む): left = 850-280=570, right=850。コンテナ幅600では
    // right(850) > 600-8=592 なのではみ出す。
    const offset = clampExpandedCardOffset({
      markerX: 850,
      markerY: 250,
      wrapW: 600,
      wrapH: 500,
      cardW: 280,
      cardH: 270,
      flipX: true,
      flipY: false,
    });
    expect(offset.dx).toBeCloseTo(600 - CLAMP_EDGE_PADDING - 850, 9);
  });

  it('左端寄りスポット(flip無し)がコンテナ左端をはみ出す場合、右へ押し戻す', () => {
    // markerX=20, flip無し: left = 20-140=-120 < padding(8) なのではみ出す。
    const offset = clampExpandedCardOffset({
      markerX: 20,
      markerY: 250,
      wrapW: 900,
      wrapH: 500,
      cardW: 280,
      cardH: 270,
      flipX: false,
      flipY: false,
    });
    expect(offset.dx).toBeCloseTo(CLAMP_EDGE_PADDING - (20 - 140), 9);
  });

  it('カード自体がコンテナより大きい極端なケースでは、下端(フッター側)を優先しクランプし始端は補正しない', () => {
    const offset = clampExpandedCardOffset({
      markerX: 400,
      markerY: 50,
      wrapW: 900,
      wrapH: 100,
      cardW: 280,
      cardH: 1000,
      flipX: false,
      flipY: true,
    });
    // top = 50+14=64, bottom=64+1000=1064。maxEdge 超過が先に検出されるため、
    // dy はその式 (containerSize-padding-maxEdge) の値になり、始端の大幅なはみ出しは補正されない。
    expect(offset.dy).toBeCloseTo(100 - CLAMP_EDGE_PADDING - 1064, 9);
    const top = 50 + EXPANDED_CARD_GAP;
    const bottom = top + 1000;
    expect(bottom + offset.dy).toBeCloseTo(100 - CLAMP_EDGE_PADDING, 9);
    // 始端はクランプ後もコンテナ外に留まる (フッター優先のトレードオフ)。
    expect(top + offset.dy).toBeLessThan(0);
  });
});
