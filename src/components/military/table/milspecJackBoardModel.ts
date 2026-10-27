import type { PartyMember } from '../../../types';
import { LIGHT_PARTY_MEMBER_IDS } from '../../../constants/party';

/** ライトパーティ順のとき、LP1 の最後の列の番号(その右が境目)。LP1 と LP2 が両方いなければ null */
export function lightPartyGap(members: PartyMember[], partySortOrder: 'role' | 'light_party'): number | null {
  if (partySortOrder !== 'light_party') return null;
  const lp1 = new Set<string>(LIGHT_PARTY_MEMBER_IDS.slice(0, 4));
  const first2 = members.findIndex((m) => !lp1.has(m.id));
  return first2 > 0 ? first2 - 1 : null;
}
