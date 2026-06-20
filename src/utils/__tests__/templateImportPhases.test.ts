import { describe, it, expect } from 'vitest';
import type { TemplateData } from '../../data/templateLoader';
import { resolveTemplatePhaseAppend } from '../templateImportPhases';

const ph = (id: number, startTimeSec: number) => ({
  id,
  startTimeSec,
  name: { ja: `P${id}`, en: `P${id}` },
});

describe('resolveTemplatePhaseAppend', () => {
  it('replace_all は incoming をそのまま返す', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, 0), ph(11, 50)];
    expect(resolveTemplatePhaseAppend(cur, inc, 'replace_all', null)).toBe(inc);
  });
  it('append: cutoff より後の新規フェーズだけ追加し時刻昇順', () => {
    const cur = [ph(1, 0), ph(2, 30)];
    const inc = [ph(10, 20), ph(11, 60)];
    const out = resolveTemplatePhaseAppend(cur, inc, 'append', 30);
    expect(out.map((p) => p.startTimeSec)).toEqual([0, 30, 60]); // 20 は除外、60 追加
  });
  it('append: 同時刻ちょうど(===cutoff)は除外し既存を触らない', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, 30)];
    expect(resolveTemplatePhaseAppend(cur, inc, 'append', 30)).toBe(cur);
  });
  it('append: 新規0件なら既存と同一参照を返す', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, 10)];
    expect(resolveTemplatePhaseAppend(cur, inc, 'append', 50)).toBe(cur);
  });
  it('append: startTimeSec<0 を除外', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, -1), ph(11, 80)];
    const out = resolveTemplatePhaseAppend(cur, inc, 'append', 50);
    expect(out.map((p) => p.startTimeSec)).toEqual([0, 80]);
  });
  it('append: appendFromTime=null(空テンプレ)なら全件追加', () => {
    const cur: TemplateData['phases'] = [];
    const inc = [ph(10, 0), ph(11, 40)];
    const out = resolveTemplatePhaseAppend(cur, inc, 'append', null);
    expect(out.map((p) => p.startTimeSec)).toEqual([0, 40]);
  });
});
