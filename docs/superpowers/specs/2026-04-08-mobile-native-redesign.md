# スマホUIネイティブリデザイン設計書

> 作成日: 2026-04-08
> ステータス: 承認済み

---

## 1. 概要

LoPoのスマホUI全体をApple HIG（Human Interface Guidelines）準拠でフルリデザインする。
ネイティブiOSアプリと同等の見た目・操作感・アニメーションを実現する。

併せて、PC版にもアニメーション改善（spring物理、ボタンフィードバック等）を共通適用する。
PC版レイアウトの大幅リデザインは別プロジェクトとして切り出す。

## 2. 設計原則

1. **トークン駆動** — 色・サイズ・アニメーション値はすべてデザイントークンで管理。ハードコーディングなし
2. **多言語完全対応** — 全UI文字列をi18nキー経由。ja/en/zh/koの4言語
3. **reduced-motion尊重** — `prefers-reduced-motion`メディアクエリでアニメーション無効化対応
4. **両テーマ対応** — ダーク/ライトの両テーマで同じ品質。CSS変数で色を切替
5. **MobileTimelineRow維持** — 2行カードレイアウト（80px行高）はそのまま。iOS自動ズーム防止済み

## 3. スコープ

### 対象コンポーネント（モバイル — 全8コンポーネント）

| コンポーネント | 変更内容 |
|---|---|
| MobileHeader | Large Title化。「LoPo」小ラベル＋コンテンツ名大タイトル＋プラン名/ジョブ構成サブタイトル |
| MobileBottomNav | ブラー背景(blur 20px)、アイコン拡大(18→24px)、タッチターゲット52px、スライドインジケーター追加 |
| MobileFAB | 角丸16px正方形、展開時ラベル横表示、spring stagger展開、区切り線でナビ系/設定系分離 |
| MobileBottomSheet | iOS14風(角丸14px、ドラッグハンドル36px)、シート背景#1c1c1e(dark)/#fff(light) |
| MobileContextMenu | ポップ展開(scale 0.8→1.0)、攻撃名+時間のヘッダー表示、削除を赤文字で分離 |
| MobilePartySettings | ドラッグ&ドロップ（ジョブ→スロット直接）、スワイプ削除、4×2グリッドスロット |
| EventModal | iOS風ナビバー（キャンセル/タイトル/保存）、Segmented Control（種別/対象） |
| MobileTimelineRow | 既存2行カード維持。長押しシュリンク(scale 0.96)追加のみ |

### 対象（PC/モバイル共通）

| 項目 | 内容 |
|---|---|
| motionTokens | 全spring/duration/easing値をPC/モバイル共通で適用 |
| SegmentedControl | 新規共通コンポーネント。EventModalの種別/対象で使用 |
| SuccessCheck | 新規共通コンポーネント。保存/同期成功時のチェックマークアニメ |
| ボタンフィードバック | active:scale(0.95)のspringアニメーション全ボタンに適用 |
| パーティD&D | PC版でもマウスドラッグ対応（useDragAndDropフック共通化） |

### 対象外（別プロジェクト）

- PC版レイアウトの大幅リデザイン（ヘッダー、サイドバー、フッター等）
- MobileTimelineRowの情報レイアウト変更

## 4. ヘッダー設計

### 現行
- 高さ36px、左にLoPoロゴ、右にコンテンツ名/プラン名（タップでポップアップ）

### 新設計
```
┌─────────────────────────────────────┐
│ LOPO                    (11px, muted)
│ 絶アレキサンダー         (26px, bold)
│ MY PLAN — WHM SCH AST SGE  (12px, muted)
└─────────────────────────────────────┘
高さ: 72px（トークン: header.height）
```

- 「LoPo」は小さなラベル（11px, uppercase, letter-spacing 0.15em）として上部に配置
- コンテンツ名がLarge Title（26px, font-weight 800）
- プラン名＋ヒーラージョブ構成をサブタイトルに常時表示
- safe-area-inset-top対応

## 5. ボトムナビ設計

### 現行
- 高さ48px、5タブ、アイコン18px

