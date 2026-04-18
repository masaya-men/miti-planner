# みんなの軽減表ボトムシート ローディング＆コピー進捗UX改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボトムシートの初期ロードに全面スピナーを追加し、コピー進捗を「不確定スピナー + 実進捗テキスト + opacityパルス + 最低表示時間」に置き換える。

**Architecture:** 単一コンポーネント `MitigationSheet.tsx` の修正で完結。新規ファイルなし。CSSは既存 `MitigationSheet.css` に追記。i18nキー1個を4言語に追加。framer-motion で実装、TDDではなく手動検証（UIアニメーション）。

**Tech Stack:** React 18 + TypeScript + framer-motion + Tailwind v4（CSS変数経由）+ react-i18next

**設計書:** `docs/superpowers/specs/2026-04-17-mitigation-sheet-loading-ux-design.md`

---

## ファイル構造

| ファイル | 変更内容 |
|---------|---------|
| `src/components/MitigationSheet.tsx` | ローディングオーバーレイJSX追加、`runCopy` のfor loop内で進捗更新、最低表示時間ロジック、crawlリングを不確定スピナー化、テキストopacityパルス |
| `src/components/MitigationSheet.css` | `.miti-loading-overlay` / `.miti-loading-spinner` 追加、不確定スピナー回転keyframes（または `motion.svg` の `animate` で実装するならCSS追加不要） |
| `src/locales/ja.json` | `miti_sheet.loading` 追加 |
| `src/locales/en.json` | 同上 |
| `src/locales/zh.json` | 同上 |
| `src/locales/ko.json` | 同上 |

---

## Task 1: i18nキー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json` (miti_sheet ブロック内、末尾)
- Modify: `src/locales/en.json` (同上)
- Modify: `src/locales/zh.json` (同上)
- Modify: `src/locales/ko.json` (同上)

- [ ] **Step 1: ja.json に loading キー追加**

`src/locales/ja.json` の `miti_sheet` ブロック内、最後のキー `"copying_progress": "コピー中… {{current}}/{{total}}"` の直後に追加（カンマを忘れずに）：

```json
"copying_progress": "コピー中… {{current}}/{{total}}",
"loading": "読み込み中..."
```

- [ ] **Step 2: en.json に loading キー追加**

`miti_sheet` ブロック内に追加：

```json
"loading": "Loading..."
```

- [ ] **Step 3: zh.json に loading キー追加**

`miti_sheet` ブロック内に追加：

```json
"loading": "加载中..."
```

- [ ] **Step 4: ko.json に loading キー追加**

`miti_sheet` ブロック内に追加：

```json
"loading": "불러오는 중..."
```

- [ ] **Step 5: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
rtk git commit -m "i18n: miti_sheet.loading キー追加（4言語）"
```

---

## Task 2: ローディングオーバーレイ用CSS追加

**Files:**
- Modify: `src/components/MitigationSheet.css` (Section 23 の直前、または末尾に追加)

- [ ] **Step 1: MitigationSheet.css に追加**

`MitigationSheet.css` の末尾、最終行の手前に以下を追加（番号は既存の流れに合わせて 25. とする。23番のCopy overlayの直後ではなく、末尾に追記してOK）：

```css
/* ----------------------------------------------------------
   25. Initial loading overlay（シート開時の全面スピナー）
   ---------------------------------------------------------- */

.miti-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(0, 0, 0, 0.3);
  --tw-backdrop-blur: blur(2px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  z-index: 50;
  pointer-events: none;
}

.theme-light .miti-loading-overlay {
  background: rgba(255, 255, 255, 0.6);
}

.miti-loading-spinner {
  width: 32px;
  height: 32px;
  color: var(--color-text-primary);
}

.miti-loading-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  letter-spacing: 0.03em;
}
```

- [ ] **Step 2: コミット**

```bash
rtk git add src/components/MitigationSheet.css
rtk git commit -m "style: ボトムシート初期ローディング用CSS追加"
```

---

## Task 3: 初期ローディングオーバーレイをJSXに追加

**Files:**
- Modify: `src/components/MitigationSheet.tsx`

- [ ] **Step 1: ローディング判定の派生値を追加**

`MitigationSheet.tsx` の関数本体内、`const currentContentName = currentContentId ? getContentName(currentContentId) : '';` の直前（318行目付近）に追加：

```tsx
  // 初期ローディング判定: popularData未取得 or プレビュー取得中
  const isInitialLoading = (Object.keys(popularData).length === 0) || previewLoading;
```

- [ ] **Step 2: `.miti-body` の中（リスト+プレビューの後ろ、コピーオーバーレイの前）にローディングオーバーレイを追加**

現在のコード（512行目付近）：

```tsx
            {/* メイン */}
            <div className="miti-body">
              {/* 左: OGPカードリスト */}
              <div className="miti-card-list" ref={listRef}>
                {/* ... 中略 ... */}
              </div>

              {/* 右: プレビュー */}
              <div className="miti-preview">
                {/* ... 中略 ... */}
              </div>
            </div>
