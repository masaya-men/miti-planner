/**
 * 短縮共有URL (/h/:slug) の入口ページ。
 *
 * slug (例: 'たかし-8f3a2c1b') の末尾識別コードだけで実際の uid を解決し、
 * 見つかれば HousingerPage (既存の /housing/housinger/:uid と同一コンポーネント) に
 * uidOverride 経由で委譲する。表示 URL は /h/:slug のまま変えない (置き換えではなく描画の
 * 差し替えのみ・vercel.json の rewrite と同じ考え方)。
 *
 * 名前部分は判定に一切使わない飾りなので、slug が壊れていても「名前が変わった」場合でも
 * 識別コードさえ一致すれば同じプロフィールに着地する。解決できない (不正な slug・非公開・
 * 存在しない) 場合は HousingerPage 本体の「見つからない」表示と同じ文言/導線を出す。
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HousingerPage } from './HousingerPage';
import { extractHousingerShortCode } from '../../../lib/housing/housingerProfile';
import { resolveHousingerUidByShortCode } from '../../../lib/housing/housingerProfileService';

type ResolveState =
  | { status: 'loading' }
  | { status: 'found'; uid: string }
  | { status: 'not-found' };

export const HousingerShortLinkPage: React.FC = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<ResolveState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const code = extractHousingerShortCode(slug ?? '');
    if (!code) {
      setState({ status: 'not-found' });
      return;
    }
    (async () => {
      const uid = await resolveHousingerUidByShortCode(code);
      if (cancelled) return;
      setState(uid ? { status: 'found', uid } : { status: 'not-found' });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === 'found') {
    return <HousingerPage uidOverride={state.uid} />;
  }

  if (state.status === 'not-found') {
    return (
      <div className="housing-detail-panel">
        <div className="housing-detail-shell">
          <main className="housing-detail-fullpage-main">
            <p>{t('housing.housinger.unavailable')}</p>
            <Link to="/housing" className="housing-detail-back" aria-label={t('housing.detail.back_aria')}>
              ← {t('housing.detail.back_aria')}
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="housing-detail-panel">
      <div className="housing-detail-shell">
        <main className="housing-detail-fullpage-main">{t('housing.housinger.loading')}</main>
      </div>
    </div>
  );
};
