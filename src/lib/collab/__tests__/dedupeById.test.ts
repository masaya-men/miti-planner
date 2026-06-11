import { describe, it, expect } from 'vitest';
import { dedupeById } from '../dedupeById';
describe('dedupeById', () => {
  it('同 id は最初の出現だけ残す', () => {
    expect(dedupeById([{ id: 'a', v: 1 }, { id: 'b' }, { id: 'a', v: 2 }])).toEqual([{ id: 'a', v: 1 }, { id: 'b' }]);
  });
  it('重複が無ければそのまま（順序保持）', () => {
    const a = [{ id: 'x' }, { id: 'y' }];
    expect(dedupeById(a)).toEqual(a);
  });
  it('空配列は空', () => {
    expect(dedupeById([])).toEqual([]);
  });
});
