# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接
- **注意**: ENFORCE_APP_CHECK=true、Vercel関数9/12、月100ビルド制限
- **軽減アプリ: 完成・公開済み（2026-04-13 完成ツイート済み）**
- **最新セッション（2026-05-03・カンペ スマホ UX 改善 + 共同編集の比較検討）**: 朝に共同編集機能の実装難度・コスト試算を依頼され、現状アーキテクチャを実コード調査（usePlanStore / useMitigationStore / planService.ts / firestore.rules）。「カーソル先勝ち + 終了時保存」方式なら 2-3 週・月 6,000-10,000 円程度、「スプシ式（非同期共同編集）」なら 1-2 週・追加コストほぼゼロと算出。ユーザー判断「完全同時編集以外は意味薄いので後回し」で着手見送り。代わりにスマホカンペの UX 全面改善に着手: ①PipView スマホ全画面サイズアップ（攻撃名 17px font-bold / 軽減アイコン 26px / ジョブアイコン 28px / ALL カラー閉じるボタン 32×32 / 行 padding py-2 / 時間カラム幅 44px）②ジョブアイコン横並びを overflow-x-auto + 右端 50px linear-gradient mask（強めフェード）でスクロール可アフォーダンス ③brainstorming → writing-plans → executing-plans の skill チェーンで「タップ → 中央モーダル → 攻撃切替+編集」を実装（B-2 採用、+N バッジ残置、ダブルタップ廃止スマホ時のみ、editingEventId state を行内とモーダル両方で流用、editInputRef 共有）④ iOS Safari で動かないカラーピッカー & デフォルト色スウォッチをスマホ時のみ非表示 ⑤ リスト本体に上下 24px の linear-gradient mask（弱めフェード）。設計書 `docs/superpowers/specs/2026-05-03-pip-mobile-edit-modal-design.md`、実装プラン `docs/superpowers/plans/2026-05-03-pip-mobile-edit-modal.md`。335 tests PASS、tsc clean、build 成功、push+デプロイ済み。実機 OK 確認待ち（スマホ全画面で 7.2 のチェックリスト + PC PiP の 7.3 で既存挙動変化なし）。

- **前セッション（2026-05-02・Ko-fi/PayPal 透明性監査 + プライバシー §1c 新設）**: AI 提案を鵜呑みにせず Ko-fi 公式ヘルプ + 国税庁ソース + 二次ソースで事実確認の上、Stripe 審査落ち = PayPal のみ受け付けという前提を踏まえ、現状のプライバシー・支援・特商法ページが「Ko-fi 経由で支援者の名前・メアドが運営者に届く事実」を一切記載しておらず誠実性に欠ける問題を発見・修正。①プライバシー §1c「支援(Ko-fi)を通じて受け取る情報」新設（Ko-fi 管理画面で届く情報 / PayPal 管理画面で届く情報 / 運営者からのお約束 / 自衛策の 4 サブセクション、Display Name 空欄→"Somebody" 表示・Business アカウントで任意名称設定・支援用別メアド推奨を明記）②§2「集めない情報」のメアド項目を「Discord/X ログイン時のみ届かない、Ko-fi 経由については §1c 参照」に限定明示 ③§3「使いみち」に「いただいた支援に関するトラブル対応」追加（お礼は省略 = ユーザー方針）④§4 末尾に Ko-fi 注釈追加 ⑤§6 表に Ko-fi/PayPal 経由情報の行追加（運営者は別途保管せず、各サービスのプライバシーポリシーに準拠）⑥support.kofi_about_body から「Apple Pay / Google Pay / Stripe / 月額」を削除し PayPal のみ明記、Ko-fi/PayPal 経由で名前・メアドが届く事実を追記 ⑦support.cta_subtext を「単発の支援を受け付けています」に修正 ⑧support ページに「支援時に私(開発者)に届く情報」§ 新設（Ko-fi/PayPal 別の届く情報 + 私のお約束 + 自衛策、§1c の一人称版）⑨☕ ボタン直前に「外部サイトが新しいタブで開く」控えめ注釈 ⑩特商法 commercial_payment_value を「PayPal（Ko-fi 経由。PayPal ゲスト決済でクレカ可）」に修正 ⑪privacy_last_updated / commercial_last_updated を 2026年5月2日に更新。4 言語（ja/en/ko/zh）同期、335 tests PASS、tsc clean、build 成功。AI 提案にあった「税務上 7 年保管」「実名含む」は事実精査の結果不正確と判明し採用せず（Ko-fi 自体に保管されているので運営者は別途保管不要、Display Name はニックネーム可）。

