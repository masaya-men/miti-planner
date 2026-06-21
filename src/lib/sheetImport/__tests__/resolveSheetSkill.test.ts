import { describe, it, expect } from 'vitest';
import { resolveSheetSkill } from '../resolveSheetSkill';
import type { Mitigation } from '../../../types';

const M = (id: string, jobId: string, ja: string): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration: 0, type: 'all', value: 0 } as Mitigation);

const MITS: Mitigation[] = [
  M('reprisal_pld', 'pld', 'リプライザル'),
  M('reprisal_war', 'war', 'リプライザル'),
  M('rampart_pld', 'pld', 'ランパート'),
  M('liturgy_of_the_bell', 'whm', 'リタージー・オブ・ベル'),
  M('excogitation', 'sch', '深謀遠慮'),
  M('improvisation', 'dnc', 'インプロビゼーション'),
];

describe('resolveSheetSkill', () => {
  it('役割共有スキルをジョブ別 id に解決', () => {
    expect(resolveSheetSkill('ナイト', 'リプライザル', MITS)).toBe('reprisal_pld');
    expect(resolveSheetSkill('戦士', 'リプライザル', MITS)).toBe('reprisal_war');
  });
  it('末尾括弧を除去して一致', () => {
    expect(resolveSheetSkill('白魔道士', 'リタージー・オブ・ベル(ダメージトリガー)', MITS)).toBe('liturgy_of_the_bell');
  });
  it('エイリアス（の策付与・フィニッシュ）を解決', () => {
    expect(resolveSheetSkill('学者', '深謀遠慮の策', MITS)).toBe('excogitation');
    expect(resolveSheetSkill('踊り子', 'インプロビゼーションフィニッシュ(踊りの激情0)', MITS)).toBe('improvisation');
  });
  it('LoPo に無い技は null', () => {
    expect(resolveSheetSkill('白魔道士', 'ベネディクション', MITS)).toBeNull();
    expect(resolveSheetSkill('戦士', 'エクリブリウム', MITS)).toBeNull();
  });
  it('未知ジョブは null', () => {
    expect(resolveSheetSkill('未知', 'リプライザル', MITS)).toBeNull();
  });
});
