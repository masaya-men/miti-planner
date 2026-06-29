// メモ本文を「URL」と「ただの文字」のセグメントに分解する純関数(React非依存・テスト容易)。
// http(s):// のみを URL とみなし、末尾の区切り記号はリンクから外す。new URL で protocol を再検証する。
export type MemoSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string };

// URL 末尾に付きがちな区切り記号(半角/全角の閉じ括弧・句読点など)。リンクには含めない。
const TRAILING_PUNCT = /[)\]）【」』。、，,.!！?？；;：:＞>]+$/;
// http(s):// で始まり空白までの連続。空白・全角文字は URL 文字でないので自然にそこで切れる。
const URL_CANDIDATE = /https?:\/\/[^\s]+/g;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseMemoLinks(text: string): MemoSegment[] {
  const segments: MemoSegment[] = [];
  // 連続する text は結合する(描画が素直・テストが安定)。
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') last.value += value;
    else segments.push({ type: 'text', value });
  };

  let lastIndex = 0;
  for (const match of text.matchAll(URL_CANDIDATE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const url = raw.replace(TRAILING_PUNCT, ''); // 末尾記号を剥がす
    const trailing = raw.slice(url.length);       // 剥がした記号は後続テキストへ

    if (start > lastIndex) pushText(text.slice(lastIndex, start));
    if (url && isHttpUrl(url)) {
      segments.push({ type: 'url', value: url });
      pushText(trailing);
    } else {
      pushText(raw); // http(s) として無効 → まるごと文字
    }
    lastIndex = start + raw.length;
  }
  pushText(text.slice(lastIndex));
  return segments;
}
