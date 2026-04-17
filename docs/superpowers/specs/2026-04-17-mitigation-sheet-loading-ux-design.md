# みんなの軽減表ボトムシート — ローディング＆コピー進捗UX改善 設計書

**作成日**: 2026-04-17
**対象コンポーネント**: `src/components/MitigationSheet.tsx` + `MitigationSheet.css`
**スコープ**: UX改善のみ（機能追加なし・既存ロジック変更なし）

---

## 背景

野良主流ボタンから開くボトムシートで、2つのUX問題をユーザーから指摘：

1. **初期ロードのインジケーター不足** — シート開時に左カード一覧（`/api/popular`）とプレビュー（`/api/share`）の2本のAPI取得が走り数秒待たされるが、画面は空で表示されるためユーザーが「壊れた？」と不安になる。
2. **コピープログレスが止まって見える** — 擬似プログレス `crawl` phase（6秒で20%まで到達する静的アニメ）が、実際のコピー処理（ローカルのみ・一瞬）と非同期で進むため、ほぼ「20%で硬直」して見える。

---

## 問題A: 初期ロードインジケーター

### 現状
- シート開時に `useEffect` で `/api/popular` を非同期fetch → `popularData` に格納
- selectedId が決まると `/api/share?id=...` でプレビュー取得 → `previewData` に格納
- この間、左カードは空のOGPプレースホルダ、右プレビューは何も出ない
- `previewLoading` フラグはあるが見える形で使われていない

### 設計

**表示条件**:
```
loading = (Object.keys(popularData).length === 0) || previewLoading
```
- `popularData` がまだ空（初回取得中）
- または `previewLoading === true`（プレビュー取得中）

**表示位置**: `.miti-body` の上に absolute positioning でオーバーレイ。左カード列と右プレビュー両方を覆う。

**見た目**:
- 半透明の背景（`rgba(0,0,0,0.3)` ダーク / `rgba(255,255,255,0.6)` ライト）+ 軽いblur（`--tw-backdrop-blur` パターン使用、CSS rules遵守）
- 中央にspinner（SVG circular、白黒、既存デザインに合わせる）
  - 直径: 32px
  - 回転: 0.8秒/周
  - stroke: `currentColor` で `text-app-text`
- 下に「読み込み中...」テキスト（i18nキー: `miti_sheet.loading`）
  - `text-app-base`、`text-app-text-muted`

**アニメーション**:
- `AnimatePresence` で fade in/out（150ms）
- ローディング完了時に即座にフェードアウト

### i18n新規キー

| キー | ja | en | zh | ko |
|------|-----|-----|-----|-----|
| `miti_sheet.loading` | 読み込み中... | Loading... | 加载中... | 불러오는 중... |

---

## 問題B: コピープログレスアニメ改善

### 現状
```
crawl phase: pathLength 0 → 0.2 を6秒かけて到達（静的アニメ、実進捗と無関係）
surge phase: pathLength 0.2 → 1 を0.5秒で到達
done phase: チェックマーク 900ms 表示 → シート閉じ
```

問題:
- コピー処理は超高速（ローカルのみ）なので、crawl開始直後すぐに surge に遷移する
- その結果、リングは0.2（20%）まで進みかけてすぐ100%にサージ
- 視覚的には「20%で止まる → 一瞬で完了」 or 長い場合「20%で硬直」に見える
- テキスト「…/N件 コピー中」も変化しないので固まった印象

### 設計

#### B-1. crawl phaseを不確定スピナーに置き換え

**現行**: pathLength 0 → 0.2 の静的進捗アニメ
**変更後**: 円弧が回転し続ける不確定スピナー

具体:
- SVG circle の `strokeDasharray` と `strokeDashoffset` を使い、短い弧（全周の25%程度）が円周を回転する
- `framer-motion` で `rotate: 0 → 360` の無限ループ（1秒/周）
- `pathLength` の制御はやめる

#### B-2. 実進捗をテキストに反映

**現行**: `…/N件 コピー中`（X部分が「…」で固定）
**変更後**: `X/N件 コピー中`（Xは実際のコピー済み数）

実装:
- `runCopy` の for loop 内で、各 `copyPlan` 完了後に
  ```ts
  setCopyState({ phase: 'crawl', current: copied, total: entries.length });
  ```
