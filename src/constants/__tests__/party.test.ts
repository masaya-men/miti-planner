import { describe, it, expect } from 'vitest';
import { getSortedPartyMemberIds, PARTY_MEMBER_IDS, LIGHT_PARTY_MEMBER_IDS } from '../party';

describe('getSortedPartyMemberIds', () => {
  it('role 指定時は PARTY_MEMBER_IDS と同じ並び(MT/ST/H1/H2/D1〜D4)', () => {
    expect(getSortedPartyMemberIds('role')).toEqual([...PARTY_MEMBER_IDS]);
  });

  it('light_party 指定時はライトパーティ順(MT/H1/D1/D3/ST/H2/D2/D4)', () => {
    expect(getSortedPartyMemberIds('light_party')).toEqual([...LIGHT_PARTY_MEMBER_IDS]);
  });

  it('どちらの並びも8人分すべて含む(欠落・重複なし)', () => {
    const role = getSortedPartyMemberIds('role');
    const light = getSortedPartyMemberIds('light_party');
    expect(new Set(role)).toEqual(new Set(PARTY_MEMBER_IDS));
    expect(new Set(light)).toEqual(new Set(PARTY_MEMBER_IDS));
    expect(role).toHaveLength(8);
    expect(light).toHaveLength(8);
  });
});
