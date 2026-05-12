# リキャスト専用行 設計書

作成日: 2026-05-13 (セッション 18 brainstorming)
ブランチ: 未定 (実装時に `feat/recast-row` 等)
関連: [docs/.private/2026-05-12-table-area-improvements.md](../../.private/2026-05-12-table-area-improvements.md) の項目 2

---

## 1. 機能概要

LoPo のタイムライン (軽減表) に **リキャスト専用行** を追加する。 ヘッダー (フェーズ│ラベル│時間│メンバー列) のすぐ下、 本文 (時刻ごとの TimelineRow) の前に固定で挿入される 1 行。 各メンバー列内に「現在時刻でリキャスト中の配置済みスキル」 を、 **FF14 ゲーム内 HUD の clockswipe 形式**で表示する。

「ゲーム内本格表示」 をそのまま再現することで、 ユーザーが軽減プランを編集する際に「今この時刻で誰のどのスキルが CD 中か」 を一目で把握できるようにする。

---

## 2. 表示仕様

### 2.1 対象スキル

- **配置済みスキルのみ** (= タイムラインに 1 回でも置かれているスキル種別)
- **リキャスト中のもののみ表示** = 「`配置時刻 ≤ 現在時刻 < 配置時刻 + recast`」 を満たすスキル
- リキャストが明けた瞬間にアイコンが**即非表示**になる
- 配置されてもまだ使用していない (= 現在時刻 < 配置時刻) スキルは表示しない
- 同じスキル種別を複数回配置している場合: 「現在時刻から見て最も最近使用された 1 回」 の CD のみを 1 アイコンで表示

### 2.2 列構造

- 各メンバー列 (T1 / T2 / H1 / H2 / D1 / D2 / D3 / D4) 内に、 そのメンバーのリキャスト中スキルを横並び
- 列幅は既存定義をそのまま使用:
  - T/H 列: `var(--col-th-w) + var(--col-member-pad-x) * 2` = 151px + 5.8px
  - DPS 列: `var(--col-dps-w) + var(--col-member-pad-x) * 2` = 53px + 5.8px

### 2.3 現在時刻の定義

- **スクロール上端の時刻** = ビューポート最上行で表示されている時刻
- ユーザーがマウスホイール等でタイムラインを縦スクロールすると、 上端の時刻が変化 → リキャスト行の clockswipe も連動して動く
- ホバー / クリックでの個別選択時刻には連動しない (パフォーマンス + マウス追従禁止規約)

### 2.4 並び順

- **配置時刻が早い順** (左 → 右)
- 削除ロジック (2.6) で表示候補を絞った後、 残ったものを配置時刻順に並べ直す
- DOM の並びは CSS `order` プロパティで動的制御

### 2.5 アイコン外観

- **サイズ**: 24px × 24px (既存配置済みアイコン `w-6 h-6` と同サイズ)
- **「グレーの箱」 (`bg-black/50 border border-app-border`) は付けない**: 画像 + rounded のみ
- 既存配置済みアイコン (本文側) は「グレーの箱あり」 のままで、 リキャスト行とは見た目で差別化される
- 副次効果: アイコン本来の色が前に出てゲーム HUD らしさが増す

### 2.6 同時表示数の上限 (暫定)

| 列種別 | 上限 |
|---|---|
| タンク (T1, T2) | 6 個 |
| ヒーラー (H1, H2) | 6 個 |
| DPS (D1, D2, D3, D4) | 2 個 |

- 上限を超える場合: **残時間が短い順から削除** (= 一番早く空くスキルを消して、 新しいスキルを表示)
- 理由:
  - 残時間が短いスキルはすぐにリストから自然消失するので、 削っても情報損失が少ない
  - 長く CD 中のスキルは「まだしばらく使えない」 という情報を長く伝える価値あり
- 「暫定的に」 = 運用後に上限値や削除ロジックを再検討する余地あり

### 2.7 CD オーバーレイ (clockswipe)

FF14 ゲーム内 HUD と完全に同一の挙動:

