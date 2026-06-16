import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import { useCollabSessionStore } from '../useCollabSessionStore';

/**
 * 根治テスト(2件目のバグ): 共同編集ON中に新規プランを作ると、初期化処理
 * (clearAllMitigations / updatePartyBulk)が「今繋がっている部屋」に委譲され、
 * その部屋(別プラン)の軽減・パーティを空にしてしまう。
 *
 * 修正方針: 新規作成の最初に共同編集セッションを切断(disconnect)し、
 * _collabActive=false にしてから初期化する。以後の clear/reset はローカルにのみ効く。
 */
describe('共同編集ON中の新規作成: 部屋を壊さない', () => {
  beforeEach(() => {
    useMitigationStore.setState({ _collabActive: false, _collabHandlers: null, _collabReadonly: false });
    useCollabSessionStore.setState({ active: false, roomToken: null, session: null, collabPlanId: null, maxParticipants: 8 });
  });

  it('再現: 共同編集中の clearAllMitigations は部屋に委譲される(=破壊の原因)', () => {
    const batch = vi.fn();
    useMitigationStore.setState({ _collabActive: true, _collabHandlers: { batch } as any });
    useMitigationStore.getState().clearAllMitigations();
    expect(batch).toHaveBeenCalled(); // 部屋の軽減が空にされてしまう
  });

  it('修正: disconnect() 後は _collabActive=false・clearAllMitigations は部屋に委譲しない', () => {
    const batch = vi.fn();
    useMitigationStore.setState({ _collabActive: true, _collabHandlers: { batch } as any });
    // 本物の collabProvider.disconnect と同型: 切断時に exitCollabMode を呼ぶ session を模す
    const session = { disconnect: vi.fn(() => useMitigationStore.getState().exitCollabMode()) };
    useCollabSessionStore.setState({ active: true, session: session as any, collabPlanId: 'FRU', roomToken: 'tok' });

    useCollabSessionStore.getState().disconnect();

    expect(useMitigationStore.getState()._collabActive).toBe(false);
    expect(session.disconnect).toHaveBeenCalled();
    expect(useCollabSessionStore.getState().active).toBe(false);

    // 切断後の全消しは部屋に行かない(ローカルのみ) = 別プランの部屋は無傷
    useMitigationStore.getState().clearAllMitigations();
    expect(batch).not.toHaveBeenCalled();
  });
});
