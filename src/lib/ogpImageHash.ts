/**
 * OGP画像の内容ハッシュ計算（サーバー専用）
 *
 * 同じ内容のOGP画像は同じhashとなり、Firebase Storage で重複排除される。
 * 内容が変わると別hashになるため、キャッシュは自然に無効化される。
 *
 * 注意: このファイルは node:crypto に依存するためクライアントから import しないこと。
 * クライアント側では共通の hash を先回り計算せず、サーバーが POST/PUT レスポンスで返す値を使う。
 */

import { createHash } from 'crypto';
import type { OgpLang } from './ogpHelpers.js';

export interface ImageHashInput {
    contentName: string;
    planTitle: string;
    showTitle: boolean;
    showLogo: boolean;
    logoHash: string | null;
    lang: OgpLang;
}

export function computeImageHash(input: ImageHashInput): string {
    const normalized: ImageHashInput = {
        contentName: input.contentName || '',
        planTitle: input.planTitle || '',
        showTitle: !!input.showTitle,
        showLogo: !!input.showLogo,
        logoHash: input.logoHash || null,
        lang: input.lang,
    };
    const serialized = JSON.stringify(normalized);
    return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}
