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

const EMPTY_DRAFT: RegistrationDraft = {
  dc: '', server: '', area: '' as never,
  ward: 1, plot: 1, size: 'M',
  tags: [],
  description: '',
};

export const HousingRegisterView: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [quotaStatus, setQuotaStatus] = useState<CanRegisterResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    canRegister().then(setQuotaStatus).catch(() => setQuotaStatus(null));
  }, [user]);

  if (loading) {
    return (
      <div className="text-app-text-muted text-app-md p-6 text-center">...</div>
    );
  }

  if (!user) return <HousingLoginPrompt context="register" />;

  const canSubmit = quotaStatus?.allowed === true && !submitting;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateRegistrationDraft(draft);
    setErrors(result.errors);
    if (!result.ok) return;
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

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-app-3xl font-bold">{t('housing.register.title')}</h2>

      <HousingQuotaIndicator status={quotaStatus} />

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
        {submitting ? t('housing.register.submitting') : t('housing.register.submit')}
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
