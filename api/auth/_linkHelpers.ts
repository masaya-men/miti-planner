/**
 * アカウント連携 (Phase B-2) 用の共通ヘルパー。
 *
 * Discord / Twitter ハンドラの link mode callback で完了画面 / エラー画面を返す処理を共通化。
 * アンダースコア prefix のため Vercel に function として認識されない (関数枠を消費しない)。
 */

export type LinkProvider = 'discord' | 'twitter';

/** 連携完了画面 → return_url にリダイレクト + localStorage に完了通知を書く */
export function sendLinkCompletePage(res: any, provider: LinkProvider): any {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
<!DOCTYPE html>
<html>
<head><title>LoPo - 連携完了</title></head>
<body>
    <script>
        localStorage.setItem('lopo_link_completed', JSON.stringify({ provider: ${JSON.stringify(provider)} }));
        var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
        localStorage.removeItem('lopo_auth_return_url');
        try {
            var u = new URL(returnUrl, window.location.origin);
            if (u.origin !== window.location.origin) returnUrl = '/';
        } catch(e) { returnUrl = '/'; }
        window.location.href = returnUrl;
    </script>
    <p>連携完了... リダイレクトしています</p>
</body>
</html>
    `);
}

/** 連携エラー画面 → return_url にリダイレクト + localStorage にエラーコードを書く */
export function sendLinkErrorPage(res: any, errorCode: string): any {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
<!DOCTYPE html>
<html>
<head><title>LoPo - 連携エラー</title></head>
<body>
    <script>
        localStorage.setItem('lopo_link_error', ${JSON.stringify(errorCode)});
        var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
        localStorage.removeItem('lopo_auth_return_url');
        try {
            var u = new URL(returnUrl, window.location.origin);
            if (u.origin !== window.location.origin) returnUrl = '/';
        } catch(e) { returnUrl = '/'; }
        window.location.href = returnUrl;
    </script>
    <p>連携エラー... リダイレクトしています</p>
</body>
</html>
    `);
}

/**
 * 現在の uid に対して指定 provider の OAuth callback uid を紐付ける。
 * - 自己リンク (同一 provider 同一 ID) → 'cannot_link_self' エラー
 * - 既に他人に紐付け済 → 'already_linked_to_another' エラー
 * - OK なら account_links/{provider}:{externalId} ドキュメントを作成
 *
 * 成功時は null、 エラー時は errorCode を返す。
 */
export async function writeAccountLink(
    candidateUid: string,
    linkPrimaryUid: string,
): Promise<string | null> {
    if (candidateUid === linkPrimaryUid) return 'cannot_link_self';

    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const linkRef = getFirestore().doc(`account_links/${candidateUid}`);
    const existing = await linkRef.get();
    if (existing.exists && existing.data()!.primaryUid !== linkPrimaryUid) {
        return 'already_linked_to_another';
    }
    await linkRef.set({
        primaryUid: linkPrimaryUid,
        linkedAt: FieldValue.serverTimestamp(),
    });
    return null;
}

/**
 * 通常ログイン時の lookup。
 * `account_links/{candidateUid}` が存在すればその primaryUid を返す。
 * なければ candidateUid をそのまま返す。
 */
export async function resolveFinalUid(candidateUid: string): Promise<string> {
    const { getFirestore } = await import('firebase-admin/firestore');
    const linkDoc = await getFirestore().doc(`account_links/${candidateUid}`).get();
    return linkDoc.exists ? linkDoc.data()!.primaryUid : candidateUid;
}

/**
 * cookie 値 (`link:<primaryUid>:<stateParam>` または `<stateParam>`) を分解。
 * primaryUid 自体に ':' を含む (例: 'discord:D1') ため、 最後の要素を stateParam として扱う。
 */
export function parseStateCookie(savedState: string | undefined): {
    expectedState: string;
    linkPrimaryUid: string | null;
} {
    if (savedState?.startsWith('link:')) {
        const parts = savedState.split(':');
        return {
            expectedState: parts[parts.length - 1],
            linkPrimaryUid: parts.slice(1, -1).join(':'),
        };
    }
    return { expectedState: savedState || '', linkPrimaryUid: null };
}
