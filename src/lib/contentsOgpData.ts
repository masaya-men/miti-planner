/**
 * OGP 用コンテンツメタデータ — contents.json から自動生成。
 *
 * **なぜ JSON import ではなく .ts ファイルか？**
 * Vercel の Node Functions バンドラー (@vercel/ncc) が `src/data/contents.json` への
 * 相対 JSON import を正しくバンドルできず、本番で FUNCTION_INVOCATION_FAILED を起こす。
 * Edge Functions (`api/og`) では問題ないが、Node Functions (`api/share`) で壊れるため、
 * JSON import を排除し、TypeScript 定数としてデータを保持する。
 *
 * **更新方法**: `contents.json` にコンテンツを追加した際は、
 * `node scripts/generate-ogp-data.mjs` を実行してこのファイルを再生成する。
 * または手動で該当エントリを追加する。
 *
 * @generated — このファイルはスクリプトで生成される。直接編集せず、生成スクリプトを実行すること。
 */

export interface OgpContentMeta {
    ja: string;
    en: string;
    category: string;
    level: number;
}

/**
 * コンテンツID→OGPメタデータのマップ。
 * ja / en / category / level が全て揃ったエントリのみ。
 */
export const CONTENTS_OGP_DATA: Record<string, OgpContentMeta> = {
    m9s: { ja: '至天の座アルカディア零式：ヘビー級1', en: 'AAC Heavyweight M1 (Savage)', category: 'savage', level: 100 },
    m10s: { ja: '至天の座アルカディア零式：ヘビー級2', en: 'AAC Heavyweight M2 (Savage)', category: 'savage', level: 100 },
    m11s: { ja: '至天の座アルカディア零式：ヘビー級3', en: 'AAC Heavyweight M3 (Savage)', category: 'savage', level: 100 },
    m12s_p1: { ja: '至天の座アルカディア零式：ヘビー級4（前半）', en: 'AAC Heavyweight M4 (Savage) Phase 1', category: 'savage', level: 100 },
    m12s_p2: { ja: '至天の座アルカディア零式：ヘビー級4（後半）', en: 'AAC Heavyweight M4 (Savage) Phase 2', category: 'savage', level: 100 },
    m5s: { ja: '至天の座アルカディア零式：クルーザー級1', en: 'AAC Cruiserweight M1 (Savage)', category: 'savage', level: 100 },
    m6s: { ja: '至天の座アルカディア零式：クルーザー級2', en: 'AAC Cruiserweight M2 (Savage)', category: 'savage', level: 100 },
    m7s: { ja: '至天の座アルカディア零式：クルーザー級3', en: 'AAC Cruiserweight M3 (Savage)', category: 'savage', level: 100 },
    m8s: { ja: '至天の座アルカディア零式：クルーザー級4', en: 'AAC Cruiserweight M4 (Savage)', category: 'savage', level: 100 },
    m1s: { ja: '至天の座アルカディア零式：ライトヘビー級1', en: 'AAC Light-heavyweight M1 (Savage)', category: 'savage', level: 100 },
    m2s: { ja: '至天の座アルカディア零式：ライトヘビー級2', en: 'AAC Light-heavyweight M2 (Savage)', category: 'savage', level: 100 },
    m3s: { ja: '至天の座アルカディア零式：ライトヘビー級3', en: 'AAC Light-heavyweight M3 (Savage)', category: 'savage', level: 100 },
    m4s: { ja: '至天の座アルカディア零式：ライトヘビー級4', en: 'AAC Light-heavyweight M4 (Savage)', category: 'savage', level: 100 },
    fru: { ja: '絶もうひとつの未来', en: 'Futures Rewritten (Ultimate)', category: 'ultimate', level: 100 },
    dmu: { ja: '絶妖星乱舞', en: 'Dancing Mad (Ultimate)', category: 'ultimate', level: 100 },
    p9s: { ja: '万魔殿パンデモニウム零式：天獄編1', en: 'Anabaseios: The Ninth Circle (Savage)', category: 'savage', level: 90 },
    p10s: { ja: '万魔殿パンデモニウム零式：天獄編2', en: 'Anabaseios: The Tenth Circle (Savage)', category: 'savage', level: 90 },
    p11s: { ja: '万魔殿パンデモニウム零式：天獄編3', en: 'Anabaseios: The Eleventh Circle (Savage)', category: 'savage', level: 90 },
    p12s_p1: { ja: '万魔殿パンデモニウム零式：天獄編4（前半）', en: 'Anabaseios: The Twelfth Circle (Savage) Phase 1', category: 'savage', level: 90 },
    p12s_p2: { ja: '万魔殿パンデモニウム零式：天獄編4（後半）', en: 'Anabaseios: The Twelfth Circle (Savage) Phase 2', category: 'savage', level: 90 },
    top: { ja: '絶オメガ検証戦', en: 'The Omega Protocol (Ultimate)', category: 'ultimate', level: 90 },
    p5s: { ja: '万魔殿パンデモニウム零式：煉獄編1', en: 'Abyssos: The Fifth Circle (Savage)', category: 'savage', level: 90 },
    p6s: { ja: '万魔殿パンデモニウム零式：煉獄編2', en: 'Abyssos: The Sixth Circle (Savage)', category: 'savage', level: 90 },
    p7s: { ja: '万魔殿パンデモニウム零式：煉獄編3', en: 'Abyssos: The Seventh Circle (Savage)', category: 'savage', level: 90 },
    p8s_p1: { ja: '万魔殿パンデモニウム零式：煉獄編4（前半）', en: 'Abyssos: The Eighth Circle (Savage) Phase 1', category: 'savage', level: 90 },
    p8s_p2: { ja: '万魔殿パンデモニウム零式：煉獄編4（後半）', en: 'Abyssos: The Eighth Circle (Savage) Phase 2', category: 'savage', level: 90 },
    dsr_p1: { ja: '絶竜詩戦争P1', en: "Dragonsong's Reprise P1", category: 'ultimate', level: 90 },
    dsr: { ja: '絶竜詩戦争', en: "Dragonsong's Reprise (Ultimate)", category: 'ultimate', level: 90 },
    p1s: { ja: '万魔殿パンデモニウム零式：辺獄編1', en: 'Asphodelos: The First Circle (Savage)', category: 'savage', level: 90 },
    p2s: { ja: '万魔殿パンデモニウム零式：辺獄編2', en: 'Asphodelos: The Second Circle (Savage)', category: 'savage', level: 90 },
    p3s: { ja: '万魔殿パンデモニウム零式：辺獄編3', en: 'Asphodelos: The Third Circle (Savage)', category: 'savage', level: 90 },
    p4s_p1: { ja: '万魔殿パンデモニウム零式：辺獄編4（前半）', en: 'Asphodelos: The Fourth Circle (Savage) Phase 1', category: 'savage', level: 90 },
    p4s_p2: { ja: '万魔殿パンデモニウム零式：辺獄編4（後半）', en: 'Asphodelos: The Fourth Circle (Savage) Phase 2', category: 'savage', level: 90 },
    e9s: { ja: '希望の園エデン零式：再生編1', en: "Eden's Promise: Umbra (Savage)", category: 'savage', level: 80 },
    e10s: { ja: '希望の園エデン零式：再生編2', en: "Eden's Promise: Litany (Savage)", category: 'savage', level: 80 },
    e11s: { ja: '希望の園エデン零式：再生編3', en: "Eden's Promise: Anamorphosis (Savage)", category: 'savage', level: 80 },
    e12s_p1: { ja: '希望の園エデン零式：再生編4（前半）', en: "Eden's Promise: Eternity (Savage) Phase 1", category: 'savage', level: 80 },
    e12s_p2: { ja: '希望の園エデン零式：再生編4（後半）', en: "Eden's Promise: Eternity (Savage) Phase 2", category: 'savage', level: 80 },
    e5s: { ja: '希望の園エデン零式：共鳴編1', en: "Eden's Verse: Fulmination (Savage)", category: 'savage', level: 80 },
    e6s: { ja: '希望の園エデン零式：共鳴編2', en: "Eden's Verse: Furor (Savage)", category: 'savage', level: 80 },
    e7s: { ja: '希望の園エデン零式：共鳴編3', en: "Eden's Verse: Iconoclasm (Savage)", category: 'savage', level: 80 },
    e8s: { ja: '希望の園エデン零式：共鳴編4', en: "Eden's Verse: Refulgence (Savage)", category: 'savage', level: 80 },
    tea: { ja: '絶アレキサンダー討滅戦', en: 'The Epic of Alexander (Ultimate)', category: 'ultimate', level: 80 },
    e1s: { ja: '希望の園エデン零式：覚醒編1', en: "Eden's Gate: Resurrection (Savage)", category: 'savage', level: 80 },
    e2s: { ja: '希望の園エデン零式：覚醒編2', en: "Eden's Gate: Descent (Savage)", category: 'savage', level: 80 },
    e3s: { ja: '希望の園エデン零式：覚醒編3', en: "Eden's Gate: Inundation (Savage)", category: 'savage', level: 80 },
    e4s: { ja: '希望の園エデン零式：覚醒編4', en: "Eden's Gate: Sepulture (Savage)", category: 'savage', level: 80 },
    o9s: { ja: '次元狭間オメガ零式：アルファ編1', en: 'Omega: Alphascape V1.0 (Savage)', category: 'savage', level: 70 },
    o10s: { ja: '次元狭間オメガ零式：アルファ編2', en: 'Omega: Alphascape V2.0 (Savage)', category: 'savage', level: 70 },
    o11s: { ja: '次元狭間オメガ零式：アルファ編3', en: 'Omega: Alphascape V3.0 (Savage)', category: 'savage', level: 70 },
    o12s_p1: { ja: '次元狭間オメガ零式：アルファ編4（前半）', en: 'Omega: Alphascape V4.0 (Savage) Phase 1', category: 'savage', level: 70 },
    o12s_p2: { ja: '次元狭間オメガ零式：アルファ編4（後半）', en: 'Omega: Alphascape V4.0 (Savage) Phase 2', category: 'savage', level: 70 },
    uwu: { ja: '絶アルテマウェポン破壊作戦', en: "The Weapon's Refrain (Ultimate)", category: 'ultimate', level: 70 },
    o5s: { ja: '次元狭間オメガ零式：シグマ編1', en: 'Omega: Sigmascape V1.0 (Savage)', category: 'savage', level: 70 },
    o6s: { ja: '次元狭間オメガ零式：シグマ編2', en: 'Omega: Sigmascape V2.0 (Savage)', category: 'savage', level: 70 },
    o7s: { ja: '次元狭間オメガ零式：シグマ編3', en: 'Omega: Sigmascape V3.0 (Savage)', category: 'savage', level: 70 },
    o8s_p1: { ja: '次元狭間オメガ零式：シグマ編4（前半）', en: 'Omega: Sigmascape V4.0 (Savage) Phase 1', category: 'savage', level: 70 },
    o8s_p2: { ja: '次元狭間オメガ零式：シグマ編4（後半）', en: 'Omega: Sigmascape V4.0 (Savage) Phase 2', category: 'savage', level: 70 },
    ucob: { ja: '絶バハムート討滅戦', en: 'The Unending Coil of Bahamut (Ultimate)', category: 'ultimate', level: 70 },
    o1s: { ja: '次元狭間オメガ零式：デルタ編1', en: 'Omega: Deltascape V1.0 (Savage)', category: 'savage', level: 70 },
    o2s: { ja: '次元狭間オメガ零式：デルタ編2', en: 'Omega: Deltascape V2.0 (Savage)', category: 'savage', level: 70 },
    o3s: { ja: '次元狭間オメガ零式：デルタ編3', en: 'Omega: Deltascape V3.0 (Savage)', category: 'savage', level: 70 },
    o4s_p1: { ja: '次元狭間オメガ零式：デルタ編4（前半）', en: 'Omega: Deltascape V4.0 (Savage) Phase 1', category: 'savage', level: 70 },
    o4s_p2: { ja: '次元狭間オメガ零式：デルタ編4（後半）', en: 'Omega: Deltascape V4.0 (Savage) Phase 2', category: 'savage', level: 70 },
};
