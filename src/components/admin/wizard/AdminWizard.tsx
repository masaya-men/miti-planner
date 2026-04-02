/**
 * 管理画面ウィザード共通コンポーネント
 * ステップ型フォームの共通UIフレームワーク
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWizard } from './useWizard';

interface AdminWizardProps {
  title: string;
  wizard: ReturnType<typeof useWizard>;
  renderStep: (stepId: string) => React.ReactNode;
  renderConfirmation: () => React.ReactNode;
  isStepValid: (stepId: string) => boolean;
}

export function AdminWizard({
  title,
  wizard,
  renderStep,
  renderConfirmation,
  isStepValid,
}: AdminWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    currentStep,
    currentIndex,
    totalSteps,
    data: _data,
    next,
    back,
    submit,
    reset,
    isFirstStep,
    isSubmitting,
    isComplete,
    showConfirmation,
    error,
  } = wizard;

  // 完了画面
  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-[var(--app-text)]">
        <div className="text-app-6xl font-bold">{t('admin.wizard_success')}</div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={reset}
            className="border border-[var(--app-text)] px-6 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
          >
            {t('admin.wizard_add_another')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity"
          >
            {t('admin.wizard_back_to_dashboard')}
          </button>
        </div>
      </div>
    );
  }

  // 確認画面
  if (showConfirmation) {
    return (
      <div className="flex flex-col gap-6 text-[var(--app-text)]">
        {/* タイトル */}
        <div className="border-b border-[var(--app-text)] pb-3">
          <h2 className="text-app-4xl font-bold">{title}</h2>
          <p className="text-app-2xl text-[var(--app-text-muted)] mt-1">
            {t('admin.wizard_confirmation')}
          </p>
        </div>

        {/* 確認内容 */}
        <div className="min-h-[200px]">{renderConfirmation()}</div>

        {/* エラー表示 */}
        {error && (
          <div className="border border-[var(--app-text)] p-3 text-app-2xl">
            {error}
          </div>
        )}

        {/* ナビゲーション */}
        <div className="flex justify-between items-center pt-4 border-t border-[var(--app-text)]">
          <button
            type="button"
            onClick={back}
            className="border border-[var(--app-text)] px-5 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
          >
            {t('admin.wizard_back')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {isSubmitting
              ? t('admin.wizard_submitting')
              : t('admin.wizard_submit')}
          </button>
        </div>
      </div>
    );
  }

  // ステップ画面（currentStepがない場合は何も表示しない）
  if (!currentStep) return null;

  const stepValid = isStepValid(currentStep.id);
  const progressPercent =
    totalSteps > 1 ? (currentIndex / (totalSteps - 1)) * 100 : 100;

  return (
    <div className="flex flex-col gap-6 text-[var(--app-text)]">
      {/* タイトル */}
      <div className="border-b border-[var(--app-text)] pb-3">
        <h2 className="text-app-4xl font-bold">{title}</h2>
      </div>

      {/* プログレスバー */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-app-lg text-[var(--app-text-muted)]">
            {t('admin.wizard_step', {
              current: currentIndex + 1,
              total: totalSteps,
            })}
          </span>
          {/* ステップインジケーター */}
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={[
                  'h-1.5 w-6 transition-colors',
                  i < currentIndex
                    ? 'bg-[var(--app-text)]'
                    : i === currentIndex
                      ? 'bg-[var(--app-text)]'
                      : 'bg-[var(--app-text-muted)] opacity-30',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
        {/* プログレスバー本体 */}
        <div className="h-0.5 bg-[var(--app-text)] opacity-20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--app-text)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ステップ内容 */}
      <div className="min-h-[200px]">{renderStep(currentStep.id)}</div>

      {/* エラー表示 */}
      {error && (
        <div className="border border-[var(--app-text)] p-3 text-app-2xl">
          {error}
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex justify-between items-center pt-4 border-t border-[var(--app-text)]">
        {/* 戻るボタン（最初のステップでは非表示） */}
        {!isFirstStep ? (
          <button
            type="button"
            onClick={back}
            className="border border-[var(--app-text)] px-5 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
          >
            {t('admin.wizard_back')}
          </button>
        ) : (
          <div />
        )}

        {/* 右側ボタン群 */}
        <div className="flex gap-3 items-center">
          {/* 任意ステップはスキップボタンを表示 */}
          {!currentStep.required && (
            <button
              type="button"
              onClick={next}
              className="text-app-2xl text-[var(--app-text-muted)] underline hover:text-[var(--app-text)] transition-colors"
            >
              {t('admin.wizard_skip')}
            </button>
          )}
          {/* 次へ / 完了ボタン */}
          <button
            type="button"
            onClick={next}
            disabled={currentStep.required && !stepValid}
            className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {t('admin.wizard_next')}
          </button>
        </div>
      </div>
    </div>
  );
}
