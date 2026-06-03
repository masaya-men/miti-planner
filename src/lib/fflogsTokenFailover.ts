/**
 * FFLogs OAuth トークン取得のフェイルオーバーロジック (純粋関数)。
 *
 * 複数の API キー (client_credentials) を startIndex から順に試し、最初に成功した
 * キーのトークンを返す。1 本が失効/レート制限/一時障害でも、残りの正常なキーで
 * トークンを取得できる (= ラウンドロビンの「冗長化」を実際に機能させる)。
 *
 * fetch を注入可能にしてユニットテストできるようにしている。
 */

export interface FFLogsCredentialPair {
    clientId: string;
    clientSecret: string;
}

export interface FFLogsTokenResult {
    access_token: string;
    expires_in: number;
}

/** テスト容易性のための最小 fetch 型。 */
type FetchLike = (
    url: string,
    init: { method: string; headers: Record<string, string>; body: URLSearchParams },
) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<any>;
    text: () => Promise<string>;
}>;

/**
 * pairs を startIndex から順に試し、最初に成功したキーのトークンを返す。
 * 全キー失敗時は null。失敗キーは onKeyFailure(index, status, body) で通知する
 * (status は例外時 null)。呼び出し側でログ出力に使う。
 */
export async function fetchTokenWithFailover(
    pairs: FFLogsCredentialPair[],
    startIndex: number,
    fetchFn: FetchLike = fetch as unknown as FetchLike,
    onKeyFailure?: (index: number, status: number | null, body: string) => void,
): Promise<{ token: FFLogsTokenResult; usedIndex: number } | null> {
    const n = pairs.length;
    if (n === 0) return null;

    for (let i = 0; i < n; i++) {
        const idx = ((startIndex % n) + i) % n;
        const p = pairs[idx];
        try {
            const r = await fetchFn('https://www.fflogs.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: p.clientId,
                    client_secret: p.clientSecret,
                }),
            });

            if (!r.ok) {
                onKeyFailure?.(idx, r.status, await r.text());
                continue;
            }

            const data = await r.json();
            return {
                token: { access_token: data.access_token, expires_in: data.expires_in },
                usedIndex: idx,
            };
        } catch (e) {
            onKeyFailure?.(idx, null, e instanceof Error ? e.message : String(e));
            continue;
        }
    }

    return null;
}
