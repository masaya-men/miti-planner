# 共同編集 ジョイナー画面 本物UI再利用(viewer mode) 設計書 (2026-06-13)

> ジョイナー(`/collab/:roomToken` で他人の共有表を見る/編集する画面)を、**本物の編集画面とピクセル単位で同一**にし、操作できない部分だけ `禁止カーソル` で塞ぐ(Google Docs / Figma の閲覧モード = 業界水準)。あわせて公開前のバグ2件(編集解禁・人数上限)と参加者表示を仕上げる。

前提: branch `feat/collab-public-release`(main から派生・admin gate で本番は一般非露出=作業中も実ユーザー影響ゼロ)。これまでの「手作りジョイナー専用ヘッダー/フッター」は本物と必ずズレるため**廃止**する。アーキテクチャ分析(Plan agent)の結論=**方式B採用**。

---

## 1. 方針(なぜ方式B=本物部品の読み取り専用再利用か)

ユーザー要望「本物の表を開いているときのレイアウトをそのまま見せ、押せない所だけ塞ぐ」を、**ライブの実ユーザーを壊さず・ジョイナー自身のデータも漏らさず**満たす。

- **却下=方式A(usePlanStore に一時プランを注入して本物 Layout を丸ごと描画)**: `partializePlanState`([planPersist.ts:31-38](../../../src/store/planPersist.ts#L31)) に per-plan 除外が無く、全保存ホットパスに変更が要る/Layout 自動保存 subscribe([Layout.tsx:280](../../../src/components/Layout.tsx#L280) `syncToCloud`) は viewer では `_collabActive` ガードが効かず Firestore へ漏れうる/サイドバーに部屋が出る/離脱 cleanup が `beforeunload` と競合。**実ユーザー保護機構を触る=高リスク**。
- **採用=方式B(Layout を使わず、本物の `ConsolidatedHeader` を `viewer` プロップで読み取り専用再利用＋フッターを共有部品 `AppFooter` に抽出)**: Layout を mount しない=自動保存/サイドバー/persist の機構に**一切触れない**。既存の `_collabReadonly`([CollabJoinerPage.tsx:83](../../../src/components/CollabJoinerPage.tsx#L83))が localStorage を守る。`ConsolidatedHeader` への変更は**追加的(`viewer` プロップ未指定=従来挙動そのまま)** なのでメインアプリは**バイト単位で不変**。**最小リスク**。

---

## 2. スコープ

### 2.1 フッターを共有部品 `AppFooter` に抽出(低リスクの確実な一致)
- 本物フッター = [Layout.tsx:686-719](../../../src/components/Layout.tsx#L686)(著作権+免責+法的情報ポップオーバー[privacy/terms/commercial]+Discord+X+パルス設定)。`footerLegalOpen` state は現在 Layout に持ち上げられているが、抽出先 `src/components/AppFooter.tsx` 内に閉じ込める。
- Layout のインライン フッターと、ジョイナーの手作りフッター([CollabJoinerPage.tsx:196-206](../../../src/components/CollabJoinerPage.tsx#L196))の両方を `<AppFooter />` に置換。**純粋なマークアップ移動・store 非依存**=フッターのズレが根治。

### 2.2 `ConsolidatedHeader` に読み取り専用 viewer ソースを追加(追加的・既定不変)
- 追加プロップ `viewer?: { contentId: string | null; ownerLabel: string | null }`。**未指定なら現状の挙動そのまま**(メインアプリ無影響)。
- `viewer` 指定時:
  - コンテンツラベルを `viewer.contentId` から `getContentById` で解決([:116-121](../../../src/components/ConsolidatedHeader.tsx#L116) のロジックを流用)。`currentPlan` には触れない。
  - タイトル表示は `viewer.ownerLabel`(空なら汎用)。タイトルのダブルクリック編集([:188-200](../../../src/components/ConsolidatedHeader.tsx#L188))は**無効**。
  - viewer で**無効化(`disabled` + `cursor-not-allowed`)するボタン**: ShareButtons([:213](../../../src/components/ConsolidatedHeader.tsx#L213))/パーティ編成([:264](../../../src/components/ConsolidatedHeader.tsx#L264))/ステータス設定([:277](../../../src/components/ConsolidatedHeader.tsx#L277))/軽減自動組み立て([:289](../../../src/components/ConsolidatedHeader.tsx#L289))/Import・FFLogs([:299](../../../src/components/ConsolidatedHeader.tsx#L299))/人気プラン([:316](../../../src/components/ConsolidatedHeader.tsx#L316))/自分のジョブをハイライト([:325](../../../src/components/ConsolidatedHeader.tsx#L325))/並び替え([:341](../../../src/components/ConsolidatedHeader.tsx#L341))。
  - viewer でも**有効に保つ**: ホーム([:153](../../../src/components/ConsolidatedHeader.tsx#L153))/テーマ([:225](../../../src/components/ConsolidatedHeader.tsx#L225))/言語([:238](../../../src/components/ConsolidatedHeader.tsx#L238))/ログイン([:242](../../../src/components/ConsolidatedHeader.tsx#L242))/ヘッダー折りたたみ([:373](../../../src/components/ConsolidatedHeader.tsx#L373))。
  - 単一の `readOnly = viewer != null` で分岐。

### 2.3 ジョイナーシェルを本物部品に差し替え
- [CollabJoinerPage.tsx](../../../src/components/CollabJoinerPage.tsx) の sheet ビューを `<ConsolidatedHeader viewer={{contentId, ownerLabel}} ... />`(`useCollabJoinerSession` から) + `<Timeline />`(現状維持) + 赤バナー + `<AppFooter />` に。**手作り `CollabJoinerHeader` は削除**。**Layout の自動保存機構は mount しない**。
- `font-sans`(フォント修正)は本物ヘッダー/Timeline を使えば自然に解決するが、シェル直下にも `font-sans text-app-text` を維持。
- **既存の漏洩防止 useEffect(効果A/B)・cleanup 順序は変更しない**(JSX とヘッダー差し替えのみ)。

### 2.3b 本物の外周クローム(サイドバー折りたたみハンドル + 右端装飾)を読み取り専用で再現
- ユーザー要望「完璧に見た目を同じに」: 本物編集画面の**左の折りたたみサイドバーハンドル**と**右端の装飾**([Layout.tsx:727](../../../src/components/Layout.tsx#L727) 付近)を、ジョイナーでも**同じ見た目**で表示する。
- ただし**Layout の自動保存 subscribe は登録しない**(安全の核心)。実現方法は実装フェーズで2択を検証して低リスク側を採る: (a) 本物の視覚部品(ハンドル/右端バー)だけを読み取り専用で再利用、(b) 同等の静的クロームをシェルに配置。いずれも**保存コードは動かさない**。
- これらのクロームは**操作禁止**(押すと `禁止カーソル`、または下記「抜ける」導線へ)。サイドバーのプラン一覧は**展開しない**(ジョイナーは自分のライブラリを持たない・折りたたみ状態で本物と一致)。

### 2.4 「共同編集中」クラスタ(オーナーと同スタイル) + 参加者ドット + 抜けるボタン(ユーザー案)
- 本物ヘッダーの右側に、オーナーの「共同編集中・N人」ピルと**同じスタイルのまとまり**を出す。中身:
  - **参加者の色付き光るドット**を横並び表示。**マウスオーバーで自動生成名(`nameForClient`)** を tooltip 表示(実名なし・④-b-1 roster + 既存 `nameForClient` 流用)。
  - **カーソル ON/OFF + ジョブ選択**(`PresenceControls`)。
  - **「共同編集を抜ける」ボタン**。
- **抜ける/ホームの動作**: `/` へ遷移=部屋を離脱(効果A の cleanup=rehydrate→readonly 解除が走り、ジョイナー自身のデータに戻る)→**自分の通常 LoPo 画面(サイドバーも使える)に帰る**。ログイン済/非ログインのどちらでも同じ(自分の元の画面に戻るだけ)。ヘッダーのホームボタンも同じ動作(共同編集を抜けてホームへ)。

---

## 3. バグ修正(公開ブロッカー)

### 3.1 編集解禁バグ(ログイン+同意済でも編集できない)
- **最有力原因(分析・要実機確認)**: ログイン直後 `auth.currentUser` のトークンが古く、`startCollabSession` の `params`([collabProvider.ts:133-138](../../../src/lib/collab/collabProvider.ts#L133))が**編集者クレーム認識前のトークン**を送る→サーバ④-a が editor 認可せず viewer 降格→書き込みが DO で破棄。Layout は import 用に `getIdToken(true)` で**強制リフレッシュ**するが([Layout.tsx:516-524](../../../src/components/Layout.tsx#L516))、ジョイナーには無い。
- **修正方針**: ジョイナーが `readOnly:false` で**再接続する直前**に `getIdToken(true)`(強制更新)してから接続する。加えて、特定のため**接続認可の結果を一時的にログ出力**(本番で1回実機確認→原因確定後にログ撤去)。
- 副次の容疑(再接続が `enterCollabMode` 前に teardown する/`setCanEdit` の順序)も実機ログで切り分け。

### 3.2 人数上限が動いてる部屋に反映されないバグ
- **原因確定**: 上限は部屋起動時の保存値で固定され、`set-max` 後も**動いてる部屋に届かない**([index.ts:23-34](../../../workers/collab/src/index.ts#L23) は `/count` の `max` を読むが、その `max` は onLoad 時に DO storage へ書いた値)。`fail-open` も重なる。
- **修正方針**: `set-max`(オーナーが人数変更)時に、**動いている DO へ新しい上限を即時反映**する(worker に `/set-max` 的な内部エンドポイントを足し、`collab:maxParticipants` を更新)。fail-open は維持(安全弁の一時障害で正規ユーザーを締め出さない方針)だが、上限更新の伝播を確実にする。**Worker 再デプロイ必須**。

---

## 4. 非ゴール(このリリースでやらない)
- サイドバー(プラン一覧)のジョイナー表示(ジョイナーは自分の表ライブラリを持たない=出さない)。
- カーソルなめらか化(時間ベース補間)。
- 編集履歴/元に戻す/個別キック。
- usePlanStore / Layout 自動保存機構への変更(方式A の不採用理由)。

---

## 5. 安全策(明示)
- **localStorage**: 既存 `_collabReadonly` が partialize([useMitigationStore.ts:1642](../../../src/store/useMitigationStore.ts#L1642))と全 mutator を no-op 化。一時プラン無し=`partializePlanState` に新フィルタ不要。
- **Firestore**: ジョイナーは Layout を mount しない=`syncToCloud`([Layout.tsx:280](../../../src/components/Layout.tsx#L280))が登録されない=部屋がジョイナーのアカウントに保存されない。
- **サイドバー**: Layout 非 mount=部屋がライブラリに出ない。
- **メインアプリ**: `ConsolidatedHeader` の `viewer` プロップは追加的(既定=未指定=現状描画)。回帰の影響範囲はヘッダーの条件分岐のみ=単体テスト可能。

---

## 6. 受け入れ基準(DoD)
- [ ] ジョイナー画面のヘッダー/フッター/表/**左サイドバー折りたたみハンドル/右端装飾**が**本物の編集画面と同一の見た目**(フォント・レイアウト含む)。
- [ ] 押せない操作は `禁止カーソル` + 無効化。閲覧者でも有効なのはホーム/テーマ/言語/ログイン。
- [ ] ヘッダー右に「共同編集中」スタイルのクラスタ(参加者ドット+カーソルON/OFF+ジョブ+**共同編集を抜けるボタン**)。
- [ ] ホーム/「抜ける」で**自分の通常 LoPo 画面(サイドバー使用可)に戻る**。
- [ ] ログイン+同意後に**実際に編集できる**(2ブラウザでライブ反映・保存往復)。
- [ ] 人数を 1 にしたら**動いてる部屋でも 2 人目が満員拒否**される。
- [ ] 参加者の光るドット+ホバー名が出る。
- [ ] メインアプリ(オーナーの通常編集画面)が**従来どおり**(回帰なし)。
- [ ] 全テスト緑(既知5失敗のみ)/ build EXIT=0 / yjs 遅延チャンク維持。Worker テスト緑。

---

## 7. 公開手順(順序厳守・変更なし)
1. 本書の実装(TDD)→ build+test 緑。
2. Worker 再デプロイ(3.2 で worker 変更あり=`cd workers/collab && wrangler deploy`)。
3. Vercel 反映(検証用 push)→ 2ブラウザ実機 E2E(⑤-3d・ユーザーと)。問題は1件ずつ修正→再検証。
4. **最後に** admin gate 撤去(`!isAdmin`→未ログイン)。
5. `git push origin HEAD:main` → 本番スモーク → 数日計測。
