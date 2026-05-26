import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  canRegister,
  registerListing,
  checkDuplicate,
  QuotaExhaustedError,
  type CanRegisterResponse,
  type DuplicateEntry,
} from '../../../lib/housingApiClient';
import {
  validateRegistrationDraft,
  type RegistrationDraft,
  type ValidationErrors,
} from '../../../utils/housingValidation';
import { HousingRegisterAddressFields } from './HousingRegisterAddressFields';
import { HousingRegisterTagPicker } from './HousingRegisterTagPicker';
import { HousingRegisterDescriptionField } from './HousingRegisterDescriptionField';
import { HousingQuotaIndicator } from './HousingQuotaIndicator';
import { HousingDuplicateWarningDialog } from '../HousingDuplicateWarningDialog';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { useHousingUpdate } from '../edit/useHousingUpdate';
import type { HousingListing } from '../../../types/housing';

const EMPTY_DRAFT: RegistrationDraft = {
  dc: '', server: '', area: '' as never,
  ward: 1,
  // 暫定: 家全体相当のデフォルト値。 5 種チップ選択 UI は Phase 2 で実装
  buildingType: 'house',
  plot: 1, size: 'M',
  tags: [],
  description: '',
};

function listingToDraft(listing: Partial<HousingListing>): RegistrationDraft {
  return {
    dc: listing.dc ?? '',
    server: listing.server ?? '',
    area: (listing.area ?? '') as RegistrationDraft['area'],
    ward: listing.ward ?? 1,
    buildingType: listing.buildingType ?? 'house',
    plot: listing.plot,
    size: listing.size,
    apartmentBuilding: listing.apartmentBuilding,
    roomKind: listing.roomKind,
    roomNumber: listing.roomNumber,
    tags: listing.tags ?? [],
    description: listing.description ?? '',
  };
}

export interface HousingRegisterViewProps {
  /** 'create' (デフォルト) で新規登録、 'edit' で既存物件編集 */
  mode?: 'create' | 'edit';
  /** mode='edit' の場合に必須。 編集対象の物件 */
  initialValues?: Partial<HousingListing> & { id: string };
  /** 編集成功時に親モーダルを閉じる callback (mode='edit' で利用) */
  onClose?: () => void;
  /** 編集保存成功時に呼ぶ callback (詳細の再 fetch + 関連通報の解決を親側でやる) */
  onSaved?: () => void;
}

export const HousingRegisterView: React.FC<HousingRegisterViewProps> = ({
  mode = 'create',
  initialValues,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const isEditMode = mode === 'edit' && initialValues != null;
  const [draft, setDraft] = useState<RegistrationDraft>(
    isEditMode ? listingToDraft(initialValues!) : EMPTY_DRAFT,
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [quotaStatus, setQuotaStatus] = useState<CanRegisterResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { update: updateListing } = useHousingUpdate();

  useEffect(() => {
    if (!user) return;
    if (isEditMode) return; // 編集時は quota チェック不要
    canRegister().then(setQuotaStatus).catch(() => setQuotaStatus(null));
  }, [user, isEditMode]);

  if (loading) {
    return (
      <div className="text-app-text-muted text-app-md p-6 text-center">...</div>
    );
  }

  if (!user) return <HousingLoginPrompt context="register" />;

  const canSubmit = isEditMode
    ? !submitting
    : quotaStatus?.allowed === true && !submitting;

  const performRegister = async (currentDraft: RegistrationDraft) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await registerListing(currentDraft);
      setSuccessMessage(t('housing.register.success', { id: result.id }));
      setDraft(EMPTY_DRAFT);
      const next = await canRegister();
      setQuotaStatus(next);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) {
        setServerError(t('housing.register.errors.quota_exhausted'));
      } else {
        setServerError(t('housing.register.errors.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const performUpdate = async (currentDraft: RegistrationDraft) => {
    if (!initialValues?.id) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await updateListing(initialValues.id, currentDraft);
      if (result.ok) {
        setSuccessMessage(t('housing.edit.success'));
        // 編集成功 → 親側で詳細を再 fetch + 関連通報を解決 (即反映 + 自動解決)
        onSaved?.();
        // 続けてモーダルを閉じる
        onClose?.();
      } else {
        setServerError(t('housing.edit.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateRegistrationDraft(draft);
    setErrors(result.errors);
    if (!result.ok) return;

    if (isEditMode) {
      await performUpdate(draft);
      return;
    }

    if (!quotaStatus?.allowed) return;

    setSubmitting(true);
    try {
      const dup = await checkDuplicate(draft);
      setSubmitting(false);
      if (dup.duplicates.length > 0) {
        setDuplicates(dup.duplicates);
        return;
      }
      await performRegister(draft);
    } catch {
      setSubmitting(false);
      setServerError(t('housing.register.errors.generic'));
    }
  };

  const titleText = isEditMode
    ? t('housing.edit.modal.title')
    : t('housing.register.title');
  const submitText = isEditMode
    ? submitting
      ? t('housing.register.submitting')
      : t('housing.edit.save')
    : submitting
      ? t('housing.register.submitting')
      : t('housing.register.submit');

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-app-3xl font-bold">{titleText}</h2>

      {!isEditMode && <HousingQuotaIndicator status={quotaStatus} />}

      {successMessage && (
        <div className="bg-app-blue-dim border border-app-blue-border rounded-md p-3 text-app-md">
          {successMessage}
        </div>
      )}
      {serverError && (
        <div className="bg-app-red-dim border border-app-red-border rounded-md p-3 text-app-md text-app-red">
          {serverError}
        </div>
      )}

      <HousingRegisterAddressFields
        value={draft}
        onChange={(addr) => setDraft({ ...draft, ...addr })}
        errors={errors}
      />

      <div>
        <p className="text-app-md font-medium mb-2">
          {t('housing.register.tags_label')}
        </p>
        <HousingRegisterTagPicker
          selected={draft.tags}
          onChange={(tags) => setDraft({ ...draft, tags })}
        />
        {errors.tags && (
          <p className="text-app-red text-app-sm mt-1">
            {t(`housing.register.errors.tags.${errors.tags}`)}
          </p>
        )}
      </div>

      <HousingRegisterDescriptionField
        value={draft.description ?? ''}
        onChange={(description) => setDraft({ ...draft, description })}
        error={errors.description}
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-app-blue text-white rounded-md py-3 font-semibold disabled:opacity-50"
      >
        {submitText}
      </button>

      {duplicates && (
        <HousingDuplicateWarningDialog
          duplicates={duplicates}
          onCorrect={() => setDuplicates(null)}
          onProceed={async () => {
            setDuplicates(null);
            await performRegister(draft);
          }}
          onClose={() => setDuplicates(null)}
        />
      )}
    </form>
  );
};