- **前セッション（2026-05-02・PiP UI 反復改善 + タブタイトル整理 + FAB スクロール対応）**: 前日復活の PiP を実機ベースで仕上げ、加えて全ページのブラウザタブ表示を整理。①PiP 反復改善: ジョブピッカー Popover 廃止 → ALL トグル + ジョブアイコン横並びの 1 段ツールバー（アイコンの opacity だけで ON/OFF、四角・リング撤去）/ カラーピッカーは色相環 conic-gradient + 中央現在色〇 + 隣にデフォルト色スウォッチ（Photoshop 前景背景風、現在色 == デフォルトのとき disabled）/ 透過撤去に伴い Chrome 透過不可だった件は完全削除 / PC 起動時は最小幅（width: 1 でブラウザ補正）+ 8.5 行用 height 200 / `html`/`body` height 100% で別ウィンドウのスクロール bug 修正 / スクロールバー非表示 / ライトテーマ + 任意 bg 色対応で文字色 currentColor 化 + isBgLight (YIQ 輝度) 純粋関数で自動切替 / 同時刻イベントを CueGroup でグループ化（AoE > 単体 > 未設定 > id 昇順）+ +1 バッジで切替 / 自動配置の aetherflow を表示から除外 / cursor-text + メモ × ボタンで「黄色固定」UX 改善。②タブタイトル整理: 区切り文字を半角 `|` で全ページ統一、4 ページ（/support /privacy /terms /commercial）に document.title 設定追加（前のページのタイトルが残るバグ解消）、LP タイトルを `LoPo | FF14 軽減表 & ハウジング | スマホ対応`（en は `Mitigation Sheet & Housing`、業界用語 MitPlan 被り回避）等 4 言語で SEO 強化、index.html 初期値も統一。Search Console / GA4 でページ毎の認識精度向上見込み。③スマホ FAB メニュー: カンペ追加で項目数 8 に増えたため古い iPhone SE 等で見切れる問題を解消、`max-h: calc(100svh-180px)` + overflow-y-auto + 動的フェード mask-image (40px、scroll position 監視) + sticky bottom の ↓ アイコン (animate-bounce) で「スクロール可能」を明示。言語チップが menu の overflow に clip されていた問題を React Portal (document.body) で fixed 配置で根治。最終 335 tests PASS（既存 + isBgLight 4 + computeCueItems グルーピング 3）、tsc clean、build 成功、20+ コミット 1 push。**「自分のプラン」バッジ機能（前セッションで実装した管理画面の ✓ バッジ）は個人特定回避方針で諦め決定**。

- **前セッション（2026-05-01・野良主流 管理画面拡張）**: ボトムシートの「野良主流」カードを管理画面から個別に非表示にできる機能を新設。背景: 共有プランが少ないコンテンツ（M9S・オメガ系等）でコピー数 0 でも自動 1 位として運営テストプランが顔を出していた問題を解消。設計書 `docs/superpowers/specs/2026-05-01-popular-admin-management-design.md`、実装プラン `docs/superpowers/plans/2026-05-01-popular-admin-management.md`、subagent-driven-development で 8 task 進行。Firestore に `shared_plans/{id}.hidden` フィールド追加、管理画面 AdminFeatured.tsx に「野良主流ビュー / URL 検索」セグメント追加。312 tests PASS、tsc clean、@testing-library/jest-dom 追加 + happy-dom 環境化。

- **前セッション（2026-05-01・LoPo Support Page (/support) 公開 + 順序バグ修正 + PopularPage 削除）**: 3 トピックを 1 セッションで完了。①ボトムシート「絶」タブの順序がサイドバーと不一致だった bug を修正（`MitigationSheet.tsx` の `ultimateIds` を `getAllUltimates()` 経由に統一、patch 降順 + order 昇順ソートで DMU 先頭に）②未使用 `PopularPage.tsx` を削除（ボトムシート統合済みで動線ゼロ、`<Route path="*" → />` の fallback で /popular 直アクセスは LP リダイレクト、`api/popular` API・`PopularConsentDialog`・`popular.*` i18n は野良主流ボトムシートが使うため全部保持）③**LoPo Support Page (/support) 新設**: Ko-fi へ飛ぶ前に 4 言語で支援内容を説明する専用ページ。設計書 `docs/superpowers/specs/2026-04-30-lopo-support-page-design.md` Revision 2、実装プラン `docs/superpowers/plans/2026-04-30-lopo-support-page.md`。subagent-driven-development で 10 task 進行（i18n 4 言語 21 キー / LegalPageLayout export 化 / SupportPage TDD 4 vitest / Route 追加 / LP+Sidebar の Ko-fi 直リンク → /support 内部リンク化 / sitemap.xml / Playwright E2E 14/14 PASS）。Revision 2 で大幅拡充: 私の想いセクション（ファーストビュー）/ Ko-fi とは（PayPal や Stripe 経由でカード情報が LoPo に届かないと明記、心理的ハードル下げ）/ 支援するとどうなるの？（¥500/1000/3000/5000/9000 の 5 段階プロテインユーモア + 維持費明記の冷静な注釈）/ 派手 CTA ボタン（☕ 大型化・shadow・ホバー浮き上がり）。LegalPageLayout に `window.scrollTo(0, 0)` 追加で /miti から遷移時のスクロール位置引き継ぎバグも解消（Privacy/Terms/Commercial にも副次的に効く）。Ko-fi 側プロフィール（カバー画像・アバター・About 4 言語・サンキュー 4 言語・Suggested 500/3000/9000・Minimum 500・Membership/Goal/Shop/Commission 全て無効化）もユーザー設定完了。本番実機確認 OK、リスク低の変更で完了。特典（バッジ/Discord ロール/ログインアイコン装飾等）は「個人情報取得を避ける LoPo 方針」で全て不採用。

