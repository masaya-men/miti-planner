// @ts-check
/**
 * standard-invariance.mjs — 標準モード不変ハーネス
 * ─────────────────────────────────────────────────────────────
 * SP2 の絶対不変条件を機械的に守るためのゴールデンテスト:
 *   「themeStyle 未設定 (= 標準) の /miti は SP2 着手前と 1px も変わらない」
 *
 * 何をするか:
 *   1. 標準モードの /miti を dark / light 両方で開く (fixture でプラン選択済)
 *   2. [data-timeline-root] の DOM 骨格 (タグ + 安定 class + data 属性、
 *      テキスト・style 数値・非決定的な状態クラスは除外) を文字列化
 *   3. 主要要素の getBoundingClientRect (0.1px 丸め) と
 *      .timeline-scroll-container の縦スクロールバー幅 (標準では 0) を採取
 *   4. --save: .baseline/standard-{dark,light}.json へ保存して exit 0
 *      フラグなし: .baseline/ と比較。差分があれば print して exit 1
 *
 * このスナップショット = SP2 着手前の標準モード。以降 SP2 の全タスクの Step で
 *   node scripts/milspec-sp2/standard-invariance.mjs
 * を回し、exit 0 (ベースライン一致) を確認する。
 * 壊れたら「SP2 の分岐 (.theme-military 条件) の入れ方が誤り」= 標準に漏れている。
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch, gotoMiti, applyFixture, attachConsoleRecorder } from './_fixture.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(__dirname, '.baseline');

const SAVE = process.argv.includes('--save');

// ─────────────────────────────────────────────────────────────
// ブラウザ内で実行される採取ロジック (DOM 骨格 + rect)
// ─────────────────────────────────────────────────────────────
/** @param {{ rectSelectors: string[] }} args */
function collectInPage(args) {
  const { rectSelectors } = args;

  // 骨格から除外する class 接頭辞。Tailwind の variant utility は className 文字列に
  // 常時含まれる静的クラスなので本来は決定的。この list は「マウント時アニメ系」と
  // 「レイアウトに効かない hover/focus 系」を将来リファクタ耐性のために落とすもの。
  // 注: group-hover/name (スラッシュ) は入れているが bare group-hover: (コロン) は
  // 入れていない。両者を揃えると採取結果が変わり .baseline/ の撮り直しが必要になるため、
  // この round では現状維持 (list を変えるなら必ず --save でベースライン更新)。
  const DROP_CLASS =
    /^(hover:|focus:|focus-visible:|focus-within:|active:|group-hover\/|group-focus\/|peer-|will-change-|animate-in|animate-out|fade-in|fade-out|zoom-in|zoom-out|slide-in|slide-out|spin|pulse|duration-\[|delay-\[)/;
  // React useId 等で生成される不安定な id を除外
  const UNSTABLE_ID = /[:_]r[0-9a-z]+[:_]?|^radix-|^headlessui-|^«/i;

  function stableClasses(el) {
    return Array.from(el.classList)
      .filter((c) => !DROP_CLASS.test(c))
      .sort();
  }

  function stableAttrs(el) {
    const out = [];
    for (const name of el.getAttributeNames()) {
      if (name === 'class' || name === 'style') continue;
      // 採取するのは以下の allowlist の属性のみ。aria-describedby / aria-labelledby は
      // allowlist に無いので自動的に不採取 (tooltip の生成 id を指し非決定的なため、あえて入れない)。
      if (name.startsWith('data-') || name === 'id' || name === 'role' || name === 'type' || name === 'aria-hidden' || name === 'disabled' || name === 'hidden') {
        let v = el.getAttribute(name);
        if (name === 'id' && v && UNSTABLE_ID.test(v)) continue;
        out.push(`${name}=${v}`);
      }
    }
    return out.sort();
  }

  function skeleton(el, depth) {
    const pad = '  '.repeat(depth);
    const cls = stableClasses(el);
    const attrs = stableAttrs(el);
    let line = `${pad}${el.tagName.toLowerCase()}`;
    if (attrs.length) line += ` [${attrs.join(' ')}]`;
    if (cls.length) line += ` .${cls.join('.')}`;
    const lines = [line];
    for (const child of el.children) lines.push(skeleton(child, depth + 1));
    return lines.join('\n');
  }

  const root = document.querySelector('[data-timeline-root]');
  // git-diff しやすいよう行配列で保存する
  const skelLines = root ? skeleton(root, 0).split('\n') : ['(no [data-timeline-root])'];
  const skel = skelLines.join('\n');

  const r1 = (n) => Math.round(n * 10) / 10;
  const rects = {};
  for (const sel of rectSelectors) {
    const nodes = Array.from(document.querySelectorAll(sel));
    rects[sel] = nodes.slice(0, 6).map((n) => {
      const b = n.getBoundingClientRect();
      return { x: r1(b.x), y: r1(b.y), w: r1(b.width), h: r1(b.height) };
    });
  }

  const sc = document.querySelector('.timeline-scroll-container');
  const vScrollbarWidth = sc ? sc.offsetWidth - sc.clientWidth : null;

  return {
    skeletonLineCount: skelLines.length,
    skeleton: skelLines,
    rects,
    vScrollbarWidth,
    timeRowCount: document.querySelectorAll('[data-time-row]').length,
    recastCellCount: document.querySelectorAll('.recast-cell').length,
    grabHandleCount: document.querySelectorAll('.timeline-scroll-container .cursor-grab').length,
    htmlClass: document.documentElement.className,
  };
}

const RECT_SELECTORS = [
  '#timeline-controls-inner',
  '#timeline-header-inner',
  '.timeline-scroll-container',
  '[data-time-row]', // 先頭 5 個 (collectInPage が 6 個までに丸める → 下で 5 に切る)
  '.recast-cell', // 先頭 3 個
];

async function captureTheme(theme) {
  const { browser, page } = await launch({ theme });
  const rec = attachConsoleRecorder(page);
  try {
    await gotoMiti(page);
    await applyFixture(page, { military: false });
    const raw = await page.evaluate(collectInPage, { rectSelectors: RECT_SELECTORS });

    // rect を brief の個数に整える
    raw.rects['[data-time-row]'] = (raw.rects['[data-time-row]'] || []).slice(0, 5);
    raw.rects['.recast-cell'] = (raw.rects['.recast-cell'] || []).slice(0, 3);

    if (rec.fatal.length) {
      console.error(`\n[standard-invariance] ${theme}: 非 whitelist の console/pageerror:`);
      for (const l of rec.fatal) console.error('  ' + l);
      throw new Error('fatal console errors during standard capture');
    }
    return raw;
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────
// 比較ロジック
// ─────────────────────────────────────────────────────────────
function diffSkeleton(baseSkel, curSkel) {
  const a = Array.isArray(baseSkel) ? baseSkel : String(baseSkel).split('\n');
  const b = Array.isArray(curSkel) ? curSkel : String(curSkel).split('\n');
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max && out.length < 40; i++) {
    if (a[i] !== b[i]) {
      out.push(`  L${i + 1}`);
      out.push(`   - baseline: ${a[i] ?? '(none)'}`);
      out.push(`   + current : ${b[i] ?? '(none)'}`);
    }
  }
  if (a.length !== b.length) out.push(`  (行数 baseline=${a.length} current=${b.length})`);
  return out;
}

function diffRects(base, cur, tol = 1.0) {
  const out = [];
  for (const sel of Object.keys(base)) {
    const ba = base[sel] || [];
    const ca = cur[sel] || [];
    if (ba.length !== ca.length) {
      out.push(`  ${sel}: 個数 baseline=${ba.length} current=${ca.length}`);
      continue;
    }
    for (let i = 0; i < ba.length; i++) {
      for (const k of ['x', 'y', 'w', 'h']) {
        if (Math.abs((ba[i][k] ?? 0) - (ca[i][k] ?? 0)) > tol) {
          out.push(`  ${sel}[${i}].${k}: baseline=${ba[i][k]} current=${ca[i][k]}`);
        }
      }
    }
  }
  return out;
}

function compareOne(theme, baseline, current) {
  const problems = [];

  const sk = diffSkeleton(baseline.skeleton, current.skeleton);
  if (sk.length) problems.push(`[${theme}] DOM 骨格が変化:\n${sk.join('\n')}`);

  const rd = diffRects(baseline.rects, current.rects);
  if (rd.length) problems.push(`[${theme}] getBoundingClientRect が変化 (許容 ±1.0px):\n${rd.join('\n')}`);

  for (const k of ['vScrollbarWidth', 'timeRowCount', 'recastCellCount', 'grabHandleCount', 'htmlClass']) {
    if (JSON.stringify(baseline[k]) !== JSON.stringify(current[k])) {
      problems.push(`[${theme}] ${k}: baseline=${JSON.stringify(baseline[k])} current=${JSON.stringify(current[k])}`);
    }
  }
  return problems;
}

// ─────────────────────────────────────────────────────────────
async function main() {
  const themes = ['dark', 'light'];
  const captured = {};
  for (const theme of themes) {
    process.stdout.write(`[standard-invariance] capture ${theme} ... `);
    captured[theme] = await captureTheme(theme);
    console.log(
      `ok (skeleton ${captured[theme].skeletonLineCount} 行 / rows ${captured[theme].timeRowCount} / vScrollbar ${captured[theme].vScrollbarWidth})`,
    );
  }

  if (SAVE) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    for (const theme of themes) {
      const f = join(BASELINE_DIR, `standard-${theme}.json`);
      writeFileSync(f, JSON.stringify(captured[theme], null, 2) + '\n');
      console.log(`  saved ${f}`);
    }
    // 標準モードの契約チェック: 縦スクロールバーは 0 のはず
    for (const theme of themes) {
      if (captured[theme].vScrollbarWidth !== 0) {
        console.error(
          `\nFAIL: 標準 ${theme} の .timeline-scroll-container 縦スクロールバー幅 = ${captured[theme].vScrollbarWidth} (期待 0)`,
        );
        process.exit(1);
      }
    }
    console.log('\nPASS: 標準ベースラインを保存しました (dark / light)。git add scripts/milspec-sp2/.baseline/ で固定してください。');
    process.exit(0);
  }

  // 比較モード
  let anyProblem = false;
  for (const theme of themes) {
    const f = join(BASELINE_DIR, `standard-${theme}.json`);
    if (!existsSync(f)) {
      console.error(`\nFAIL: ベースライン未保存 (${f})。まず --save で保存してください。`);
      process.exit(1);
    }
    const baseline = JSON.parse(readFileSync(f, 'utf8'));
    const problems = compareOne(theme, baseline, captured[theme]);
    if (problems.length) {
      anyProblem = true;
      console.error(`\n──────── FAIL: ${theme} ────────`);
      for (const p of problems) console.error(p + '\n');
    }
  }

  if (anyProblem) {
    console.error(
      '\nFAIL: 標準モードがベースラインから変化しました。\n' +
        'SP2 の変更が標準モード (themeStyle 未設定) に漏れています。\n' +
        '.theme-military スコープの外に構造/クラス/レイアウトを足していないか確認してください。\n' +
        '(意図的にベースラインを更新する場合のみ --save で撮り直す)',
    );
    process.exit(1);
  }

  console.log('\nPASS: 標準モード (dark / light) はベースラインと一致しています。');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[standard-invariance] ERROR:', err);
  process.exit(1);
});
