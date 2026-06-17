# 軽減競合の双方向警告 + 画面外ガイド矢印 — 設計書

- 日付: 2026-06-17
- 起点: 機能アイデア③ (`docs/.private/2026-06-15-feature-ideas-batch.md`)
- 状態: ブレスト合意済み → 本書で確定 → writing-plans へ

## 1. 目的 / 背景

「同じ軽減のリキャスト被り (競合)」をユーザーに気づかせる。現状は **片方向**しか機能していない。

現状の挙動 (実コードで確認):
- **クリック配置・後ろ方向** (= これから置く軽減の CD が "後の使用" に食い込む): `validateMitigationPlacement` が `warning:true` を返し、**黄色で置ける**。`conflictInstanceId = firstNext.id` をストア (`conflictingMitigationId`) に立て、対象アイコンが `animate-conflict-pulse ring-2 ring-amber-400` で脈動 ([resourceTracker.ts:590-616](../../../src/utils/resourceTracker.ts#L590-L616) / [Timeline.tsx:497](../../../src/components/Timeline.tsx#L497))。
- **クリック配置・前方向** (= 既存の CD 中に後から重ねる): forward チェックが `available:false` を返し **赤+禁止カーソルでブロック**。競合相手は光らない ([resourceTracker.ts:578-588](../../../src/utils/resourceTracker.ts#L578-L588))。
- **ドラッグ**: 前後とも `available:false` でブロック。
- 脈動は「配置時に1回フラグを立て、競合相手アイコンを操作 (pointerdown/contextmenu) または削除すると消える」一過性フラグ。
- **PC のタイムライン (`Timeline.tsx`) のみ**。スマホ (`MobileTimelineRow.tsx`) は脈動なし。

問題点:
1. 前方向 (既存 CD に重ねる) で競合相手が分からない。
2. 競合相手が**画面外**だと脈動が見えない (例: 1:30 に置いたが競合先 1:00 が上にスクロールアウト)。
3. 操作しただけで脈動が消える = 解消前に見失う。

例 (リプライザル, recast 60s [mockData.ts:756](../../../src/data/mockData.ts#L756)): 1:00 使用 → CD は 2:00 まで → 1:30 に置こうとすると今は「CD残30s」でブロック。これを「**置ける + 競合がひと目で分かる**」にする。

## 2. 確定仕様

### 2.1 配置ルール (競合 = 同じ軽減の CD 被り)

- **クリック配置**: 前方向・後ろ方向とも**置ける**。
  - 前方向 (既存 CD 中) は **赤 + 禁止カーソルの見た目はそのまま残し**、クリックだけ解放して即配置 (確認ダイアログなし)。
  - 後ろ方向は従来どおり黄色 + 即配置。
- **ドラッグ**: 前後とも**ブロック維持** (変更なし)。理由 = ドラッグは被りに気づくきっかけが薄いため。
- **競合以外のブロック** (リソース不足 / チャージ切れ / 前提スキル切れ / 戦闘前限定 / AST 交互 / フェアリー不在 等) は**ブロック維持**。今回は触らない。

### 2.2 競合の検出 (派生・常時判定) — 範囲2

「配置時に1回フラグ」方式を廃止し、**`timelineMitigations` から競合を常に導出**する方式に変更する。

- 競合の定義: **同一オーナー**かつ**同一の共有リキャストグループ**の2インスタンス (時刻 t1 < t2) が `t2 < t1 + recast` で被るとき、両者を「競合中」とする。
  - 共有リキャストグループ = `getSharedCooldownIds` 準拠 (例: bloodwhetting / nascent_flash は同一 CD)。
  - **チャージ技は対象外** (チャージ系はリキャスト被り概念で扱わない。現行 `validateMitigationPlacement` でもチャージは前段で return し、この same-skill CD チェックを通らない)。
  - オーナー単位 (別人が持つ同名ロールアクションは別 CD)。`validateMitigationPlacement` も既にオーナー別の `activeMitigations` で動作 ([Timeline.tsx:3720](../../../src/components/Timeline.tsx#L3720))。
- 結果は「競合中インスタンス id の集合」。プラン内の該当する全被りが対象 (= たくさん同時に競合してもすべて表示)。
- **正当性**: 同じ軽減を CD 中にもう一度使うのは FF14 で物理的に不可能 = 同名 CD 被りは常に「いつか直すべき実エラー」。よって全件表示しても "わざとの重ね置き" を誤検出しない。
- **解消で自動的に消える**: 時刻をずらして被らなくなる / どちらか削除 → 派生判定が再計算され自動でフラグ解除。操作しただけでは消えない。

実装方針: 判定ルールは **resourceTracker に共有ヘルパー** (`findSameSkillCdConflicts(mitigations)` 等) を1つ置き、(a) 派生セレクタ と (b) `validateMitigationPlacement` の same-skill CD 判定が同じルールを参照する (単一の真実)。

### 2.3 競合の見せ方 (PC タイムラインのみ)

- 競合中インスタンスのアイコンを **`animate-conflict-pulse ring-2 ring-amber-400`** で脈動 (既存 CSS を流用、見た目は変えない)。新規に置いた側も競合中なら脈動する (= 「この2つが競合」)。
- **画面外ガイド矢印**: 競合中アイコンが**スクロールで画面外**にあるとき、その**列の中央・ビューポートの上端 (∧) / 下端 (∨)** に、競合相手の方向を指す**黄色脈動の矢印**を出す。
  - 時間が前 (上) に外れている → 上端 ∧ / 後 (下) → 下端 ∨。
  - **1つの列・1方向につき矢印1個** (同方向に複数あれば一番近いものを指す)。端のゴチャつき防止。
  - **矢印クリックで競合相手まで自動スクロール** (`timeline-scroll-container` を `scrollTo({behavior:'smooth'})`。時刻→Y は既存 `timeToYMap` / `pixelsPerSecond` を利用)。
  - 矢印は**ホバーで pointer カーソル + ホバー演出**。
  - 競合相手が画面内に入れば矢印は消え、相手アイコンの脈動が見える。解消するまで (再び画面外に出れば) また出る。
- スマホ (`MobileTimelineRow`) は画面構造上ガイド矢印が成立しないため**対象外** (脈動も付けない)。配置可否のルール (2.1) は共通バリデーション経由でスマホにも反映されるが、視覚フィードバックは出ない。

### 2.4 パフォーマンス

- 検出はデータ変更時に1回 (毎フレームではない)。同名グループを時刻順で隣接比較 = O(N)。数百インスタンスでも無視できる。
- 脈動は **opacity + transform:scale のみ** ([index.css:84-87](../../../src/index.css#L84-L87)) = GPU 合成で軽い。数十個同時でも問題なし。`ring` は静止。
- 画面外判定は IntersectionObserver (多数ターゲット向けに効率的)。

## 3. コンポーネント / データフロー

```
timelineMitigations (store)
   │
   ├─ findSameSkillCdConflicts()  ← resourceTracker 共有ヘルパー (単一ルール)
   │      └→ conflictingIds: Set<string>   (派生・useMemo / セレクタ)
   │
   ├─ 各 MitigationIcon: conflictingIds.has(id) → 脈動クラス
   │
   └─ ConflictOffscreenArrows (新規・PCのみ)
          ├ IntersectionObserver で各競合アイコンの可視/不可視を追跡
          ├ 列(owner)×方向(上/下) ごとに「最も近い画面外競合」を集計
          └ 端に脈動矢印を描画 / クリックで scrollTo

placement:
   validateMitigationPlacement(forward, !drag) → { available:false, conflictOverride:true, message }
   MitigationSelector: isClickable = available || conflictOverride、見た目は !available で赤のまま
   → onSelect で配置 → timelineMitigations 更新 → 上の派生が再計算 → 脈動/矢印が自動で出る
```

### 撤去するもの (派生方式へ置換)
- `conflictingMitigationId` ストアフィールド / `setConflictingMitigationId` / 一過性セット ([MitigationSelector.tsx:202-206](../../../src/components/MitigationSelector.tsx#L202-L206))。
- `removeMitigation` 内の conflict クリア ([useMitigationStore.ts:1333,1339-1340](../../../src/store/useMitigationStore.ts#L1333))。
- Timeline の pointerdown/contextmenu での clear ([Timeline.tsx:500,504](../../../src/components/Timeline.tsx#L500))。

### 触るファイル (見込み)
- `src/utils/resourceTracker.ts` — forward を click=`conflictOverride`/drag=block 化、共有ヘルパー追加、戻り型に `conflictOverride?` 追加。
- `src/components/MitigationSelector.tsx` — `isClickable` を `available || conflictOverride` に、赤スタイルは `!available` 維持。`conflictInstanceId` 連携を撤去。
- `src/store/useMitigationStore.ts` — `conflictingMitigationId` 系を撤去。
- `src/components/Timeline.tsx` — 派生 `conflictingIds` の購読 + 脈動適用 + `ConflictOffscreenArrows` 設置 + 自動スクロール。
- (新規) 画面外矢印コンポーネント。
- i18n — 矢印の aria-label / title (例: 「競合あり (上へ)」)。`cd_remaining` は既存流用。

## 4. 隅の決め事

- 前後同時競合 (前後両方に同名がある真ん中) — 矢印は列×方向ごとなので上下に1個ずつ出る。脈動は該当全インスタンス。
- 新規配置した当人アイコンも競合中なら脈動する (許容)。
- ドラッグで競合位置へ落とすのは引き続き不可なので、競合の発生源はクリック配置のみ。ドラッグで時刻をずらして**解消**するのは派生判定で自動反映。
- スマホは視覚フィードバック対象外 (配置ルールのみ共通)。

## 5. テスト

- `findSameSkillCdConflicts` 単体: (a) 単純な前後被りで両者検出 (b) 共有 CD グループ (bloodwhetting/nascent_flash) (c) オーナー違いは非競合 (d) チャージ技は対象外 (e) 被らない距離なら非検出 (f) 解消 (ずらす/削除) で集合から外れる。
- `validateMitigationPlacement` forward: クリック (ignoreInstanceId なし) → `available:false` かつ `conflictOverride:true`、ドラッグ (ignoreInstanceId あり) → `available:false` かつ override なし (ブロック)。
- 既存 backward warning の回帰 (黄色のまま)。
- (任意) 画面外矢印の表示/非表示は IntersectionObserver 依存のため単体は薄め。ロジック (列×方向で最近傍を選ぶ集計) を純関数化して単体化。

## 6. 非目標 (今回やらない)

- 競合以外のブロック条件の警告化。
- スマホの視覚フィードバック。
- 競合チェッカーの履歴/サマリ表示。
- "or 攻撃"(⑦) やインポート再設計(⑤⑥⑧) との統合。
