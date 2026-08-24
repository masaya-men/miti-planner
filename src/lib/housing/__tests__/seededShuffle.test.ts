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

  it('管理者が pinnedNewUntil を設定した古い投稿は、新着でも固定でもない投稿より必ず前に来る (2026-08-24 実機報告・全シードで成立を検証し偶然一致を排除)', () => {
    const items = [
      { ...item('old-pinned', 30), pinnedNewUntil: NOW + 3 * DAY },
      item('plain1', 60),
      item('plain2', 90),
      item('plain3', 45),
      item('new-a', 1),
    ];
    for (let seed = 0; seed < 30; seed++) {
      const result = shuffleWithNewPinned(items, seed, NOW);
      const pinnedIdx = result.findIndex((i) => i.id === 'old-pinned');
      const plainIdxs = ['plain1', 'plain2', 'plain3'].map((id) => result.findIndex((i) => i.id === id));
      expect(pinnedIdx).toBeGreaterThanOrEqual(0);
      expect(plainIdxs.every((idx) => pinnedIdx < idx)).toBe(true);
    }
  });

  it('pinnedNewUntil が過去 (期限切れ) の投稿は先頭グループに含まれない (同様に決定的な検証)', () => {
    const items = [
      { ...item('expired-pin', 30), pinnedNewUntil: NOW - 1000 },
      item('plain1', 60),
      item('plain2', 90),
      item('plain3', 45),
    ];
    const result = shuffleWithNewPinned(items, 42, NOW);
    // 期限切れなので全件 rest 扱い = seededShuffle と完全一致する
    expect(result).toEqual(seededShuffle(items, 42));
  });
});
