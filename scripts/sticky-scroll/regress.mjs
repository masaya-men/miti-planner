// @ts-check
/**
 * 軽減表の回帰自動確認(横スクロール計画 §4 の [自] 項目)。アプリのコードは変えない・計測するだけ。
 *
 * 使い方(README.md に詳細):
 *   node scripts/sticky-scroll/regress.mjs --out=baseline
 *   node scripts/sticky-scroll/regress.mjs --out=after --compare=baseline [--only=standard] [--allow=<項目>]
 *   他: --list(条件一覧)  --probe=<名前,…>(動作の確認項目を絞る・開発用)  --geom-only / --beh-only
 *
 * 結果は scripts/sticky-scroll/.baseline/regress-<out>.json(git に入れない)。
 * 形: { meta, conds: { <条件id>: { items: { <項目id>: ... } } } }
 * 計測は dev サーバー(既定 http://localhost:5173、REGRESS_BASE_URL で変更)。localStorage 注入で表を作り、
 * 一部の確認(カーソル送信・読み取り専用・記録モード)だけ dev の store を直接読む(dev 専用)。
 * 画面の呼び名: 本人=1489×679/DSR2.58、多数派=1920×1080/DSR2、大画面=2560×1440/DSR1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { args, BASE_URL, OUT, COMPARE, ONLY, ALLOW, PROBE_FILTER, TOL, TOL_PRECISE } from './regress/config.mjs';
import { ALL_CONDS, condById, BEH, MOBILE_THEMES } from './regress/conditions.mjs';
import { openPage, withStore, readMits, readMemos } from './regress/page.mjs';
import { probeGeom } from './regress/geom.mjs';
import { PROBES, iconCenter } from './regress/helpers.mjs';
import './regress/probes-edit.mjs';
import './regress/probes-memo.mjs';
import './regress/probes-view.mjs';
import { probePrint, probeMobile } from './regress/probes-misc.mjs';
import { wantProbe, diffAny } from './regress/compare.mjs';
import { pool, errMsg, expandProbes, runBehaviorFor } from './regress/run.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.join(HERE, '.baseline');
/** 取得時の HEAD の SHA(baseline がどのコードで取られたか残す)。 */
const gitSha = () => { try { return execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim(); } catch { return null; } };
const fileOf = (name) => path.join(BASE_DIR, `regress-${name}.json`);