- **前セッション（2026-04-30 終盤・Phase 5.4 実機 OK + Discord アプデ作成）**: スキルモード切替インフラ Phase 5.4 実機確認 → ユーザー目視で UI 変化ゼロ確認、土台確定。8.0 アナウンス時の残作業は admin の差分入力 UI / `DEFAULT_NEW_MODE` 1 行切替 / autoPlanner mode 解決対応の 3 点（既に follow-up に記載）。続いて 4 月中旬〜下旬のユーザー向け変更を Discord アプデ用に集約（絶妖星乱舞追加、イベントモーダル UI 刷新、ダメージ値スプリング演出、スマホ空行操作、共有モーダル OGP プレビュー修正、致命バグ修正、自動採番、LP SEO 多言語、8.0 裏側準備）。3D アイコンアニメ拡充は brainstorming 開始したが「現状の完成度で十分」とユーザー判断で見送り（地球儀アイコン回転等の案あり、将来余力があれば再検討）。

- **前セッション（2026-04-30・スキルモード切替インフラ Phase 1-5 完了）**: 8.0 でエヴォルヴモード実装確定情報を受け、リボーン/エヴォルヴ切替の土台を 8 コミット（Phase 1=型 / 2=resolveMitigation 実装 / 3.1=autoPlanner 配線 / 3.2-3.3=コメントのみ / 4=INITIAL_PARTY mode 注入 / 5.1-5.2=互換性ガード+想定外ケーステスト 21 件）で構築。subagent-driven-development（implementer + spec/quality 2 段階レビュー）で全 Phase 進行、main 直接、UI / admin / Firestore / api 一切触らず。`Mitigation.modes?` と `PartyMember.mode?` Optional 追加 → `resolveMitigation(m, mode)` 単一動線で差分マージ → 既存プランは `getMode()` フォールバックで永久に reborn 扱い、新規プランは `DEFAULT_NEW_MODE`（現状 `'reborn'`、8.0 時に 1 行で `'evolved'` に切替）が `INITIAL_PARTY` で書き込まれる。設計書: `docs/superpowers/specs/2026-04-30-skill-mode-infrastructure-design.md`、プラン: `docs/superpowers/plans/2026-04-30-skill-mode-infrastructure.md`。build+test 289 PASS（既存 253 + 新規 36）、tsc --noEmit clean、snapshot diff ゼロ、push→Vercel デプロイ済み。Final code reviewer 指摘は 2 件とも spec の YAGNI 線内（usePlanStore.ts 138-144 はラベル変換で PartyMember 生成ではなく実害なし、autoPlanner.ts isAvail/place の raw getMiti は 8.0 で実 evolved データ投入時に対応で十分）。

- **前セッション（2026-04-30 翌日・ダメージアニメ Revision 3「ゆったり化」）**: Revision 2 で頻度が約 95% 削減された結果「たまに出るアニメをもっとドラマチックに」したいユーザー要望に対応。プレビュー HTML を再 tuning しやすく拡張（Reset 値を実装値に同期、スライダー上限拡大、ドラマチック試案/スプリング試案のプリセットボタン追加）→ ユーザーがブラウザで複数案を比較 → **スプリング(out-back)案を採用**。Enter 150ms/15px/22ms out-expo → **380ms/26px/32ms out-back**（軽くオーバーシュートでぴょこっと乗る感じ）、Exit 120ms/-3px/10ms → **150ms/-6px/12ms**。AnimatedDamage.css/tsx の数値更新、テストの `advanceTimersByTime` を 200→240 に同期。設計書 Revision 3 セクション追記。build+test 253 PASS、commit→push→Vercel デプロイ済み。

- **前セッション（2026-04-30・ダメージ値変化アニメーション追加）**: 軽減表の軽減後ダメージ値に per-character bottom-up アニメーション追加。pixel-point/animate-text の `bottom-up-letters` 仕様を参考（コードはコピーせず数値レシピのみ参考、ライセンス安全策）。①新規 `AnimatedDamage` コンポーネント (.tsx + .css + 9 tests)、TimelineRow.tsx (PC) と MobileTimelineRow.tsx (スマホ) に統合 ②スライダー付きプレビュー HTML (`tmp/damage-anim-preview.html`) でユーザーが数値を tuning ③`prefers-reduced-motion` 完全対応 ④**Revision 2 適用**: 「アニメ前に一瞬全体が消える」問題と「常時アニメは過剰」のフィードバックを受けて、(a) 致死状態 (isLethal) 反転時のみアニメ起動（値変化は致死維持ならサイレント更新）、(b) Sequential → Overlap 方式に変更（exit-layer と enter-layer を `position: absolute` で重ねて並行実行）、SWAP_DELAY_MS 撤廃。同時アニメ件数約 95% 削減でパフォーマンス劇的向上。設計書: `docs/superpowers/specs/2026-04-30-damage-value-animation-design.md`、セーフティタグ `pre-damage-anim` 残置。

