import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingRegisterForm, type HousingRegisterFormValues } from './HousingRegisterForm';
import { registerListing, uploadListingThumbnail, QuotaExhaustedError } from '../../../lib/housingApiClient';
import { HousingPanelModal } from '../HousingPanelModal';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { getTagById } from '../../../data/housingTags';
import type { RegistrationDraft } from '../../../utils/housingValidation';

/**
 * フォーム入力値 → API が期待する RegistrationDraft への変換。
 * フォームでは「サイズ」 が S/M/L/PrivateRoom/Apartment の 5 択で
 * 建物種別と部屋区分を兼ねているが、 API は buildingType と roomKind を
 * 分けて受け取る。 ここで対応関係に詰め替える。
 */
export function toRegistrationDraft(v: HousingRegisterFormValues): RegistrationDraft {
    const size = v.size;
    let buildingType: 'house' | 'apartment' = 'house';
    let apiSize: string | undefined;
    let roomKind: string | undefined;
    let plot: number | undefined = v.plot;

    if (size === 'Apartment') {
        buildingType = 'apartment';
        apiSize = undefined;
        plot = undefined;
        roomKind = 'apartment_room';
    } else if (size === 'PrivateRoom') {
        buildingType = 'house';
        apiSize = v.parentHouseSize;
        roomKind = 'private_chamber';
    } else if (size === 'S' || size === 'M' || size === 'L') {
        buildingType = 'house';
        apiSize = size;
    }

    return {
        dc: v.dc ?? '',
        server: v.server ?? '',
        area: v.area ?? '',
        ward: v.ward ?? 0,
        buildingType,
        plot,
        size: apiSize,
        // 2026-05-27: apartment 時に号棟を渡す。 buildingType !== apartment では undefined 維持
        ...(buildingType === 'apartment' && v.apartmentBuilding
            ? { apartmentBuilding: v.apartmentBuilding }
            : {}),
        roomKind,
        roomNumber: v.roomNumber,
        tags: v.tags ?? [],
        description: v.description,
        ...(v.postUrl && v.ogImageUrl && v.tweetId
            ? {
                  imageMode: 'sns' as const,
                  postUrl: v.postUrl,
                  ogImageUrl: v.ogImageUrl,
                  tweetId: v.tweetId,
              }
            : {}),
    };
}

type Props = {
    open: boolean;
    onClose: () => void;
};

const SUMMARY_ROWS: Array<{
    key: keyof HousingRegisterFormValues;
    labelKey: string;
}> = [
    { key: 'dc', labelKey: 'housing.register.dc' },
    { key: 'server', labelKey: 'housing.register.server' },
    { key: 'area', labelKey: 'housing.register.area' },
    { key: 'ward', labelKey: 'housing.register.ward' },
    { key: 'plot', labelKey: 'housing.register.plot' },
    { key: 'size', labelKey: 'housing.register.size' },
    { key: 'apartmentBuilding', labelKey: 'housing.register.apartment_building.label' },
    { key: 'roomNumber', labelKey: 'housing.register.room_number' },
    { key: 'parentHouseSize', labelKey: 'housing.register.parent_house_size' },
];

