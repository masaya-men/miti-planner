// ─── ファジーマッチ: 2つの文字列の類似度（0〜1）を計算 ───
export function similarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    // 正規化: 長音(ー)除去、全角半角統一、小書き文字統一
    const normalize = (s) => s
        .replace(/ー/g, '')
        .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
        .toLowerCase();
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1;

    // 共通文字数 / 長い方の文字数
    const setA = new Set(na), setB = new Set(nb);
    let common = 0;
    for (const c of setA) { if (setB.has(c)) common++; }
    const charRatio = common / Math.max(setA.size, setB.size);

    // 連続部分文字列の一致も考慮
    let longestMatch = 0;
    for (let i = 0; i < na.length; i++) {
        for (let len = 2; len <= na.length - i; len++) {
            if (nb.includes(na.slice(i, i + len))) {
                longestMatch = Math.max(longestMatch, len);
            }
        }
    }
    const substringRatio = longestMatch / Math.max(na.length, nb.length);

    return Math.max(charRatio * 0.4 + substringRatio * 0.6, substringRatio);
}
