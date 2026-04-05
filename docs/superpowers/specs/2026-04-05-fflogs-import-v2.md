# FFLogsインポート v2 設計書

## 概要

FFLogsからのタイムラインインポート処理を「ダメージ起点」から「キャスト起点」に刷新する。
プレイヤー情報をAPIから直接取得することで、タンク判定・TB判定の精度を大幅に向上させる。

## 現状の問題

1. **誤マージ**: ダメージイベントのグループ化（800ms / 2sウィンドウ）が、同じ技の複数ヒットを誤って1つにまとめる（例: M3S キングオブアルカディアが2行になる）
2. **タンク推測**: AA被弾回数からタンクを推測しているが不正確な場合がある
3. **TB推測**: ダメージ比率1.5倍ルールで推測しているが、キャスト対象から直接判定可能
4. **言語検出なし**: 英語ログでも日本語名が取れたように振る舞い、結果が全て英語になる

## 設計方針

- **キャスト起点**: 敵のキャスト（詠唱開始）イベントをタイムラインの骨格にする
- **プレイヤー情報直接取得**: `playerDetails` APIでタンク/ヒーラー/DPSを確定
- **キャスト対象でTB判定**: キャストの `targetID` がタンク → TB確定
- **ダメージは後付け**: 各キャストに対応するダメージを紐付けて基準値を算出
- **連続ダメージ対応**: 1キャストから複数波のダメージが来る場合、波ごとに別行

## API呼び出しフロー

```
1. fetchFights(reportCode)                         — ファイト一覧
2. fetchPlayerDetails(reportCode, fightId)          — NEW: プレイヤー情報
3. fetchCastEvents(reportCode, fight, true/false)   — キャスト（EN/JP）
4. fetchFightEvents(reportCode, fight, true/false)  — ダメージ（EN/JP）
5. fetchDeathEvents(reportCode, fight)              — デス
```

### 新規API: playerDetails

```graphql
query GetPlayerDetails($reportCode: String!, $fightIDs: [Int]!) {
  reportData {
    report(code: $reportCode) {
      playerDetails(fightIDs: $fightIDs)
    }
  }
}
```

レスポンス（JSONスカラー）:
```json
{
  "tanks": [{ "id": 1, "name": "...", "type": "Warrior" }, ...],
  "healers": [{ "id": 3, "name": "...", "type": "WhiteMage" }, ...],
  "dps": [{ "id": 5, "name": "...", "type": "BlackMage" }, ...]
}
```

- `id` がイベントの `sourceID` / `targetID` と一致
- ロール分類済みで返されるため、タンク判定が確実

## マッピング処理（新ロジック）

### Step 1: プレイヤー情報セットアップ

`playerDetails` からタンク2人のIDを取得。
MT/ST の区別はAA被弾パターンで判定（最初にAAを多く受けている方がMT）。

```
tankIds: Set<number>     — タンク2人のプレイヤーID
healerIds: Set<number>   — ヒーラー2人
dpsIds: Set<number>      — DPS4人
mtId: number             — MT（AA被弾で判定）
stId: number             — ST
```

### Step 2: 言語検出

`translate: true`（EN）と `translate: false`（ネイティブ）のキャストイベントを比較。
最初の数件の技名が全て同一 → 英語ログと判定。

- 英語ログ検出時: UIに「日本語名が取得できません。日本語ログを使用してください」と警告
- インポートは英語のみで続行可能

### Step 3: キャスト一覧を骨格にする

`begincast` イベントからタイムライン骨格を作成。

```
入力: castEn[], castJp[]
処理:
  1. GUIDベースで EN/JP 名前マップを構築
  2. begincast イベントを時間順にソート
  3. AA名のキャストを除外
  4. 各キャストから TimelineEvent の元データを生成:
     - time: (timestamp - fightStart) / 1000 → 秒
     - name: { ja, en } — GUIDで突合
     - targetId: キャストの targetID
```

### Step 4: キャスト対象で対象タイプ判定

```
if targetID ∈ tankIds     → TB (MT or ST)
if targetID = 0 or ボスID → AoE（暫定、Step 5で確定）
if targetID ∈ dpsIds      → 個別ギミック（AoE扱い）
if targetID ∈ healerIds   → 個別ギミック（AoE扱い）
```

### Step 5: ダメージをキャストに紐付け

各キャストに対して、対応するダメージイベントを紐付ける。

