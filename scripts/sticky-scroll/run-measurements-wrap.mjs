// @ts-check
/**
 * 「置く・消す」(コピー → + で攻撃を足す)の押してから描くまでの測定の基準取り。
 * 親リポジトリの docs/.private/perf-tools/run-measurements.cjs は書き換えず、ファイルのコピーも作らず、
 * 読み込んだ文字列の定数だけをメモリ上で差し替えて実行する(出力先・向き先・条件)。差し替えが 1 つでも外れたら止まる。
 * 使い方: SP2_BASE_URL=http://localhost:4184 node scripts/sticky-scroll/run-measurements-wrap.mjs \
 *           --name=baseline-standard [--theme=standard|military] [--repeats=5]
 * 条件: 本番ビルド(SP2_BASE_URL)のみ・データ normal と heavy・CPU 4 倍・1489×679 / DSR 2.58・繰り返し(既定 5)の中央値。
 * 結果: scripts/sticky-scroll/.baseline/perf/run-measurements-<name>.json(生データ + 中央値。git に入れない)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const here = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = (process.env.PERF_TOOLS_DIR || 'C:/Users/masay/Desktop/FF14Sim/docs/.private/perf-tools').replace(/\\/g, '/');
const baseUrl = process.env.SP2_BASE_URL;
if (!baseUrl || /:(4173|5173|4181)\b/.test(baseUrl)) { console.error('SP2_BASE_URL に自分の配信先(例 http://localhost:4184)を指定してください(4173/5173/4181 は不可)'); process.exit(2); }
const name = typeof args.name === 'string' ? args.name : 'baseline-standard';
const military = args.theme === 'military';
const repeats = Number(typeof args.repeats === 'string' ? args.repeats : 5);
const outDir = path.join(here, '.baseline', 'perf').replace(/\\/g, '/');
fs.mkdirSync(outDir, { recursive: true });

let src = fs.readFileSync(path.join(TOOLS, 'run-measurements.cjs'), 'utf8');
function swap(re, to) {
  const n = (src.match(re) ?? []).length;
  if (n !== 1) throw new Error(`差し替え対象が ${n} 件(1 件のはず): ${re}`);
  src = src.replace(re, () => to);
}
// 出力先と dataset の読み込み元
swap(/const OUT_DIR = '[^']*';/, `const OUT_DIR = ${JSON.stringify(outDir)};`);
swap(/const RESULTS_PATH = [^\n]*;/, `const RESULTS_PATH = path.join(OUT_DIR, ${JSON.stringify(`run-measurements-${name}.raw.json`)});`);
swap(/path\.join\(OUT_DIR, `dataset-\$\{tier\}\.json`\)/, `path.join(${JSON.stringify(TOOLS)}, \`dataset-\${tier}.json\`)`);
// 向き先: dev(5173)を外し、本番(4173)を自分の配信先に。5173/4173 の文字列は残さない
swap(/\{ key: 'dev', baseUrl: 'http:\/\/localhost:5173' \},\s*(?=\{ key: 'prod', baseUrl: 'http:\/\/localhost:4173' \},)/, '');
src = src.replace(/http:\/\/localhost:4173/g, baseUrl).replace(/http:\/\/localhost:5173/g, baseUrl);
// 条件: normal と heavy・CPU 4 倍・繰り返し・DSR 2.58
swap(/const TIERS = [^\n]*;/, `const TIERS = ['normal', 'heavy'];`);
swap(/const CPU_RATES = [^\n]*;/, `const CPU_RATES = [4];`);
swap(/const REPEATS = [^\n]*;/, `const REPEATS = ${repeats};`);
swap(/browser\.newContext\(\{ viewport: \{ width: 1489, height: 679 \} \}\)/, `browser.newContext({ viewport: { width: 1489, height: 679 }, deviceScaleFactor: 2.58 })`);
if (military) {
  swap(/localStorage\.setItem\('lopo_mobile_guide_completed', 'true'\);/,
    `localStorage.setItem('lopo_mobile_guide_completed', 'true'); localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark', themeStyle: 'military', contentLanguage: 'ja', mobileEffectBarMode: 'icon' }, version: 2 }));`);
}
if (/:(4173|5173)\b/.test(src)) throw new Error('向き先の差し替え漏れ');

// 実行(元ファイルと同じ require。playwright は絶対パスで読まれる)
const require = createRequire(path.join(TOOLS, 'run-measurements.cjs'));
const fn = new Function('require', 'process', 'console', 'module', '__dirname', src);
const origExit = process.exit;
await new Promise((resolve) => {
  // 元スクリプトは自走(async IIFE)。完了は生データの最終書き込みで判断せず、終了時の標準出力を見る
  const log = console.log;
  console.log = (...a) => { log(...a); if (String(a[0]).includes('件完了')) setTimeout(resolve, 200); };
  try { fn(require, process, console, { exports: {} }, TOOLS); } catch (e) { console.error(e); origExit(2); }
});

// 中央値の集計
const raw = JSON.parse(fs.readFileSync(path.join(outDir, `run-measurements-${name}.raw.json`), 'utf8'));
const med = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const summary = {};
for (const tier of ['normal', 'heavy']) {
  const rs = raw.runs.filter((r) => r.tier === tier && !r.error);
  summary[tier] = {
    ok: rs.length, total: raw.runs.filter((r) => r.tier === tier).length, rowCount: rs[0]?.rowCount ?? null,
    duration: med(rs.map((r) => r.duration)), inputDelay: med(rs.map((r) => r.inputDelay)), processingTime: med(rs.map((r) => r.processingTime)),
    renderDelay: med(rs.map((r) => r.renderDelay)), maxFrameInterval: med(rs.map((r) => r.maxFrameInterval)),
    timeToFirstFrameAfterClick: med(rs.map((r) => r.timeToFirstFrameAfterClick)),
    longtaskCount: med(rs.map((r) => r.longtaskCount)), longtaskTotal: med(rs.map((r) => r.longtaskTotal)),
    longtaskMax: null,
  };
}
const outFile = path.join(outDir, `run-measurements-${name}.json`);
fs.writeFileSync(outFile, JSON.stringify({ name, theme: military ? 'military' : 'standard', baseUrl, repeats, cpu: 4, dsr: 2.58, summary, runs: raw.runs }, null, 2));
console.log(`SUMMARY ${name}: ${JSON.stringify(summary)}`);
console.log(`saved ${outFile}`);
process.exit(0);