- **前セッション（2026-04-29・絶妖星乱舞 (DMU) 追加 + 関連 UX 改善）**: 7.51 で実装予定の新規絶コンテンツ「絶妖星乱舞 / Dancing Mad (Ultimate) / 妖星乱舞绝境战」を追加。①contents.json + Firestore（管理画面）両方に dmu 登録、ko 欄空欄で en→ja フォールバック ②管理画面のコンテンツ編集に「FFLogs URL 貼付→ID 自動抽出」機能追加（正規表現 /encounter[=/](\\d+)/、AdminContentForm.tsx に純粋関数 + state + JSX）③Sidebar の絶タブで正式名称が幅半分しか取れず省略されていた問題（flex-1 スペーサーが name と等分されていた古い設計）を、絶タブ時のみスペーサー非表示で修正 ④Sidebar の韓国語フォールバックを ja 直行から en→ja の順に統一（他画面 getPhaseName と整合）⑤Timeline.tsx で空プラン (timelineEvents.length===0) を開いたとき hideEmptyRows=false で強制展開（テンプレ未整備の新規コンテンツで時刻軸が見えない問題を解消）⑥鼓舞展開バリアント Tooltip i18n 化、CRIT_MULTIPLIER 集約も完了。build+test 244 PASS、ユーザー実機 OK、デプロイ完了。

