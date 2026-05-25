# 軽減表メモ機能 — Design

作成日: 2026-05-25 / セッション #57
ターゲット: 軽減表アプリ画面 (`/` 系) の MitigationSheet (= シート / 軽減表本体)
brainstorming: `docs/.private/2026-05-25-mitigation-memo-design.md` (#56 で全論点確定)
容量実測: `scripts/measure-plan-size.ts` (最重プラン 113.2KB / 1MB の 11%)

---

## 1. 目的とスコープ

軽減表ユーザーが**シート上の任意位置に短いメモを置く**ための機能。 メモは「ここはアスフォはマケドニアにする」 等、 特定タイミング・特定パーティーメンバー・特定技に対する補足を、 シートを見ながら自然に書き留めるための場。

### 含むもの (v1)

- シート上の任意 (時間, 横位置) にメモを配置 (フリー DnD)
- Plain text のみ
- Firestore `plans/{id}.data.memos[]` に保存 (既存プランデータの 1 フィールド)
- 軽減表メモモード切替アイコン (鉛筆) を AA 追加モード (剣) と並べる
- メモごとに右クリック削除 / 空文字確定で削除 / 既存ゴミ箱メニューに「メモ全削除」 追加 (確認ダイアログあり)
- 上限: メモ 100 個、 1 個あたり 100 文字 (定数で抽出、 後で拡張可)
- 4 言語 i18n (UI ラベルのみ、 メモ本文は翻訳しない)

### 含まないもの (将来拡張)

- 配置単位メモ (タイムラインの特定の技に紐付くメモ)
- Markdown / WYSIWYG リッチエディタ
- 公開/非公開トグル (共有 URL は snapshot 型なので共有後の編集は反映されない = 副作用なし)
- スマホ対応 (PC のみ。 モバイルではメモ表示のみ、 編集 UI は出さない)
- メモの色・サイズ可変 (固定スタイル、 mix-blend-mode で背景反転)
- メモのタイムスタンプ表示 (内部にはあるが UI には出さない)

---

## 2. データモデル

### `PlanData.memos[]` (新規フィールド、 optional)

LoPo 軽減表の座標系は [Timeline.tsx:789](src/components/Timeline.tsx#L789) で `const y = (time - offsetTime) * pixelsPerSecond` となっており、 **縦軸 = 時間 (秒)**、 横軸 = パーティーメンバー横並び。 メモも同じ座標系に乗せる:

```ts
// src/types/index.ts
export interface PlanMemo {
  id: string;         // crypto.randomUUID()
  text: string;       // 最大 100 文字 (MEMO_TEXT_MAX_LENGTH)
  timeSec: number;    // 縦軸 = 何秒地点 (連続値、 0.0〜sheet 最終秒)
  xRatio: number;     // 横軸 = シート横幅 (=メンバー並び幅) に対する 0.0〜1.0 比率
  createdAt: number;  // Date.now()
  updatedAt: number;
}

export interface PlanData {
  // ... 既存フィールド
  memos?: PlanMemo[];  // optional (未マイグレ既存プランは undefined)
}
```

### 座標系の意図

- **縦軸 (時間)**: 連続値の `timeSec` で持つので「12 秒セルの上端=12.0、 真ん中=12.5、 下端=12.9」 という置き方が自然に可能。 セル単位スナップしない。 ウィンドウ縦サイズ変わっても「12 秒地点」 が保たれる ([timelineEvents[].time] と同じ思想)
- **横軸 (メンバー)**: 完全自由。 シート横幅は固定セル幅 × メンバー数だが、 メモは比率 (0.0〜1.0) で持つので、 メンバー数が変わったり列幅が変わったりしても比例追従する

### 定数 (拡張時に 1 箇所変更で済む)

```ts
// src/types/firebase.ts (PLAN_LIMITS と同じ場所)
export const MEMO_LIMITS = {
  MAX_MEMOS_PER_PLAN: 100,
  MAX_TEXT_LENGTH: 100,
} as const;
```

### 容量試算

- 1 メモ = `{id:36B, text:300B(日本語100文字UTF-8), timeSec/xRatio:32B, createdAt/updatedAt:32B, JSON overhead:60B}` ≈ 460B
- 100 メモ × 460B = 46KB
- 最重プラン (絶エデン野良主流) 113.2KB + 46KB = 159KB ≈ 1MB の 15.5% → 余裕

### 既存プランへの影響

- `memos === undefined` のプランは「メモなし」 として透過的に扱う
- 既存プランを一切書き換えない (silent migration なし、 ユーザーがメモを追加して初めて `memos[]` が生まれる)
- migration 不要、 シリアライズも optional のままで OK

---

## 3. 共有 (sharedPlans) との関係

LoPo の共有 URL (`/share/:id`) は **snapshot 型コピー** ([planService.ts] の `copyPlan`)。 つまり共有時点でデータ全体が複製され、 オリジナルを後から編集しても共有先には反映されない。

→ **メモも snapshot に含めるだけで完結**。 「共有後にメモを編集したら共有先にも反映される」 等の同期問題は発生しない。 副作用なし。

→ **共有先で表示はする** (= 共有プランの閲覧者にもメモが見える)。 共有先で編集はできない (= 元プランのコピー権を持つユーザーが「コピーして使う」 した時に編集可能になる)。

---

## 4. UI — 編集モードとボタン配置

### 4.1 メモモード切替

AA 追加モードと同じパターン ([Timeline.tsx:2023-2024](src/components/Timeline.tsx#L2023-L2024) の Sword アイコン + `hidden md:block` の `t('aa_settings.title')` テキスト) を踏襲。

```
Timeline 上部のツールバー (Area B 周辺)
  ┌─────────────────────────────────────────┐
  │ [⚔ AA追加]  [✎ メモ]  ... (PC のみテキスト) │
  │ [⚔]        [✎]       ... (スマホ非表示) │
  └─────────────────────────────────────────┘
```

- 鉛筆アイコン: lucide-react `Pencil` (= [Timeline.tsx:26](src/components/Timeline.tsx#L26) に既に import 済み)
- PC のみテキストラベル `t('memo.mode_toggle_label')` = "メモ" (短く、 AA「AA追加」 と並んで違和感ない長さ)
- スマホでは**ボタン自体を非表示**にする (メモ編集 UI を出さないため。 アイコンのみ縮退もしない)
- クリック → 「メモモード ON」 = シート上の空白をクリックすると新規メモが置ける
- メモモード ON 中は画面下部にフローティングバー (AA 配置モードと同じパターン):
  ```
  [✎ メモモード | メモ 12/100 | ✕ 終了 (Esc)]
  ```
  - **🗑 全削除はフローティングバーには置かない** (= 後述の既存ゴミ箱メニューに集約)
- 終了: ✕ ボタン / Escape / 鉛筆アイコン再クリック
- AA 追加モードとメモモードは**排他** (同時 ON にしない、 一方が ON なら他方は無効化または自動 OFF)

### 4.2 メモの新規作成

1. メモモード ON 中、 シート上の空白をクリック
2. クリック位置の (px, px) を (`timeSec`, `xRatio`) に変換
3. クリック位置に**インライン入力ボックス**が表示 (テキストエリア + Save/Cancel ボタン)
4. 入力して Enter or Save → メモ確定 → `PlanData.memos[]` に追加 → markDirty
5. Escape or Cancel → 入力ボックスを閉じる、 メモは追加しない
6. 空文字で Save → メモは追加しない (空メモは存在し得ない)

### 4.3 メモの編集

1. メモモード ON 中、 既存メモをクリック → 同じインライン入力ボックスが既存テキストで開く
2. 編集して Save → 既存メモを更新 → markDirty
3. **空文字にして Save → 該当メモを削除** (= 削除の代替手段、 確認ダイアログなし。 「内容空 = 不要」 が明らかなので)

### 4.4 メモの DnD (フリー配置)

**実装方式**: 既存軽減アイコン DnD と同じ pointer events 自作 ([Timeline.tsx:463](src/components/Timeline.tsx#L463) の `onPointerDown`/`onPointerMove`/`onPointerUp` パターン)。

理由:
- **保守性**: 既存軽減 DnD と同じパターンなのでコード読者が違和感なく理解できる、 既存ヘルパに乗れる
- **パフォーマンス**: pointer events 直は最軽量、 ライブラリオーバーヘッド無し
- **バンドルサイズ**: ライブラリ追加なし (@dnd-kit は package.json に存在するがハウジング側専用)
- **マウス追従 UI 禁止ルール** ([.claude/rules/ui-design.md]) と整合: グローバル `onMouseMove` ではなくメモ要素自身の `onPointerMove` のみ使う

**挙動**:
- メモモード ON 中、 メモを **pointerdown → pointermove → pointerup** でドラッグ
- ドラッグ中の見た目: `opacity: 0.6` + `cursor: grabbing` (= 通常時は不透明、 持ち上げた時だけ薄くなる)
- ドラッグ終了 (pointerup) で確定 → `memos[id].timeSec, xRatio` を更新 → markDirty
- **ドラッグ中は markDirty しない**。 確定時のみ。 (= Firestore 5 分クールダウン同期に過剰な dirty を積まない、 brainstorming 「確定時のみ Firestore 同期」 の方針)

### 4.5 メモの削除

3 つの経路。 一括削除は**既存ゴミ箱メニューに集約**する (= [Timeline.tsx:2122-2131](src/components/Timeline.tsx#L2122-L2131) の Trash2 + ChevronDown ボタン → [ClearMitigationsPopover.tsx](src/components/ClearMitigationsPopover.tsx) にメニュー項目「メモを全削除」 を追加):

| 経路 | 確認 | 理由 |
|------|------|------|
| 空文字で Save | なし | 内容空 = 不要の意思表示 |
| メモを右クリック → コンテキストメニュー「削除」 | なし | 1 件削除は誤操作リスク低 |
| 既存ゴミ箱 → メニュー「メモを全削除」 | **あり** (modal 確認) | 100 個一気に消えるので誤クリック保護 |

ClearMitigationsPopover の中で軽減全削除と並列に「メモを全削除」 を出す。 メモが 0 件の時はその項目を非活性 or 非表示にする。

### 4.6 メモの見た目

```css
/* 仮トークン: 実装時に design tokens で定義 */
.plan-memo {
  position: absolute;
  font-family: (既存軽減表と同じ);
  font-size: var(--font-size-sm);   /* 12px 相当、 1 トークンに統一 */
  color: var(--color-text);          /* 白黒テーマの現在の文字色 */
  opacity: 1;                        /* 通常時は不透明 = はっきり読める */
  mix-blend-mode: difference;        /* 背景に応じてコントラスト自動反転 */
  pointer-events: auto;
  user-select: none;                 /* ドラッグ中の選択防止 */
  max-width: 200px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

.plan-memo--dragging {
  opacity: 0.6;                      /* ドラッグ中だけ薄くする (= 持ち上げてる感) */
  cursor: grabbing;
}
```

- 通常時 `opacity: 1` で読みやすく (Figma 付箋・Miro sticky note と同じパターン)
- DnD 中だけ `opacity: 0.6` に下げて「持ち上げてる感」 を出す
- `mix-blend-mode: difference` は常時 ON で、 シート背景 (glassmorphism 半透明) でも文字が背景の補色で浮き出る
- メモモード OFF 中: `pointer-events: none` で「見えるが触れない」 (シート操作の邪魔をしない)
- メモモード ON 中: `pointer-events: auto` で touchable

### 4.7 スマホ非対応

- viewport < `md:` (768px) では:
  - メモは**表示する** (= 既存プランを開いた時の補足情報として読めるべき)
  - メモモード切替アイコンを **非表示** (= 編集 UI を出さない)
  - DnD・右クリック・空文字削除など編集動作はすべて無効

---

## 5. 同期 (Firestore)

### 5.1 markDirty タイミング

メモ操作のうち、 以下のタイミング**のみ**で `usePlanStore.markDirty(planId)` を呼ぶ:

- 新規作成確定 (Save クリック)
- 編集確定 (Save クリック)
- 削除確定 (右クリック削除 / 空文字確定 / ゴミ箱メニュー一括削除)
- DnD 確定 (pointerup)

**呼ばない**:
- DnD 中の pointermove (= 連続位置更新)
- 入力ボックスでのキータイプ中
- メモモード切替

### 5.2 同期サイクル

既存の `syncToFirestore` 5 分クールダウン ([usePlanStore.ts:420-528](src/store/usePlanStore.ts#L420-L528)) に乗せる (= 専用同期経路は追加しない)。 markDirty さえ正しく打てば、 既存のクールダウン + タブ切替 + ログアウト force sync で確実に届く。

### 5.3 共有 URL

`copyPlan` 時の snapshot に `memos[]` が含まれる (= `PlanData` 全体をコピーするので自然に追従)。 共有先の閲覧者は読み取り専用で見るだけ。

---

## 6. i18n

新規キー (`src/locales/ja.json` 起点、 en/ko/zh は ja 値コピーで先行、 翻訳は後追い):

```json
{
  "memo": {
    "mode_toggle_label": "メモ",
    "mode_toggle_tooltip": "シートにメモを書き込む",
    "floating_bar_count": "メモ {count}/{max}",
    "floating_bar_exit": "終了 (Esc)",
    "input_placeholder": "メモを入力 (最大 {max} 文字)",
    "input_save": "保存",
    "input_cancel": "キャンセル",
    "context_delete": "削除",
    "clear_all_menu_label": "メモを全削除",
    "confirm_clear_all_title": "メモを全削除しますか",
    "confirm_clear_all_body": "{count} 件のメモが消えます。 元に戻せません。",
    "confirm_clear_all_ok": "全削除",
    "confirm_clear_all_cancel": "やめる",
    "limit_reached": "メモは最大 {max} 件までです"
  }
}
```

---

## 7. 排他制御 (AA 追加モードとの両立)

`useMitigationStore` に既存 AA モードフラグがあるので、 メモモードを同じ store に追加し、 両者排他で持つ:

```ts
type ToolMode = 'idle' | 'aa-placement' | 'memo';
```

- AA 追加モード ON → メモアイコンを再クリックすると AA を OFF にして memo ON
- AA 追加開始時に memo モードを自動 OFF (逆も同じ)

---

## 8. 実装ファイル概観

| 操作 | ファイル | 責務 |
|------|---------|------|
| 修正 | `src/types/index.ts` | `PlanMemo` 型追加、 `PlanData.memos?` 追加 |
| 修正 | `src/types/firebase.ts` | `MEMO_LIMITS` 定数追加 |
| 修正 | `src/store/useMitigationStore.ts` | メモモード状態 / メモ CRUD / AA との排他 |
| 修正 | `src/components/Timeline.tsx` | 鉛筆アイコン追加、 シートクリックハンドラ、 メモオーバーレイ描画 |
| 修正 | `src/components/ClearMitigationsPopover.tsx` | メニュー項目「メモを全削除」 を追加 |
| 新規 | `src/components/Memo/MemoOverlay.tsx` | メモのレンダリング (絶対配置 + mix-blend-mode + DnD) |
| 新規 | `src/components/Memo/MemoInputBox.tsx` | 入力ボックス (新規/編集共用) |
| 新規 | `src/components/Memo/MemoFloatingBar.tsx` | 下部フローティングバー |
| 修正 | `src/locales/{ja,en,ko,zh}.json` | i18n キー追加 (ja に値、 他は ja コピー) |
| 修正 | `src/components/MitigationSheet.css` (or 新規 `memo.css`) | メモスタイル |

---

## 9. テスト方針

### 単体 (vitest)

- `MEMO_LIMITS` 上限の境界 (100/101 個、 100/101 文字)
- 座標変換 (画面 px → `timeSec` / `xRatio`、 逆方向)
- 空文字確定が delete に分岐すること
- markDirty が DnD 中に呼ばれず、 pointerup でのみ呼ばれること
- AA モードとメモモードの排他

### 実機 (PC)

- 新規作成 → 配置 → 編集 → 削除 (右クリック / 空文字 / ゴミ箱メニュー) の golden path
- ウィンドウリサイズでメモが時間軸 (縦) を保つこと
- AA 追加モードとの排他 (両方 ON にできない)
- 共有 URL でメモが見える (= snapshot に乗っている)
- メモ 100 個で上限警告
- 既存プラン (`memos === undefined`) を開いて壊れない
- DnD 中 opacity 0.6、 通常時 opacity 1

### 実機 (スマホ)

- メモモード切替アイコンが出ないこと
- 既存メモが表示はされる、 編集 UX が露出しないこと

---

## 10. 段階的リリース (推奨フェーズ分け)

実装フェーズ分けは writing-plans 側で詰めるが、 spec レベルでの推奨分割:

- **Phase 1 (= 最初のリリース単位)**: Phase A + B 一緒。 型・定数・store・メモ表示 + 鉛筆アイコン + 新規作成までを 1 リリース。 ユーザーが触って動く最小単位
- **Phase 2**: DnD + 編集 + 右クリック削除
- **Phase 3**: ゴミ箱メニューに「メモ全削除」 追加 + 上限警告 + 確認ダイアログ
- **Phase 4**: i18n の en/ko/zh 翻訳追加 (ja のみ先行 → 後追い)

各 Phase 終わりで `feedback_one_fix_one_verify` 準拠 (実機 1 件検証) で進める。

---

## 11. 設計判断ログ (#57 review 結果)

#56 brainstorming + #57 review で確定した判断:

| # | 論点 | 確定 | 理由 |
|---|------|------|------|
| 1 | 透明度 | 通常時 `opacity:1`、 DnD 中だけ `0.6` | 業界水準 (Figma/Miro 付箋型) で通常時くっきり読める方が UX 良い |
| 2 | 鉛筆ボタンの位置と短縮 | AA ボタン (Sword + PC のみテキスト) と同じパターン、 ラベルは「メモ」 | 既存 [Timeline.tsx:2023-2024](src/components/Timeline.tsx#L2023-L2024) の Sword ボタン UI と揃える |
| 3 | 座標系 | 縦 = `timeSec` (時間秒、 連続値)、 横 = `xRatio` (0.0〜1.0) | LoPo 軽減表は [Timeline.tsx:789](src/components/Timeline.tsx#L789) で `y = time * pixelsPerSecond` = **縦軸が時間**。 横軸はメンバー横並び |
| 4 | DnD 方式 | 既存軽減アイコン DnD と同じ pointer events 自作 | [Timeline.tsx:463](src/components/Timeline.tsx#L463) の `onPointerDown` パターンを踏襲。 ライブラリ追加なし、 保守性とパフォーマンスの両立 |
| 5 | 一括削除 UI | フローティングバーに置かず、 [ClearMitigationsPopover.tsx](src/components/ClearMitigationsPopover.tsx) に「メモを全削除」 メニュー追加 | 既存ゴミ箱と統合、 削除系操作の入口を 1 箇所に集約 |
| 6 | リリース粒度 | Phase 1 = Phase A+B 一緒。 メモ表示 + 鉛筆 + 新規作成までを最初の単位 | memory `feedback_industry_standard` 準拠で「動く骨組み」 でも UX を業界水準に |

---

## 12. 残リスク (実装時に検証する)

- **`mix-blend-mode: difference` の見え方**: LoPo の glassmorphism 背景 (半透明 + ブラー) と組み合わせた時、 文字が読みづらくないか実機検証。 もし読みづらければ代替案 `mix-blend-mode: screen` / `overlay` を試す。 *この判断は実装フェーズで実機を見ながら*
- **シート最終秒を超えた `timeSec` のメモ**: ウィンドウ縦サイズの都合で「画面外」 に配置されるメモが出るかも。 v1 では timeSec の上限 = `Math.max(...timelineEvents.map(e => e.time))` で clamp する案

---

## 13. Done 条件

- [ ] `PlanData.memos[]` 型 + `MEMO_LIMITS` 定数導入、 既存プランが壊れない
- [ ] 鉛筆アイコンが PC 軽減表ツールバーに表示、 スマホでは非表示
- [ ] メモモード ON でシートをクリック → 入力ボックス → Save でメモ確定
- [ ] DnD で位置変更、 pointerup で markDirty、 ドラッグ中だけ opacity 0.6
- [ ] 右クリック削除 / 空文字確定削除 / ClearMitigationsPopover の「メモを全削除」 (確認あり) の 3 経路
- [ ] AA 追加モードとの排他 (両方 ON にできない)
- [ ] 共有 URL で snapshot に memos が乗る
- [ ] 4 言語 i18n キー追加 (ja に値、 en/ko/zh は ja コピーで先行)
- [ ] `npm run build` + `vitest run` がパスする (memory `feedback_vercel_tsc_strict`)
- [ ] 本番 (lopoly.app) で実機ゴールデンパス確認 (memory `feedback_endpoint_user_verification`)

---

## 次工程

1. ✅ ユーザー spec review 完了 (§11 で 6 論点全確定)
2. `superpowers:writing-plans` skill で implementation plan を作成 → `docs/superpowers/plans/2026-05-25-mitigation-memo-plan.md`
3. `superpowers:subagent-driven-development` で Phase 分割実装
4. 完了後、 #54 ハウジングマップ残作業に復帰
