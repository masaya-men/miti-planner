import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../toastBus';
import { apiFetch } from '../../lib/apiClient';
import { stripSharedPersonalData } from '../../lib/sharePrivacy';
import type { SavedPlan } from '../../types';
import { buildOgImageUrl, type OgpLang } from '../../lib/ogpHelpers';

interface UseShareLinkArgs {
    isOpen: boolean;
    currentPlan: SavedPlan | undefined;
    /** バンドル共有用：複数プランのデータ */
    bundlePlans?: { contentId: string | null; title: string; planData: unknown }[];
    showLogo: boolean;
}

/** 共有 URL と OGP 画像の生成・ロゴ差し替え(PUT) */
export function useShareLink({ isOpen, currentPlan, bundlePlans, showLogo }: UseShareLinkArgs) {
    const { t, i18n } = useTranslation();
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
    const [, setLoading] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [shareIdRef, setShareIdRef] = useState<string | null>(null);
    // logoHash はサーバーから返ってくる SHA-256 先頭16文字。OGP URL の lh パラメータ用で、
    // 各 PUT/POST 直後にレスポンスから取り出して buildOgUrl に渡す。
    // 永続 state は持たず、レスポンスごとに最新値を直接使うことで参照ズレを排除。

    const { user, teamLogoUrl } = useAuthStore();

    const isBundle = bundlePlans && bundlePlans.length > 0;

    const lang: OgpLang = i18n.language === 'en' ? 'en' : 'ja';

    /**
     * OGP画像URLを構築するヘルパー。
     *   imageHash あり: /og/{hash}.png（同一オリジン静的キャッシュ、サーバー側 og:image と一致）
     *   imageHash なし: 従来の /api/og?... URL（後方互換）
     * サーバーから返ってきた imageHash を必ず渡すことでサーバーと URL が完全一致する。
     */
    const buildOgUrl = (
        id: string,
        logo: boolean,
        logoHash: string | null,
        imageHash?: string | null,
    ) => {
        if (imageHash && /^[a-f0-9]{16}$/.test(imageHash)) {
            return `${window.location.origin}/og/${imageHash}.png`;
        }
        return buildOgImageUrl(window.location.origin, id, {
            showLogo: logo,
            logoHash: logoHash || undefined,
            lang,
        });
    };

    // モーダルが開いたら共有URLを生成
    useEffect(() => {
        if (!isOpen) return;
        setShareUrl(null);
        setOgImageUrl(null);
        setImageLoaded(false);

        generateShareUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- モーダルが開いた時だけ共有 URL を生成する(generateShareUrl は毎回作り直される関数。依存に入れると毎描画で再生成してしまう)
    }, [isOpen]);

    const generateShareUrl = async () => {
        setLoading(true);
        try {
            let body: Record<string, unknown>;
            if (isBundle) {
                // 個人状態(progress/memos)を端末から送らない（プライバシー: サーバ側strip より手前で除去）
                body = { plans: bundlePlans!.map(p => ({ ...p, planData: stripSharedPersonalData(p.planData) })) };
            } else {
                const snapshot = useMitigationStore.getState().getSnapshot();
                body = {
                    planData: stripSharedPersonalData(snapshot),
                    title: currentPlan?.title || '',
                    contentId: currentPlan?.contentId || null,
                };
            }
            // ロゴが有効ならストレージパスをサーバーに送る（サーバー側でfirebase-adminでダウンロード）
            if (showLogo && teamLogoUrl && user) {
                body.logoStoragePath = `users/${user.uid}/team-logo.jpg`;
            }
            body.lang = lang;

            // App Check は付けない（サーバ側で share は App Check 免除）。匿名は初期化しない＝
            // privacy 制限下での reCAPTCHA 交換失敗 (initial-throttle) を踏まない。ログイン時は
            // 既に初期化済みなので apiFetch が peek でトークンを載せるが、サーバは参照しない。
            const res = await apiFetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setShareIdRef(data.shareId);
            const newLogoHash: string | null = typeof data.logoHash === 'string' ? data.logoHash : null;
            const newImageHash: string | null = typeof data.imageHash === 'string' ? data.imageHash : null;
            const url = `${window.location.origin}/share/${data.shareId}`;
            setShareUrl(url);
            setOgImageUrl(buildOgUrl(data.shareId, showLogo, newLogoHash, newImageHash));
            if (data.logoBlocked) {
                showToast(t('team_logo.logo_blocked'), 'error');
            }
        } catch (err) {
            console.error('Share failed:', err);
            showToast(t('app.share_failed') || '共有リンクの生成に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    // 既存shareIdのロゴを更新（PUT）
    // logoUrlOverride: setTeamLogoUrl 直後に呼ぶ場合、closure 内の古い teamLogoUrl
    // (null のまま) を使うとサーバーがロゴ無しで PUT してしまい imageHash が過去と
    // 同一になって React が bail-out する事象が発生する。最新の URL を引数で渡すことで
    // closure を回避し、サーバーに必ず最新ロゴ状態を伝える。
    const updateShareLogo = async (withLogo: boolean, logoUrlOverride?: string | null) => {
        if (!shareIdRef) return;
        setImageLoaded(false);
        // ogImageUrl を一度 null にすることで <img> を確実にアンマウントする。
        // 同じロゴで再追加する等で imageHash が過去と完全一致した場合、
        // setOgImageUrl(同値) では React が bail-out して再レンダリングせず、
        // ブラウザも新規ロードを開始しないため「永遠に生成中」になる事象への対策。
        // await fetch をまたぐので React は途中で render を走らせ、<img> が消える。
        setOgImageUrl(null);
        try {
            const body: Record<string, unknown> = { shareId: shareIdRef };
            const effectiveLogoUrl = logoUrlOverride !== undefined ? logoUrlOverride : teamLogoUrl;
            if (withLogo && effectiveLogoUrl && user) {
                body.logoStoragePath = `users/${user.uid}/team-logo.jpg`;
            }
            // App Check は付けない（サーバ側で share は App Check 免除。プレビュー更新ボタン経由で
            // 匿名も PUT に到達するため）。匿名は初期化しない＝reCAPTCHA 交換失敗を踏まない。
            const res = await apiFetch('/api/share', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.logoBlocked) {
                showToast(t('team_logo.logo_blocked'), 'error');
            }
            // サーバーから返ってきた logoHash / imageHash で URL を組み立て直す。
            // ロゴ内容が変われば imageHash も変わるため URL が自然に変化し、
            // ブラウザも Storage キャッシュも別エントリとして新画像を取得する
            // （タイムスタンプ式キャッシュバスター不要でサーバーOGP URL と完全一致）。
            const newLogoHash: string | null = typeof data.logoHash === 'string' ? data.logoHash : null;
            const newImageHash: string | null = typeof data.imageHash === 'string' ? data.imageHash : null;
            setOgImageUrl(buildOgUrl(shareIdRef, withLogo, newLogoHash, newImageHash));
        } catch (err) {
            console.error('Share logo update failed:', err);
            showToast(t('app.share_failed'));
            setImageLoaded(true); // エラー時にボタンを再有効化
        }
    };

    return {
        isBundle, shareUrl, ogImageUrl, imageLoaded, setImageLoaded, updateShareLogo,
    };
}
