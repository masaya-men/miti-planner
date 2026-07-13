import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import type { HousingerProfile } from '../../../types/housing';

/**
 * Task 9: 登録フォーム、確認セクション直前の任意ブロック (spec 2026-07-10-housinger-profile-design.md §4.1)。
 *
 * ログイン済のときだけ、 自分のプロフィールを 1 回読む。 housing_profiles/{uid} を
 * getDoc で直読みする (firestore.rules 上、 本人は非公開状態でも read 可能 —
 * HousingerProfileSection.tsx / HousingRegisterTagPicker.tsx の usePersonalTag と同じ理由)。
 * getHousingerProfile (housingerProfileService.ts) は「公開プロフィールのみ」返す関数のため
 * ここでは使わない (未公開の自分のプロフィールが null に丸められてしまう)。
 *
 * 未公開 (ドキュメント無し、 または isPublished !== true) なら、 任意の公開導線
 * (見出し + 説明 + [設定する] ボタン → アカウントモーダルを開く) を出す。
 * 公開中なら「{{name}} として公開中」の小さな表示のみに留める。
 * どちらの状態でも入力を要求せず、 登録フローを止めない (spec §4.1)。
 */
export const RegisterHousingerCta: React.FC = () => {
  const { t } = useTranslation();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HousingerProfile | null>(null);

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
        setProfile(snap.exists() ? (snap.data() as HousingerProfile) : null);
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

  if (!uid || loading) return null;

  if (profile?.isPublished === true) {
    return (
      <p
        className="housing-register-housinger-cta-published"
        data-testid="housing-register-housinger-cta-published"
      >
        {t('housing.housinger.register.publishedAs', { name: profile.displayName })}
      </p>
    );
  }

  return (
    <div className="housing-register-housinger-cta" data-testid="housing-register-housinger-cta">
      <h3 className="housing-register-housinger-cta-title">
        {t('housing.housinger.register.ctaTitle')}
      </h3>
      <p className="housing-register-housinger-cta-desc">
        {t('housing.housinger.account.description')}
      </p>
      <button
        type="button"
        className="housing-action-btn housing-btn-primary"
        onClick={() => useHousingModalStore.getState().openAccount()}
      >
        {t('housing.housinger.register.ctaButton')}
      </button>
    </div>
  );
};
