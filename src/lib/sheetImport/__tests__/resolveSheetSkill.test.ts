import { describe, it, expect } from 'vitest';
import { resolveSheetSkill } from '../resolveSheetSkill';
import { MITIGATIONS } from '../../../data/mockData';
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

  // 版違い(レベル別)の同名スキルは MITIGATIONS の配列順依存で先頭一致を拾う。
  // 現状は Lv100 版(最新 duration)が配列前方にあり正しく解決される。将来の配列並べ替えで
  // base 版(短い duration)を拾う退行を検出するための回帰固定(実 MITIGATIONS で検証)。
  it('版違いスキルは Lv100 版(最新 duration)に解決される(実データ配列順の回帰固定)', () => {
    const durOf = (jobJa: string, skill: string) => {
      const id = resolveSheetSkill(jobJa, skill, MITIGATIONS);
      return MITIGATIONS.find((m) => m.id === id)?.duration;
    };
    expect(resolveSheetSkill('ナイト', 'リプライザル', MITIGATIONS)).toBe('reprisal_pld');
    expect(durOf('ナイト', 'リプライザル')).toBe(15); // base版(dur10)でなくLv100版(dur15)
    expect(durOf('モンク', '牽制')).toBe(15);          // feint base版(dur10)でなくdur15
    expect(durOf('赤魔道士', 'アドル')).toBe(15);      // addle base版(dur10)でなくdur15
  });

  it('英中韓のスキル名でも解決する(4言語一致)', () => {
    const MULTI: Mitigation[] = [
      { id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart', ko: '램파트', zh: '铁壁' }, recast: 0, duration: 0, type: 'all', value: 0 } as Mitigation,
    ];
    expect(resolveSheetSkill('ナイト', 'Rampart', MULTI)).toBe('rampart_pld');
    expect(resolveSheetSkill('ナイト', '铁壁', MULTI)).toBe('rampart_pld');
    expect(resolveSheetSkill('ナイト', '램파트', MULTI)).toBe('rampart_pld');
    expect(resolveSheetSkill('ナイト', 'ランパート', MULTI)).toBe('rampart_pld');
  });
});