```

の `</div>` （`.miti-body` の閉じタグ）の **直前** に以下を挿入：

```tsx
              {/* 初期ローディングオーバーレイ */}
              <AnimatePresence>
                {isInitialLoading && (
                  <motion.div
                    className="miti-loading-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <motion.svg
                      className="miti-loading-spinner"
                      viewBox="0 0 32 32"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    >
                      <circle
                        cx="16" cy="16" r="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeOpacity="0.15"
                      />
                      <circle
                        cx="16" cy="16" r="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="20 81.7"
                      />
                    </motion.svg>
                    <span className="miti-loading-text">{t('miti_sheet.loading')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
```

- [ ] **Step 3: ビルド確認**

```bash
rtk npm run build
```

エラーなく通ることを確認。

- [ ] **Step 4: 動作確認（手動）**

```bash
rtk npm run dev
```

ブラウザで:
1. DevTools → Network → Slow 3G
2. 野良主流ボタン押下 → 全面スピナーが出る
3. データ取得完了 → スピナーがfadeoutする（150ms）
4. テーマ切替（ライト）でも視認できる

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "feat: ボトムシート初期ロード全面スピナー追加"
```

---

## Task 4: コピー進捗 — crawlリングを不確定スピナーに置換

**Files:**
- Modify: `src/components/MitigationSheet.tsx` (530〜555行目付近のSVGリング部分)

- [ ] **Step 1: 既存リングSVGを置き換える**

現在のコード（コピーオーバーレイ内、phase === 'crawl' || 'surge' の分岐内）：

```tsx
                    {(copyState.phase === 'crawl' || copyState.phase === 'surge') ? (
                      <>
                        <div className="miti-copy-ring">
                          <svg viewBox="0 0 36 36" className="miti-copy-ring-svg">
                            <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                            <motion.circle
                              cx="18" cy="18" r="16" fill="none"
                              stroke="#3b82f6"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              pathLength={1}
                              initial={false}
                              animate={{
                                pathLength: copyState.phase === 'crawl' ? 0.2 : 1,
                              }}
                              transition={
                                copyState.phase === 'crawl'
                                  ? { duration: 6, ease: [0.1, 0, 0.2, 1] }
                                  : { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
                              }
                            />
                          </svg>
```

を、phaseで分岐した2種類のリング描画に書き換える：

```tsx
                    {(copyState.phase === 'crawl' || copyState.phase === 'surge') ? (
                      <>
                        <div className="miti-copy-ring">
                          {copyState.phase === 'crawl' ? (
                            // 不確定スピナー（円弧が回転し続ける）
                            <motion.svg
                              viewBox="0 0 36 36"
                              className="miti-copy-ring-svg"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                              <circle
                                cx="18" cy="18" r="16" fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray="25 100"
                              />
                            </motion.svg>
                          ) : (
                            // surge: 0.2 → 1 にぐいーん
                            <svg viewBox="0 0 36 36" className="miti-copy-ring-svg">
                              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                              <motion.circle
                                cx="18" cy="18" r="16" fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                pathLength={1}
                                initial={{ pathLength: 0.2 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                              />
                            </svg>
                          )}
```

**注意:** 既存CSS `.miti-copy-ring-svg` には `transform: rotate(-90deg)` がかかっている。framer-motionの `animate.rotate` はこのCSS transformと **加算ではなく上書き** されるので、不確定スピナー時は -90deg 起点の回転にならない（純粋に0deg → 360deg ループ）。今回は弧が短くて起点が見えないので問題なし。surgeはこれまで通り -90deg 起点で 0%→100% にサージする（こちらは動的rotateなしなのでCSS transformが効く）。

- [ ] **Step 2: ビルド確認**

```bash
rtk npm run build
```

- [ ] **Step 3: 動作確認（手動）**

```bash
rtk npm run dev
```

ブラウザで:
1. 1件コピー実行 → crawl phase でリングがくるくる回り続ける（止まって見えない）
2. surge phase に遷移 → リングが100%にサージ
3. done phase でチェックマーク

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "fix: crawl phase を不確定スピナーに置換（止まって見える問題解消）"
```

---

## Task 5: コピー進捗 — 実進捗をテキスト/数字に反映

**Files:**
- Modify: `src/components/MitigationSheet.tsx` (`runCopy` 関数 + リング中央の数字 + ラベル文)

- [ ] **Step 1: `runCopy` 内のfor loopで進捗を更新する**

現在のコード（228〜249行目付近）：

```tsx
  const runCopy = useCallback(async (entries: PopularEntry[]) => {
    if (entries.length === 0) return;
    setCopyState({ phase: 'crawl', current: 0, total: entries.length });

    let copied = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
    }

    setCopyState({ phase: 'surge', current: entries.length, total: entries.length });
```

を以下に書き換え：

```tsx
  const runCopy = useCallback(async (entries: PopularEntry[]) => {
    if (entries.length === 0) return;
    const startedAt = Date.now();
    setCopyState({ phase: 'crawl', current: 0, total: entries.length });

    let copied = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
      // 1件完了ごとに current を進める
      setCopyState({ phase: 'crawl', current: copied, total: entries.length });
    }

    // 最低表示時間 400ms（瞬殺ケースでも crawl が見えるように）
    const elapsed = Date.now() - startedAt;
    if (elapsed < 400) {
      await new Promise(r => setTimeout(r, 400 - elapsed));
    }

    setCopyState({ phase: 'surge', current: entries.length, total: entries.length });
```

- [ ] **Step 2: リング中央の数字とラベルを実進捗に変更**

現在のコード（リング中央 `<span className="miti-copy-count">` 部分、552〜558行目付近）：

```tsx
                          <span className="miti-copy-count">
                            {copyState.phase === 'surge' ? `${copyState.total}/${copyState.total}` : `…/${copyState.total}`}
                          </span>
                        </div>
                        <span className="miti-copy-label">
                          {t('miti_sheet.copying_progress', { current: copyState.phase === 'surge' ? copyState.total : '…', total: copyState.total })}
                        </span>
```

を以下に置換（`current` を実値で表示、ラベルにopacityパルスを追加）：

```tsx
                          <span className="miti-copy-count">
                            {copyState.current}/{copyState.total}
                          </span>
                        </div>
                        <motion.span
                          className="miti-copy-label"
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {t('miti_sheet.copying_progress', { current: copyState.current, total: copyState.total })}
                        </motion.span>
```

- [ ] **Step 3: ビルド確認**

```bash
rtk npm run build
```

- [ ] **Step 4: 動作確認（手動）**

```bash
rtk npm run dev
```

ブラウザで:
1. 単体コピー（カードの「コピー」ボタン） → 「0/1 コピー中… → 1/1」と更新（最低400ms見える）
2. 「零式まとめてコピー」 → 「0/N → 1/N → 2/N → … → N/N」と更新
3. ラベルがopacityパルス（呼吸している）
4. 4言語切替で表示崩れなし（ja/en/zh/ko）

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "feat: コピー進捗の実進捗表示・opacityパルス・最低表示時間追加"
```

---

## Task 6: 全体動作確認とテスト

- [ ] **Step 1: ビルド + テスト**

```bash
rtk npm run build && rtk npx vitest run
```

両方パスすることを確認。

- [ ] **Step 2: 設計書受け入れ基準チェック（手動）**

設計書 `docs/superpowers/specs/2026-04-17-mitigation-sheet-loading-ux-design.md` の「受け入れ基準」と「検証手順」を順にチェック：

**初期ロード:**
- [ ] シート開時、popularData取得中はスピナーが全面表示
- [ ] previewData取得中もスピナー表示
- [ ] どちらも完了したらfadeout（150ms）
- [ ] ライトテーマでも視認性OK

**コピー進捗:**
- [ ] crawlでリングが回転し続ける（止まって見えない）
- [ ] X/N件のXが実進捗で更新（単体コピーでも 0/1 → 1/1）
- [ ] テキストがopacityパルス
- [ ] surge → done は現状維持
- [ ] 単体コピーでも crawl が最低400ms見える

**4言語:**
- [ ] ja / en / zh / ko 全てでロード中テキストが表示される

- [ ] **Step 3: TODO.md更新**

`docs/TODO.md` の「次にやること」セクションから「ボトムシート ローディング＆コピー進捗UX改善」を削除し、「今セッションの完了事項」に追加。

- [ ] **Step 4: 最終コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs: ボトムシートUX改善完了 TODO更新"
```

- [ ] **Step 5: push + Vercelデプロイ**

```bash
rtk git push
```

Vercelで自動デプロイが走る。本番で実機確認（特にスマホ実機 + ライトテーマ）。

---

## 非対応（スコープ外、設計書通り）

- エラー時のリトライUI
- プレビュー取得の先読み
- スケルトンUI

---

## リスク・注意点

- **「fetch開始済みフラグ」の必要性**: 設計書では `popularData` 空判定で初回判定としているが、リセット useEffect（306〜315行目）で `isOpen=false` 時に `popularData` を空に戻す処理は **無い**（`popularData` はリセット対象外）。よって2回目以降のシート開時はキャッシュが効いており、初回判定で誤検知しない想定 → 設計書のシンプルな条件でOK
- **既存CSS `transform: rotate(-90deg)` との干渉**: 不確定スピナーはCSSの-90deg起点が無視されるが、起点位置が見えない（弧が短く回転しているだけ）ので問題なし。surgeリングは静的描画なのでCSS transformが効き、これまで通り12時起点でサージ
- **previewLoading の依存**: シート開きっぱなしでカード切替時もpreviewLoadingが立つため、ローディングオーバーレイが再表示される。これは設計書通り（許容）
