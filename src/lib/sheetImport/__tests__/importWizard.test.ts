import { describe, it, expect } from 'vitest';
import {
  wizardHasPartyStep, wizardTotalSteps, wizardStepPosition,
  wizardCanAdvance, wizardNextStep, wizardPrevStep, wizardClampStep, resolvePhaseName,
} from '../importWizard';

describe('wizardHasPartyStep', () => {
  it('軽減も かつ ジョブ検出>0 のときだけ true', () => {
    expect(wizardHasPartyStep(true, 3)).toBe(true);
    expect(wizardHasPartyStep(true, 0)).toBe(false);   // ジョブ未検出
    expect(wizardHasPartyStep(false, 3)).toBe(false);  // タイムラインだけ
  });
});

describe('wizardTotalSteps', () => {
  it('party有り=4 / 無し=3', () => {
    expect(wizardTotalSteps(true)).toBe(4);
    expect(wizardTotalSteps(false)).toBe(3);
  });
});

describe('wizardStepPosition', () => {
  it('party有りは step と位置が一致', () => {
    expect(wizardStepPosition(1, true)).toBe(1);
    expect(wizardStepPosition(4, true)).toBe(4);
  });
  it('party無しは step4 が 3番目（step3 はスキップ）', () => {
    expect(wizardStepPosition(1, false)).toBe(1);
    expect(wizardStepPosition(2, false)).toBe(2);
    expect(wizardStepPosition(4, false)).toBe(3);
  });
});

describe('wizardCanAdvance', () => {
  const ctx = (o: Partial<{ entriesCount: number; hasPendingDraft: boolean; partyComplete: boolean }>) =>
    ({ entriesCount: 0, hasPendingDraft: false, partyComplete: true, ...o });
  it('step1 は常に進める', () => {
    expect(wizardCanAdvance(1, ctx({}))).toBe(true);
  });
  it('step2 は entries>0 かつ 未追加draftなし', () => {
    expect(wizardCanAdvance(2, ctx({ entriesCount: 0 }))).toBe(false);
    expect(wizardCanAdvance(2, ctx({ entriesCount: 1, hasPendingDraft: true }))).toBe(false);
    expect(wizardCanAdvance(2, ctx({ entriesCount: 1, hasPendingDraft: false }))).toBe(true);
  });
  it('step3 は partyComplete', () => {
    expect(wizardCanAdvance(3, ctx({ partyComplete: false }))).toBe(false);
    expect(wizardCanAdvance(3, ctx({ partyComplete: true }))).toBe(true);
  });
  it('step4 は常に true（確定は canConfirm で別判定）', () => {
    expect(wizardCanAdvance(4, ctx({}))).toBe(true);
  });
});

describe('wizardNextStep', () => {
  it('1→2', () => expect(wizardNextStep(1, true)).toBe(2));
  it('2→3 (party有り)', () => expect(wizardNextStep(2, true)).toBe(3));
  it('2→4 (party無しはスキップ)', () => expect(wizardNextStep(2, false)).toBe(4));
  it('3→4', () => expect(wizardNextStep(3, true)).toBe(4));
});

describe('wizardPrevStep', () => {
  it('4→3 (party有り)', () => expect(wizardPrevStep(4, true)).toBe(3));
  it('4→2 (party無しはスキップ)', () => expect(wizardPrevStep(4, false)).toBe(2));
  it('3→2', () => expect(wizardPrevStep(3, true)).toBe(2));
  it('2→1', () => expect(wizardPrevStep(2, true)).toBe(1));
});

describe('wizardClampStep', () => {
  it('party無しなのに step3 のときだけ 4 へ', () => {
    expect(wizardClampStep(3, false)).toBe(4);
  });
  it('それ以外は据え置き', () => {
    expect(wizardClampStep(3, true)).toBe(3);
    expect(wizardClampStep(2, false)).toBe(2);
    expect(wizardClampStep(4, false)).toBe(4);
  });
});

describe('resolvePhaseName', () => {
  it('空(trim後空)なら Phase {index0+1} を実体化', () => {
    expect(resolvePhaseName('', 0)).toBe('Phase 1');
    expect(resolvePhaseName('   ', 2)).toBe('Phase 3');
  });
  it('入力があれば trim して採用', () => {
    expect(resolvePhaseName('  P1 神々の像 ', 0)).toBe('P1 神々の像');
  });
});
