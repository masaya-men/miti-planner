// @ts-check
/**
 * 見た目の回帰テストの入口。base(比較元のコミット)と head(作業ツリー)を同じ条件で撮って比べる。
 *   node scripts/visual-regress/run.mjs [--base=<rev>] [--only=<文字>] [--jobs=N] [--name=<名前>]
 *     [--save-as=<名前> | --compare=<名前>] [--inject-css=<file>] [--calibrate] [--list]
 *   node scripts/visual-regress/run.mjs --report-only=<名前>   (撮影せず、既存の PNG と verdicts.json から報告を作り直す)
 * 終了コード: 0=全部同じ / 1=差分あり / 2=失敗あり・実行不能
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { validateCatalog, expandConditions } from './lib/catalog.mjs';
import { diffPng, toleranceFrom } from './lib/diff.mjs';
import { buildReport } from './lib/report.mjs';
import { shootCondition } from './lib/shoot.mjs';
import {
  staleBaseDirs, packageJsonDiffers, startDevServer, createBaseWorktree, removeBaseWorktree,
} from './lib/servers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(HERE, '.out');
const BASE_PORT = 5181;
const HEAD_PORT = 5182;

/**
 * result 全体の終了コード。fail があれば 2、diff だけなら 1、全部 same なら 0。
 * @param {Record<string, { status: string }>} result
 */
export function exitCodeOf(result) {
  const st = Object.values(result).map((r) => r.status);
  if (st.some((s) => s.startsWith('fail'))) return 2;
  if (st.some((s) => s === 'diff')) return 1;
  return 0;
}

/**
 * --name / --save-as / --compare / --report-only の値は .out/ 直下の 1 階層の名前だけ許す。
 * 問題があれば日本語のメッセージ、無ければ null。
 * @param {string} name
 */
export function validateRunName(name) {
  if (!name || name === '.' || name === '..' || /[\\/:\u0000]/.test(name) || path.isAbsolute(name) || path.win32.isAbsolute(name)) {
    return `名前 '${name}' は使えません。英数字・ハイフンなど、フォルダ名 1 つ分だけにしてください(. や .. ・区切り文字・絶対パスは不可)`;
  }
  return null;
}

/** dir が root の中(root 自身は含めない)か。rm・書き込みの前の最終確認用 */
export function isInside(root, dir) {
  const rel = path.relative(root, dir);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const a = {};
  for (const x of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(x);
    if (m) a[m[1]] = m[2] ?? true;
  }
  return a;
}

async function loadCatalog() {
  const dir = path.join(HERE, 'catalog');
  const entries = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.mjs') && !n.startsWith('_')).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    entries.push(...mod.default);
  }
  const errs = validateCatalog(entries);
  if (errs.length) throw new Error(`カタログが不正です:\n${errs.join('\n')}`);
  return entries;
}

/** 並列数 jobs で items を順に処理 */
async function pool(items, jobs, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item); }
  }));
}

const timestampName = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function readTolerance() {
  try { return JSON.parse(fs.readFileSync(path.join(OUT_ROOT, 'tolerance.json'), 'utf8')); } catch { return {}; }
}

