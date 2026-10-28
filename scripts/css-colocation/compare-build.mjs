// ビルド後の CSS を基準と比べる道具。 規則の欠け・重複と、 「順番頼りの組」の前後の入れ替わりを見る。
// 起動時の CSS(index.html が読む)と後読みの CSS(遅延読み込みの部品と一緒に読む)の両方を比べ、 起動時 ↔ 後読みの移動も一覧にする。
// 使い方: node scripts/css-colocation/compare-build.mjs --save-as=<名前>   (今の作業ツリーをビルドして基準に保存)
//         node scripts/css-colocation/compare-build.mjs --compare=<名前>   (今をビルドして基準と比べる・差があれば exit 1)
// minify なしでビルドする(minify の宣言統合で判定がぶれないため)。 約 15 秒。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform } from 'lightningcss';
import { findOrderPairs, parseRules } from './cssRules.mjs';
import { classGroups } from './classGroups.mjs';
import { listTsx } from './srcFiles.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '.out');
// 順番頼りを探す対象の class(ハウジングと MIL-SPEC。 道具の対象を足したらここにも足す)
const ALL_PREFIX = /^(housing(?:er)?|milspec)-/;

// Tailwind の後処理(Lightning CSS)は @import 等を含むファイル(index.css とその @import 先)だけに掛かり、 部品の隣の CSS は素通りする。
// 移すと書き方だけ変わる(0.3s → .3s)ので、 両側を対象ブラウザ指定なしの minify でそろえて比べる。 対象ブラウザ由来の書き換え・削除は差として残る
const minified = new Map();
function minify(css) {
  if (!minified.has(css)) {
    let out;
    try {
      out = transform({ filename: 'x.css', code: Buffer.from(css), minify: true }).code.toString();
    } catch {
      out = css.replace(/\s+/g, ' ');
    }
    minified.set(css, out);
  }
  return minified.get(css);
}

