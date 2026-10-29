// @ts-check
/**
 * 計算後スタイルの A/B 比較(base の worktree と作業ツリーで同じ probe を測り、1 つでも違えば exit 1)。
 * 使い方: node scripts/theme-out/computed-probe.mjs --base=<rev>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { installDeterminism } from '../visual-regress/lib/determinism.mjs';
import { serializeStorage, baseStorage, mitiStorage, housingStorage } from '../visual-regress/fixtures/storage.mjs';
import { staleBaseDirs, createBaseWorktree, removeBaseWorktree, startDevServer } from '../visual-regress/lib/servers.mjs';
import { PROBES, THEMES, HOUSING_THEMES } from './probes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, '..', 'visual-regress', 'fixtures');
const OUT_DIR = path.join(HERE, '..', '..', '.out', 'theme-out');
const BASE_PORT = 5191;
const HEAD_PORT = 5192;
const FIXED_NOW = '2026-10-01T12:00:00+09:00';
const FIXED_SEED = 20261026;

const themeLabel = (/** @type {string[]} */ classes) => (classes.includes('theme-military') ? 'military-' : '') + (classes.includes('theme-light') ? 'light' : 'dark');

/** @param {string[]} classes @returns {{ mode: string, style: string }} */
const themeState = (classes) => ({ mode: classes.includes('theme-light') ? 'light' : 'dark', style: classes.includes('theme-military') ? 'military' : 'standard' });

/** probe の { base, head } 指定を片側に解決する(head が無ければ base と同じ) */
const pick = (v, /** @type {'base'|'head'} */ side) => (typeof v === 'string' ? v : (v[side] ?? v.base));