/** 残骸掃除(前回異常終了で残った base worktree) */
function cleanStale(repoRoot) {
  for (const d of staleBaseDirs(os.tmpdir())) {
    console.log(`前回の残骸を掃除: ${d}`);
    if (!removeBaseWorktree(d, repoRoot)) throw new Error(`前回の残骸を削除できません。手動で消してから再実行してください: ${d}`);
  }
  try { execFileSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'ignore' }); } catch { /* 続行 */ }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const k of ['name', 'save-as', 'compare', 'report-only']) {
    const v = args[k];
    const msg = typeof v === 'string' ? validateRunName(v) : null;
    if (msg) { console.error(`--${k}: ${msg}`); return 2; }
  }
  // 報告だけ作り直す(dev サーバーも worktree も使わない)
  if (typeof args['report-only'] === 'string') {
    const dir = path.join(OUT_ROOT, args['report-only']);
    if (!isInside(OUT_ROOT, dir)) { console.error('--report-only: .out の外は指定できません'); return 2; }
    if (!fs.existsSync(path.join(dir, 'result.json'))) { console.error(`結果がありません: ${dir}`); return 2; }
    console.log(`報告: ${await buildReport(dir)}`);
    return 0;
  }
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: HERE, encoding: 'utf8' }).trim();
  const entries = await loadCatalog();
  const only = typeof args.only === 'string' ? args.only : undefined;
  const conds = expandConditions(entries, { only });

  if (args.list) {
    for (const c of conds) console.log(c.key);
    console.log(`計 ${conds.length} 条件`);
    return 0;
  }
  if (!conds.length) { console.error('撮影条件が 0 件です(--only を確認してください)'); return 2; }

  const jobs = Number(args.jobs ?? 3);
  const name = typeof args.name === 'string' ? args.name : timestampName();
  const runDir = path.join(OUT_ROOT, name);
  const baseRev = typeof args.base === 'string' ? args.base : 'HEAD';
  const saveAs = typeof args['save-as'] === 'string' ? args['save-as'] : null;
  const compare = typeof args.compare === 'string' ? args.compare : null;
  const injectCss = typeof args['inject-css'] === 'string' ? fs.readFileSync(args['inject-css'], 'utf8') : undefined;
  const headOnly = Boolean(saveAs || compare || args.calibrate);
  const baselineDir = path.join(OUT_ROOT, 'baselines', String(saveAs ?? compare ?? ''));

  if (![runDir, baselineDir].every((d) => d === path.join(OUT_ROOT, 'baselines') || isInside(OUT_ROOT, d))) { console.error('出力先が .out の外になります。名前を確認してください'); return 2; }
  if (compare && !fs.existsSync(baselineDir)) { console.error(`保存済みの基準 '${compare}' がありません`); return 2; }

  cleanStale(repoRoot);

  /** @type {string | null} */
  let baseDir = null;
  /** @type {{ stop: () => void }[]} */
  const servers = [];
  /** @type {import('playwright').Browser | null} */
  let browser = null;
  // Ctrl+C・終了要求でも後片付けする(finally は走らないので同期で止めて消す)
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const s of servers) { try { s.stop(); } catch { /* 続行 */ } }
    if (baseDir) removeBaseWorktree(baseDir, repoRoot);
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(sig, () => { console.error(`
${sig} を受けました。後片付けして終了します`); cleanup(); process.exit(2); });
  }
  try {
    let baseUrl = '';
    if (!headOnly) {
      // 先に rev の存在確認と package.json の差を見る(差があると node_modules を共有できない)
      let differs;
      try { differs = packageJsonDiffers(repoRoot, baseRev); } catch (e) {
        console.error(`base '${baseRev}' を解決できません: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        return 2;
      }
      if (differs) {
        console.error(`base '${baseRev}' と作業ツリーで package.json が違うため、node_modules を共有できません。同じ依存の base を指定してください。`);
        return 2;
      }
      baseDir = createBaseWorktree(baseRev, repoRoot);
      console.log(`base worktree: ${baseDir}`);
      const b = await startDevServer(baseDir, BASE_PORT); servers.push(b); baseUrl = b.url;
    }
    const h = await startDevServer(repoRoot, HEAD_PORT); servers.push(h);
    const headUrl = h.url;

    browser = await chromium.launch();
    // ウォームアップ(Ruling 10): 初回の Google Fonts 取得が 15 秒を超えうるので、先に 1 回撮って捨てる
    console.log('ウォームアップ中(字体キャッシュ)...');
    await shootCondition(browser, headUrl, conds[0], path.join(runDir, '_warmup.png'));
    fs.rmSync(path.join(runDir, '_warmup.png'), { force: true });

    // 同じ --name の再実行: 古い画像と仕分けが新しい画像に紛れないよう片付ける(calibrate は別の置き場なので触らない)
    if (!args.calibrate) {
      for (const d of ['base', 'head', 'overlay', 'crops', 'save-check']) fs.rmSync(path.join(runDir, d), { recursive: true, force: true });
      const vf = path.join(runDir, 'verdicts.json');
      if (fs.existsSync(vf)) fs.renameSync(vf, path.join(runDir, 'verdicts.prev.json'));
    }

    const t0 = Date.now();
    /** @type {Record<string, any>} */
    const result = {};
    const tolFile = readTolerance();

    if (args.calibrate) {
      await pool(conds, jobs, async (c) => {
        const files = [];
        for (let i = 0; i < 3; i++) {
          const f = path.join(runDir, 'calibrate', `${c.key}.${i}.png`);
          const r = await shootCondition(browser, headUrl, c, f);
          if (!r.ok) { result[c.key] = { status: 'fail-head', ratio: 0, tol: 0, error: r.error }; return; }
          files.push(f);
        }
        const bufs = files.map((f) => fs.readFileSync(f));
        const ds = await Promise.all([diffPng(bufs[0], bufs[1]), diffPng(bufs[0], bufs[2]), diffPng(bufs[1], bufs[2])]);
        const tol = toleranceFrom(ds.map((d) => d.ratio), ds[0].total);
        tolFile[c.key] = tol;
        result[c.key] = { status: 'same', ratio: Math.max(...ds.map((d) => d.ratio)), tol };
      });
      fs.mkdirSync(OUT_ROOT, { recursive: true });
      fs.writeFileSync(path.join(OUT_ROOT, 'tolerance.json'), JSON.stringify(tolFile, null, 2));
      console.log(`許容を ${path.join(OUT_ROOT, 'tolerance.json')} に保存しました`);
    } else {
      await pool(conds, jobs, async (c) => {
        const baseFile = path.join(runDir, 'base', `${c.key}.png`);
        const headFile = path.join(runDir, 'head', `${c.key}.png`);
        const saveFile = saveAs ? path.join(baselineDir, `${c.key}.png`) : null;
        /** @type {{ selector: string, reason: string }[] | undefined} */
        let masks;
        // base と head を同じ枠で続けて撮る
        if (compare) {
          const src = path.join(baselineDir, `${c.key}.png`);
          if (!fs.existsSync(src)) { result[c.key] = { status: 'fail-base', ratio: 1, tol: 0, error: '保存済みの基準にこの条件がありません' }; return; }
          fs.mkdirSync(path.dirname(baseFile), { recursive: true });
          fs.copyFileSync(src, baseFile);
        } else if (!saveAs) {
          const rb = await shootCondition(browser, baseUrl, c, baseFile);
          if (!rb.ok) { result[c.key] = { status: 'fail-base', ratio: 1, tol: 0, error: rb.error }; return; }
          masks = rb.masks;
        }
        const rh = await shootCondition(browser, headUrl, c, saveFile ?? headFile, { injectCss });
        if (!rh.ok) { result[c.key] = { status: 'fail-head', ratio: 1, tol: 0, error: rh.error }; return; }
        masks = masks ?? rh.masks;
        /** @param {string} a @param {string} b */
        const judge = async (a, b) => {
          const d = await diffPng(fs.readFileSync(a), fs.readFileSync(b));
          return { d, tol: tolFile[c.key] ?? toleranceFrom([], d.total) };
        };
        if (saveAs) {
          // 基準は 2 回撮って一致を確かめる。負荷でまれに別の絵(ボタン下端が 1px 伸びる等)になるため、違えば 3 回目で多数決
          const extra = path.join(runDir, 'save-check', `${c.key}.png`);
          const again = async () => { const r = await shootCondition(browser, headUrl, c, extra); return r.ok ? null : r.error; };
          let err = await again();
          if (err) { result[c.key] = { status: 'fail-head', ratio: 1, tol: 0, error: err }; return; }
          let j = await judge(/** @type {string} */ (saveFile), extra);
          if (j.d.ratio > j.tol) {
            const second = path.join(runDir, 'save-check', `${c.key}.2.png`);
            fs.renameSync(extra, second);
            err = await again();
            if (err) { result[c.key] = { status: 'fail-head', ratio: 1, tol: 0, error: err }; return; }
            if ((j = await judge(/** @type {string} */ (saveFile), extra)).d.ratio > j.tol) {
              if ((await judge(second, extra)).d.ratio > j.tol) {
                result[c.key] = { status: 'fail-head', ratio: 1, tol: 0, error: '基準を 3 回撮って 3 回とも違う絵でした(撮るたびに変わる画面)' }; return;
              }
              fs.copyFileSync(extra, /** @type {string} */ (saveFile));
            }
          }
          result[c.key] = { status: 'same', ratio: 0, tol: 0, masks }; return;
        }
        let { d, tol } = await judge(baseFile, headFile);
        let retried = false;
        if (d.ratio > tol) {
          // 差が出たものだけ 1 回撮り直して比べ直す(本物の変化は撮り直しても差が出る)
          retried = true;
          if (!compare) {
            const rb = await shootCondition(browser, baseUrl, c, baseFile);
            if (!rb.ok) { result[c.key] = { status: 'fail-base', ratio: 1, tol: 0, error: rb.error }; return; }
          }
          const rh2 = await shootCondition(browser, headUrl, c, headFile, { injectCss });
          if (!rh2.ok) { result[c.key] = { status: 'fail-head', ratio: 1, tol: 0, error: rh2.error }; return; }
          ({ d, tol } = await judge(baseFile, headFile));
        }
        result[c.key] = {
          status: d.ratio > tol ? 'diff' : 'same', ratio: d.ratio, tol,
          ...(retried ? { retried: true } : {}),
          ...(d.sizeMismatch ? { sizeMismatch: d.sizeMismatch } : {}),
          ...(masks?.length ? { masks } : {}),
        };
      });
    }

    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));
    const counts = {};
    for (const r of Object.values(result)) counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (!args.calibrate && !saveAs) console.log(`報告: ${await buildReport(runDir)}`);
    console.log(`完了(${((Date.now() - t0) / 1000).toFixed(1)} 秒): ${JSON.stringify(counts)}  結果: ${path.join(runDir, 'result.json')}`);
    return exitCodeOf(result);
  } finally {
    // 何があっても後片付け(サーバーのプロセスツリー停止 → worktree 削除)
    if (browser) await browser.close().catch(() => {});
    cleanup();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then((code) => process.exit(code), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(2); });
}