- **前セッション（2026-04-29・イベント追加モーダル UI 全面改善）**: 設計書 `docs/superpowers/specs/2026-04-29-event-modal-mitigation-improvements-design.md` + 実装プラン `docs/superpowers/plans/2026-04-29-event-modal-mitigation-improvements.md` に基づき、PC/スマホ共通の EventModal.tsx を全面改善。20 コミットを EventModal.tsx ファイル内に閉じて他コンポーネントへの影響ゼロで実施: ①並び順を 3 グループ構成（全体軽減 → タンクLB → 個別軽減）に再構成、各グループ内ロール T→H→D → ジョブ順 → リキャスト短→長、前提スキル (requires) は親の直後に配置 ②純粋回復スキル自動除外ルール追加（healingIncrease なしを判定） ③mantra/nature_s_minne を EXCLUDED から復帰、riddle_of_earth と aspected_helios を追加 ④単体バフ (scope='target') 選択時に MT|ST トグル UI を直下に表示、計算で被対象者と突合 ⑤鼓舞展開 3 バリアント実装（展開戦術 / +秘策 / +秘策+生命回生法）、排他選択、CRIT_MULTIPLIER 1.60 と protraction.healingIncrease 動的取得で実シールド倍率計算、学者不在時 DEFAULT_HEALER_STATS フォールバック、アイコンは「展開戦術ベース＋右上秘策バッジ＋右下生命回生法バッジ」の重ね方式 ⑥ニュートラルセクト押下で lv96+ コンジャ／lv95- アスペクト・ヘリオスのバリアを自動加算（占星不在時もフォールバック）、SKILL_DATA キー名に揃えて修正 ⑦Timeline.tsx のプラン切替 useEffect で「チュートリアル中 or 空プラン」では hideEmptyRows リセットをスキップ。build+test 244 PASS、ユーザー実機 OK、デプロイ完了。
- **前セッション（2026-04-29・PC イベントモーダル軽減プレビュー）**: PC のイベント追加モーダル「使用された軽減・バリア」横の選択軽減プレビューが `slice(0, 4)` ハードコードで 4 個固定 + `+N` 省略になっていた問題を修正。`flex-wrap` で全件表示・右寄せ・必要に応じて折り返し、`+N` 省略を撤去、ラベル側に `shrink-0` で折り返し防止。スマホ側（MobileTimelineRow）は別実装のため影響なし。build+test 244 PASS、ユーザー実機 OK 確認済み。
- **前セッション（2026-04-29・離脱ダイアログ廃止 → revert）**: タブ離脱ダイアログを削除する変更を入れたが、ユーザー報告で別端末同期不整合・PC のデータが古い状態に戻る等の症状が判明。原因仮説は「旧コードはダイアログ表示の数秒間で Firestore SDK の async write が完了していたのが、削除後は完了前にタブが閉じる」。被害最小化のため 2 コミット即 revert して元の挙動に戻した。離脱ダイアログは復活、データ同期は元の信頼性に戻る。build+test 244 PASS、デプロイ完了。
- **前セッション（2026-04-29・SEO canonical 追加）**: Search Console「ページにリダイレクトがあります」通知の調査。対象は `http://lopoly.app/` のみで HTTP→HTTPS の正常 308、対処不要と判明。あわせて SEO 改善の基礎固めとして `useCanonicalUrl` フックを新設、全公開ページ（/、/miti、/share/:id、/popular、/privacy、/terms、/commercial）に `<link rel="canonical">` を動的注入。SPA で utm パラメータ・末尾スラッシュ違いが重複ページ判定されるのを防ぐ。build+test 244 PASS、デプロイ完了。次は Search Console URL 検査での再クロール要求。
- **前セッション（2026-04-29・プラン切替リセット）**: ユーザー報告「別プランを開いても横スクロール位置と空行非表示トグルが引き継がれる」を修正。`Timeline.tsx` のプラン切替 `useEffect` が `scrollTo({ top: 0 })` で縦のみリセットしていた点を `top: 0, left: 0` に拡張、加えて `setHideEmptyRows(true)` を呼びコンパクト表示に戻す。フェーズ列・ラベル列の折りたたみはユーザー操作の状態を維持する判断で意図的に触らない。build+test 119 PASS、デプロイ完了、実機 OK（チュートリアル含む）確認済み。
- **前セッション（2026-04-28 深夜・スマホ空行操作）**: スマホでイベントの無い行にも軽減配置・イベント追加できるように改修。`MobileTimelineRow.tsx` の長押し／タップ両方の `events.length > 0` ガードを撤去、`onLongPress` 引数を `TimelineEvent | null` に拡張。`Timeline.tsx` `handleMobileLongPress` で event=null のとき直接 EventModal を開く（PC の `+` ボタン相当）。空行表示は既存の `hideEmptyRows` トグル（FAB）に依存、変更なし。build+test 244 PASS。
- **前セッション（2026-04-28 終盤・5 段目）**: 4 段目で OGP プレビュー本体は治ったが「URL の生成に失敗」トーストがたまに発生。原因は **PUT /api/share のレート制限 5 回/分**で、ロゴ操作を連続でやると到達してしまうこと。共有モーダルでのロゴ追加・削除・トグルは正常な使い方なので、レート制限を **5 → 15 回/分に緩和**。PUT は既存共有のロゴ差し替えのみで破壊的でなく、サーバーコストも軽量で安全。build+test 244 PASS。
- **前セッション（2026-04-28 終盤・4 段目）**: 3 段目でも治らない真の根本原因を特定。**React closure 問題**だった。`processLogoFile` で `setTeamLogoUrl(url)` 直後に `await updateShareLogo(true)` を呼んでいたが、updateShareLogo の closure 内では teamLogoUrl がまだ古い null のまま。結果サーバーに「ロゴ無し PUT」を送ってしまい同じロゴ無し imageHash が返ってきて React bail-out。「右上の更新ボタンで動く」のは次の render 後で closure が更新されているから。**updateShareLogo に `logoUrlOverride` 引数を追加**して `processLogoFile` から最新 url を直接渡し、closure を回避。これが本質的修正。
- **前セッション（2026-04-28 終盤・3 段目）**: `updateShareLogo` 冒頭で `setOgImageUrl(null)` を挟んで `<img>` を確実にアンマウント→マウント。state bail-out 対策。closure 問題が真因だったため、3 段目だけでは不十分だが保険として有効。
- **前セッション（2026-04-28 終盤・2 段目）**: ShareModal の `<img>` に `key={ogImageUrl}` を追加して URL 変更時に強制再マウント。サーバー側 PUT 200 成功しても /og/ リクエストが発行されない事象への対策。Vercel ログで判明。
- **前セッション（2026-04-28 終盤）**: 共有モーダル OGP プレビュー「永遠に生成中」バグ修正 1 段目。原因は **古い PWA Service Worker が `/og/{hash}.png` のフェッチを呑んで永遠 Pending にする** 事象。systematic-debugging で `<img>` 要素は DOM 存在 + src 正しい→ブラウザがリクエスト未発行→SW unregister で復活、を順に検証して特定。`vite.config.ts` の workbox `runtimeCaching` に `/og/[a-f0-9]{16}.png` を **NetworkOnly** で明示追加。新版デプロイ後に新 SW が `clientsClaim` で即時切替される。
- **前セッション（2026-04-28 後半）**: 致命バグ修正＋同意ダイアログ白背景化＋プラン名自動採番。①PopularConsentDialog をライトモードで白背景化（他主要モーダルと同じ `--share-modal-bg` を適用）。②**致命バグ**: 野良主流ボトムシートからのコピーで `ownerId: ''` 空文字になっており、雲同期で「別端末で削除」と誤判定されてプランが丸ごと消滅していた問題を修正（過去 4 回直したのと同パターンが新規入口に再発、`ownerId: 'local'` に統一）。③`generateUniqueTitle` ユーティリティを新設し、野良主流コピーと「下にコピー」の両方で同コンテンツ内重複時に `(2)` を自動採番。build+test 244 PASS。
- **前セッション（2026-04-28）**: 野良主流 OGP 表示ポリシー整理 完了。プラン名 OGP 焼き込み機能を全削除（lib/API/UI/i18n）、野良主流シート・ページのカードからプラン名撤去、X 共有テキストも `コンテンツ名` のみに。共有モーダル初回 POST 直前に同意ダイアログ表示（localStorage 永続）、ロゴトグル＝身元公開意思の明確化、4 言語常駐キャプション追加。設計書: `docs/superpowers/specs/2026-04-28-popular-ogp-consent-design.md`
- **前セッション（2026-04-20 後半）**: LP の SEO 改善（レベル 1）完了。index.html / 4 言語 locale / LandingPage.tsx を更新し、「FF14 軽減表」等の検索キーワードをメタタグに反映。多言語対応（ja=軽減表、en=mitigation sheet、ko=경감 시트、zh=减伤轴）。見た目変更なし、build+test 成功。設計書: `docs/superpowers/specs/2026-04-20-lp-seo-meta-multilingual-design.md`
- **前セッション（2026-04-20）**: Vercel 2026年4月セキュリティインシデント対応。Vercel CLI 導入、監査（不正侵入痕跡ゼロ確認）、全カスタム環境変数を production/preview で sensitive 化（29本）、動作確認＆デプロイ完了。
- **前セッション（2026-04-18 夜）**: 学者エーテルフロー実機確認後の調整。削除/ずらし尊重ガード追加（hasAnyAetherflow）、ポップアップ「いいえ」廃止＋×/Esc 化＋ライトモード白背景化。デプロイ済み、実機再確認は次セッション。
- **前セッション（2026-04-18 後半）**: 学者エーテルフロー仕様を全面刷新。スキル化＋自動配置＋ポップアップ実装、Pattern 切替ボタン廃止。
- **前セッション（2026-04-18 前半）**: サイドバータブリセットバグ修正 + ヘッダー罫線統一 + フェーズ/ラベル境界系3連修正 すべてデプロイ・検証済み
- **シークレット漏洩 3層防御 導入済み（全プロジェクト自動診断）**

