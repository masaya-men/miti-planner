// @ts-check
/**
 * military-smoke.mjs — 軍事モード スモークテスト
 * ─────────────────────────────────────────────────────────────
 * themeStyle==='military' の /miti (PC) で主要インタラクションが全て動き、
 * 非 whitelist の console/pageerror が 0 件であることを確認する。
 *
 * Task 1 時点: 軍事モードの「見た目」は未実装。ここで見るのは
 *   「入口が残っている」「操作が壊れていない」「エラーを吐かない」だけ。
 *
 * 手順 (step 番号は実行順・全 30 ステップ):
 *   1. 標準ヘッダーに MIL-SPEC 切替ボタン (aria-label=翻訳 app.theme_style_switch) が
 *      表示されていることを assert (SP1 の失敗 = この入口を消したこと) →
 *      useThemeStore.setThemeStyle('military') で軍事へ + store 注入 fixture
 *      (プラン選択済 + 8 人 + 軽減 7 個)。
 *   2. 配置済み軽減バーをドラッグして別時刻へ移動 (実マウス pointer 列)。
 *   3. Undo / Redo (Ctrl+Z → Ctrl+Y) が 1 往復する (GC2・レビュー I5)。
 *   4. 折りたたむボタン (Area A) を ON/OFF → hideEmptyRows がトグル。
 *   5. AA 追加ボタンを押してポップオーバー表示 → Esc で閉じる。
 *   6. メモボタン ON/OFF → toolMode が 'memo'→'idle'。
 *   7. リキャスト行トグル (Area C) を OFF/ON。
 *   8. フェーズヘッダー click → ドロップダウン → フェーズジャンプ。
 *   9. .timeline-scroll-container を scrollBy({left:300}) →
 *      #timeline-header-inner / #timeline-controls-inner の transform が
 *      コンテナ実 scrollLeft と一致 (±2px)。
 *  10. scrollBy({top:400}) → .recast-num が変化 or 例外なし。
 *  11. 配置した軽減を右クリックで削除。
 *  12. リキャスト帯 (Task 7) の位置・列整合・横スクロール同期 +
 *      (d) 列折りたたみ (Shift+P / Shift+L) 後も帯がチップ/バー陣営に留まる (C1 の回帰検知)。
 *  13. リキャスト帯: T/H セルで 6 アイコンが 1 行に収まる (折り返しクリップ回帰)。
 *  14. 縦スクロールバー非表示(10-23 決定): バー幅 0 + 見出し右端の目盛りキャップ ::after が無い。
 *  15. CSS 構造前提の自己防衛 (レビュー M8 / T4 #4): sheetContainer 先頭の
 *      [data-time-row] 連続性 + :has() アンカーの一意性。
 *  16. コンテンツキーで絶タブ (aria-pressed ちょうど 1 つ)。
 *  17. シリーズの開閉で aria-expanded 反転。
 *  18. まとめて共有キーで選択の帯が出て Escape で消える。
 *  19. 電源投入で TRB が自動で押されタービンが回る(無効化・琥珀・羽根)→ 止まると戻り、手動でも回る(動きありの別ブラウザ)。
 *  20. 通気口の取っ手でヘッダーが閉じて開く(aria-expanded)。
 *  21. SORT の 2 キー(押したほうが沈み、もう片方が戻る)。
 *  22. 縦ロッカーで昼夜が切り替わる(<html> の theme-light)。
 *  23. レールの取っ手でサイドバーが閉じて開く。
 *  24. フッターの法的情報の一覧(4 リンク・外側クリックで閉じる)。
 *  25. 電源が 2 秒以内に on になる(動きありの別ブラウザ)。
 *  26. 操作列の削除キー: 押すとメニュー → 「すべての軽減」で確認ダイアログ → キャンセルで軽減は消えない。
 *  27. 操作列の PiP ロッカー: 押すと PiP のメニューが出て、外へ出ると閉じる。
 *  28. 並び替えで差込口が滑り、終わった後に差込口とリキャスト帯の列が揃う(dx≤1)。
 *  29. 照準: 効果アイコンへ実マウスを載せると照準の枠がそのアイコンに乗る。
 *  30. MODE レバーで標準テーマへ戻る(最後の step)。
 *
 * 各ステップ後に console エラー 0 を確認。1 件でも exit 1。
 */

import { launch, gotoMiti, attachConsoleRecorder } from './_fixture.mjs';
import { state, TOTAL_STEPS, resetState } from './military-smoke/state.mjs';
import { runStepsA } from './military-smoke/steps-a.mjs';
import { runStepsB } from './military-smoke/steps-b.mjs';
import { runStepsC } from './military-smoke/steps-c.mjs';
import { runStepsD } from './military-smoke/steps-d.mjs';
import { runStepsE } from './military-smoke/steps-e.mjs';
/** width から 16:9 の height を導出 (--width=N 単一指定時)。
 *  既知幅は実解像度、それ以外は width*9/16 を丸め・下限 800。 */
function heightForWidth(w) {
  if (w === 1920) return 1080;
  if (w === 2560) return 1440;
  return Math.max(800, Math.round((w * 9) / 16));
}

/**
 * process.argv から実行する viewport 群を決める。
 *   --viewport   : [1489×900, 1920×1080, 2560×1440] を順に (3 幅)
 *   --width=N    : [N×heightForWidth(N)] のみ (単一)
 *   (引数なし)   : [1489×900] のみ (従来挙動を厳密に維持)
 * @returns {{ width: number, height: number }[]}
 */
