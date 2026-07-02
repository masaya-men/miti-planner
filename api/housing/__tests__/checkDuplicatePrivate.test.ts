import { describe, it, expect } from 'vitest';
import { splitDuplicates } from '../_checkDuplicateHandler.js';

// splitDuplicates(docs): 公開分の要約配列と、非公開分の件数を返す純関数。
describe('splitDuplicates', () => {
  it('公開は duplicates に要約・非公開は件数だけ', () => {
    const docs = [
      { id: '1', data: () => ({ ownerUid: 'a', createdAt: 1, tags: ['x'], visibility: 'public' }) },
      { id: '2', data: () => ({ ownerUid: 'b', createdAt: 2, tags: [], visibility: 'private' }) },
      { id: '3', data: () => ({ ownerUid: 'c', createdAt: 3, tags: [] }) }, // 未設定=公開
    ] as any;
    const r = splitDuplicates(docs);
    expect(r.duplicates.map((d) => d.id).sort()).toEqual(['1', '3']);
    expect(r.privateMatchCount).toBe(1);
  });
});
