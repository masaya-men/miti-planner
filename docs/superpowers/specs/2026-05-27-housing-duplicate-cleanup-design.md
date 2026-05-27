# ハウジング重複の自動掃除 設計書 (§3.8)

- **日付**: 2026-05-27
- **状態**: ユーザー承認済、 実装は writing-plans skill で計画化
- **スコープ**: 詳細モーダル重複一覧 (A) / 長押し「ちがった」 (B) / ツアー自動追加 (C)
- **前提**: §3.1〜§3.6 (lastConfirmedAt 追加 + sort) 完了済、 §3.7 (カードバッジ) は本作業の後段で別実装
- **参照**: 議論経緯は [docs/.private/2026-05-27-housing-video-3frame-and-phase2.md](../../.private/2026-05-27-housing-video-3frame-and-phase2.md) §3.8

---

## 1. 目的とシナリオ

FF14 ハウジングでは家主交代/撤去等で「同住所に複数の登録」 が自然発生する。 これを LoPo がモデレーター不在で自動掃除するための機能群。

**シナリオ**:
1. 住所 X に重複登録 A / A2 / A3 が存在
2. ツアー作成者が A をツアーに入れる → 自動で A2 / A3 も同ツアーに入る
3. 訪問者がツアー実行 → 現地で「A だけ本物、 A2 / A3 は別の家/撤去済」 と判明
4. 訪問者が詳細モーダルの「この住所の他の登録」 から A2 / A3 に「ちがった」 を**長押し 2 秒**
5. 1 撃 hide → 「正解」 のみ残る → 重複が自動的に掃除される

---

## 2. 機能要件

### 2.1 詳細モーダル「この住所の他の登録」 セクション (A)

**表示条件**: `hasDuplicates === true` のとき (= `HousingDetailModalRoute` で既に算出済の boolean を流用)。

**配置**: `HousingDetailContent` の **下部** (= 説明文 / タグ / `HousingActionBar` の下)。

**理由**:
- 上部バナーは既に `reportNotice` (家主向け通報案内) が占めるケースがあり、 重複配置で視覚が破綻する
- 下部配置 = 通常閲覧時はノイズにならず、 訪問前に確認したい人だけスクロールで到達できる
- mini カード縦並びは ambient slideshow と相性が良い (= 「生きた」 状態のまま見える)

**セクション中身**:
- 見出し: 「この住所の他の登録 (N)」 (i18n キー: `housing.detail.duplicates.title`)
- mini カード縦並び:
  - 左: サムネ (= 既存ロジックで 1 枚目画像 or video poster)
  - 右: タイトル (description or 住所) + 住所行 + 「ちがった」 長押しボタン
- 各 mini カードは詳細モーダル open trigger を持つ (= タップで別 listing の詳細に切り替わる、 現状の deep link 経路を流用)

**データ取得**:
- `HousingDetailModalRoute` で既に `findListingsByAddressKey()` を fetch 済、 結果配列を `peers` として保持
- `HousingDetailModal` → `HousingDetailContent` まで props chain で thread
- フィルタ: 自分自身を除外、 `deletedAt` あり除外 (`isHidden` は service 側で除外済)

**訪問判定 UI**: 置かない。 LoPo は位置情報を持たないため検証不可能な前提条件は形骸化する。 誤爆防止は B の長押し + 確認文言に一任する。

---

### 2.2 「ちがった」 長押しボタン (B)

**目的**: 1 撃 hide という重操作の誤爆を防ぐ。 通常タップでは押せない 2 秒拘束を入れる。

**仕様**:
- **押下時間**: 2 秒
- **進捗 UI**: ring fill or 背景塗りつぶし (= 確定までの残時間が見える)
- **離したらキャンセル**: 完了直前 (= 約 1.8 秒) 以降も「離せばキャンセル」 を維持。 確定は 2 秒到達のみ
- **限定範囲**: reason=`wrong_info` のみ。 NSFW / griefing / sold / その他は既存 1 タップ + reason 別ガイド維持
- **モバイル抑止**: テキスト選択コンテキストメニュー起動を防ぐため
  - `touch-action: manipulation`
  - `user-select: none`
  - `onTouchStart` で `preventDefault`