- **起点**: 12 時 (= 0deg)
- **方向**: 時計回り
- **動作**: リキャスト直後 (経過 0 秒) はアイコン全体が黒く覆われ、 12 時から時計回りに**透明領域**が広がる
- **完了直前**: 黒い扇形が 11 時 → 12 時 の狭い範囲に縮む
- **完了**: アイコンがリキャスト行から非表示
- **色**: `rgba(0, 0, 0, 0.55)`
- **CSS 実装**:
  ```css
  .cd::before {
    content: '';
    position: absolute;
    inset: 0;
    background: conic-gradient(
      transparent 0 var(--cd-angle, 0deg),
      rgba(0,0,0,0.55) var(--cd-angle, 0deg) 360deg
    );
    pointer-events: none;
  }
  ```
- **角度計算**: `--cd-angle` = `(1 - 残時間 / recast) × 360deg` = 経過率 × 360deg
- 注: `conic-gradient` のデフォルト起点が 12 時。 `from -90deg` 等は付けない (誤って付けると 9 時起点になる)

### 2.8 残秒テキスト

- アイコン中央に**残秒数を整数で表示** (例: 88, 35, 13, 9)
- スタイル: 白文字 + 黒影 (text-shadow 多重)、 Arial 系 sans-serif、 太字 (font-weight 900)
- 1 桁・2 桁・3 桁いずれも単位なし (FF14 ゲーム内と同)
- 長 CD (recast ≥ 30 秒) ばかりの軽減プランで必須 (clockswipe の角度だけでは判別困難)

### 2.9 行高さ

- 展開時: **32px** (アイコン 24px + 上下 padding 4px)
- 折り畳み時: **18px** (細い帯)

### 2.10 0 個の列

- リキャスト中スキルがゼロのメンバー列はアイコンを表示せず、 空セルとして行高さのみ確保

---

## 3. 折り畳み UI

### 3.1 操作 UI

- リキャスト行の左端 (フェーズ列内 または 時間列内) に小さな**シェブロンボタン**
- 展開時: ▼
- 折り畳み時: ▶
- シェブロンクリックで切替

### 3.2 折り畳み時の状態

- 高さ 18px の細い帯
- アイコン非表示 (CSS で `display: none` or `visibility: hidden`)
- シェブロン ▶ と「リキャスト」 テキストのみ残る (= 再展開の取っ手)

### 3.3 状態の永続化

- `useState` + `localStorage` パターン (既存 `phaseColumnCollapsed` と同一)
- キー: `lopo-recast-row-collapsed`
- 値: `'true'` (折り畳み) / `'false'` (展開) 文字列
- デフォルト: 展開状態 (= 表示)
- 実装例:
  ```tsx
  const [recastRowCollapsed, setRecastRowCollapsed] = useState(() => {
    try { return localStorage.getItem('lopo-recast-row-collapsed') === 'true'; } catch { return false; }
  });

  const handleToggleRecastRow = () => {
    setRecastRowCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('lopo-recast-row-collapsed', String(next)); } catch {}
      return next;
    });
  };
  ```

---

## 4. 実装方針 (GPU 加速 + React 再レンダー最小化)

### 4.1 全体方針

