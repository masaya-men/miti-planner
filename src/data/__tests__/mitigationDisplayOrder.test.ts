import { describe, it, expect } from 'vitest';
import { getMitigationPriority } from '../mockData';

describe('getMitigationPriority', () => {
  it('レベル版違い(_v2)は素の技と同じ表示順になる', () => {
    // rampart_v2_pld (Lv94以上の回復アップ版) は rampart_pld (Lv93以下) と
    // 同じ「ランパート」の表示位置になるべき。_v2 が baseId 解決から漏れると
    // MITIGATION_DISPLAY_ORDER に見つからず優先度999(モーダル最下段)に落ちる。
    expect(getMitigationPriority('rampart_v2_pld')).toBe(getMitigationPriority('rampart_pld'));
  });

  it('ジョブ接尾辞の無いレベル版違い(aurora_v2)も同様', () => {
    expect(getMitigationPriority('aurora_v2')).toBe(getMitigationPriority('aurora'));
  });
});
