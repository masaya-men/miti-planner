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

  // 住所非公開 (unlisted) の id を duplicates に出すと、攻撃者が保有する unlisted の id を
  // 使って総当たりで住所を逆引きできてしまう (住所空間は列挙可能)。
  // unlisted は private と同様に件数だけ返し、id は返さないことを保証する。
  it('unlisted は id を返さず件数だけ private と一緒に畳む', () => {
    const docs = [
      { id: 'pub', data: () => ({ ownerUid: 'a', createdAt: 1, tags: [], visibility: 'public' }) },
      { id: 'unlisted-1', data: () => ({ ownerUid: 'b', createdAt: 2, tags: [], visibility: 'unlisted' }) },
      { id: 'priv-1', data: () => ({ ownerUid: 'c', createdAt: 3, tags: [], visibility: 'private' }) },
    ] as any;
    const r = splitDuplicates(docs);
    expect(r.duplicates.map((d) => d.id)).toEqual(['pub']);
    expect(r.duplicates.map((d) => d.id)).not.toContain('unlisted-1');
    expect(r.duplicates.map((d) => d.id)).not.toContain('priv-1');
    expect(r.privateMatchCount).toBe(2);
  });
});
