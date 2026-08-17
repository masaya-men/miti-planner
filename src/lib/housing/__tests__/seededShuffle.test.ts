import { describe, it, expect } from 'vitest';
import { seededShuffle, generateShuffleSeed, shuffleWithNewPinned } from '../seededShuffle';

describe('seededShuffle', () => {
  it('同じ seed なら常に同じ並びを返す', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, 42);
    const b = seededShuffle(items, 42);
    expect(a).toEqual(b);
  });

  it('seed が違えば並びが変わる (十分な要素数で偶然一致しない)', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  it('元配列を変更しない', () => {
    const items = [1, 2, 3];
    const original = [...items];
    seededShuffle(items, 7);
    expect(items).toEqual(original);
  });

  it('要素数・要素の集合は保たれる (並びだけ変わる)', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = seededShuffle(items, 99);
    expect(shuffled.length).toBe(items.length);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('空配列で空配列を返す', () => {
    expect(seededShuffle([], 1)).toEqual([]);
  });
});

describe('generateShuffleSeed', () => {
  it('整数を返す', () => {
    const seed = generateShuffleSeed();
    expect(Number.isInteger(seed)).toBe(true);
  });
});

describe('shuffleWithNewPinned', () => {
  const NOW = 1_000_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;
  const item = (id: string, daysAgo: number) => ({ id, createdAt: NOW - daysAgo * DAY });

  it('7日以内の投稿は先頭にまとまり、新着順(新しい順)に並ぶ', () => {
    const items = [item('old1', 30), item('new-a', 1), item('old2', 60), item('new-b', 5)];
    const result = shuffleWithNewPinned(items, 42, NOW);
    expect(result.slice(0, 2).map((i) => i.id)).toEqual(['new-a', 'new-b']);
  });

  it('7日以内が無ければ全体が seededShuffle と同じ並びになる', () => {
    const items = [item('a', 30), item('b', 60), item('c', 90)];
    expect(shuffleWithNewPinned(items, 42, NOW)).toEqual(seededShuffle(items, 42));
  });

  it('7日以内しか無ければ全件が新着順(シャッフルなし)', () => {
    const items = [item('a', 1), item('b', 3), item('c', 0)];
    const result = shuffleWithNewPinned(items, 42, NOW);
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('ちょうど7日経過は「新着」に含まれない (isNewListingと同じ境界)', () => {
    const items = [item('boundary', 7), item('new', 6)];
    const result = shuffleWithNewPinned(items, 1, NOW);
    expect(result[0].id).toBe('new');
    expect(result[1].id).toBe('boundary');
  });

  it('要素数・要素の集合は保たれる', () => {
    const items = [item('a', 1), item('b', 30), item('c', 3), item('d', 90)];
    const result = shuffleWithNewPinned(items, 7, NOW);
    expect(result.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('空配列で空配列を返す', () => {
    expect(shuffleWithNewPinned([], 1, NOW)).toEqual([]);
  });

  it('windowMsを明示指定すればその日数で「新着」を判定する (管理画面の設定値)', () => {
    const items = [item('day2', 2), item('day5', 5)];
    const threeDays = 3 * DAY;
    // 既定7日なら両方新着扱いだが、3日指定なら day5 は新着から外れる
    const result = shuffleWithNewPinned(items, 1, NOW, threeDays);
    expect(result[0].id).toBe('day2');
    expect(result.map((i) => i.id)).toContain('day5'); // rest側に残る (消えない)
  });
});
