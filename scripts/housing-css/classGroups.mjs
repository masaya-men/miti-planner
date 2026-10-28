// 「同じ要素に一緒に付く class」の判定。 規則の対象 class が違っても同じ要素に効くなら並び順で勝ち負けが決まるので、
// 順番頼りの検出(findOrderPairs の第 2 引数)でこの組を同じ対象とみなす。
// 仲間 = JSX の 1 つの className に直接並んで書かれた class 同士 / X と X--修飾(BEM)。
// 連鎖ではつながない(共通の土台 class を介して別々の要素まで仲間になるのを防ぐ)。
const CLASSNAME_RE = /className=(?:"([^"]*)"|'([^']*)'|\{`([\s\S]*?)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g;
const CLASS_RE = /\bhousing(?:er)?-[\w-]+/g;

const bemBase = (c) => c.replace(/--[\w-]*$/, '');

/** (a, b) => 同じ要素に付きうるか */
export function classGroups(jsxTexts) {
  const pairs = new Set();
  for (const text of jsxTexts) {
    for (const m of text.matchAll(CLASSNAME_RE)) {
      const value = m.slice(1).find((v) => v !== undefined) ?? '';
      const classes = [...new Set(value.match(CLASS_RE) || [])];
      for (const a of classes) for (const b of classes) if (a < b) pairs.add(`${a} ${b}`);
    }
  }
  return (a, b) => {
    if (a === b || bemBase(a) === bemBase(b)) return true;
    return pairs.has(a < b ? `${a} ${b}` : `${b} ${a}`);
  };
}
