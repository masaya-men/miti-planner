import { parseTweetUrl } from './tweetUrlParse';
import { parseYoutubeUrl, buildYoutubeThumbnailUrl } from './youtubeUrl';
import { isOgpUrlAllowed } from './ogpHostAllowlist';

/**
 * SNS URL の種別ルーティング (判定のみの純関数)。
 *
 * 元は登録フォーム `HousingRegisterSnsUrlField.handleChange` にインラインで
 * 実装されていた判定順 (YouTube → Twitter → OGP allowlist → invalid) を、
 * 一時ツアーの追加パネル (`EphemeralAddPanel`) と共用するために切り出した
 * (計画: 住所登録なし一時ツアー Task3。fork せずヘルパー共用)。
 *
 * 判定順は登録フォームの従来挙動と同一:
 * 1. 空 → 'empty'
 * 2. YouTube (Twitter の syndication API が走る前に確定)
 * 3. Twitter (x.com / twitter.com の status URL)
 * 4. OGP allowlist (housingsnap 等、`isOgpUrlAllowed`)
 * 5. どれにも該当しない → 'invalid'
 */
export type SnsUrlRoute =
    | { kind: 'empty' }
    | { kind: 'youtube'; videoId: string; postUrl: string; ogImageUrl: string }
    | { kind: 'tweet'; tweetId: string; postUrl: string }
    | { kind: 'ogp'; postUrl: string }
    | { kind: 'invalid' };

export function classifySnsUrl(value: string): SnsUrlRoute {
    const trimmed = value.trim();
    if (!trimmed) return { kind: 'empty' };

    const videoId = parseYoutubeUrl(value);
    if (videoId) {
        return {
            kind: 'youtube',
            videoId,
            postUrl: trimmed,
            ogImageUrl: buildYoutubeThumbnailUrl(videoId),
        };
    }

    const tweetId = parseTweetUrl(value);
    if (tweetId) return { kind: 'tweet', tweetId, postUrl: trimmed };

    if (isOgpUrlAllowed(trimmed)) return { kind: 'ogp', postUrl: trimmed };

    return { kind: 'invalid' };
}
