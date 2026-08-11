import { describe, it, expect } from 'vitest';
import { computeSnakeGridPositions, buildSnakePathD } from '../computeSnakeGridPositions';

describe('computeSnakeGridPositions', () => {
  it('1列目は上から下へ順に並ぶ', () => {
    const result = computeSnakeGridPositions(['a', 'b', 'c'], 5);
    expect(result).toEqual([
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
      { id: 'c', row: 2, col: 0 },
    ]);
  });

  it('2列目は下から上へ折り返す(ジグザグ)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = computeSnakeGridPositions(ids, 5);
    // 1列目: a=row0,b=row1,c=row2,d=row3,e=row4 (上から下)
    expect(result.slice(0, 5)).toEqual([
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
      { id: 'c', row: 2, col: 0 },
      { id: 'd', row: 3, col: 0 },
      { id: 'e', row: 4, col: 0 },
    ]);
    // 2列目: f=row4(下端から), g=row3 (下から上)
    expect(result.slice(5)).toEqual([
      { id: 'f', row: 4, col: 1 },
      { id: 'g', row: 3, col: 1 },
    ]);
  });

  it('3列目は再び上から下へ(上下交互)', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `id${i}`);
    const result = computeSnakeGridPositions(ids, 5);
    // index10 = 3列目(col=2)の1件目 = row0
    expect(result[10]).toEqual({ id: 'id10', row: 0, col: 2 });
  });

  it('rowsPerColumnが0以下でも1として扱い、1列に1件ずつ配置する(防御)', () => {
    const result = computeSnakeGridPositions(['a', 'b'], 0);
    expect(result).toEqual([
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 0, col: 1 },
    ]);
  });

  it('空配列は空配列を返す', () => {
    expect(computeSnakeGridPositions([], 5)).toEqual([]);
  });
});

describe('buildSnakePathD', () => {
  // 2026-08-11(4回目の実機指摘): 「角を丸めた折れ線」方式に刷新。直線で点をつなぎ、
  // 実際に方向が変わる箇所だけ二次ベジェで丸める、シンプルな手描き風のつなぎ方。

  it('同じ列内(一直線上の3点)は角丸めの影響を受けず実質まっすぐになる', () => {
    const cells = [
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
      { id: 'c', row: 2, col: 0 },
    ];
    const d = buildSnakePathD(cells, 200, 60);
    // bの前後(a・c)が一直線上にあるため、Q制御点(=b自身)も直線上に乗り、見た目はまっすぐ。
    expect(d).toBe('M 100 30 L 100 69 Q 100 90, 100 111 L 100 150');
  });

  it('実際に方向が変わる箇所(列をまたぐ折返し)だけ丸くカーブする', () => {
    const cells = [
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 1, col: 0 },
      { id: 'c', row: 1, col: 1 },
      { id: 'd', row: 0, col: 1 },
    ];
    const d = buildSnakePathD(cells, 200, 60);
    expect(d).toBe('M 100 30 L 100 69 Q 100 90, 121 90 L 279 90 Q 300 90, 300 69 L 300 30');
  });

  it('2点しかない場合は丸める基準点が無いため直線でつなぐ', () => {
    const cells = [
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 0, col: 1 },
    ];
    const d = buildSnakePathD(cells, 200, 60);
    expect(d).toBe('M 100 30 L 300 30');
  });

  it('空配列は空文字列を返す', () => {
    expect(buildSnakePathD([], 200, 60)).toBe('');
  });

  it('1件だけなら移動コマンドのみ(線は引かない)', () => {
    const d = buildSnakePathD([{ id: 'a', row: 0, col: 0 }], 200, 60);
    expect(d).toBe('M 100 30');
  });
});