```
紐付けルール:
  - 同じ GUID
  - キャスト発生時刻〜次の同GUIDキャスト発生時刻の間
  - 次の同GUIDキャストがない場合: キャスト後10秒以内

紐付け後の処理:
  - ダメージ件数で対象を確定:
    - 8件 → 全体AoE
    - 2件 → シェアまたは2人ギミック
    - 1件 → 単体
  - TB判定（Step 4）と組み合わせて最終判定
```

### Step 6: 連続ダメージの波検出

1キャストに紐づくダメージが時間差で複数波ある場合、波ごとに別行にする。

```
例: ホーリーブレードダンス
  キャスト: 60秒
  ダメージ: 61.0s x2, 62.0s x2, 62.5s x2
  → 波検出: [61s, 62s, 62.5s] → 秒単位グループ → 3行

波検出ルール:
  - ダメージを時間順にソート
  - 500ms以上の間隔がある → 新しい波
  - 各波の代表時刻を TimelineEvent の time とする
```

### Step 7: ダメージ値算出

各波のダメージ基準値を算出。

```
優先順位:
  1. unmitigatedAmount がある → そのまま使用
  2. ない場合 → rawDmg / 1.05（現行ロジック）

TB の場合:
  - タンクへのダメージと非タンクへのダメージを分離
  - タンク向け: タンクダメージの最大値
  - AoE部分: 非タンクダメージの最大値

ダメージ丸め: 3有効桁数、天井（現行維持）
```

### Step 8: ダメージなしキャスト

ダメージが紐付かなかったキャスト → フェーズ移行演出・ギミック前兆として追加。

```
- damageAmount: undefined（ダッシュ表示）
- damageType: 'magical'（便宜上）
- target: 'AoE'
```

### Step 9: AA処理

AAにはキャストイベントがないため、ダメージイベントから生成（現行ロジック維持）。

```
- AA判定: 技名が "Attack" / "Shot" / "攻撃" 等
- 500ms以内のAAは同一キャストとして統一
- タンクIDは Step 1 で確定済みなので正確に MT/ST を割り当て
- ダメージ基準値: floor(maxRaw / 1.05 * 0.8)
```

### Step 10: フェーズ自動割り当て

`fight.phaseTransitions` データからフェーズを自動設定。

```
phaseTransitions: [{ id: 1, startTime: 0 }, { id: 2, startTime: 180000 }, ...]

各イベントの time からフェーズを判定:
  - (startTime - fightStart) / 1000 でフェーズ境界を秒に変換
  - イベントの time がどのフェーズに属するかを判定
  - phases 配列を自動生成して返す
```

### Step 11: スケジューリング（現行維持）

同秒に3イベント以上ある場合の競合解消。

```
ルール:
  - 非AA + タンク対象 + AoE が同秒 → AoE を +1s
  - 非AA + AoE + AA が同秒 → AA を +1s
  - 最大2イベント/秒制限: 超過分は +1s にシフト
```

## 出力

```typescript
interface MapperResult {
  events: TimelineEvent[];     // タイムラインイベント
  phases: Phase[];             // NEW: 自動生成フェーズ
  stats: {
    totalRawEvents: number;
    filteredEvents: number;
    timelineEventCount: number;
    aaCount: number;
    mechanicCount: number;
    mtId: number;
    stId: number;
    isEnglishOnly: boolean;    // NEW: 英語ログ検出フラグ
  };
}
```

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/api/fflogs.ts` | `fetchPlayerDetails()` 追加 |
| `src/utils/fflogsMapper.ts` | キャスト起点ロジックに全面書き換え |
| `src/components/FFLogsImportModal.tsx` | playerDetails呼び出し追加、英語ログ警告UI、フェーズ情報受け渡し |
| `src/store/useMitigationStore.ts` | `importTimelineEvents` にフェーズ情報対応 |

## 対象外（今回のスコープ外）

- 中韓翻訳（手動入力のまま）
- 2択攻撃の「AかB」表記（ログの本質的限界、手動編集）
- FFLogsインポート以外の経路（スプシインポート等）への影響
- AA一括対象指定UI（別タスク）

## テスト方針

- 既知のコンテンツ（M1S〜M4S, DSR等）で実データ検証
- 特に確認すべきケース:
  - M3S開幕: キングオブアルカディアが1行になること
  - 連続ダメージ技（ホーリーブレードダンス等）が波ごとに複数行
  - DSR: フェーズが正しく分割されること
  - TB: タンク対象技が正しくMT/ST判定されること
  - 英語ログ: 警告が表示されること
