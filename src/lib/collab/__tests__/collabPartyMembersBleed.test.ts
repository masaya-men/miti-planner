import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { PARTY_MEMBERS_KEY, applyUpsert, readArray } from '../yjsPlanData';
import type { PartyMember } from '../../../types';

/**
 * 本番ロールバックの「別の表を開くと partyMembers が横に列増殖する」バグの根治を、
 * 本物の Y.Doc + observeDeep + _applyPartyMembersFromCollab で実エンジン実証する。
 *
 * startCollabSession の partyMembers 配線 (collabProvider.ts:146,170,317) を最小再現:
 *   yPartyMembers.observeDeep(applyPartyMembers)
 *   applyPartyMembers = store._applyPartyMembersFromCollab(readArray(doc, PARTY_MEMBERS_KEY))
 *   disconnect で yPartyMembers.unobserveDeep(applyPartyMembers)
 *
 * これにより「切断後は古い部屋の更新が表に届かなくなる=列が混ざらない」を、
 * WebSocket/login なしで証明する (実機 2 ブラウザ確認の自動プロキシ)。
 */
function wirePartyMembers(doc: Y.Doc) {
  const arr = doc.getArray<Y.Map<unknown>>(PARTY_MEMBERS_KEY);
  const apply = () =>
    useMitigationStore.getState()._applyPartyMembersFromCollab(readArray<PartyMember>(doc, PARTY_MEMBERS_KEY));
  arr.observeDeep(apply); // = collabProvider の yPartyMembers.observeDeep
  return {
    push: (members: PartyMember[]) => doc.transact(() => applyUpsert(arr, members), 'local'),
    disconnect: () => arr.unobserveDeep(apply), // = collabProvider.disconnect の unobserveDeep
  };
}

const member = (id: string): PartyMember => ({
  id, jobId: 'pld', role: 'tank',
  stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
  computedValues: {},
} as PartyMember);

const ids = () => useMitigationStore.getState().partyMembers.map((m) => m.id);

beforeEach(() => {
  useMitigationStore.setState({ partyMembers: [], currentLevel: 100, _collabActive: false, _collabHandlers: null });
});

describe('collab partyMembers 列増殖の根治 (本物の Y.Doc で実証)', () => {
  it('切断後は古い部屋(A)の更新がもう表に届かない = 別表に A の列が混入しない', () => {
    const roomA = wirePartyMembers(new Y.Doc());
    useMitigationStore.getState().enterCollabMode({} as never);

    // 部屋 A に 2 人 → observer 経由で表に反映 (接続が生きている証拠)
    roomA.push([member('MT'), member('ST')]);
    expect(ids().sort()).toEqual(['MT', 'ST']);

    // ★ 管制 (reconcileCollabForPlan) の disconnect 相当: observer 解除 + exitCollabMode
    roomA.disconnect();
    useMitigationStore.getState().exitCollabMode();

    // 別プラン B をローカルにロード (ソロ) = 表は B の 1 人だけに
    useMitigationStore.setState({ partyMembers: [member('H1')] });
    expect(ids()).toEqual(['H1']);

    // 部屋 A でまだ誰かが編集 / 残留更新が来ても…
    roomA.push([member('MT'), member('ST'), member('D1'), member('D2')]);

    // ★ 表は B のまま。A の列は 1 つも混入しない (= 列が際限なく増えない)
    expect(ids()).toEqual(['H1']);
  });

  it('新しい部屋(B)へ接続し直しても前の部屋(A)のメンバーは残らない = 全置換で累積しない', () => {
    const roomA = wirePartyMembers(new Y.Doc());
    useMitigationStore.getState().enterCollabMode({} as never);
    roomA.push([member('MT'), member('ST')]);
    expect(ids().sort()).toEqual(['MT', 'ST']);

    // 切断 → 新しい部屋 B へ (start 前 disconnect の不変条件1 + 管制の不変条件2)
    roomA.disconnect();
    useMitigationStore.getState().exitCollabMode();

    const roomB = wirePartyMembers(new Y.Doc());
    useMitigationStore.getState().enterCollabMode({} as never);
    roomB.push([member('H1')]);

    // B の 1 人だけ。A の 2 人は累積しない
    expect(ids()).toEqual(['H1']);
  });
});