export function HousingRegisterFormModal({ open, onClose }: Props) {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const [confirmValues, setConfirmValues] = useState<HousingRegisterFormValues | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(null);

    const handleSubmit = useCallback((values: HousingRegisterFormValues) => {
        setErrorKey(null);
        setConfirmValues(values);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!confirmValues || submitting) return;
        setErrorKey(null);
        setSubmitting(true);
        try {
            const { id } = await registerListing(toRegistrationDraft(confirmValues));

            // 2026-05-26: 画像アップロードがあれば register 直後に upload-thumbnail を呼ぶ。
            // upload 失敗時は listing 自体は登録済みなので、 ユーザーには登録成功として扱い
            // エラーは toast/console に流す (再アップロードは編集 UI で対応する想定)。
            if (confirmValues.localImage) {
                try {
                    await uploadListingThumbnail({
                        listingId: id,
                        base64: confirmValues.localImage.base64,
                        mimeType: confirmValues.localImage.mimeType,
                    });
                } catch (uploadErr) {
                    console.warn('[HousingRegisterFormModal] thumbnail upload failed', uploadErr);
                    setErrorKey('upload_failed');
                    // upload 失敗時も listing 自体は登録済み。 list 反映 + close は実行。
                }
            }

            // 登録した物件を中央一覧へ即反映 (リロード不要)。 失敗しても登録は成功済み。
            // upload が成功していれば thumbnailPath も含めて fetch される。
            await useHousingListingsStore.getState().fetchAndUpsert(id);
            setConfirmValues(null);
            onClose();
        } catch (e) {
            if (e instanceof QuotaExhaustedError) {
                setErrorKey('quota_exhausted');
            } else if (e instanceof Error && e.message === 'not_authenticated') {
                setErrorKey('not_authenticated');
            } else {
                setErrorKey('generic');
            }
        } finally {
            setSubmitting(false);
        }
    }, [confirmValues, onClose, submitting]);

    return (
        <>
            <HousingPanelModal
                open={open}
                onClose={onClose}
                title={t('housing.register.title')}
                closeLabel={t('housing.register.cancel')}
                maxWidth={720}
                modalRole="register"
            >
                {user ? (
                    <HousingRegisterForm onSubmit={handleSubmit} onCancel={onClose} />
                ) : (
                    <HousingLoginPrompt context="register" />
                )}
            </HousingPanelModal>

            <HousingPanelModal
                open={open && confirmValues !== null}
                onClose={() => setConfirmValues(null)}
                title={t('housing.register.confirm.title')}
                closeLabel={t('housing.register.confirm.cancel')}
                maxWidth={480}
            >
                <p className="housing-confirm-message">
                    {t('housing.register.confirm.message')}
                </p>
                {confirmValues && (
                    <dl className="housing-confirm-summary-list">
                        {SUMMARY_ROWS.map(({ key, labelKey }) => {
                            const value = confirmValues[key];
                            if (value === undefined || value === null || value === '') return null;
                            return (
                                <div key={key} className="housing-confirm-summary-row">
                                    <dt>{t(labelKey)}</dt>
                                    <dd>{String(value)}</dd>
                                </div>
                            );
                        })}
                        {confirmValues.description && (
                            <div className="housing-confirm-summary-row" data-block="true">
                                <dt>{t('housing.register.description')}</dt>
                                <dd>{confirmValues.description}</dd>
                            </div>
                        )}
                        {confirmValues.tags && confirmValues.tags.length > 0 && (
                            <div className="housing-confirm-summary-row" data-block="true">
                                <dt>{t('housing.register.tags')}</dt>
                                <dd className="housing-confirm-summary-tags">
                                    {confirmValues.tags.map((id) => {
                                        const tag = getTagById(id);
                                        return (
                                            <span key={id} className="housing-tag-chip">
                                                {tag ? t(tag.i18nKey) : id}
                                            </span>
                                        );
                                    })}
                                </dd>
                            </div>
                        )}
                    </dl>
                )}
                {errorKey && (
                    <p className="housing-confirm-error" role="alert">
                        {t(`housing.register.confirm.errors.${errorKey}`)}
                    </p>
                )}
                <div className="housing-confirm-actions">
                    <button
                        type="button"
                        onClick={() => setConfirmValues(null)}
                        disabled={submitting}
                    >
                        {t('housing.register.confirm.cancel')}
                    </button>
                    <button
                        type="button"
                        data-variant="primary"
                        onClick={handleConfirm}
                        disabled={submitting}
                    >
                        {submitting
                            ? t('housing.register.submitting')
                            : t('housing.register.confirm.submit')}
                    </button>
                </div>
            </HousingPanelModal>
        </>
    );
}
