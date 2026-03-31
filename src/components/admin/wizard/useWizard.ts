import { useState, useCallback } from 'react';

export interface WizardStep {
  id: string;
  label: string; // i18n key for the question text
  required: boolean;
  // Conditional step: skip if this returns false
  condition?: (data: Record<string, unknown>) => boolean;
}

interface UseWizardOptions {
  steps: WizardStep[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function useWizard({ steps, onSubmit }: UseWizardOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // 条件に基づいてアクティブなステップをフィルタリング
  const activeSteps = steps.filter(
    (s) => !s.condition || s.condition(data)
  );

  const currentStep = activeSteps[currentIndex];
  const totalSteps = activeSteps.length;
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === totalSteps - 1;

  const setField = useCallback((key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const next = useCallback(() => {
    if (isLastStep) {
      setShowConfirmation(true);
    } else {
      setCurrentIndex((i) => Math.min(i + 1, totalSteps - 1));
    }
  }, [isLastStep, totalSteps]);

  const back = useCallback(() => {
    if (showConfirmation) {
      setShowConfirmation(false);
    } else {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
  }, [showConfirmation]);

  const goToStep = useCallback(
    (stepId: string) => {
      const idx = activeSteps.findIndex((s) => s.id === stepId);
      if (idx >= 0) {
        setShowConfirmation(false);
        setCurrentIndex(idx);
      }
    },
    [activeSteps]
  );

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(data);
      setIsComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [data, onSubmit]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setData({});
    setIsSubmitting(false);
    setIsComplete(false);
    setError(null);
    setShowConfirmation(false);
  }, []);

  return {
    currentStep,
    currentIndex,
    totalSteps,
    activeSteps,
    data,
    setField,
    next,
    back,
    goToStep,
    submit,
    reset,
    isFirstStep,
    isLastStep,
    isSubmitting,
    isComplete,
    showConfirmation,
    error,
  };
}