async function main() {
  if (args.list) {
    for (const c of ALL_CONDS) console.log(c.id);
    console.log('--- 動作の確認(項目 → 条件) ---');
    for (const [k, v] of Object.entries(BEH)) console.log(`${k}: ${v.join(', ')}`);
    return 0;
  }
  if (COMPARE && !fs.existsSync(fileOf(COMPARE))) {
    console.error(`baseline が無い: ${fileOf(COMPARE)}(先に --out=${COMPARE} で取る)`);
    return 1;
  }
  const selCond = (c) => !ONLY || c.id.includes(ONLY);
  const result = {
    meta: { baseUrl: BASE_URL, tolerancePx: TOL, tolerancePrecisePx: TOL_PRECISE, only: ONLY, node: process.version, gitSha: gitSha() },
    conds: {},
  };
  const slot = (id) => (result.conds[id] ??= { items: {} }).items;
  const errors = [];
  const t00 = Date.now();

  const tasks = [];
  if (!args['beh-only'] && wantProbe('geom')) {
    for (const cond of ALL_CONDS.filter(selCond)) {
      tasks.push(async () => {
        const t0 = Date.now();
        try {
          Object.assign(slot(cond.id), await probeGeom(cond));
          console.log(`geom ${cond.id} ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        } catch (e) {
          errors.push(`geom ${cond.id}: ${errMsg(e)}`);
          slot(cond.id).geom = { error: errMsg(e) };
          console.log(`geom ${cond.id} ERROR ${errMsg(e)}`);
        }
      });
    }
  }
  if (!args['geom-only']) {
    const byCond = new Map();
    for (const [probeName, conds] of Object.entries(BEH)) {
      for (const id of conds) {
        const cond = condById(id);
        if (!cond || !selCond(cond)) continue;
        if (!byCond.has(id)) byCond.set(id, []);
        byCond.get(id).push(probeName);
      }
    }
    for (const [id, names] of byCond) {
      const subs = expandProbes(names);
      if (!subs.length) continue;
      tasks.push(async () => {
        const r = await runBehaviorFor(condById(id), subs);
        Object.assign(slot(id), r.items);
        errors.push(...r.errors);
      });
    }
    if (wantProbe('print')) {
      for (const id of BEH.milspec) {
        const cond = condById(id);
        if (!cond || !selCond(cond)) continue;
        tasks.push(async () => {
          try { slot(id)['probe.print'] = await probePrint(cond); console.log(`  beh ${id} print ok`); } catch (e) { errors.push(`${id} print: ${errMsg(e)}`); slot(id)['probe.print'] = { error: errMsg(e) }; }
        });
      }
    }
    if (wantProbe('mobile')) {
      for (const theme of MOBILE_THEMES) {
        const id = `mobile-390-${theme.id}`;
        if (ONLY && !id.includes(ONLY)) continue;
        tasks.push(async () => {
          try { slot(id).mobile = await probeMobile(theme); console.log(`  mobile ${id} ok`); } catch (e) { errors.push(`${id} mobile: ${errMsg(e)}`); slot(id).mobile = { error: errMsg(e) }; }
        });
      }
    }
  }
  if (args['no-run']) {
    // 保存済みの結果ファイルを読むだけ(比較のやり直し用)
    const all = JSON.parse(fs.readFileSync(fileOf(OUT), 'utf8')).conds;
    for (const [id, v] of Object.entries(all)) if (!ONLY || id.includes(ONLY)) result.conds[id] = v;
  } else {
    await pool(tasks);
  }

  fs.mkdirSync(BASE_DIR, { recursive: true });
  result.conds = JSON.parse(JSON.stringify(result.conds)); // NaN/Infinity は保存すると null になるので、比較も同じ形で行う
  // 並べ順を固定(並行で走らせても出力が変わらない)
  const sorted = {};
  for (const k of Object.keys(result.conds).sort()) {
    sorted[k] = { items: Object.fromEntries(Object.keys(result.conds[k].items).sort().map((i) => [i, result.conds[k].items[i]])) };
  }
  result.conds = sorted;
  if (!args['no-run']) fs.writeFileSync(fileOf(OUT), JSON.stringify(result, null, 1));
  console.log(`\n保存: ${fileOf(OUT)}(${((Date.now() - t00) / 1000).toFixed(0)}s・条件 ${Object.keys(result.conds).length})`);

  let code = 0;
  if (errors.length) {
    console.error(`\n確認の失敗 ${errors.length} 件:`);
    for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
    code = 2;
  }

  if (COMPARE) {
    const base = JSON.parse(fs.readFileSync(fileOf(COMPARE), 'utf8'));
    const acc = [], allowedAcc = [];
    let compared = 0;
    for (const id of Object.keys(result.conds)) {
      if (!base.conds[id]) { acc.push(`${id}: baseline にこの条件が無い`); continue; }
      compared++;
      const a = base.conds[id].items, b = result.conds[id].items;
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(k in b) && (args['beh-only'] || args['geom-only'] || PROBE_FILTER)) continue; // 今回取っていない項目は比べない
        if (!(k in a)) { acc.push(`${id}/${k}: baseline に無い項目`); continue; }
        if (!(k in b)) { acc.push(`${id}/${k}: 今回の結果に無い項目`); continue; }
        diffAny(a[k], b[k], `${id}/${k}`, acc, allowedAcc);
      }
    }
    console.log(`\n比較 ${COMPARE}: ${compared} 条件・許容 ${TOL}px(precise は ${TOL_PRECISE}px)`);
    if (allowedAcc.length) {
      console.log(`--allow(${ALLOW.join(', ')}) で見逃した差分 ${allowedAcc.length} 件(報告書に理由を書くこと)。先頭 10 件:`);
      for (const d of allowedAcc.slice(0, 10)) console.log(`  ~ ${d}`);
    }
    if (acc.length) {
      console.error(`意図しない差分 ${acc.length} 件。先頭 40 件:`);
      for (const d of acc.slice(0, 40)) console.error(`  ! ${d}`);
      code = 1;
    } else {
      console.log('差 0(許容内)');
    }
  }
  return code;
}

export { openPage, PROBES, condById, iconCenter, withStore, readMits, readMemos };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(3); });
}
