import { describe, it, expect } from 'vitest';
import { applyLiveOrder } from '../applyLiveOrder';

describe('applyLiveOrder', () => {
  const snap = ['a', 'b', 'c', 'd'];
  it('order 無し(undefined/null)は snapshot 順のまま', () => {
    expect(applyLiveOrder(snap, undefined)).toEqual(snap);
    expect(applyLiveOrder(snap, null)).toEqual(snap);
  });
  it('order の順に並べ替える', () => {
    expect(applyLiveOrder(snap, ['d', 'b', 'a', 'c'])).toEqual(['d', 'b', 'a', 'c']);
  });
  it('snapshot に無い id は無視する', () => {
    expect(applyLiveOrder(snap, ['x', 'c', 'a', 'y', 'b', 'd'])).toEqual(['c', 'a', 'b', 'd']);
  });
  it('order に欠けた id は元の順で末尾へ', () => {
    expect(applyLiveOrder(snap, ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });
  it('重複は除去する', () => {
    expect(applyLiveOrder(snap, ['b', 'b', 'a', 'a'])).toEqual(['b', 'a', 'c', 'd']);
  });
});