- リング中央の数字も `copyState.current` を表示
- 単体コピー（total=1）でも `0/1 → 1/1` の変化が見える

#### B-3. テキストのopacityパルス

「コピー中...」テキストに呼吸アニメ：
- `framer-motion` で `opacity: [0.6, 1, 0.6]`
- 1.5秒周期の無限ループ
- 「生きてる感」を出す

#### B-4. 最低表示時間

コピーが一瞬で終わるケースでも crawl phase を最低400ms維持：
- `runCopy` 開始時に `Date.now()` 記録
- コピー完了後、経過時間 < 400ms なら差分だけ `setTimeout` で待機
- これにより「パッと出てパッと消える」のを防ぐ

### 変更しないもの
- surge phase のアニメ（pathLength 0.2 → 1、0.5秒）← 現状のまま
- done phase のチェックマーク（900ms表示 → onClose）← 現状のまま
- コピー実ロジック（`copyPlan`）← 触らない

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/components/MitigationSheet.tsx` | ローディングオーバーレイJSX追加、runCopy内for loopで進捗更新、最低表示時間ロジック、crawlリングを不確定スピナーに |
| `src/components/MitigationSheet.css` | `.miti-loading-overlay`、`.miti-loading-spinner`、スピナー回転のkeyframes |
| `src/locales/{ja,en,zh,ko}.json` | `miti_sheet.loading` キー追加（4言語） |

**変更行数予測**: 合計 +50 〜 +70 行程度

---

## 受け入れ基準

### 初期ロード
- [ ] シート開時、`popularData` 取得中はスピナーが全面表示される
- [ ] `previewData` 取得中もスピナー表示される
- [ ] どちらも完了したらスピナーがfadeoutする（150ms）
- [ ] ライトテーマでも視認性OK（背景が明るすぎて見えないとかNG）

### コピー進捗
- [ ] crawl phase でリングが回転し続ける（止まって見えない）
- [ ] 「X/N件 コピー中」のXが実際の進捗で更新される（単体コピーでも 0/1 → 1/1）
- [ ] テキストがopacityパルスで呼吸する
- [ ] surge phase で100%にサージ、done phase でチェックマーク（現状維持）
- [ ] 単体コピー（超高速）でもcrawl phase が最低400ms見える

### デザイン・挙動
- [ ] 白黒ベース（アクセント色は進捗の青=機能色OKのみ、既存に合わせる）
- [ ] CSS ルール遵守（`backdrop-filter` は `--tw-backdrop-blur` パターン）
- [ ] i18n 4言語対応
- [ ] ビルド・テスト通過（148/148）

---

## 検証手順

1. **dev サーバー起動** → 野良主流ボタン押下
2. **ネットワーク遅延シミュレーション**
   - Chrome DevTools → Network → Slow 3G に設定
   - 再度シート開いてスピナーが見える＆消えるのを確認
3. **コピー動作確認**
   - 単体コピー（カードの「コピーして使う」）→ crawlリング回転 → サージ → チェック
   - 選択コピー（2〜3件）→ 「0/3 → 1/3 → 2/3 → 3/3」と更新されるか
   - まとめてコピー（大量）→ 同様
4. **ライトテーマ確認** → テーマ切替してスピナーとオーバーレイが見えるか
5. **4言語確認** → ja/en/zh/ko で切り替えてテキスト崩れないか

---

## リスク・注意点

- **スピナー表示タイミング**: `popularData` が空判定で初回判定。タブ切替等の既に取得済みケースで誤検知しないよう、「fetch開始済みフラグ」との組み合わせが必要かも → 実装時に検討
- **最低表示時間の実装**: `Date.now()` 差分で `setTimeout` 待機するが、Promise的なクリーンな書き方で実装する
- **テーマ切替時のチカチカ**: 背景色がテーマ変数使用なら自動追従、問題なし想定

---

## 非対応（今回のスコープ外）

- エラー時のリトライUI（現状は toast のみ、スコープ外）
- プレビュー取得の先読み（selectedId変更前にバックグラウンドで次の候補を取得）← パフォ改善、別タスク
- スケルトンUI（ロード中にカードの形だけ表示）← スピナーで十分と判断
