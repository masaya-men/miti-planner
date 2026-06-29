import { describe, it, expect } from 'vitest';
import { clampToViewport } from '../clampToViewport';

describe('clampToViewport', () => {
  it('収まる場合: 下端/右端が画面外に出ないよう max でクランプ(旧マジックナンバーのバグを再現させない)', () => {
    // 実環境(200%×130%スケール)= viewport 約 1489×679。モーダル 500×400 をクリック位置(520,500)へ。
    // 旧実装は y = min(500, 679-600=79) で上部79pxに張り付いた。正しくは下端を画面内に保つ y=271。
    const r = clampToViewport({ x: 520, y: 500 }, { w: 500, h: 400 }, { w: 1489, h: 679 }, 8);
    expect(r).toEqual({ x: 520, y: 679 - 400 - 8 }); // {520, 271}
  });

  it('desired が margin 未満なら margin に持ち上げる', () => {
    const r = clampToViewport({ x: 2, y: -50 }, { w: 300, h: 200 }, { w: 1489, h: 679 }, 8);
    expect(r).toEqual({ x: 8, y: 8 });
  });

  it('desired が収まる範囲内ならそのまま', () => {
    const r = clampToViewport({ x: 100, y: 100 }, { w: 300, h: 200 }, { w: 1489, h: 679 }, 8);
    expect(r).toEqual({ x: 100, y: 100 });
  });

  it('要素が viewport より大きい軸は margin(先頭)に固定', () => {
    // 高さ 800 > viewport 679 → y は 8 に固定(上端を見せる)。x は通常クランプ。
    const r = clampToViewport({ x: 1400, y: 500 }, { w: 500, h: 800 }, { w: 1489, h: 679 }, 8);
    expect(r).toEqual({ x: 1489 - 500 - 8, y: 8 }); // {981, 8}
  });
});