### 次にやること（優先順）
- **マイコラージュ（別プロジェクト）を急ぐ**: ユーザー優先指示。完了次第ハウジング着手
- **プライバシー §1c + support /support 実機確認**: Ko-fi/PayPal の届く情報 / 私のお約束 / 自衛策 / ☕ ボタン直前注釈 / cta_subtext「単発のみ」/ 特商法ページ PayPal 表記 / 4 言語表示（ja/en/ko/zh、ko の §1b は en フォールバック）
- **PiP UI 反復後 実機軽くチェック**: ALL トグル / ジョブアイコン opacity ON/OFF / カラー〇 + デフォルト色スウォッチ並列 / +1 バッジ切替 / cursor-text + メモ × リセット / FAB メニュー古い端末での fade + ↓ + 言語チップ Portal 表示 / 各ページのブラウザタブ表示
- **野良主流 管理画面拡張 実機確認**: /admin/featured で「野良主流ビュー」が開けるか、零式/絶タブ切替・コンテンツ選択・上位10件カード表示・★ Featured トグル・🚫 Hidden トグル・実際にボトムシート野良主流から消える（最大 15 分キャッシュ反映、`?t=Date.now()` で即時確認可）
- **ハウジングツアープランナー着手**: マイコラージュ片付いてから着手。要件定義済み・Pretext 採用決定。docs/ 内の関連設計書から再開
- **Revision 3 実機確認（ダメージアニメ）**: 致死クロス時のみスプリング演出が出ること、out-back の overshoot で文字が slot からはみ出さないこと、連続クロスで乱れないこと、`prefers-reduced-motion` ON で消えること
- デプロイ確認: サイレント圧縮の実動作（2026-04-20以降に確認）

### 野良主流 管理画面拡張 完了 2026-05-01
- [x] `shared_plans/{id}.hidden` フィールド追加（undefined OK、既存ドキュメント無影響）
- [x] GET /api/popular: hidden=true プランをスコア / featured 両方から除外
- [x] PATCH /api/popular: `{shareId, featured?, hidden?}` 受付、不整合ガード（body + 現在値 両対応）、hiddenAt/hiddenBy 監査フィールド、og_image_meta.keepForever cleanup
- [x] GET /api/admin?resource=popular: 上位 10 件 + hidden 含む全件、defense-in-depth (CORS + AppCheck + rateLimit + try-catch)、ownerUidSuffix プライバシー
- [x] `popularFilters.ts` に scoring helper extract（公開/管理画面で drift 防止）
- [x] i18n 22 キー × 4 言語 = 88 キー追加
- [x] PopularBrowseView コンポーネント (4 vitest test、@testing-library/react + happy-dom)
- [x] AdminFeatured セグメント化（野良主流ビュー デフォルト / URL 検索）
- [x] URL 検索ビューに Hidden トグル追加 + Status 行で featured/hidden 同時表示

### LoPo Support Page (/support) 完了 2026-05-01
- [x] /support ページ新規追加（4 言語、Revision 2 で想い・Ko-fi 説明・5 段階金額表・派手 CTA まで実装）
- [x] LegalPageLayout 経由でスクロール位置リセット修正（Privacy/Terms/Commercial にも副次効果）
- [x] LP フッター + サイドバー下部の Ko-fi 直リンクを /support 経由に変更
- [x] Ko-fi 側プロフィール（カバー・アバター・About 4 言語・サンキュー 4 言語・Suggested 500/3000/9000・Minimum 500）設定完了
- [x] 本番実機確認済み（直アクセス / LP・サイドバーから遷移 / スクロール修正 / ダーク&ライト / 4 言語 / Ko-fi ボタンで ko-fi.com/lopoly が開く）

### 順序バグ + PopularPage 削除 完了 2026-04-30 終盤
- [x] ボトムシート絶タブで DMU が一番上に来るよう修正（getAllUltimates() 経由に統一）
- [x] 未使用 PopularPage.tsx 削除（API・同意ダイアログ・i18n は保持、SPA fallback で /popular 直アクセスは LP リダイレクト）

### スキルモード切替インフラ Phase 5.4 実機 OK 確認済み 2026-04-30 終盤
- [x] 既存プランをロードしてエラー無し
- [x] 軽減配置・削除・移動が従来通り
- [x] ジョブ変更が従来通り
- [x] シールド表示・オートプラン・学者エーテルフロー自動配置が従来通り
- [x] 共有リンク作成・OGP プレビューが従来通り

