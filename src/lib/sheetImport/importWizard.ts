/**
 * スプシ取込モーダル「誘導型ウィザード」の遷移判定・フェーズ名解決（純粋関数）。
 * UI から分離してユニットテストする（importBlockReason.ts と同じ流儀）。
 *
 * ステップ:
 *  1 設定 / 2 貼付ループ / 3 パーティ割当(条件付き) / 4 確認
 *  Step3 は「軽減も かつ ジョブ検出>0」のときだけ存在。満たさなければ 2→4 にスキップ。
 */
export type WizardStep = 1 | 2 | 3 | 4;

/** Step3(パーティ割当)を出すか。軽減も かつ 検出ジョブ>0。 */
export function wizardHasPartyStep(includeMitigations: boolean, detectedJobCount: number): boolean {
  return includeMitigations && detectedJobCount > 0;
}

/** 総ステップ数（party有り=4 / 無し=3）。 */
export function wizardTotalSteps(hasPartyStep: boolean): number {
  return hasPartyStep ? 4 : 3;
}

/** 論理ステップ(1..4)を進捗ドットの表示位置(1..total)へ。party無しのとき step4 は 3番目。 */
export function wizardStepPosition(step: WizardStep, hasPartyStep: boolean): number {
  if (hasPartyStep) return step;
  return step === 4 ? 3 : step;
}

export interface WizardGateCtx {
  entriesCount: number;
  hasPendingDraft: boolean;
  partyComplete: boolean;
}

/** 「次へ」を押せるか（黄/赤ゲートの移植）。step4 は確定ボタン側で canConfirm 判定するため常に true。 */
export function wizardCanAdvance(step: WizardStep, ctx: WizardGateCtx): boolean {
  switch (step) {
    case 1: return true;
    case 2: return ctx.entriesCount > 0 && !ctx.hasPendingDraft;
    case 3: return ctx.partyComplete;
    case 4: return true;
  }
}

/** 次ステップ（party無しは 2→4 スキップ）。 */
export function wizardNextStep(step: WizardStep, hasPartyStep: boolean): WizardStep {
  if (step === 1) return 2;
  if (step === 2) return hasPartyStep ? 3 : 4;
  if (step === 3) return 4;
  return 4;
}

/** 前ステップ（party無しは 4→2 スキップ）。 */
export function wizardPrevStep(step: WizardStep, hasPartyStep: boolean): WizardStep {
  if (step === 4) return hasPartyStep ? 3 : 2;
  if (step === 3) return 2;
  if (step === 2) return 1;
  return 1;
}

/** Step3 が無効化された（party無しなのに step3 に居る）場合のみ 4 へクランプ。レース対策。 */
export function wizardClampStep(step: WizardStep, hasPartyStep: boolean): WizardStep {
  if (step === 3 && !hasPartyStep) return 4;
  return step;
}

/**
 * 追加時のフェーズ名を確定する。空（trim 後空）なら `Phase {index0+1}` を実体化。
 * 理由: buildPlanFromSheets は phaseName をそのまま生成プランの phase 名に使うため、
 * 空のままだとフェーズ名が空になる（モーダル表示の `Phase N` フォールバックは表示専用）。
 * index0 = 追加時点の entries.length（0 始まり）。
 */
export function resolvePhaseName(rawName: string, index0: number): string {
  const trimmed = rawName.trim();
  return trimmed !== '' ? trimmed : `Phase ${index0 + 1}`;
}
