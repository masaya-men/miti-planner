# 展開戦術バリアコピー設計書

## 概要

展開戦術が独自のshieldPotencyでバリアを計算する現状を改修し、「タイムライン上の鼓舞バリアを参照してコピーする」正しい動作に変更する。

## 現状の問題

- 展開戦術が `shieldPotency: 540` を持ち、鼓舞と独立してバリア値を計算している
- 秘策・転化・クラーシス等のバフが鼓舞→展開戦術の連鎖に反映されない
- FF14本来の動作:「鼓舞のバリアをパーティ全員にコピーする」が再現できていない

## 設計

### データモデル変更

#### AppliedMitigation型（types/index.ts）

```typescript
export interface AppliedMitigation {
  id: string;
  mitigationId: string;
  time: number;
  duration: number;
  ownerId: string;
  targetId?: string;
  linkedMitigationId?: string;  // 追加: リンク先の鼓舞インスタンスID
}
```

#### deployment_tactics スキル定義（mockData.ts）

変更前:
- `shieldPotency: 540` → 削除
- `valueType: 'potency'` → 削除

変更後:
- `isShield: true` → 維持
- `copiesShield: 'adloquium'` → 追加（コピー元スキルを明示）

### バリア計算ロジック

展開戦術のバリア値 = リンク先の鼓舞が詠唱された時点のバフを反映したバリア値。

計算手順:
1. `linkedMitigationId` でリンク先の鼓舞インスタンスを取得
2. リンクなし → バリア値0
3. リンクあり → 鼓舞の詠唱時刻に有効だったバフを収集:
   - 秘策（recitation）→ クリ確定 ×1.6
   - 転化（dissipation）→ 回復効果+20%（healingIncreaseSelfOnly: 鼓舞の使用者と同一ownerIdの場合のみ）
   - クラーシス（krasis）→ 回復効果+20%（対象: 鼓舞のtargetId）
   - その他のhealingIncrease系バフ
4. `calculatePotencyValue(stats, 540, 'healer', modifiers) × critMultiplier × healingMultiplier`
5. この値を全パーティメンバーに適用

### 自動リンクロジック

タイムラインが変更されるたびに（スキル追加/削除/移動）、全ての展開戦術をチェック。

**「有効な鼓舞」の条件:**
- `mitigationId === 'adloquium'`
- `鼓舞.time <= 展開戦術.time`（展開前に詠唱済み）
- `鼓舞.time + duration > 展開戦術.time`（バリアがまだ残っている）

| 状態 | 有効な鼓舞数 | 動作 |
|------|-------------|------|
| リンク未設定 | 0 | バリア値0、警告表示 |
| リンク未設定 | 1 | 自動リンク |
| リンク未設定 | 2+ | バリア値0、選択待ち |
| リンク済み・有効 | - | そのまま維持 |
| リンク先が消えた | 0 | バリア値0、警告表示 |
| リンク先が消えた | 1 | 自動で付け替え |
| リンク先が消えた | 2+ | バリア値0、選択待ち |

### 選択UI

既存のscope: "target"スキル選択UIパターンを踏襲。

- 展開戦術ボタンクリック → スキル直下にglass-panelがスライドイン展開
- ヘッダー: 「← 展開する鼓舞を選択」（戻るボタン付き、既存の「← 対象を選択」と同じスタイル）
- リスト: 各鼓舞を「対象者ジョブアイコン + ポジション名 + バリア値」で表示
- 1つなら自動選択してUI省略
- 0なら配置は許可、バリア値0で警告表示（後から鼓舞追加で自動リンク）

### 影響範囲

- `src/types/index.ts` — AppliedMitigation型にlinkedMitigationId追加
- `src/data/mockData.ts` — deployment_tacticsの定義変更（shieldPotency削除、copiesShield追加）
- `src/components/Timeline.tsx` — バリア計算ロジック改修（リンク先参照計算）
- `src/components/MitigationSelector.tsx` — 展開戦術用の鼓舞選択UI追加
- `src/store/useMitigationStore.ts` — 自動リンクロジック追加
- `src/utils/calculator.ts` — 鼓舞バリア計算のヘルパー関数追加（必要に応じて）
