// ビルド後の CSS を基準と比べる道具。 規則の欠け・重複と、 「順番頼りの組」の前後の入れ替わりを見る。
// 使い方: node scripts/housing-css/compare-build.mjs --save-as=<名前>   (今の作業ツリーをビルドして基準に保存)
//         node scripts/housing-css/compare-build.mjs --compare=<名前>   (今をビルドして基準と比べる・差があれば exit 1)
// minify なしでビルドする(minify の宣言統合で判定がぶれないため)。 約 15 秒。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findOrderPairs, parseRules } from './cssRules.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '.out');

/** 規則の同一性 = 条件+セレクタ+宣言+「同じものの何個目か」 */
function identities(rules) {
  const count = new Map();
  return rules.map((r) => {
    const base = r.kind === 'rule' ? `${r.media}|${r.selector}|${r.decls}` : `${r.media}|@${r.name} ${r.params}|${r.node.toString().replace(/\s+/g, ' ')}`;
    const n = count.get(base) ?? 0;
    count.set(base, n + 1);
    return `${base}#${n}`;
  });
}

export function compareCss(baseCss, nextCss) {
  const baseRules = parseRules(baseCss, 'base.css');
  const nextRules = parseRules(nextCss, 'next.css');
  const baseIds = identities(baseRules);
  const nextIds = identities(nextRules);
  const nextPos = new Map(nextIds.map((id, i) => [id, i]));
  const baseSet = new Set(baseIds);
  const missing = baseIds.filter((id) => !nextPos.has(id));
  const extra = nextIds.filter((id) => !baseSet.has(id));
  const idOf = new Map(baseRules.map((r, i) => [r, baseIds[i]]));
  const flipped = [];
  for (const [a, b, prop] of findOrderPairs(baseRules)) {
    const pa = nextPos.get(idOf.get(a));
    const pb = nextPos.get(idOf.get(b));
    if (pa === undefined || pb === undefined) continue;
    if (pa > pb) flipped.push({ a: `${a.media ? `@media ${a.media} ` : ''}${a.selector}`, b: `${b.media ? `@media ${b.media} ` : ''}${b.selector}`, prop });
  }
  return { missing, extra, flipped };
}

async function buildCss() {
  const require = createRequire(path.resolve('package.json'));
  const vitePath = require.resolve('vite');
  const { build } = await import(pathToFileURL(vitePath).href);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'housing-css-build-'));
  await build({ configFile: path.resolve('vite.config.ts'), logLevel: 'error', build: { cssMinify: false, outDir, emptyOutDir: true } });
  const assets = path.join(outDir, 'assets');
  const file = fs.readdirSync(assets).find((f) => /^index-.*\.css$/.test(f));
  const css = fs.readFileSync(path.join(assets, file), 'utf8');
  fs.rmSync(outDir, { recursive: true, force: true });
  return css;
}

async function main() {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const saveAs = arg('save-as');
  const compare = arg('compare');
  if (!saveAs && !compare) throw new Error('--save-as=<名前> か --compare=<名前> を付ける');
  const css = await buildCss();
  fs.mkdirSync(OUT, { recursive: true });
  if (saveAs) {
    fs.writeFileSync(path.join(OUT, `${saveAs}.css`), css);
    console.log(`基準を保存: ${saveAs} (${parseRules(css, 'x').length} 規則)`);
    return;
  }
  const base = fs.readFileSync(path.join(OUT, `${compare}.css`), 'utf8');
  fs.writeFileSync(path.join(OUT, 'last.css'), css);
  const r = compareCss(base, css);
  console.log(`欠け ${r.missing.length} / 重複 ${r.extra.length} / 順番の入れ替わり ${r.flipped.length}`);
  for (const m of r.missing.slice(0, 20)) console.log('  欠け:', m.slice(0, 200));
  for (const e of r.extra.slice(0, 20)) console.log('  重複:', e.slice(0, 200));
  for (const f of r.flipped.slice(0, 40)) console.log(`  入れ替わり [${f.prop}]: ${f.a}  ⇄  ${f.b}`);
  if (r.missing.length || r.extra.length || r.flipped.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