/** 1 つの (route, テーマ) の context で、その route の全 probe を測る。返り値: { キー: 値 } */
async function measureColumn(browser, origin, route, column, side) {
  const context = await browser.newContext({ viewport: { width: 1489, height: 679 }, reducedMotion: 'reduce', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  try {
    await installDeterminism(context, { appOrigin: origin, fixturesDir: FIXTURES_DIR, fontCacheDir: path.join(OUT_DIR, 'fonts'), now: FIXED_NOW, seed: FIXED_SEED });
    const isHousing = route === '/housing';
    const st = isHousing
      ? { ...baseStorage(), ...housingStorage({ theme: { mode: column, style: 'standard' } }) }
      : { ...baseStorage(), ...mitiStorage({ view: 'lanes', party: 8, theme: themeState(column) }) };
    await context.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch { /* 無視 */ } }, serializeStorage(st));
    const page = await context.newPage();
    await page.goto(new URL(route, origin).toString(), { waitUntil: 'domcontentloaded' });
    const ready = isHousing ? '.housing-workspace' : (column.includes('theme-military') ? '.milspec-app [data-time-row]' : '[data-time-row]');
    await page.waitForSelector(ready, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const military = !isHousing && column.includes('theme-military');
    const probes = PROBES.filter((p) => p.route === route).map((p) => ({
      id: p.id,
      mount: pick(p.mount, side),
      // label = 突き合わせの名前。改名で base/head の selector が違っても同じ行として比べる(base 側の名前を使う)
      targets: p.targets.map((t) => ({ name: t.name, selector: pick(t.selector, side), label: pick(t.selector, 'base'), pseudo: t.pseudo ?? '', props: t.props })),
    }));
    return await page.evaluate(([list, col, isH, mil]) => {
      /** @type {Record<string, string>} */
      const out = {};
      const root = document.documentElement;
      if (!isH) {
        // 外側のテーマクラスを測りたい列に置き換える(同期処理なので app 側の再描画は割り込まない)
        root.classList.remove('theme-light', 'theme-dark', 'theme-military');
        for (const c of col) root.classList.add(c);
      }
      if (mil) {
        // MIL-SPEC の CSS が実際に読まれているか(.theme-military .milspec-app 配下でだけ定義される値)
        const probe = document.createElement('div');
        probe.className = 'milspec-app';
        document.body.appendChild(probe);
        const v = getComputedStyle(probe).getPropertyValue('--ma-cell-line');
        probe.remove();
        out['__sentinel__|military-css|--ma-cell-line'] = v.trim() ? 'loaded' : 'NOT-LOADED';
      }
      for (const p of list) {
        const box = document.createElement('div');
        box.id = '__theme_out_probe__';
        box.innerHTML = p.mount.replaceAll('__THEME__', String(col));
        document.body.appendChild(box);
        for (const t of p.targets) {
          const el = box.querySelector(t.selector);
          for (const prop of t.props) {
            const key = `${p.id}|${t.name} ${t.label}${t.pseudo}|${prop}`;
            out[key] = el ? getComputedStyle(el, t.pseudo || null).getPropertyValue(prop) : '(要素なし)';
          }
        }
        box.remove();
      }
      return out;
    }, /** @type {[any, any, boolean, boolean]} */ ([probes, column, isHousing, military]));
  } finally {
    await context.close();
  }
}

/** 片側(base か head)の全テーマ・全 route を測る */
async function measureSide(browser, origin, side) {
  /** @type {Record<string, string>} */
  const all = {};
  const cols = [
    ...THEMES.map((c) => ({ route: '/miti', column: c, label: themeLabel(c) })),
    ...HOUSING_THEMES.map((c) => ({ route: '/housing', column: c, label: `housing-${c}` })),
  ];
  for (const { route, column, label } of cols) {
    if (!PROBES.some((p) => p.route === route)) continue;
    const r = await measureColumn(browser, origin, route, column, side);
    for (const [k, v] of Object.entries(r)) {
      const [id, ...rest] = k.split('|');
      all[[id, label, ...rest].join('|')] = v;
    }
  }
  return all;
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith('--base='));
  if (!arg) { console.error('使い方: node scripts/theme-out/computed-probe.mjs --base=<rev>'); return 2; }
  const rev = arg.slice('--base='.length);
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  for (const d of staleBaseDirs(os.tmpdir())) {
    if (!removeBaseWorktree(d, repoRoot)) throw new Error(`前回の残骸を削除できません。手動で消してください: ${d}`);
  }
  /** @type {{ stop: () => void }[]} */
  const servers = [];
  /** @type {string | null} */
  let baseDir = null;
  /** @type {import('playwright').Browser | null} */
  let browser = null;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const s of servers) s.stop();
    if (baseDir) removeBaseWorktree(baseDir, repoRoot);
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(sig, () => { cleanup(); process.exit(130); });
  try {
    baseDir = createBaseWorktree(rev, repoRoot);
    const b = await startDevServer(baseDir, BASE_PORT); servers.push(b);
    const h = await startDevServer(repoRoot, HEAD_PORT); servers.push(h);
    browser = await chromium.launch();
    const base = await measureSide(browser, new URL(b.url).origin, 'base');
    const head = await measureSide(browser, new URL(h.url).origin, 'head');

    const diffs = [];
    for (const k of new Set([...Object.keys(base), ...Object.keys(head)])) {
      if (base[k] !== head[k]) diffs.push({ key: k, base: base[k] ?? '(無し)', head: head[k] ?? '(無し)' });
    }
    const sentinelBad = Object.entries({ ...base, ...head }).filter(([k, v]) => k.includes('__sentinel__') && v !== 'loaded');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'result.json'), JSON.stringify({ rev, count: Object.keys(base).length, diffs, base, head }, null, 1));
    const targets = new Set(Object.keys(base).map((k) => k.split('|').slice(0, 3).join('|'))).size;
    console.log(`測定: ${targets} 件(probe × テーマ × target)/ ${Object.keys(base).length} 値`);
    if (sentinelBad.length) {
      console.error(`MIL-SPEC の CSS が読まれていません(測定が無効): ${sentinelBad.map(([k]) => k).join(', ')}`);
      return 2;
    }
    for (const d of diffs) {
      const [id, theme, sel, prop] = d.key.split('|');
      console.log(`${id} / ${theme} / ${sel} / ${prop}: ${d.base} → ${d.head}`);
    }
    console.log(diffs.length ? `差あり: ${diffs.length} 件(結果 ${path.join(OUT_DIR, 'result.json')})` : '全一致');
    return diffs.length ? 1 : 0;
  } finally {
    if (browser) await browser.close().catch(() => {});
    cleanup();
  }
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