### スキルモード切替インフラ 8.0 アナウンス時 follow-up
- [ ] **`DEFAULT_NEW_MODE` を `'evolved'` に切替**: `src/utils/mitigationResolver.ts` の 1 行変更で新規プランのデフォルトモードを切替。既存プランは `mode` 未指定 → `getMode()` フォールバックで `'reborn'` を維持
- [ ] **admin 画面に「エヴォルヴ差分」入力 UI 追加**: 既存 `SkillFormModal` 拡張で `Mitigation.modes.evolved` を編集可能に
- [ ] **PartyMember カードにモード切替 UI 追加**: 既存 UI への小規模追加でメンバー個別の `mode` を切替可能に
- [ ] **autoPlanner.ts `isAvail`/`place` を mode 解決対応**: 現状 `getMiti` で raw を直接読んでいる recast/duration を `memberSkills` 経由（mode 解決済み）に切替。実 evolved データ投入時のみ必要
- [ ] **resourceTracker.ts を mode 解決対応**: `8.0` で `resourceCost` 構造が分岐する場合、関数シグネチャに `party` 追加 + `resolveMitigation` 経由に切替（必要時のみ）
- [ ] **必要に応じ自動配置ロジック分岐対応**: 学者エーテルフロー初期配置 / オートプランの mode 分岐は来てから判断

### 絶妖星乱舞 (DMU) フォローアップ — 6月実装前後で対応
- [ ] **patchStats['7.51'] の追加**: SE が 7.50/7.51 パッチノートで IL 上限・装備ステータスを公開したら、管理画面 → ステータス → patchStats に 7.51 用の tank/other ステータスを登録。`defaultStatsByLevel: { 100: '7.40' }` の 100 を 7.51 に切り替えるかは要検討（既存 Lv100 コンテンツへの影響あり）
- [ ] **FFLogs Encounter ID 追加**: 6月実装後、FFLogs 側で encounter ID が割り当てられたら、管理画面 → コンテンツ → 絶妖星乱舞 → 上級者設定 → 「FFLogs URL を貼り付け」欄に FFLogs ランキングページ URL を貼ると自動で ID 入力される
- [ ] **韓国語正式名称追加**: 韓国版 FF14 で 7.51 対応・公式名公開後、管理画面 → コンテンツ → 絶妖星乱舞 → 名前（韓国語）欄に入力
- [ ] **テンプレート整備**: 6月実装後、ACT 持ちユーザーから FFLogs ログが集まったら管理画面 → テンプレートで攻撃タイムライン整備（自動で蓄積されるわけではなく管理者の手動作業）

### スマホ空行への軽減配置・イベント追加 2026-04-29 — 実機 OK 確認済み

### プラン切替時のスクロール/空行非表示リセット 2026-04-29 — 実機 OK 確認済み（チュートリアル含む）

### 前セッション実機検証（致命バグ修正 + 自動採番 2026-04-28 後半）すべて OK
- [x] 野良主流ボトムシートから FRU コピー → 雲同期 → プランが消えないこと
- [x] 同じプランを 2 回コピー → 2 つ目が `タイトル (2)`、3 つ目が `(3)` になる
- [x] サイドバー「下にコピー」も同コンテンツ内のみで採番されること
- [x] 別コンテンツに同名プランがあっても採番に巻き込まれないこと
- [x] PopularConsentDialog がライトモードで白背景になっていること

### 相談したい（次セッションで着手検討）
- **リキャスト本格表示**: 各スキルのリキャストを実戦に近い形で視覚化したい。具体案（CD 棒グラフ重ね／次使用可能時刻ホバー等）は未定、着手前に Claude と相談
- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワードを盛り込む。デザイン変更伴うため、現状英語ミニマリスト美学とどう両立するかを相談
- **SEO 効果計測**: Search Console 未導入。導入すれば実際に流入しているキーワードを把握できる

### 次セッションで実機再確認すること（学者フロー調整 2026-04-18 夜）
- [ ] エーテルフローを削除した後、ジョブ一括更新やパーティ操作で復活しないか
- [ ] エーテルフローを大きくずらしても初期配置 (t=13,73,...) が補充されないか
- [ ] 賢者→学者にジョブ変更 → 転化＋フローが自動配置されるか
- [ ] 編集後保存→再読込でユーザー編集が保持されるか
- [ ] 「野良主流」ボタンから popular プラン（旧 Pattern 2）を開くと migration が走るか
- [ ] ポップアップが ×/Esc/背景クリックで閉じる、ライトモードで白背景になっているか

### イベント追加モーダル 残課題

#### 優先度: 高
- **計算ロジック責務肥大（リファクタ）**: `EventModal.tsx` の `handleCalculate` が healingIncrease 集計 / scope フィルタ / MT-ST 突合 / 鼓舞展開 / ニュートラルセクト分岐 / value mitigation / shield calc など 8 段階を担う。`applyHealingIncrease` / `applyMitigationFilters` / `applyShieldCalc` 等への分割を検討。Timeline 本体側の同種計算（calculator.ts）と重複している部分は将来共通化すべき
- **CRIT 倍率のステータス連動**: 現状 `calculator.ts` の `CRIT_MULTIPLIER = 1.60` は固定値（コメントにも "approx 1.60 for now"）。本来 FF14 のクリティカル倍率は装備のクリダメステータスから `1.40 + (CRIT - 420) × 200 / 100000` で算出される。IL/装備帯ごとに 1.55〜1.65 程度で変動。`getCritMultiplier(level, ilv?)` 関数化 + 設定画面での IL 切替 UI が理想。calculator.ts の CRIT 計算箇所すべてに波及するため中規模の機能追加