### 新設計
```
┌────────┬────────┬────────┬────────┬────────┐
│  Menu  │ Party  │ Tools  │ My Job │Account │
│  24px  │  24px  │  24px  │  24px  │  24px  │
│  10px  │  10px  │  10px  │  10px  │  10px  │
├════════╧════════╧════════╧════════╧════════┤
│  blur(20px) 半透明背景 + 0.5px border-top  │
└─────────────────────────────────────────────┘
高さ: 52px（トークン: bottomNav.height）
```

- 半透明ブラー背景（ダーク: rgba(20,20,20,0.85) / ライト: rgba(249,249,249,0.94)）
- アイコン24px、ラベル10px
- タッチターゲット52px確保（Apple推奨44px以上）
- アクティブタブにスライドインジケーター（spring.snappyで移動）
- safe-area-inset-bottom対応

## 6. FAB設計

### 閉じた状態
- 52×52px、角丸16px、右下配置（right: 16px, bottom: bottomNav.height + 16px）
- ダーク: 半透明白ボーダー / ライト: 白背景＋影

### 展開状態
- メインボタン×マークに変化
- 各44pxボタンが上方向にspring stagger展開（40msディレイ）
- ラベルがボタン横に表示（13px, 半透明黒背景パッド）
- 区切り線でナビ系（フェーズ/ラベル/検索/展開折りたたみ）と設定系（同期/言語/テーマ）を分離
- 背景にオーバーレイ（rgba(0,0,0,0.4)）

## 7. ボトムシート設計

### 共通仕様
- 角丸14px（上部のみ）
- ドラッグハンドル（36×5px、角丸3px）
- 背景: ダーク #1c1c1e / ライト #fff
- スワイプダウンで閉じる
- spring.defaultでスライドイン、easing.sheetでスライドアウト

### メニューシート（MENUタブ）
- タイトル（16px, bold, center）
- リスト項目: 28pxアイコン（カテゴリ色背景）＋テキスト＋シェブロン
- 項目: コンテンツ選択、プラン管理、共有、FFLogsインポート、バックアップ

### コンテキストメニュー（長押し）
- ヘッダー: 攻撃名（14px, bold）＋時間・種別（12px, muted）
- 区切り線
- 編集（青アイコン）/ この時間にイベント追加（緑アイコン）
- 区切り線
- 削除（赤アイコン、赤テキスト）
- ポップ展開: scale(0.8)→1.0のspring

## 8. EventModal設計

### ナビバー
```
キャンセル(青)  |  イベント編集(bold)  |  保存(青,bold)
```
iOS標準の3パート構成。

### フォームフィールド
- 攻撃名: テキスト入力（16px — iOSズーム防止）
- 種別: SegmentedControl（物理/魔法/全体）
- 対象: SegmentedControl（全体/単体）
- ダメージ: 数値入力（16px）
- メモ: テキストエリア
- 全フィールドラベル: 12px, uppercase, #8e8e93

### SegmentedControl仕様
- iOS UISegmentedControlを再現
- 選択背景がspring.snappyでスライド移動
- ダーク: 背景rgba(255,255,255,0.06), 選択rgba(255,255,255,0.12)
- ライト: 背景rgba(0,0,0,0.06), 選択#fff＋影

## 9. パーティ設定設計

### レイアウト
```
┌───────────────────────────────────┐
│  Party            [MY JOB]       │
├─────┬─────┬─────┬─────┐          │
│ MT  │ ST  │ H1  │ H2  │  4×2    │
│     │     │     │     │  グリッド │
├─────┼─────┼─────┼─────┤          │
│ D1  │ D2  │ D3  │ D4  │          │
│     │     │     │     │          │
└─────┴─────┴─────┴─────┘          │
│  ジョブアイコンをスロットにドラッグ  │
├───────────────────────────────────┤
│  TANK                            │
│  [PLD][WAR][DRK][GNB]           │
│  HEALER                          │
│  [WHM][SCH][AST][SGE]           │
│  DPS                             │
│  [MNK][DRG][NIN][SAM][RPR][VPR] │
│  [BRD][MCH][DNC][BLM][SMN][RDM] │
│  [PCT]                           │
└───────────────────────────────────┘
```

