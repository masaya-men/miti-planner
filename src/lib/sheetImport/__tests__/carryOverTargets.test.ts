import { describe, it, expect } from 'vitest';
import type { TimelineEvent } from '../../../types';
import {
  normalizeAttackName, parseSheetAliases, findTemplateAttacks,
  resolveTargetFromMatches, matchTemplateTarget, applyTargetsFromTemplate, buildSheetMatchReport,
} from '../carryOverTargets';

const ev = (over: Partial<TimelineEvent>): TimelineEvent => ({
  id: over.id ?? 'x', time: over.time ?? 0,
  name: over.name ?? { ja: '', en: '' },
  damageType: 'magical',
  ...over,
});

describe('normalizeAttackName', () => {
  it('括弧以降除去・全半角統一・空白除去', () => {
    expect(normalizeAttackName('リプライザル（範囲）')).toBe('リプライザル');
    expect(normalizeAttackName('Ａ Ｂ Ｃ')).toBe('ABC'); // NFKC 全角→半角 + 空白除去
    expect(normalizeAttackName('  裁きの 光 ')).toBe('裁きの光');
  });
});

describe('parseSheetAliases', () => {
  it('カンマ/改行区切り→trim→空除去', () => {
    expect(parseSheetAliases('散開, まとまる\n 集合 ')).toEqual(['散開', 'まとまる', '集合']);
    expect(parseSheetAliases('   ')).toEqual([]);
  });
});

describe('findTemplateAttacks', () => {
  const tpl = [
    ev({ id: 't1', name: { ja: 'アクモーン', en: 'Akh Morn' }, target: 'MT' }),
    ev({ id: 't2', name: { ja: '雷神の怒り', en: 'x' }, sheetAliases: ['カミナリ'] }),
  ];
  it('name.ja 正規化一致', () => {
    expect(findTemplateAttacks('アクモーン（連続）', tpl).map((e) => e.id)).toEqual(['t1']);
  });
  it('別名一致', () => {
    expect(findTemplateAttacks('カミナリ', tpl).map((e) => e.id)).toEqual(['t2']);
  });
  it('一致なし→空', () => {
    expect(findTemplateAttacks('存在しない技', tpl)).toEqual([]);
  });
  it('空文字の攻撃名はテンプレの空名イベント(target付き)にも一切マッチしない(精度優先)', () => {
    // テンプレに name.ja:'' かつ target:'MT' のイベントがあっても空の actionName は拾わない
    const tplWithBlank = [ev({ id: 'blank', name: { ja: '', en: '' }, target: 'MT' })];
    expect(findTemplateAttacks('', tplWithBlank)).toEqual([]);
  });
  it('空白のみの攻撃名も空文字と同様にマッチしない(精度優先)', () => {
    const tplWithBlank = [ev({ id: 'blank', name: { ja: '', en: '' }, target: 'MT' })];
    expect(findTemplateAttacks('   ', tplWithBlank)).toEqual([]);
  });
});

describe('resolveTargetFromMatches', () => {
  it('target undefined は無視', () => {
    expect(resolveTargetFromMatches([ev({ target: undefined })], 0)).toBeUndefined();
  });
  it('target 1種→確定', () => {
    expect(resolveTargetFromMatches([ev({ target: 'MT' }), ev({ target: undefined })], 0)).toBe('MT');
  });
  it('食い違い→時刻最近傍', () => {
    const m = [ev({ time: 10, target: 'MT' }), ev({ time: 100, target: 'ST' })];
    expect(resolveTargetFromMatches(m, 90)).toBe('ST');
  });
  it('最近傍が等距離で食い違い→undefined(推測しない)', () => {
    const m = [ev({ time: 0, target: 'MT' }), ev({ time: 20, target: 'ST' })];
    expect(resolveTargetFromMatches(m, 10)).toBeUndefined();
  });
});

describe('matchTemplateTarget', () => {
  const tpl = [ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'MT' })];
  it('一致して target を返す', () => {
    expect(matchTemplateTarget('アクモーン', 50, tpl)).toBe('MT');
  });
  it('未マッチ→undefined', () => {
    expect(matchTemplateTarget('別の技', 50, tpl)).toBeUndefined();
  });
});

describe('applyTargetsFromTemplate', () => {
  const tpl = [ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'MT' })];
  it('target 空の event を補完(非破壊)', () => {
    const events = [ev({ id: 'e1', name: { ja: 'アクモーン', en: 'x' }, time: 50 })];
    const out = applyTargetsFromTemplate(events, tpl);
    expect(out[0].target).toBe('MT');
    expect(events[0].target).toBeUndefined(); // 入力非破壊
  });
  it('既に target ある event は上書きしない', () => {
    const events = [ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'ST' })];
    expect(applyTargetsFromTemplate(events, tpl)[0].target).toBe('ST');
  });
  it('未マッチ event はそのまま', () => {
    const events = [ev({ name: { ja: '別技', en: 'x' }, time: 50 })];
    expect(applyTargetsFromTemplate(events, tpl)[0].target).toBeUndefined();
  });
  it('name.ja が空のイベントはテンプレの空名イベント(target:MT)に誤マッチせず target 未設定のまま(精度優先)', () => {
    // parseMitigationSheet が action:'' の行を emit した場合のシミュレーション
    const blankEvent = ev({ id: 'blank-import', name: { ja: '', en: '' }, time: 10 });
    const blankTpl = [ev({ id: 'blank-tpl', name: { ja: '', en: '' }, time: 10, target: 'MT' })];
    const out = applyTargetsFromTemplate([blankEvent], blankTpl);
    expect(out[0].target).toBeUndefined(); // 誤って 'MT' を引き継いではいけない
  });
});

describe('buildSheetMatchReport', () => {
  const tpl = [
    ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'MT' }),
    ev({ name: { ja: '無対象技', en: 'x' }, time: 60 }), // target なし
  ];
  it('carried / matched_no_target / unmatched を分類・重複 action は1回', () => {
    const rows = [
      { action: 'アクモーン', time: 50 },
      { action: 'アクモーン', time: 99 }, // 重複→無視
      { action: '無対象技', time: 60 },
      { action: '知らない技', time: 70 },
    ];
    const rep = buildSheetMatchReport(rows, tpl);
    expect(rep).toEqual([
      { action: 'アクモーン', status: 'carried', templateName: 'アクモーン', target: 'MT' },
      { action: '無対象技', status: 'matched_no_target', templateName: '無対象技', target: null },
      { action: '知らない技', status: 'unmatched', templateName: null, target: null },
    ]);
  });
});
