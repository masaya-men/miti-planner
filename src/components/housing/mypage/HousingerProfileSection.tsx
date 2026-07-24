import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/useAuthStore';
import { upsertHousingerProfile } from '../../../lib/housing/housingerProfileService';
import { HOUSINGER_BIO_MAX_LENGTH, validateHousingerSnsUrl } from '../../../lib/housing/housingerProfile';
import { ConfirmDialog } from '../../ConfirmDialog';
import { showToast } from '../../Toast';
import type { HousingerProfile } from '../../../types/housing';

/**
 * アカウントモーダル内「ハウジンガー公開」セクション (spec 2026-07-10-housinger-profile-design.md §4.1)。
 *
 * 自分のプロフィールは housing_profiles/{uid} を getDoc で直読みする。他人の公開プロフィール取得用の
 * getHousingerProfile (housingerProfileService.ts、セッションキャッシュ付き) とは別経路 —
 * 本人は非公開状態でも自分のデータを読む必要があり (firestore.rules の isOwner(uid) 分岐)、
 * かつ保存直後は必ず最新値を見せたいためキャッシュを使わない。
 *
 * 公開条件は「表示名 (profileDisplayName) が空でないこと」のみ (名前 = 個人タグの源泉)。
 * 保存/公開/公開停止はすべて upsertHousingerProfile (POST /api/housing?action=upsert-housinger-profile)
 * 経由で行い、成功時はレスポンスの profile でローカル state を更新する (再フェッチ不要)。
 */
export const HousingerProfileSection: React.FC = () => {
  const { t } = useTranslation();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const displayName = useAuthStore((s) => s.profileDisplayName);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const [bio, setBio] = useState('');
  const [snsUrl, setSnsUrl] = useState('');
  const [snsError, setSnsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getDoc(doc(db, 'housing_profiles', uid))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as HousingerProfile;
          setProfile(data);
          setBio(data.bio ?? '');
          setSnsUrl(data.snsUrl ?? '');
        } else {
          setProfile(null);
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const hasName = !!displayName?.trim();
  const isPublished = profile?.isPublished === true;

  /** upsertHousingerProfile の結果を state に反映し、成功/失敗トーストを出す共通処理。 */
  const applyResult = (res: { ok: boolean; error?: string; profile?: HousingerProfile }) => {
    if (res.ok) {
      if (res.profile) {
        setProfile(res.profile);
        setBio(res.profile.bio ?? '');
        setSnsUrl(res.profile.snsUrl ?? '');
      }
      showToast(t('housing.housinger.account.toastSaved'));
    } else {
      showToast(t('housing.housinger.account.toastError'), 'error');
    }
  };

  const handlePublish = async () => {
    if (!hasName || isSaving) return;
    setIsSaving(true);
    try {
      applyResult(await upsertHousingerProfile({ isPublished: true }));
    } catch {
      showToast(t('housing.housinger.account.toastError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const trimmedSns = snsUrl.trim();
    if (trimmedSns && !validateHousingerSnsUrl(trimmedSns).ok) {
      setSnsError(true);
      return;
    }
    setSnsError(false);
    setIsSaving(true);
    try {
      applyResult(
        await upsertHousingerProfile({
          bio: bio.trim() ? bio : null,
          snsUrl: trimmedSns || null,
        }),
      );
    } catch {
      showToast(t('housing.housinger.account.toastError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    try {
      applyResult(await upsertHousingerProfile({ isPublished: false }));
    } catch {
      showToast(t('housing.housinger.account.toastError'), 'error');
    } finally {
      setIsSaving(false);
      setShowUnpublishConfirm(false);
    }
  };

  if (!uid) return null;

  return (
    <div className="housing-account-housinger">
      <h4 className="housing-account-housinger-title">{t('housing.housinger.account.title')}</h4>
      <p className="housing-account-housinger-desc">{t('housing.housinger.account.description')}</p>

      {!loading && !isPublished && (
        <>
          <button
            type="button"
            className="housing-account-button"
            onClick={handlePublish}
            disabled={!hasName || isSaving}
          >
            {t('housing.housinger.account.publish')}
          </button>
          {!hasName && (
            <p className="housing-address-note">{t('housing.housinger.account.nameRequired')}</p>
          )}
        </>
      )}

      {!loading && isPublished && (
        <div className="housing-account-housinger-published">
          <p className="housing-account-housinger-status">
            {t('housing.housinger.account.published')}
          </p>

          <div className="housing-field">
            <label htmlFor="housinger-bio" className="housing-label">
              {t('housing.housinger.account.bioLabel')}
            </label>
            <input
              id="housinger-bio"
              type="text"
              className="housing-input"
              value={bio}
              maxLength={HOUSINGER_BIO_MAX_LENGTH}
              placeholder={t('housing.housinger.account.bioPlaceholder')}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="housing-address-note">{HOUSINGER_BIO_MAX_LENGTH - bio.length}</p>
          </div>

          <div className="housing-field">
            <label htmlFor="housinger-sns" className="housing-label">
              {t('housing.housinger.account.snsLabel')}
            </label>
            <input
              id="housinger-sns"
              type="url"
              className="housing-input"
              value={snsUrl}
              placeholder={t('housing.housinger.account.snsPlaceholder')}
              onChange={(e) => {
                setSnsUrl(e.target.value);
                setSnsError(false);
              }}
            />
            {snsError && (
              <p className="housing-field-error">{t('housing.housinger.account.snsInvalid')}</p>
            )}
          </div>

          <button
            type="button"
            className="housing-account-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {t('housing.housinger.account.save')}
          </button>

          <button
            type="button"
            className="housing-account-button housing-account-button-danger"
            onClick={() => setShowUnpublishConfirm(true)}
            disabled={isSaving}
          >
            {t('housing.housinger.account.unpublish')}
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showUnpublishConfirm}
        onConfirm={handleUnpublish}
        onCancel={() => setShowUnpublishConfirm(false)}
        title={t('housing.housinger.account.unpublishConfirmTitle')}
        message={t('housing.housinger.account.unpublishConfirmBody')}
        confirmLabel={t('housing.housinger.account.unpublish')}
        variant="danger"
      />
    </div>
  );
};
