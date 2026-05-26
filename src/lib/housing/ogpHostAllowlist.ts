/**
 * OGP fetch 対象の host allowlist (2026-05-27 新設、 B: OGP 汎用拡張)。
 *
 * SSRF 防御のため、 server が任意の URL を fetch しないよう **完全一致 allowlist** で制限。
 * 増やすときはこの配列を編集 + テスト追加。
 *
 * 採用基準: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md の
 *   「主要参考」 リストから、 物件単体ページが OGP を返すサイトのみ。
 * Housing Eden (ff14eden.work) は物件単体ページが無く除外。
 * 個人ページのみのため、 物件 1 件単位の og:image が出ない。
 */

const ALLOWED_OGP_HOSTS: readonly string[] = [
    'housingsnap.com',
    'housing-collection-ff14.com',
    'studio-xiv.com',
    'thonhart.com',
] as const;

/**
 * url が SSRF 安全かつ allowlist 内の host かを判定する。
 * - https のみ
 * - hostname が ALLOWED_OGP_HOSTS のいずれかに**完全一致** (= サブドメインも拒否)
 * - private IP リテラル (RFC1918 / loopback / link-local / metadata) は明示拒否
 *   (allowlist 完全一致で実質防げるが業界水準で多重防御)
 */
export function isOgpUrlAllowed(url: string): boolean {
    if (typeof url !== 'string' || url.length === 0) return false;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') return false;
    if (!ALLOWED_OGP_HOSTS.includes(parsed.hostname)) return false;
    // hostname が IP アドレスリテラルになっているケースを念のため拒否
    // (allowlist で完全一致しているので通常ここには来ないが多重防御)
    if (isPrivateOrSpecialIp(parsed.hostname)) return false;
    return true;
}

/** 配列のスナップショットを返す (test / UI 用)。 */
export function getOgpAllowlist(): readonly string[] {
    return ALLOWED_OGP_HOSTS;
}

/**
 * private / loopback / link-local / metadata の IP リテラルを判定する純関数。
 * IPv4 のみ (LoPo の allowlist は全部 FQDN なので IPv6 リテラル経路は実質発生しない)。
 */
function isPrivateOrSpecialIp(hostname: string): boolean {
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) return false;
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + AWS metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
}