#### 優先度: 最低（やらない判断もアリ）
- **Phase 3（理想形・別セッションで設計）**: パーティメンバー個別 (H1/H2/D1-D4) の target 指定 / 鼓舞インスタンス選択 UI / Timeline と同じ owner/targetId モデル統合。実用上は MT/ST トグルで足りているため優先度最低

### 既知の残課題
- **同期不安定（2026-04-29 報告）**: 軽減配置直後にタブを閉じて別端末で開くと出ない / 同期ボタンを押しても出ない / 同期競合コピーが作られる / PC データが古い状態に戻る等の複合症状。離脱ダイアログ廃止が悪化させた可能性が高く revert 済みだが、症状が「前から起きていた」可能性もユーザー認識あり。根本対応案: (1) sendBeacon ベースの独自同期エンドポイント新設、(2) `syncDirtyPlans` の競合判定ロジック見直し（updatedAt のクライアント時計依存）、(3) PULL 時の上書き条件を `updatedAt` だけでなくバージョン番号併用に変更。中規模工数、別セッションで設計から検討。
- ヘッダー縦罫線 2 番目のサブピクセル残存（実害なし、放置判断）
- **同期済みプランをローカル削除→即同期で復活する潜在バグ**（2026-04-28 後半発見）。原因: `deletePlan` が `ownerId === 'local'` のとき `_deletedPlanIds` に追加せず、Firestore に削除指示を出さない。同期成功後もローカルの `ownerId` は `'local'` のまま。発生条件は限定的（削除直後に新規コピー＆同期）でユーザー判断「重要度低」。修正方針: `syncDirtyPlans` 同期成功後に ローカル `ownerId` を `uid` に書き換える根本対応が必要。同期ロジックの中核に触るため別セッションで設計から検討。

---

## バグ・不具合（要修正）

### 中
- [ ] ラベル名が管理画面で取得できない（スプシヘッダー問題？）

### 低（動作影響なし・エッジケース）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい
- [ ] パルス設定: カスタムカラーのスライダー初期位置が端に寄る（軽微）
- [ ] ヘッダー縦罫線 2 番目のみサブピクセルで細く見える（`w-px shrink-0` 適用後も残存、実害なし）

### Phase 2 後の follow-up（優先度低）
- [ ] `api/popular/index.ts` `mapDoc` と `PopularEntry` 型の `viewCount` フィールドは Phase 2 以降未使用 → 削除整理
- [ ] en/ko の `privacy_section1_auto_items` 既存翻訳でインラインコンマが bullet 分割される pre-existing バグ
- [ ] クライアント dedup の書き込みタイミング問題（`MitigationSheet.tsx` `copyPlan`）: POST 失敗でも localStorage に残る

---

## 未着手

### 多言語
- [ ] ハウジングツアーページの言語対応
- [ ] AA名統一: 英語も"AA"に変更（中韓も同様）

### その他
- [ ] モーダル出現アニメーション改善（スプリング物理ベース、設計書あり）
- [ ] 本番動作確認（ギミックグループ・フェーズ編集・翻訳伝播・ダメージインポート）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）
- [ ] セキュリティ: 認証方式のプライバシー調査 / localStorage認証トークン / Google Fonts SRI / Firestoreパス検証

### 新機能（将来）
- Floating Timeline (PiP): Tauri v2が現実的
- FFLogsインポート精度向上: 敵攻撃データ取得、テンプレート昇格、API制限解除申請
- ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- SA法オートプランナー改善 / AI APIでオートプラン
- 詠唱バー注釈機能 / チートシートモード検討
- public/icons/ 削除（バンドル2.1MB削減）

### UI改善（検討中）
- [ ] アイコンアニメーション化（SVGアニメ、FFLogsボタン等）
- [ ] 紹介PV動画: CapCut/DaVinci Resolveでの制作を検討

---

## アイデア・やりたいこと
- YouTube埋め込み / こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション / UI温度感改善
- オートプラン精度改善（スプシ教師データ・スコアリングモデル）
- YouTube導線: ジョブごとにスキル回し動画URL設定→アイコン表示
- スクショOCR: ゲーム画面から軽減自動読み取り
- 管理画面FFLogsインポート（テンプレート作成効率化）
- 横型タイムライン＋音ゲーモード（PiP）
- Gemma搭載AI機能

### 多言語リファレンスURL（zh/ko翻訳作業用）
- 韓国語: https://guide.ff14.co.kr/job/paladin/1?type=E#pve
- 中国語: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index

## バックログ（運用・品質・検討中）
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ

---

## プロジェクト方針

### スキルデータ管理
- **正本: Firestore**（管理画面から追加・編集するのが正規ワークフロー）
- **mockData.ts**: フォールバック + テスト用 + 初期seed用
- **seed-skills-stats.ts**: マージ型（Firestoreのみのスキルは保持）

### SNS Build in Public
- 進捗時にJP+ENツイート案を提案（ツリー形式、"Translated by AI" 付記）
- #LoPo #FF14 #BuildInPublic #AISelection
