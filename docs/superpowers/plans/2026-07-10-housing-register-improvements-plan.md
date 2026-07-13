# 登録ページ改善 実装計画 (住所確認ゲート + 左パネルステッパー + 細修正)

> 2026-07-10 全体相談で設計確定済み。本書だけで実装完了できる粒度で書く。
> 実行時の共通ルール: 1 タスクずつ実装 → ユーザーがローカル (HMR) で目視 → 次へ。
> push 前に `npm run build` + `vitest run` (出力をパイプしない・vmThreads ハング注意)。
> `/housing` 配下 = 独自トンマナ (`.claude/rules/housing-design.md`)。色・寸法は必ず `--housing-*` トークン経由。
> 文言は必ず i18n キー経由・ja/en/ko/zh 4 言語 parity。ロケール JSON は該当ブロックのみ textual 編集。

## 確定済み設計判断 (変更不可)

1. **住所確認ゲート = C案**: フォーム値から組み立てた住所文を確認セクションに提示し、
   「この住所で間違いありません」ボタンを 1 回押させる。押すまで送信ボタン無効。
2. **編集モード = (b)**: `mode='edit'` は住所欄に触れた場合のみ再確認 (初期状態は確認済み扱い)。
3. **住所を変えたら確認は自動解除**。ただし **size 自動導出による変化では解除しない**。
4. **左パネル**: ①番号を縦棒でつなぎスクロールに合わせて塗る ②説明文は**アクティブなステップだけ**開く
   ③左パネルは**スクロールさせない**。

---

## Task 1: 住所確認ゲート (C案)

### 1-1. RegisterPage に確認 state を追加
- ファイル: `src/components/housing/pages/RegisterPage.tsx`
- `const [addressConfirmed, setAddressConfirmed] = useState(() => mode === 'edit');`
- **解除する場所 (2 箇所のみ)**:
  - `handleAddressChange` (現 327 行付近): ユーザー手編集 → `setAddressConfirmed(false)`
  - `applyExtractedResult` 内の `applyOne` (現 448 行付近): SNS 自動入力 → `setAddressConfirmed(false)`
- **解除してはいけない場所**: size 導出 effect (現 349 行付近)。この effect は `setAddress` を呼ぶが
  区画由来の導出なので確認を外さない。オートセーブ復元 (`restoreAppliedRef` 経路・現 1002 行付近の
  setAutoFilled ループ) は**復元値を未確認として扱う** → 復元適用時に `setAddressConfirmed(false)` を明示。
- 確認ボタン押下ハンドラ: `setAddressConfirmed(true)` + 住所系フィールドに `fieldState.confirm(name)` を
  呼ぶ (dc/server/area/ward/buildingType/plot/size/apartmentBuilding/roomKind/roomNumber のうち
  値が入っているもの)。これで到達不能だった `'confirmed'` (緑・`--housing-field-bg-confirmed`) が初めて機能する。
  ※ TODO.md「細かい: fieldState.confirm() バグ」はこのタスクで解消。

### 1-2. registerChecklist を拡張 (純関数 + テスト)
- ファイル: `src/lib/housing/registerChecklist.ts` / テスト `src/__tests__/housing/` 配下の該当テスト
- `RegisterChecklistInput` に `addressConfirmed: boolean` を追加。
- address 行: `done = input.addressOk && input.addressConfirmed`。
  `missingLabelKey` を条件分岐: 値が不正なら従来の `check.missing_address`、
  値は妥当だが未確認なら新キー `check.missing_address_confirm` (「住所を確認してください」)。
- `isReadyToPublish` は変更不要 (address 行の done に集約される)。

### 1-3. RegisterSectionConfirm に確認 UI
- ファイル: `src/components/housing/register/RegisterSectionConfirm.tsx`
- 入力要約 `<dl>` の上 (または住所行の直下) に確認ブロック:
  - 見出し文: 新キー `housing.register.confirm.address_gate_lead` (ja:「この住所で登録します」)
  - 住所文: RegisterPage 側で `formatHousingAddress(addressViewModel, i18n.language)` を組み立てて
    props (`summary.address` を流用可。null なら未確定表示のまま) — **表示コンポーネントで直接組み立てない**
    (formatHousingAddress.ts 冒頭コメントの一貫性ルール)。
  - ボタン: 新キー `housing.register.confirm.address_gate_button` (ja:「この住所で間違いありません」)。
    確認済みになったらボタンをチェック付きの確認済み表示に変える (再クリック不要)。
    見た目は静かな注記トーン (色付き alert 箱禁止・ヘアライン + `--housing-text-mute`)。
    確認済み表示にはハニーではなく確認済みトークン (`--housing-field-bg-confirmed` 系) を使う。
- props 追加: `addressConfirmed: boolean` / `onConfirmAddress: () => void`。
- 未確認のときの不足アクション一覧には 1-2 の `missing_address_confirm` が自動で出る。

### 1-4. i18n (4 言語)
- 追加キー: `housing.register.confirm.address_gate_lead` / `address_gate_button` /
  `address_gate_confirmed` (確認済み表示) / `housing.register.check.missing_address_confirm`。
- ja 文言は上記。en/ko/zh は意味対訳 (機械的直訳ではなく UI 文脈で自然に)。

