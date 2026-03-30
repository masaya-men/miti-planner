/** パーティメンバーID（表示順） */
export const PARTY_MEMBER_IDS = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;

/** パーティメンバーIDのソート用マップ */
export const PARTY_MEMBER_ORDER: Record<string, number> = {
  MT: 0, ST: 1, H1: 2, H2: 3, D1: 4, D2: 5, D3: 6, D4: 7,
};
