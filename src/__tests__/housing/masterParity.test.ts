// ファイル名: masterParity.test.ts
// dcServerMap (Task 1) と masterData (Task 3) のドリフト防止テスト。

import { describe, expect, it } from 'vitest';
import { DC_SERVER_MAP } from '../../data/housing/dcServerMap';
import { serverMasterData, housingAreaMasterData } from '../../data/masterData';

describe('2マスター整合 (dcServerMap ⟷ masterData)', () => {
  it('DC 集合とワールド集合が完全一致する (ドリフト防止)', () => {
    expect(Object.keys(serverMasterData).sort()).toEqual(Object.keys(DC_SERVER_MAP).sort());
    for (const [dc, { servers }] of Object.entries(DC_SERVER_MAP)) {
      expect(Object.keys(serverMasterData[dc].servers).sort(), `dc ${dc}`).toEqual([...servers].sort());
    }
  });
  it('エリア名 ko/zh が実値 (ja のままの placeholder が残っていない)', () => {
    for (const [key, a] of Object.entries(housingAreaMasterData)) {
      expect(a.name.ko, `${key} name.ko`).not.toBe(a.name.ja);
      expect(a.name.zh, `${key} name.zh`).not.toBe(a.name.ja);
      expect(a.apartment_name.ko, `${key} apartment.ko`).not.toBe(a.apartment_name.ja);
      expect(a.apartment_name.zh, `${key} apartment.zh`).not.toBe(a.apartment_name.ja);
    }
  });
  it('alias はグローバル既存 alias と衝突しない (KR 英名 / CN 白银乡 を入れていない)', () => {
    const krAliases = Object.values(serverMasterData['Korea'].servers).flat();
    expect(krAliases).not.toContain('Carbuncle');
    const cnMoogleAliases = Object.values(serverMasterData['MoogleCN'].servers).flat();
    expect(cnMoogleAliases).not.toContain('白银乡');
    expect(cnMoogleAliases).not.toContain('시로가네');
  });
  it('TW の alias は繁体字ワールド名のみ (英名はグローバル同名ワールドと衝突するため入れない)', () => {
    const twAliases = Object.values(serverMasterData['TW'].servers).flat();
    expect(twAliases).not.toContain('Ifrit'); // Gaia の Ifrit と衝突させない
  });
});

describe('housingAreaMasterData の zh-Hant', () => {
  it('全エリアの name / apartment_name に zh-Hant がある', () => {
    for (const [key, a] of Object.entries(housingAreaMasterData)) {
      expect(a.name['zh-Hant'], `${key} name.zh-Hant`).toBeTruthy();
      expect(a.apartment_name['zh-Hant'], `${key} apartment.zh-Hant`).toBeTruthy();
    }
  });
});