スクロール時の clockswipe を**スムーズスクロールに完全連動**させるため、 LoPo 既存の `timeLabelRef` 系パターン ([Timeline.tsx:164-232](../../../src/components/Timeline.tsx#L164-L232)) を踏襲:

- React state を介さず、 `ref` で DOM の `style.setProperty` を直接更新
- CSS variable (custom property) を経由してブラウザの paint layer が GPU で描画
- 60fps のスクロール連動でも CPU 負荷ほぼゼロ

### 4.2 静的 DOM 設計

- 各メンバーに配置されたスキル**全種を DOM に常駐**させる (key で固定、 追加/削除しない)
- 各アイコンに `ref` を持たせ、 `data-` 属性で必要メタ情報を保持:
  ```jsx
  <RecastIcon
    ref={iconRef}
    data-skill-id={skill.id}
    data-placement-time={skill.time}
    data-recast={skill.recast}
    style={{
      '--cd-display': 'none',
      '--cd-angle': '0deg',
      '--cd-order': 0,
    }}
  />
  ```
- アイコンの表示/非表示・角度・並び順は全て CSS variable で制御

### 4.3 更新フロー (スクロールイベントごと)

1. スクロールイベント (passive listener) を捕捉
2. ビューポート上端の時刻 (`currentTime`) を計算
3. 各メンバーごとに:
   - 配置済みスキル全種を iterate
   - 残時間計算: `remaining = recast - (currentTime - placementTime)`
   - リキャスト中判定: `0 < remaining ≤ recast` かつ `currentTime ≥ placementTime`
   - リキャスト中のスキルを残時間昇順でソート
   - 上限 (T/H 6 個 / DPS 2 個) を超えた分を切り捨て (先頭 = 残時間短い側を削除)
   - 残ったスキルを配置時刻順で並び直し
4. 各アイコンの DOM 直接更新 (ref.style.setProperty + textContent):
   - 表示候補にあれば: `--cd-display: flex`、 `--cd-angle: N deg`、 `--cd-order: N`、 残秒テキスト更新
   - 表示候補になければ: `--cd-display: none`
5. ブラウザの paint layer が GPU で再描画 → 滑らかに反映

### 4.4 CSS 設計

```css
.recast-icon {
  display: var(--cd-display, none);
  order: var(--cd-order, 0);
  width: 24px;
  height: 24px;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.recast-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: conic-gradient(
    transparent 0 var(--cd-angle, 0deg),
    rgba(0,0,0,0.55) var(--cd-angle, 0deg) 360deg
  );
}

.recast-icon .recast-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  font-family: Arial, sans-serif;
  text-shadow: 0 0 3px #000, 0 0 2px #000, 0 0 1px #000;
  z-index: 2;
  line-height: 1;
}
```

注: 既存 CSS ルール ([css-rules.md](../../../.claude/rules/css-rules.md)) を遵守:
- `backdrop-filter` 直書きはしない (今回不要)
- `clip-path: path()` は使わない (`conic-gradient` で実現)
- conic-gradient は静的 (回転しない) のため `::before` のサイズ規約は無関係

### 4.5 影響範囲

#### 新規ファイル

- `src/components/RecastRow.tsx`: リキャスト行コンポーネント
- `src/components/RecastIcon.tsx`: clockswipe アイコン単体コンポーネント (forwardRef)

#### 変更ファイル

- `src/components/Timeline.tsx`:
  - ヘッダーと本文の間に `<RecastRow />` を挿入
  - 折り畳み state (`recastRowCollapsed` + handler) を追加
  - スクロールイベントハンドラ内で `RecastRow` の `update` メソッドを呼ぶ (ref ベース)
- `src/index.css`:
  - リキャスト行関連のクラス (`.recast-icon`、 `.recast-row` 等) を追加 (既存 Tailwind + 専用 CSS の併用パターンに合わせる)
- `src/locales/{ja,en,ko,zh}.json`:
  - `timeline.recast_row.label` = 「リキャスト」 / "Recast" / "리캐스트" / "技能冷却" 等

#### 影響を受けない既存機能

- タイムライン本体・配置済みアイコン (本文): 完全に独立
- フェーズオーバーレイ・ラベル・時間列: 完全に独立
- スクロール処理: passive listener 追加のみ (既存と並列)
- パフォーマンス: 既存と同等の負荷 (ref ベース更新のみ)

---

## 5. i18n

| キー | ja | en | ko | zh |
|---|---|---|---|---|
| `timeline.recast_row.label` | リキャスト | Recast | 리캐스트 | 技能冷却 |

注: 上記の zh/ko 訳は仮。 実装時に正式訳語を確認 (LoPo は中韓公式ジョブガイドを一次ソースとする慣例あり、 memory `reference_ff14_jobguide_urls.md` 参照)。

---

## 6. やらないこと (スコープ外)

- **未配置スキルの表示**: ジョブが持つ全スキル (= ホットバー全種) は出さない。 配置されたものだけ。
- **リキャスト中以外のアイコン表示**: 通常状態 (使用可能) のアイコンは出さない。 ゲーム HUD は使用可能アイコンも常時並ぶが、 軽減プランの視認性とパフォーマンスのため CD 中のみ。
- **「効果中スキル最上行残し」 との統合**: これは次セッション最優先 2 番目の別タスク。 本仕様には含めない (相互影響は別途検討)。
- **マウス追従 UI**: 規約 ([ui-design.md](../../../.claude/rules/ui-design.md)) で禁止。
- **JS によるアニメーション**: 全部 CSS + GPU 描画。 `requestAnimationFrame` 駆動の補間アニメは使わない。
- **モバイル対応の最適化**: PC (md ブレークポイント以上) を主対象。 モバイルではリキャスト行を表示しないか、 別レイアウトを検討 (本仕様には含めない)。
- **「互い違い配置時のチラつき」 バグ修正**: TODO.md「次セッション最優先 3」 の別バグ、 本仕様に含めない。

---

## 7. 未確定事項 (実装時に決定)

- シェブロンボタンを置く具体的な列 (フェーズ列? 時間列? 専用領域?) - 実装時に既存ヘッダー構造と相談
- 残秒テキストの正確な font-size (10px / 11px) - 24px アイコン上で 2 桁 (例: "35") が読める最大サイズに調整
- スクロールイベントの処理方式: 基本は **passive listener 単独で `style.setProperty` を直接呼ぶ** (ref ベースで再レンダーなしなら毎フレーム呼んでも軽い)。 実機計測でカクつきが出たら `requestAnimationFrame` で coalesce する方針 (実装時判断)
- フェーズオーバーレイ (`!phaseColumnCollapsed && phases.length > 0` の半透明バー、 [Timeline.tsx:2499-](../../../src/components/Timeline.tsx#L2499)) との重なり処理 - リキャスト行も同様にオーバーレイされるか、 リキャスト行は phaseオーバーレイ対象外か。 多分後者だが実装時に確認。
- モバイル (`MobileTimelineRow`) での扱い - 初期実装では PC 限定とし、 モバイルではリキャスト行自体を表示しない方向

---

## 8. テスト戦略

### 8.1 ユニットテスト

- 残時間計算ロジック (`remaining = recast - (currentTime - placementTime)`)
- 上限超過時の削除ロジック (T/H 6, DPS 2、 残時間昇順削除)
- 同スキル複数配置時の「最も最近使用された 1 回」 選択
- リキャスト明け判定 (境界値: `remaining = 0`, `remaining = 1`)

### 8.2 統合テスト (vitest + React Testing Library)

- リキャスト行の表示/非表示切替
- スクロール時のアイコン表示数変化
- 折り畳み state の localStorage 永続化

### 8.3 視覚回帰 / 手動テスト

- clockswipe が 12 時起点・時計回りに正しく動く (60 秒スキル、 120 秒スキル等で進行度確認)
- 既存タイムライン (placed mitigation icon・フェーズオーバーレイ・スクロール) に影響なし
- 折り畳み前後で他要素のレイアウトが崩れない
- 端末別のフレームレート (ローカル dev + 本番) 確認

---

## 9. ロールアウト

- PR タイトル例: `feat(timeline): リキャスト専用行 - clockswipe 表示、 折り畳み可、 GPU 加速`
- `feat/recast-row` ブランチで作業 → ローカル dev で実機確認 → main にマージして本番デプロイ → ユーザーが実機で触って「OK」 を得るまで一区切り
- 過去のセッション 17 同様、 表エリアの視覚要素に手を入れるため、 既存機能 (placed mitigation icon、 フェーズオーバーレイ、 スクロール挙動) への副作用を必ず動作確認する
- 「効果中スキル最上行残し」 (次セッション最優先 2) との統合検討は本機能リリース後

---

## 10. 関連ドキュメント

- TODO: [docs/TODO.md](../../TODO.md) (次セッション最優先 1)
- アイデア集約: [docs/.private/2026-05-12-table-area-improvements.md](../../.private/2026-05-12-table-area-improvements.md) (項目 2)
- LoPo デザイン: [docs/DESIGN.md](../../DESIGN.md)、 [.claude/rules/DESIGN.md](../../../.claude/rules/DESIGN.md)、 [.claude/rules/css-rules.md](../../../.claude/rules/css-rules.md)、 [.claude/rules/ui-design.md](../../../.claude/rules/ui-design.md)
- 既存ファイル参照:
  - [src/components/Timeline.tsx](../../../src/components/Timeline.tsx) (折り畳み state パターン: L737-771、 配置済みアイコン: L448-507、 スクロールハンドラ: L164-232)
  - [src/utils/calculator.ts](../../../src/utils/calculator.ts) (`getColumnCssVar`)
  - [src/index.css](../../../src/index.css) (列幅 CSS variable: L1326-1350)
