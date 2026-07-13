// @vitest-environment happy-dom
/**
 * Task 7 前レビュー指摘: uid が非null → 別の非null に切り替わったとき、 古い profile を
 * 保持したまま loading になると「別人のプロフィールが一瞬表示される」。
 * HousingerPage は同一コンポーネントのまま :uid だけ変わるルーティングを踏むため、
 * この hook 側で uid 変化時に profile を即 null に戻すことを保証する回帰テスト。
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HousingerProfile } from '../../../../types/housing';

const mockGetHousingerProfile = vi.fn();
vi.mock('../../../../lib/housing/housingerProfileService', () => ({
  getHousingerProfile: (...args: unknown[]) => mockGetHousingerProfile(...args),
}));

import { useHousingerProfile } from '../useHousingerProfile';

const profileA: HousingerProfile = {
  displayName: 'A太郎',
  avatarUrl: null,
  bio: null,
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 1,
  updatedAt: 1,
};
const profileB: HousingerProfile = { ...profileA, displayName: 'B次郎' };

beforeEach(() => {
  mockGetHousingerProfile.mockReset();
});

describe('useHousingerProfile', () => {
  it('uid が別の非null uid に切り替わると、 新プロフィール取得完了前は前の profile を保持せず null に戻す', async () => {
    let resolveA!: (v: HousingerProfile | null) => void;
    mockGetHousingerProfile.mockImplementationOnce(
      () => new Promise<HousingerProfile | null>((resolve) => { resolveA = resolve; }),
    );

    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useHousingerProfile(uid),
      { initialProps: { uid: 'uid-a' } },
    );

    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolveA(profileA);
    });
    await waitFor(() => expect(result.current.profile).toEqual(profileA));

    // uid-a → uid-b への切替。 新 fetch が解決するまで前 (A) の profile を出してはいけない。
    let resolveB!: (v: HousingerProfile | null) => void;
    mockGetHousingerProfile.mockImplementationOnce(
      () => new Promise<HousingerProfile | null>((resolve) => { resolveB = resolve; }),
    );
    rerender({ uid: 'uid-b' });

    // fetch 完了前 (同期直後) に profile が null へ戻っていること = stale 表示防止の核心。
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveB(profileB);
    });
    await waitFor(() => expect(result.current.profile).toEqual(profileB));
  });
});
