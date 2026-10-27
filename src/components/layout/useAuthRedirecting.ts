import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';

/** 初回ログイン判定と、OAuth リダイレクト戻りの「ログイン中…」表示の要否。 */
export function useAuthRedirecting() {
    // 初回ログイン判定
    const isNewUser = useAuthStore((s) => s.isNewUser);

    // リダイレクト認証の戻り検知（Discord/Twitter — ページロード前に即座に判定）
    // ※ Phase B-1.5 polish 第 2 弾 Rev 3: 一度撤去したが、 OAuth リダイレクト戻り時は
    //   実際にログイン処理中なので「ログイン中…」 オーバーレイは正しい用途として復活。
    //   migrate / pull だけのときに出ていた isImportPreparing オーバーレイは撤去のまま。
    const justLoggedInUser = useAuthStore((s) => s.justLoggedInUser);
    const [isAuthRedirecting, setIsAuthRedirecting] = React.useState(() =>
        localStorage.getItem('lopo_auth_redirecting') === 'true'
    );
    React.useEffect(() => {
        if (justLoggedInUser || !localStorage.getItem('lopo_auth_redirecting')) {
            setIsAuthRedirecting(false);
        }
    }, [justLoggedInUser]);

    return { isNewUser, showAuthRedirecting: isAuthRedirecting && !justLoggedInUser };
}