### ドラッグ&ドロップ仕様
1. ジョブアイコンを**長押し**（drag.holdDelay: 150ms、定数化）
2. アイコンがscale(1.15)に拡大＋影が深くなる（「持ち上がった」感覚）
3. 指を動かしてスロットの上に移動 → スロットがscale(1.08)＋青枠でハイライト
4. 指を離す → ジョブがスロットにspring.gentleでスナップ
5. 既に埋まっているスロットにドロップ → 入れ替え（スワップ）
6. 触覚フィードバック: ドラッグ開始(haptic.medium)、ドロップ成功(haptic.success)
7. **タップ操作も残す** — タップで空きスロットに自動配置（アクセシビリティ）
8. **PC版**: マウスドラッグで同じ操作が可能（useDragAndDropフック共通化）

### スワイプ削除
- スロットを左スワイプ → 赤い「削除」ボタンが出現（swipe.deleteThreshold: 80px）
- ボタンタップで確定（即時削除ではない）

## 10. アニメーション設計

### spring物理（framer-motion）
| トークン | 値 | 用途 |
|---|---|---|
| spring.default | stiffness: 400, damping: 28 | FAB展開、シート表示、一般 |
| spring.gentle | stiffness: 300, damping: 24 | D&Dスナップ、パーティスロット |
| spring.snappy | stiffness: 500, damping: 30 | タブ切替、セグメント、トグル |

### duration/easing
| トークン | 値 | 用途 |
|---|---|---|
| duration.fast | 150ms | ホバー、フォーカス |
| duration.normal | 250ms | オーバーレイ表示/非表示 |
| duration.sheet | 350ms | シートスライド |
| easing.sheet | cubic-bezier(0.32, 0.72, 0, 1) | iOS標準シートカーブ |
| stagger.fab | 40ms | FABメニュー連続展開ディレイ |

### スケール
| トークン | 値 | 用途 |
|---|---|---|
| scale.press | 0.96 | 長押しシュリンク（タイムライン行） |
| scale.drag | 1.15 | ドラッグ中アイコン拡大 |
| scale.dropTarget | 1.08 | ドロップターゲットのパルス |
| scale.ctxMenu | 0.8 | コンテキストメニュー初期スケール |
| scale.tapActive | 0.95 | ボタンタップ時（PC/モバイル共通） |

### 触覚フィードバック
| トークン | 値 | 用途 |
|---|---|---|
| haptic.light | 10ms | タブ切替、トグル |
| haptic.medium | 15ms | ドラッグ開始、ドロップ |
| haptic.success | [10, 30, 10]ms | 保存完了、同期成功 |

### こだわりの演出
1. **長押しシュリンク** — タイムライン行が長押し中にscale(0.96)に縮み、コンテキストメニューの予告
2. **ドラッグゴーストリフト** — ジョブアイコンがscale(1.15)＋影でリアルに浮き上がる
3. **タブインジケーター スライド** — アクティブタブ背景がspring.snappyで滑らかに移動
4. **成功チェックマーク** — Apple Pay風のpop＋SVG描画アニメ＋触覚フィードバック
5. **スワイプで削除** — iOS Mail風の左スワイプ、80px閾値で赤ボタン出現
6. **Segmented Control** — 選択背景がspringで滑る、iOS標準と同一
7. **コンテキストメニュー ポップ** — scale(0.8)→1.0のspring展開＋背景ぼかし
8. **ラバーバンド** — ボトムシート内スクロール端のゴムバンド効果

## 11. デザイントークン構成

### ファイル構成

```
src/tokens/
  mobileTokens.ts    — モバイル専用（サイズ・角丸・余白）
  motionTokens.ts    — アニメーション（PC/モバイル共通）
  interactionTokens.ts — 操作（長押し・スワイプ・触覚）
```

