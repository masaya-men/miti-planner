/**
 * OGP画像生成で使う M PLUS 1 フォントの読み込み（Edge Runtime専用）
 *
 * api/og/index.ts (共有プランOGP) と api/og/_housingerCard.ts (ハウジンガーカードOGP) の
 * 両方から使う共通ロジック。Google Fonts CSS2 API から使用文字だけを含むサブセットを
 * 取得することで、フォントファイルの転送量を最小化する（satori はフォントの部分読み込みに
 * 対応していないため、事前に文字を絞ったサブセットを渡す必要がある）。
 */

export interface LoadedFont {
    name: string;
    data: ArrayBuffer;
    style: 'normal';
    weight: 400 | 700 | 900;
}

/**
 * 使用文字 (uniqueChars) を元に M PLUS 1 の 400/700/900 ウェイトを取得する。
 * Google Fonts 側のレスポンス都合でウェイトが揃わない場合は取得できた分だけ返す
 * (0件なら空配列 = satori はデフォルトフォントにフォールバックする)。
 */
export async function loadMPlus1Fonts(uniqueChars: string): Promise<LoadedFont[]> {
    const fontCssUrl = `https://fonts.googleapis.com/css2?family=M+PLUS+1:wght@400;700;900&text=${encodeURIComponent(uniqueChars)}`;
    const fontCss = await fetch(fontCssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
    }).then((r) => r.text());

    const fontUrls = [...fontCss.matchAll(/src:\s*url\(([^)]+)\)/g)].map((m) => m[1]);
    const fontBuffers = await Promise.all(
        fontUrls.map((url) => fetch(url).then((r) => r.arrayBuffer())),
    );

    const fonts: LoadedFont[] = [];
    if (fontBuffers.length >= 3) {
        fonts.push({ name: 'M PLUS 1', data: fontBuffers[0], style: 'normal', weight: 400 });
        fonts.push({ name: 'M PLUS 1', data: fontBuffers[1], style: 'normal', weight: 700 });
        fonts.push({ name: 'M PLUS 1', data: fontBuffers[2], style: 'normal', weight: 900 });
    } else if (fontBuffers.length >= 1) {
        fonts.push({ name: 'M PLUS 1', data: fontBuffers[0], style: 'normal', weight: 700 });
    }
    return fonts;
}
