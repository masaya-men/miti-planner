import { describe, it, expect } from 'vitest';
import { mergeReportedProfileRefs } from '../_housingerReportsHandler.js';

describe('mergeReportedProfileRefs', () => {
  it('通報ありと強制非公開の両方が空なら空配列', () => {
    expect(mergeReportedProfileRefs([], [], 50)).toEqual([]);
  });

  it('強制非公開のみ (通報0件) でも一覧に残る (レビュー指摘の再発防止)', () => {
    const hidden = [{ uid: 'hidden-uid', reportCount: 0 }];
    expect(mergeReportedProfileRefs([], hidden, 50)).toEqual(hidden);
  });

  it('reportCount 降順でソートされる', () => {
    const reported = [
      { uid: 'a', reportCount: 3 },
      { uid: 'b', reportCount: 5 },
    ];
    const result = mergeReportedProfileRefs(reported, [], 50);
    expect(result.map((r) => r.uid)).toEqual(['b', 'a']);
  });

  it('通報ありクエリと強制非公開クエリの両方に出てきた uid は重複排除される', () => {
    const reported = [{ uid: 'dup', reportCount: 2 }];
    const hidden = [{ uid: 'dup', reportCount: 2 }, { uid: 'hidden-only', reportCount: 0 }];
    const result = mergeReportedProfileRefs(reported, hidden, 50);
    expect(result).toHaveLength(2);
    expect(result.filter((r) => r.uid === 'dup')).toHaveLength(1);
  });

  it('通報ありが優先的に採用される (重複時、後勝ちで hidden 側の同一 uid を上書きしない)', () => {
    // reported 側に存在する uid は、その値 (reported 側の reportCount) を採用する。
    const reported = [{ uid: 'x', reportCount: 7 }];
    const hidden = [{ uid: 'x', reportCount: 0 }];
    const result = mergeReportedProfileRefs(reported, hidden, 50);
    expect(result).toEqual([{ uid: 'x', reportCount: 7 }]);
  });

  it('limit 件数で切り詰められる', () => {
    const reported = [
      { uid: 'a', reportCount: 1 },
      { uid: 'b', reportCount: 2 },
      { uid: 'c', reportCount: 3 },
    ];
    const result = mergeReportedProfileRefs(reported, [], 2);
    expect(result.map((r) => r.uid)).toEqual(['c', 'b']);
  });
});
