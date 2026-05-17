// src/lib/accountLinks.ts
//
// アカウント連携 (Discord / Twitter) のクライアント API ラッパー。
//
// UI 層からは「連携状態取得 / 連携解除 / 連携開始」の 3 関数を呼ぶだけで済むようにする。
// 内部では既存の apiFetch (App Check トークン + Firebase ID Token を自動付与する fetch ラッパー)
// を経由するため、トークン取得ロジックを各呼び出し元で重複させない。
//
// Phase B-2 (Account Link) — 設計書: docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md §6
import { auth } from './firebase';
import { apiFetch } from './apiClient';

export type LinkProvider = 'discord' | 'twitter';

export interface LinkedProviders {
    discord: boolean;
    twitter: boolean;
}

/**
 * 現在ログイン中ユーザーの連携状態を取得する。
 *
 * @throws ログインしていない場合
 * @throws API 呼び出しが失敗した場合 (status / body をメッセージに含める)
 */
export async function getLinkedProviders(): Promise<LinkedProviders> {
    if (!auth.currentUser) {
        throw new Error('Not logged in');
    }

    // cache: 'no-store' で ETag/304 を回避 (連携直後に古い未連携状態が表示されないように)。
    // サーバー側も Cache-Control: no-store を返すが、 既にブラウザに残っているキャッシュを使わせないため二重に指定。
    const res = await apiFetch('/api/auth/links', { method: 'GET', cache: 'no-store' });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`getLinkedProviders failed: ${res.status} ${body}`);
    }
    return res.json();
}

/**
 * 指定プロバイダとの連携を解除する。
 *
 * @throws ログインしていない場合
 * @throws API 呼び出しが失敗した場合 (status / body をメッセージに含める)
 */
export async function unlinkAccount(provider: LinkProvider): Promise<void> {
    if (!auth.currentUser) {
        throw new Error('Not logged in');
    }

    const res = await apiFetch('/api/auth/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`unlinkAccount failed: ${res.status} ${body}`);
    }
}

/**
 * mode=link で OAuth フローを開始する。
 *
 * サーバから返ってきた認可 URL に window.location で遷移するため、 関数自体は
 * 通常 resolve しない (画面遷移してしまう)。 遷移前に現在のパスを localStorage に
 * 保存し、 コールバック後に元のページへ戻れるようにする。
 *
 * @throws ログインしていない場合
 * @throws API 呼び出しが失敗した場合 (status をメッセージに含める)
 */
export async function startLinkFlow(provider: LinkProvider): Promise<void> {
    if (!auth.currentUser) {
        throw new Error('Not logged in');
    }

    // 連携完了後に戻るページを記録 (既存 OAuth フローと同じキーを再利用)。
    // 連携は同一画面内のアクション扱いなので pathname のみ保存する。
    localStorage.setItem('lopo_auth_return_url', window.location.pathname);

    const res = await apiFetch(`/api/auth?provider=${provider}&mode=link`, {
        method: 'POST',
    });

    if (!res.ok) {
        throw new Error(`startLinkFlow failed: ${res.status}`);
    }
    const { url } = (await res.json()) as { url?: string };
    if (!url) {
        throw new Error('startLinkFlow failed: no url in response');
    }
    window.location.href = url;
}