function parseViewports(argv) {
  const args = argv.slice(2);
  if (args.includes('--viewport')) {
    return [
      { width: 1489, height: 900 },
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
    ];
  }
  const wArg = args.find((a) => /^--width=\d+$/.test(a));
  if (wArg) {
    const w = parseInt(wArg.slice('--width='.length), 10);
    return [{ width: w, height: heightForWidth(w) }];
  }
  return [{ width: 1489, height: 900 }];
}

/**
 * 1 つの viewport で全ステップを実行する。旧 main() の中身をそのまま切り出したもの
 * (ステップロジック・しきい値・座標計算は一切不変)。process.exit せず結果オブジェクトを
 * 返す — 最終的な exit code は main() が全幅の結果を集約して決める。
 *
 * @param {{ width: number, height: number }} viewport
 * @param {{ tagOutput?: boolean }} [opts] tagOutput: PASS/FAIL 行に [W×H] を付ける (複数幅実行時)
 * @returns {Promise<{ viewport: {width:number,height:number}, ok: boolean, steps: number, warns?: number, reason?: string, results: any[] }>}
 */
async function runOnce(viewport, { tagOutput = false } = {}) {
  resetState();
  const tag = tagOutput ? ` [${viewport.width}×${viewport.height}]` : '';
  const launched = await launch({ theme: 'dark', viewport });
  state.page = launched.page;
  state.rec = attachConsoleRecorder(state.page);
  const { page } = state;

  try {
    await gotoMiti(page);

    await runStepsA(viewport);
    await runStepsB();
    await runStepsC();
    await runStepsD(viewport);
    await runStepsE(viewport);

    // ── 最終判定 (この viewport) ──────────────────────────────
    console.log('');
    if (state.rec.whitelisted.length) {
      console.log(`[info] whitelist 済み (dev で無害) の console/pageerror ${state.rec.whitelisted.length} 件:`);
      const uniq = [...new Set(state.rec.whitelisted.map((l) => l.slice(0, 120)))].slice(0, 12);
      for (const l of uniq) console.log('  · ' + l);
      console.log('');
    }
    if (state.rec.fatal.length) {
      console.error(`FAIL${tag}: 非 whitelist の console/pageerror ${state.rec.fatal.length} 件:`);
      for (const l of state.rec.fatal) console.error('  ' + l);
      return {
        viewport,
        ok: false,
        steps: state.stepNum,
        reason: `非 whitelist console/pageerror ${state.rec.fatal.length} 件`,
        results: state.results.slice(),
      };
    }

    if (state.stepNum !== TOTAL_STEPS) {
      console.error(`FAIL${tag}: 実行ステップ数 ${state.stepNum} が TOTAL_STEPS (${TOTAL_STEPS}) と一致しない — ファイル頭の手順コメントを更新すること`);
      return { viewport, ok: false, steps: state.stepNum, reason: `step 数不一致 ${state.stepNum}/${TOTAL_STEPS}`, results: state.results.slice() };
    }

    const warns = state.results.filter((r) => r.ok && r.note.startsWith('WARN')).length;
    console.log(`PASS${tag}: ${state.stepNum} ステップ完走 / 非 whitelist console エラー 0 件${warns ? ` / WARN ${warns} 件 (headless で確認できない項目)` : ''}`);
    return { viewport, ok: true, steps: state.stepNum, warns, results: state.results.slice() };
  } catch (err) {
    console.error(`\n──────── FAIL${tag} ────────`);
    console.error(String(err && err.stack ? err.stack : err));
    console.error('\nステップ結果:');
    for (const r of state.results) console.error(`  ${r.ok ? '✓' : '✗'} ${r.tag}${r.note ? ` — ${r.note}` : ''}`);
    if (state.rec && state.rec.fatal.length) {
      console.error('\n収集した console/pageerror:');
      for (const l of state.rec.fatal) console.error('  ' + l);
    }
    const failed = state.results.find((r) => !r.ok);
    return {
      viewport,
      ok: false,
      steps: state.stepNum,
      reason: failed ? `${failed.tag} — ${failed.note}` : String(err && err.message ? err.message : err),
      results: state.results.slice(),
    };
  } finally {
    await launched.browser.close();
  }
}

async function main() {
  const viewports = parseViewports(process.argv);
  const multi = viewports.length > 1;
  /** @type {Awaited<ReturnType<typeof runOnce>>[]} */
  const summary = [];

  for (const vp of viewports) {
    if (multi) console.log(`\n=== viewport ${vp.width}×${vp.height} ===\n`);
    summary.push(await runOnce(vp, { tagOutput: multi }));
  }

  if (multi) {
    console.log('\n──────── viewport 集計 ────────');
    for (const r of summary) {
      const v = `${r.viewport.width}×${r.viewport.height}`;
      console.log(
        r.ok
          ? `  ✓ ${v}: ${r.steps}/${TOTAL_STEPS} pass${r.warns ? ` (WARN ${r.warns})` : ''}`
          : `  ✗ ${v}: ${r.reason}`,
      );
    }
  }

  const failed = summary.filter((r) => !r.ok);
  if (failed.length) {
    console.error(
      `\nFAIL: ${failed.map((r) => `${r.viewport.width}×${r.viewport.height}`).join(', ')} で失敗 (詳細は上記)`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[military-smoke] ERROR:', err && err.stack ? err.stack : err);
  process.exit(1);
});