- **PC 側**: マウス押下 (`mousedown` + `setTimeout` + `mouseup`/`mouseleave` でキャンセル)
- **完了後の挙動**:
  1. `reportListing(listingId, reason='wrong_info')` を呼ぶ (= 既存 API)
  2. サーバー側で重複時閾値 1 (= 2.4 節) により即 1 撃 hide
  3. トースト「『ちがった』 として処理しました。 該当登録は非表示になりました」
  4. 詳細モーダルの重複一覧から消える (= 親で peers を再 fetch or 該当 listing を local filter)

**実装場所**: `src/lib/housing/useLongPressConfirm.ts` (= 新規 hook)。 §3.7 (Phase 2-6 カード版「ちがった」 ボタン) で再利用する想定。

**a11y**:
- キーボード操作: `Space` 長押しでも発火 (= `keydown`/`keyup` で同等処理)
- スクリーンリーダー: `aria-pressed` + 進捗を `aria-valuenow` で更新
- 進捗 UI は `prefers-reduced-motion` 配慮 (= 急な ring fill アニメは避け、 段階的 fill)

---

### 2.3 ツアー自動追加 (C)

**目的**: 訪問者を A / A2 / A3 全部に物理的に連れて行く → 現地確認の機会を作る → B の長押し「ちがった」 が活きる。

**仕様**:
- **トリガー**: ユーザーが**明示的に listing をツアーに追加したとき**のみ (= ドラッグドロップ / 「ツアーに追加」 ボタン / 「全部回る」 等)。 listings store の自動更新には追従しない (= スナップショット型を保証)
- **挙動**: 追加 listing の `addressKey` と一致する他の listing で、 まだツアーに居ないものを**全て追加** (= 冪等)
- **自動追加分の扱い**: 通常 listing と**完全に同等**
  - 個別 × ボタンで消せる
  - 「自動追加」 マークは付けない (= UI ノイズ回避)
  - 親 A を消しても A2 / A3 は残る (= 連動削除なし)
- **スナップショット型**: ツアー作成後に住所 X へ A4 が新規登録されても、 既存ツアーには反映しない
  - 理由: 作成者の意図せぬ変更を防ぐ、 A4 が偽物だった場合に作成者の信頼が損なわれるリスクを回避
  - 将来「住所 X に新規あり、 追加する?」 提案 UI に発展可能 (本作業のスコープ外)
- **複数 drop 時の処理順**: drop 順に通常追加、 各 listing で「同 addressKey の不在分追加」 を冪等実行 → 順序に依存しない結果

**UI 演出**:
- drop 直後に追加された listing 群を motion で同時入場
- トースト「同住所の他 N 件もツアーに追加しました」 (= 一度きり、 マーク UI は出さない)
- 理由: 「マークなし方針」 と「ユーザーが『あれ?増えた』 と混乱しない」 のバランス

**helper 関数**:
- `src/lib/housing/expandTourWithDuplicates.ts` (= 新規 pure helper)
- 入力: `(tourListingIds: string[], newListingId: string, allListings: MockListing[])`
- 出力: `{ nextIds: string[], autoAddedCount: number }`
- 純関数、 副作用なし、 vitest 単体テスト容易

---

### 2.4 通報 API 閾値の重複時 1 化 (= Phase 2-7 を本作業に統合)

**理由**: B の長押し「ちがった」 が「1 撃 hide」 として機能するためには、 サーバー側で reason=`wrong_info` + 重複登録あり時に閾値 1 で hide する必要がある。 これは Phase 2-7 と同じ実装なので統合する。

**`api/housing/_reportListingHandler.ts` 修正**:
- transaction 内で同 addressKey の他生存 listing 存在チェック
  ```ts
  const sameAddressOthers = await tx.get(
    listingsCol
      .where('addressKey', '==', data.addressKey)
      .where('isHidden', '==', false)
      .limit(2)
  );
  const isDuplicate = sameAddressOthers.docs.filter(d => d.id !== listingId).length > 0;
  const threshold = isDuplicate && reason === 'wrong_info'
    ? 1
    : REPORT_AUTO_HIDE_THRESHOLD;
  const shouldHide = newCount >= threshold && !data.isHidden;
  ```
