/** パーティメンバーID（表示順） */
export const PARTY_MEMBER_IDS = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;

/** ライトパーティ表示順（MT/H1/D1/D3 が1パーティ、ST/H2/D2/D4 がもう1パーティ） */
export const LIGHT_PARTY_MEMBER_IDS = ['MT', 'H1', 'D1', 'D3', 'ST', 'H2', 'D2', 'D4'] as const;

/** 並び替え設定に応じたパーティメンバーID表示順を返す(Timeline/ヘッダー等で共通利用)。 */
export function getSortedPartyMemberIds(sortOrder: 'light_party' | 'role'): readonly string[] {
  return sortOrder === 'light_party' ? LIGHT_PARTY_MEMBER_IDS : PARTY_MEMBER_IDS;
}
