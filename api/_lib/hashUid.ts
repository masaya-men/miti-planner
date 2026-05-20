import { createHmac } from 'node:crypto';

/**
 * Discord ID を pseudonymous な Firebase uid に変換する。
 *
 * 元の Discord ID は LoPo 内部でも復元できない (one-way hash + server-side secret)。
 * secret が失われると過去全データの参照が永遠に不能になるので、 必ず多重バックアップすること。
 *
 * 設計書: docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md §2.1
 *
 * @param discordId - Discord OAuth から取得した数値 ID (17〜19 桁の数字文字列)
 * @param secret - LOPO_PSEUDONYM_SECRET 環境変数の値 (64 文字 hex を推奨。 最低 32 文字)
 * @returns `hashed:` プレフィックス + HMAC-SHA256 hex (64 文字)
 */
export function hashUid(discordId: string, secret: string): string {
    if (!secret || secret.length < 32) {
        throw new Error('LOPO_PSEUDONYM_SECRET が未設定または短すぎます (32 文字以上の hex を期待)');
    }
    return 'hashed:' + createHmac('sha256', secret).update(discordId).digest('hex');
}