- **適用範囲**: reason=`wrong_info` AND 同 addressKey 重複あり、 のときのみ閾値 1。 それ以外は既存 3 維持
- 既存の `restoreCount` / `MAX_SELF_RESTORE` 自己復帰機構はそのまま流用 (= 1 撃 hide でも所有者 1 回復帰可)

---

## 3. 非機能要件

### 3.1 a11y
- 長押しボタンはキーボード操作対応 (`Space` 長押し)
- `aria-pressed` + `aria-valuenow` で進捗を SR に伝える
- `prefers-reduced-motion` 配慮で進捗アニメを段階化

### 3.2 mobile
- 長押し時のテキスト選択コンテキストメニュー抑止 (touch-action / user-select / preventDefault の 3 点)
- mini カード縦並びは sm: ブレイクポイントでも自然に収まる幅設計

### 3.3 i18n
- 新規 i18n キー (ja を一次、 en/ko/zh は後追い):
  - `housing.detail.duplicates.title` = 「この住所の他の登録 ({{count}})」
  - `housing.detail.duplicates.action.wrong` = 「ちがった」
  - `housing.detail.duplicates.long_press_hint` = 「2 秒長押しで非表示」
  - `housing.detail.duplicates.toast.hidden` = 「『ちがった』 として処理しました。 該当登録は非表示になりました」
  - `housing.tour.auto_added_toast` = 「同住所の他 {{count}} 件もツアーに追加しました」

---

## 4. データモデル

**追加なし**。 `lastConfirmedAt` (§3.1 完了済) と既存 `addressKey` / `isHidden` / `deletedAt` / `reportCount` で完結。

ツアー側も `useHousingTourStore` の flat `listingIds: string[]` を維持 (= 「自動追加」 メタ無し)。

---

## 5. API 追加 / 変更

**追加**: なし
**変更**: `api/housing/_reportListingHandler.ts` (= 2.4 節、 重複時 1 撃 hide ロジック)

---

## 6. テスト戦略

### 6.1 単体テスト (vitest happy-dom)
- `useLongPressConfirm` hook: タイマー / cancel / confirm / キーボード対応の各分岐
- `expandTourWithDuplicates` helper: 冪等性 / 同 addressKey 不在分全追加 / 順序非依存
- `_reportListingHandler` transaction logic: reason=`wrong_info` + 重複あり時の閾値 1 動作 (= 既存 admin test 環境を流用)

### 6.2 コンポーネントテスト
- `HousingDetailContent.test.tsx` 拡張: `peers` prop ありで重複一覧セクションが描画されること、 自分自身が除外されること

### 6.3 実機検証
- 進捗 UI の見た目 / 離す挙動 / 完了トースト
- mobile (実機 Android/iOS) でのテキスト選択抑止
- ツアー自動追加の motion 入場 + トースト
- E2E 系は実機検証メイン (memory `feedback_one_fix_one_verify`)

---

## 7. 段階的リリース

`feedback_one_fix_one_verify` (= 修正は 1 件ずつ実機検証) を厳守:

1. **B 長押し hook + 通報 API 閾値 1 統合** (= 単独実装、 既存 reason ボタンに仮設置して実機検証)
2. **A 詳細モーダル重複一覧セクション** (= B のボタンを mini カードに設置 → 実機検証)
3. **C ツアー自動追加** (= 独立、 helper + UI 統合 → 実機検証)

各ステップで vitest + tsc + build pass → 実機 1 シナリオ通す → 次へ。

---

## 8. 既存 Phase 2-6/2-7 との関係

- 本設計 = §3.8 (A/B/C) のみが正式スコープ
- §3.7 (= Phase 2-6 = カード上の「📅 1 ヶ月以上更新なし」 バッジ + カード版「ちがった」 ボタン) は本作業の**後段**で別セッション設計
- 本作業で実装する `useLongPressConfirm` hook と通報 API 閾値 1 ロジックは Phase 2-6 で**再利用**される (= 二重実装しない)

---

## 9. 用語確定 (= [.private 議論](../../.private/2026-05-27-housing-video-3frame-and-phase2.md) §6 と整合)

- 「ハウジング」 (= 「物件」 使わない)
- 「ちがった」 (= 通報 reason=`wrong_info` の UI 表示語)
- 「この住所の他の登録」 (= 重複一覧セクション見出し)
- 「同住所の他 N 件もツアーに追加しました」 (= ツアー自動追加トースト)
