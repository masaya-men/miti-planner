import { describe, it, expect } from 'vitest';
import { detectUsedJobIds } from '../detectUsedJobIds';
import type { ParsedSheet } from '../types';

const sheet: ParsedSheet = {
  columns: [
    { index: 3, job: 'ナイト', skillNameRaw: 'リプライザル' },
    { index: 4, job: '戦士', skillNameRaw: 'ランパート' },
    { index: 5, job: '白魔道士', skillNameRaw: 'アサイラム' }, // TRUE 無し→検出されない
    { index: 6, job: 'マスコット', skillNameRaw: 'なし' },     // JOB_JA_TO_ID 未登録
  ],
  rows: [
    { phaseLabel: 'P', totalTimeSec: 40, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [4] },
    { phaseLabel: 'P', totalTimeSec: 10, action: 'b', damageAmount: null, damageType: null, trueColumnIndexes: [3, 6] },
  ],
};

describe('detectUsedJobIds', () => {
  it('TRUE 列のジョブを時刻順初出・重複排除で返す（未登録/未TRUE は除外）', () => {
    // t=10 で pld(3) と マスコット(6・未登録→除外)、t=40 で war(4)
    expect(detectUsedJobIds([sheet])).toEqual(['pld', 'war']);
  });

  it('複数シートを跨いで時刻順初出', () => {
    const s2: ParsedSheet = {
      columns: [{ index: 1, job: '占星術師', skillNameRaw: 'ニュートラルセクト' }],
      rows: [{ phaseLabel: 'Q', totalTimeSec: 5, action: 'c', damageAmount: null, damageType: null, trueColumnIndexes: [1] }],
    };
    // 全行を時刻マージ: t=5(ast), t=10(pld), t=40(war)
    expect(detectUsedJobIds([sheet, s2])).toEqual(['ast', 'pld', 'war']);
  });
});
