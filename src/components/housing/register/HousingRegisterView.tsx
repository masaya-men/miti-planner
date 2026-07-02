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
import { RegisterSectionVisibility } from './RegisterSectionVisibility';
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
    // 編集時もタイトルは必須 (spec)。 旧 listing (title 未設定) を編集開始した瞬間から
    // '' を初期値にすることで validateTitle('') = required がクライアントで発火する。
    title: listing.title ?? '',
    visibility: listing.visibility ?? 'public',
    publishUntil: listing.publishUntil ?? null,
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
      <div
        style={{
          color: 'var(--housing-text-dim)',
          fontSize: 'var(--housing-text-base)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        ...
      </div>
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
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 672,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <h2 style={{ fontSize: 'var(--housing-text-xl)', fontWeight: 600 }}>{titleText}</h2>

      {!isEditMode && <HousingQuotaIndicator status={quotaStatus} />}

      {successMessage && (
        <div
          style={{
            background: 'var(--housing-honey-soft)',
            border: '1px solid var(--housing-honey-border)',
            borderRadius: 8,
            padding: 12,
            fontSize: 'var(--housing-text-base)',
            color: 'var(--housing-candle)',
          }}
        >
          {successMessage}
        </div>
      )}
      {serverError && (
        <div
          style={{
            background: 'var(--housing-danger-soft)',
            border: '1px solid var(--housing-warning)',
            borderRadius: 8,
            padding: 12,
            fontSize: 'var(--housing-text-base)',
            color: 'var(--housing-warning)',
          }}
        >
          {serverError}
        </div>
      )}

      <HousingRegisterAddressFields
        value={draft}
        onChange={(addr) => setDraft({ ...draft, ...addr })}
        errors={errors}
      />

      {isEditMode && (
        <div className="housing-field">
          <label htmlFor="housing-edit-title" className="housing-label">
            {t('housing.edit.title_label')}
          </label>
          <input
            id="housing-edit-title"
            type="text"
            required
            value={draft.title ?? ''}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="housing-input"
            placeholder={t('housing.edit.title_placeholder')}
          />
          {errors.title && (
            <p className="housing-field-error">
              {t(`housing.register.errors.title.${errors.title}`)}
            </p>
          )}
        </div>
      )}

      {isEditMode && (
        <RegisterSectionVisibility
          visibility={draft.visibility ?? 'public'}
          publishUntil={draft.publishUntil ?? null}
          onChange={({ visibility, publishUntil }) =>
            setDraft({ ...draft, visibility, publishUntil })
          }
        />
      )}

      <div>
        <p style={{
          fontSize: 'var(--housing-text-base)',
          fontWeight: 500,
          marginBottom: 8,
        }}>
          {t('housing.register.tags_label')}
        </p>
        <HousingRegisterTagPicker
          selected={draft.tags}
          onChange={(tags) => setDraft({ ...draft, tags })}
        />
        {errors.tags && (
          <p style={{
            color: 'var(--housing-warning)',
            fontSize: 'var(--housing-text-sm)',
            marginTop: 4,
          }}>
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
        className="housing-action-btn housing-btn-primary"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '12px 16px',
          fontSize: 'var(--housing-text-base)',
        }}
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