/** 規則の同一性 = 条件+セレクタ+宣言(書き方をそろえたもの)+「同じものの何個目か」 */
function identities(rules) {
  const count = new Map();
  return rules.map((r) => {
    const base = r.kind === 'rule' ? `${r.media}|${r.selector}|${minify(`a{${r.decls}}`)}` : `${r.media}|@${r.name} ${r.params}|${minify(r.node.toString())}`;
    const n = count.get(base) ?? 0;
    count.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/** 「A, B { 宣言 }」を同じ位置の「A { 宣言 }」「B { 宣言 }」に開く(移す道具が持ち主ごとに分けても同じものと見るため) */
function perSelector(rules) {
  return rules.flatMap((r) => (r.kind === 'rule' && r.selectors.length > 1 ? r.selectors.map((s) => ({ ...r, selector: s, selectors: [s] })) : [r]));
}

/** 起動時の CSS の後に後読みの CSS をファイル名順に並べ、 各規則に置き場所(eager か後読みのファイル名)を付ける */
function rulesOfBuild(b) {
  const parts = [{ file: '', css: b.eager }, ...[...b.lazy].sort((x, y) => x.file.localeCompare(y.file))];
  return parts.flatMap((p) => perSelector(parseRules(p.css, p.file || 'eager.css')).map((r) => ({ ...r, place: p.file })));
}

/**
 * BuildCss = { eager: string, lazy: Array<{ file, css }> }。
 * 後読み同士の並びは開いた順で実行時に決まるので、 次のビルドで別々の後読みファイルに分かれた組は flipped に入れず lazyCross に数える
 * (部品同士の順番頼りは見張りテストが 0 を保つ)。
 */
export function compareBuilds(base, next, related = (a, b) => a === b, prefixRe = undefined) {
  const baseRules = rulesOfBuild(base);
  const nextRules = rulesOfBuild(next);
  const baseIds = identities(baseRules);
  const nextIds = identities(nextRules);
  const nextPos = new Map(nextIds.map((id, i) => [id, i]));
  const baseSet = new Set(baseIds);
  const missing = baseIds.filter((id) => !nextPos.has(id));
  const extra = nextIds.filter((id) => !baseSet.has(id));
  const idOf = new Map(baseRules.map((r, i) => [r, baseIds[i]]));
  const flipped = [];
  let lazyCross = 0;
  for (const [a, b, prop] of findOrderPairs(baseRules, related, prefixRe)) {
    const pa = nextPos.get(idOf.get(a));
    const pb = nextPos.get(idOf.get(b));
    if (pa === undefined || pb === undefined) continue;
    // 基準でも別々の後読みファイルにあった組は、 元々並びが決まっていない(開いた順)ので守る並びが無い
    if (a.place && b.place && a.place !== b.place) continue;
    const qa = nextRules[pa].place;
    const qb = nextRules[pb].place;
    if (qa && qb && qa !== qb) {
      lazyCross++;
      continue;
    }
    if (pa > pb) flipped.push({ a: `${a.media ? `@media ${a.media} ` : ''}${a.selector}`, b: `${b.media ? `@media ${b.media} ` : ''}${b.selector}`, prop });
  }
  // 起動時 ↔ 後読みの移動(同一性は置き場所を含まないので missing/extra には出ない)。
  // 起動時 → 後読み は「その規則が描く要素が起動時から画面に出るなら、部品が開くまで素の見た目になる」ので要確認
  const nextPlace = new Map(nextIds.map((id, i) => [id, nextRules[i].place]));
  const toLazy = [];
  const toEager = [];
  baseIds.forEach((id, i) => {
    if (!nextPlace.has(id)) return;
    const was = baseRules[i].place;
    const now = nextPlace.get(id);
    if (!was && now) toLazy.push(`${id.replace(/#\d+$/, '')} → ${now}`);
    else if (was && !now) toEager.push(`${id.replace(/#\d+$/, '')} ← ${was}`);
  });
  return { missing, extra, flipped, lazyCross, toLazy, toEager };
}

/** 起動時の CSS 1 本どうしの比較(後読みなし) */
export function compareCss(baseCss, nextCss, related = (a, b) => a === b, prefixRe = undefined) {
  const { missing, extra, flipped } = compareBuilds({ eager: baseCss, lazy: [] }, { eager: nextCss, lazy: [] }, related, prefixRe);
  return { missing, extra, flipped };
}

/** ビルドして { eager, lazy } を返す。 eager = index.html が <link> で読む CSS(並び順に連結)・lazy = 残りの CSS(名前はハッシュを除く) */
async function buildCss() {
  const require = createRequire(path.resolve('package.json'));
  const vitePath = require.resolve('vite');
  const { build } = await import(pathToFileURL(vitePath).href);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-colocation-build-'));
  await build({ configFile: path.resolve('vite.config.ts'), logLevel: 'error', build: { cssMinify: false, outDir, emptyOutDir: true } });
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const linked = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="\/?assets\/([^"]+\.css)"/g)].map((m) => m[1]);
  const assets = path.join(outDir, 'assets');
  const read = (f) => fs.readFileSync(path.join(assets, f), 'utf8');
  const eager = linked.map(read).join('\n');
  const seen = new Map();
  const lazy = fs
    .readdirSync(assets)
    .filter((f) => f.endsWith('.css') && !linked.includes(f))
    .sort()
    .map((f) => {
      const name = f.replace(/-[\w-]{8}\.css$/, '.css');
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      return { file: n ? `${name}#${n}` : name, css: read(f) };
    });
  fs.rmSync(outDir, { recursive: true, force: true });
  if (!eager) throw new Error('index.html に CSS の <link> が見つからない');
  return { eager, lazy };
}

const countRules = (b) => parseRules(b.eager, 'x').length + b.lazy.reduce((n, l) => n + parseRules(l.css, 'x').length, 0);

async function main() {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const saveAs = arg('save-as');
  const compare = arg('compare');
  if (!saveAs && !compare) throw new Error('--save-as=<名前> か --compare=<名前> を付ける');
  const built = await buildCss();
  fs.mkdirSync(OUT, { recursive: true });
  if (saveAs) {
    fs.writeFileSync(path.join(OUT, `${saveAs}.json`), JSON.stringify(built));
    console.log(`基準を保存: ${saveAs} (起動時 ${parseRules(built.eager, 'x').length} 規則・${Buffer.byteLength(built.eager)} バイト / 後読み ${built.lazy.length} 本・全 ${countRules(built)} 規則)`);
    return;
  }
  const base = JSON.parse(fs.readFileSync(path.join(OUT, `${compare}.json`), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'last.json'), JSON.stringify(built));
  // 同じ要素に一緒に付く class を仲間として順番頼りを探す(JSX の className から)
  const related = classGroups(listTsx('src').map((f) => fs.readFileSync(f, 'utf8')), ALL_PREFIX);
  const r = compareBuilds(base, built, related, ALL_PREFIX);
  console.log(`欠け ${r.missing.length} / 重複 ${r.extra.length} / 順番の入れ替わり ${r.flipped.length} / 後読み同士に分かれた組 ${r.lazyCross}(表示のみ)`);
  console.log(`起動時 ${parseRules(built.eager, 'x').length} 規則・${Buffer.byteLength(built.eager)} バイト / 後読み ${built.lazy.length} 本`);
  for (const m of r.missing.slice(0, 20)) console.log('  欠け:', m.slice(0, 200));
  for (const e of r.extra.slice(0, 20)) console.log('  重複:', e.slice(0, 200));
  for (const f of r.flipped.slice(0, 40)) console.log(`  入れ替わり [${f.prop}]: ${f.a}  ⇄  ${f.b}`);
  // 起動時 → 後読み の一覧(要確認=その要素は後読みの部品だけが描くか)は .out/moved.txt に全部書く
  fs.writeFileSync(path.join(OUT, 'moved.txt'), [`# 起動時 → 後読み ${r.toLazy.length}`, ...r.toLazy, '', `# 後読み → 起動時 ${r.toEager.length}`, ...r.toEager].join('\n'));
  console.log(`起動時 → 後読み ${r.toLazy.length} / 後読み → 起動時 ${r.toEager.length}(一覧 scripts/css-colocation/.out/moved.txt。起動時 → 後読みは、その要素を後読みの部品だけが描くか確かめる)`);
  if (r.missing.length || r.extra.length || r.flipped.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