### 1-5. テスト
- registerChecklist: 「妥当 + 未確認 → done=false / missing_address_confirm」「確認済み → done=true」
- RegisterPage 結合 (既存テストの流儀に合わせる): 手編集で確認解除 / size 導出では解除されない /
  edit モード初期は確認済み。

---

## Task 2: 左パネルステッパー強化

### 2-1. 現状
- 左パネル: `src/components/housing/register/RegisterStepperNav.tsx` (表示専用・状態は RegisterPage が計算)
- steps 配列とアクティブ判定: `RegisterPage.tsx` 現 650-672 行付近 (`doneMap` / `steps` / `activeStepId`)
- 参考にする既存アニメ: ツアーパネルのステップ接続線。`src/styles/housing.css` 内 `housing-tour` 系の
  ステッパー/接続線 CSS と、`src/components/housing/workspace/` のツアーパネル実装を grep して
  同じトークン・イージングを流用する (新規に発明しない)。

### 2-2. 実装
- `RegisterStepperNav` に縦の接続線を追加: 各 li 間をつなぐ線 (擬似要素 or 専用 div)。
  塗り = 「スクロール進行」と同期。RegisterPage が既に持つ activeStepId 算出に加えて、
  中央カラムのスクロール率から**連続的な進行度 (0..1)** を計算して props で渡し、
  接続線の塗り高さを CSS カスタムプロパティ (例 `--stepper-progress`) で反映する。
  スクロールハンドラは rAF スロットル。`prefers-reduced-motion` 時はトランジション無効 (即時反映)。
- 説明文: 新キー `housing.register.step_desc.{media,address,intro,visibility,confirm}`。
  **アクティブなステップのみ**ラベル下に開く (max-height か grid-rows のトランジション)。
  非アクティブは畳む。パネル全体が viewport からはみ出ない (低い画面でも) ことが受け入れ条件。
- 説明文 ja (確定・en/ko/zh は対訳):
  - media: 「X (Twitter) やハウジングスナップの URL を貼ると、写真と住所を自動で取り込みます」
  - address: 「自動入力でも手入力でも、登録前に必ず住所を確認します」
  - intro: 「タイトルは任意です。未入力の場合、一覧には住所が表示されます」
  - visibility: 「公開・非公開と、公開期限を選べます」
  - confirm: 「入力内容をまとめて確認し、登録します」
- edit モード (media ステップなし・4 ステップ) でも成立すること。

### 2-3. 検証
- 実機 (ユーザー画面 CSS 1489×679 / DPR 2.58) で: 塗りがスクロールに追従 / 説明の開閉が滑らか /
  パネルがスクロールしない。jsdom では検証できない (WAAPI/スクロール系は実機のみ —
  過去に jsdom すり抜け事例あり)。

---

## Task 3: 細修正 (機械的)

1. **サイズ欄の▼削除**: `RegisterSectionAddress.tsx` 現 195-213 行。disabled `<select>` をやめ、
   読み取り専用表示に置換 (例: `<input readOnly>` か `<div class="housing-input">` + 導出値ラベル)。
   `data-state` の auto-filled バッジ (🟡) と label の関連は維持。ドロップダウンに見える UI を残さない。
2. **タイトルのプレースホルダー**: RegisterSectionIntro (`src/components/housing/register/` 配下) の
   タイトル input placeholder キーを grep で特定し、ja を「タイトルを入力」に。4 言語とも同トーンの
   無難な文言へ。
3. **「未入力なら住所が…」→「未入力の場合、…」**: 同セクションの注記キーを grep で特定し ja を修正。
   en/ko/zh は意味が同じなら変更不要 (ja の言い回し修正のみ)。
4. **部屋区分チップの「家」重複解消**: `RegisterSectionAddress.tsx` 現 229 行が建物タイプと同じ
   `housing.register.building_type.house` を部屋区分チップに使い回している。新キー
   `housing.register.room_kind.whole_house` (ja 案:「家全体」) を作って置換。4 言語。
   ※文言はユーザーがローカル目視で最終判断 (変更容易)。

## Task 4: 死にコード撤去

- `src/components/housing/register/HousingRegisterAddressFields.tsx` と
  `src/components/housing/register/HousingRegisterParentHouseSizeField.tsx` を削除
  (非テスト参照ゼロは 2026-07-10 確認済み。削除前に grep で再確認)。
- 対応するテストファイルがあれば一緒に削除。
- 孤児 i18n キー `housing.register.address.expansionWardNote` を 4 言語から削除
  (ロケールはブロック単位の textual 編集厳守)。

## 受け入れ基準

- 新規登録: 住所が妥当でも確認ボタンを押すまで送信不可。不足アクションに「住所を確認してください」。
- 確認後に住所 (どのフィールドでも) を変える/SNS 再取込 → 確認が外れて再度求められる。
- size の自動導出・オートセーブの往復だけでは確認は外れない。
- 編集モード: 住所に触れなければ従来どおり保存可。触れたら再確認。
- ステッパー: 接続線・スクロール塗り・アクティブ説明文が動作し、左パネル非スクロール維持。
- `npm run build` + `vitest run` 緑 / 4 言語で表示崩れなし (特に en の長文)。

## やらないこと

- 登録ボタン押下時の確認ダイアログ (C案で不採用)
- 住所以外 (タイトル等) への確認ゲート適用
- 旧 5 択 HousingExtractSize モデルの再導入
