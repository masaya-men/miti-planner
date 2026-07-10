import { parseHousingFromText, type HousingExtractResult } from './parseHousingFromText';

// ページから取得したテキスト群 (og:title / og:description / 本文)
export interface HousingPageTexts {
    title?: string | null;
    description?: string | null;
    bodyText?: string | null;
}

// 候補生成の打ち切り上限。 本文が非常に長い場合の暴走を防ぐ (超過分は黙って切る)。
const MAX_CANDIDATES = 400;

// 空の抽出結果 (住所なし)
function emptyResult(): HousingExtractResult {
    return {
        dc: undefined,
        server: undefined,
        area: undefined,
        ward: undefined,
        plot: undefined,
        size: undefined,
        roomNumber: undefined,
        parentHouseSize: undefined,
        ambiguity: [],
    };
}

/**
 * ページ由来の複数テキストから住所候補を列挙する。
 *   - title / description / bodyText 全体 / bodyText の各行 / 隣接 2 行窓 / 隣接 3 行窓
 *   - 空白のみの行は除外
 *   - 総数 MAX_CANDIDATES で打ち切り
 */
function buildCandidates(page: HousingPageTexts): string[] {
    const out: string[] = [];
    const add = (s: string | null | undefined) => {
        if (out.length >= MAX_CANDIDATES) return;
        if (!s) return;
        const t = s.trim();
        if (!t) return;
        out.push(t);
    };

    add(page.title);
    add(page.description);
    add(page.bodyText);

    const lines = (page.bodyText ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    for (const line of lines) add(line);
    for (let i = 0; i + 1 < lines.length; i++) add(`${lines[i]}\n${lines[i + 1]}`);
    for (let i = 0; i + 2 < lines.length; i++) add(`${lines[i]}\n${lines[i + 1]}\n${lines[i + 2]}`);

    return out.slice(0, MAX_CANDIDATES);
}

// 区切り記号 (| ┆ /) の出現数。 2 個以上なら「住所らしさ」 の加点材料にする。
function separatorCount(text: string): number {
    const m = text.match(/[|┆\/]/g);
    return m ? m.length : 0;
}

/**
 * 1 候補を parseHousingFromText に掛けて「住所らしさ」を採点する。
 *   - ward と plot が両方揃う: +4
 *   - server が取れた: +3 / dc が取れた: +1 (両方なら +4)
 *   - area が取れた: +2
 *   - size が取れた: +1
 *   - roomNumber が取れた: +1
 *   - ambiguity が非空: -5
 *   - 区切り記号 (| ┆ /) が 2 個以上: +1
 */
export function scoreHousingCandidate(candidate: string): {
    score: number;
    result: HousingExtractResult;
} {
    const result = parseHousingFromText(candidate);
    let score = 0;
    if (result.ward !== undefined && result.plot !== undefined) score += 4;
    if (result.server !== undefined) score += 3;
    if (result.dc !== undefined) score += 1;
    if (result.area !== undefined) score += 2;
    if (result.size !== undefined) score += 1;
    if (result.roomNumber !== undefined) score += 1;
    if (result.ambiguity.length > 0) score -= 5;
    if (separatorCount(candidate) >= 2) score += 1;
    return { score, result };
}

/**
 * ページ内の複数テキストから「最も住所らしい」候補を選び、 その解析結果を返す。
 * 何も取れなければ全フィールド undefined (+ ambiguity: [])。
 *
 * 同点の場合は「短い候補」 (=より具体的) を優先する。
 * 最高得点が 1 未満なら住所なしとみなす。
 */
export function extractHousingAddressFromPage(page: HousingPageTexts): HousingExtractResult {
    const candidates = buildCandidates(page);

    let best: { score: number; length: number; result: HousingExtractResult } | null = null;
    for (const candidate of candidates) {
        const { score, result } = scoreHousingCandidate(candidate);
        if (
            best === null ||
            score > best.score ||
            (score === best.score && candidate.length < best.length)
        ) {
            best = { score, length: candidate.length, result };
        }
    }

    if (best === null || best.score < 1) {
        return emptyResult();
    }
    return best.result;
}