### mobileTokens.ts
| トークン | 値 | 用途 |
|---|---|---|
| header.height | 72px | Large Titleヘッダー高さ |
| header.titleSize | 26px | Large Titleフォントサイズ |
| bottomNav.height | 52px | ボトムナビ高さ |
| bottomNav.iconSize | 24px | ナビアイコンサイズ |
| bottomNav.labelSize | 10px | ナビラベルサイズ |
| fab.size | 52px | FABボタンサイズ |
| fab.itemSize | 44px | FABメニュー項目サイズ |
| fab.radius | 16px | FAB角丸 |
| sheet.radius | 14px | ボトムシート角丸 |
| sheet.handleWidth | 36px | ドラッグハンドル幅 |
| touchTarget.min | 44px | Apple推奨最小タッチ領域 |
| party.slotSize | 1:1 aspect | パーティスロットアスペクト比 |
| party.iconSize | 32px | スロット内ジョブアイコン |
| party.jobChipColumns | 6 | ジョブ選択グリッド列数 |

### interactionTokens.ts
| トークン | 値 | 用途 |
|---|---|---|
| drag.holdDelay | 150 | D&D長押し開始（ms）。調整しやすいよう定数化 |
| drag.moveThreshold | 8 | ドラッグ判定の移動量（px） |
| swipe.deleteThreshold | 80 | スワイプ削除の発火閾値（px） |
| contextMenu.holdDelay | 300 | コンテキストメニュー長押し（ms） |

## 12. テーマ対応

### ダークテーマ（既存CSS変数を活用＋拡張）
| 用途 | 値 |
|---|---|
| シート背景 | #1c1c1e |
| ナビ背景 | rgba(20,20,20,0.85) + blur(20px) |
| ナビボーダー | rgba(255,255,255,0.08) 0.5px |
| FABボタン | rgba(255,255,255,0.1) border rgba(255,255,255,0.15) |
| オーバーレイ | rgba(0,0,0,0.4) |

### ライトテーマ
| 用途 | 値 |
|---|---|
| シート背景 | #ffffff |
| ナビ背景 | rgba(249,249,249,0.94) + blur(20px) |
| ナビボーダー | rgba(0,0,0,0.12) 0.5px |
| FABボタン | rgba(255,255,255,0.9) shadow + border rgba(0,0,0,0.08) |
| オーバーレイ | rgba(0,0,0,0.2) |

## 13. 新規ファイル一覧

### トークン（3ファイル）
- `src/tokens/mobileTokens.ts`
- `src/tokens/motionTokens.ts`
- `src/tokens/interactionTokens.ts`

### フック（3ファイル）
- `src/hooks/useDragAndDrop.ts` — タッチ/マウスD&Dロジック
- `src/hooks/useSwipeAction.ts` — スワイプアクションロジック
- `src/hooks/useHaptic.ts` — 触覚フィードバック

### 共通コンポーネント（2ファイル）
- `src/components/SegmentedControl.tsx` — iOS風Segmented Control（PC/モバイル共通）
- `src/components/SuccessCheck.tsx` — チェックマークアニメ（PC/モバイル共通）

## 14. 変更ファイル一覧

### モバイルコンポーネント（8ファイル）
- `src/components/MobileHeader.tsx` — Large Title化
- `src/components/MobileBottomNav.tsx` — ブラー背景＋インジケーター
- `src/components/MobileFAB.tsx` — デザイン刷新＋ラベル
- `src/components/MobileBottomSheet.tsx` — iOS風角丸＋ハンドル
- `src/components/MobileContextMenu.tsx` — ポップ展開＋ヘッダー
- `src/components/MobilePartySettings.tsx` — D&D＋スワイプ削除
- `src/components/MobileGuide.tsx` — チュートリアル更新
- `src/components/MobileTimelineRow.tsx` — 長押しシュリンク追加

### 共通（2ファイル）
- `src/components/EventModal.tsx` — iOS風フォーム＋Segmented Control
- `src/components/Timeline.tsx` — springアニメーション適用（PC含む）

### PC適用
- パーティ設定のD&D（PartySettingsModal.tsx）
- 全ボタンのspringフィードバック（グローバルCSS or Tailwind）

### 多言語（4ファイル）
- `src/locales/ja.json`
- `src/locales/en.json`
- `src/locales/zh.json`
- `src/locales/ko.json`

## 15. 対象外（別プロジェクト）

- PC版レイアウトの大幅リデザイン
- MobileTimelineRowの情報レイアウト変更
- ランディングページのモバイル対応
