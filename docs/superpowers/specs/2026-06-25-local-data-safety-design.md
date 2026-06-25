# ローカルデータ安全性 設計書 (2026-06-25)

調査の正典: `docs/.private/2026-06-25-local-data-safety-research.md`
背景 memory: [[reference_browser_storage_eviction_persist]]

## 目的

ログインせず軽減表を作る「ローカルのみユーザー」を、ブラウザのストレージ消去（特に Safari の7日消去）から守る。Web のローカル保存は仕様上「消えないことを保証しない」ため、100% 保証は不可能。よって **消える前提を受け入れ、保険（persist）＋逃げ道（バックアップ）＋気づき（控えめな案内）** を渡すのが目標。

ログイン層は Firestore 同期で既に安全（対象外）。本作業はローカルのみ層のギャップを埋める。

## スコープ（3点）

1. **persist 要求**（裏方・UI なし）
2. **控えめな案内バー＋説明モーダル**（非ログイン且つ表1つ以上のとき常設）
3. **復元バグ修正**（圧縮プラン入りバックアップが復元できない不具合）

非スコープ: localStorage→IndexedDB 移行（調査の C・任意・別途）。ログイン強制や派手なバナーは作らない。

---

## ① persist 要求（裏方）

- 起動時に `navigator.storage.persist()` を1回要求する。
- 実装: `src/lib/requestPersistentStorage.ts`（新規）に薄いラッパを置き、`App.tsx` の起動 useEffect（現状 `recompressStaleArchives()` / `silentCompressStale()` を呼んでいる箇所・[App.tsx:143-147](../../src/App.tsx#L143-L147)）の隣で呼ぶ。
- 挙動:
  - `navigator.storage?.persist` が無いブラウザでは何もしない（feature detection）。
  - 既に `persisted()` が true なら再要求しない。
  - 失敗・拒否しても無害（best-effort・例外を握りつぶしてログのみ）。
- ログイン有無に関係なく要求（コストゼロ）。Chrome/Firefox で「消去対象外」へ昇格。Safari タブには付与されにくいので、これは保険の1枚目に過ぎない（②③で補完）。

### 関数インターフェース
```
// 冪等・例外安全。付与されたか否かを boolean で返す（呼び出し側は無視してよい）
export async function requestPersistentStorage(): Promise<boolean>
```

---

## ② 控えめな案内バー＋説明モーダル

### 表示条件
- **非ログイン（`useAuthStore` の user が null）** **かつ** **表が1つ以上（`usePlanStore` の plans.length > 0）** のときだけ表示。
- ログインした瞬間、または表が0件の間は非表示。

### 案内バー `LocalDataSafetyBar`（新規 `src/components/LocalDataSafetyBar.tsx`）
- 既存 [SystemNotificationBar](../../src/components/SystemNotificationBar.tsx) と同じ構造を踏襲:
  - 全幅 button、上下ボーダー `border-app-text/10`、`min-h-9`、hover `bg-app-text/5`。
  - 色は **すべて `app-text` 系トークン経由**（ライトテーマで自動的に白基調になる。ハードコード色禁止）。
- アイコン: 保護系（`ShieldAlert` 等。ベルは通知用なので変える）。
- 文言: 「⚠ 端末内のみ保存」（控えめ・煽りすぎない短文）。i18n キー経由。
- **「要確認」赤ドット**: モーダルを一度も開いていない間だけ、SystemNotificationBar と同じ赤ドット（`bg-red-500 ring-2 ring-app-bg`）を表示し「必ず読んでください」の一押しにする。一度開いたら赤ドットは消えるが、**バー自体は条件を満たす限り常設**（うるさくしない）。
  - 既読フラグはローカルに保存（`localStorage` キー `lopo_local_safety_seen` = `'1'`）。新規 util `src/utils/localSafetySeen.ts`（get/set）。
- クリックで `LocalDataSafetyModal` を開く。
- 折りたたみ時（Sidebar collapsed）はアイコンのみ（SystemNotificationBar と同じ振る舞い）。

### 配置
- サイドバー内、SystemNotificationBar と同じ並びに追加（[Sidebar.tsx](../../src/components/Sidebar.tsx) の通知バー描画箇所の近く）。両方表示される場合は縦に並ぶ。

### 説明モーダル `LocalDataSafetyModal`（新規 `src/components/LocalDataSafetyModal.tsx`）
- スタイルは既存モーダル準拠。**glass-tier3 に `--glass-tier3-bg: var(--share-modal-bg)` を必ず付与**してライトで白くなるようにする（[[reference_modal_light_mode_white_bg]] の頻出ミス回避）。`createPortal` で body 直下に出す。
- 中身（押し付けない順・3段）:
  1. **なぜ消えうるか**（平易）: 端末のブラウザ内だけに保存されていること。ブラウザはストレージを消すことがあること。特に **iPhone/Safari は約7日サイトを開かないと消える**こと。
  2. **いますぐできる守り方**（アクション）:
     - **バックアップを書き出す**（メイン導線）: ボタンで既存 [BackupExportModal](../../src/components/BackupExportModal.tsx) を開く。
     - **iPhone/iPad の方「ホーム画面に追加」**: iOS Safari は自動インストール不可なので、「共有 →『ホーム画面に追加』」の手順を文章で案内（Safari の7日消去を回避できる＝iPhone ユーザーに最も効く）。iOS 判定（`/iPad|iPhone|iPod/.test(navigator.userAgent)`）で iOS のときはこの項目を上に出す（任意・iOS でなくても項目自体は表示してよい）。
     - **（おまけ）ログインすると自動でクラウド保存**: 軽く1行触れるだけ。押し付けない。
  3. （任意）現在の保護状態: `navigator.storage.persisted()` が true なら「この端末では永続化が有効です」と添える。実装簡単なら入れる、複雑なら省略可。

---

## ③ 復元バグ修正

### 不具合の根拠（コード）
- 起動時 [App.tsx:146](../../src/App.tsx#L146) `silentCompressStale()` が「7日以上開いていない非アーカイブプラン」を圧縮（`data: undefined` + `compressedData` セット・[usePlanStore.ts:942-968](../../src/store/usePlanStore.ts#L942-L968)）。アーカイブプランも圧縮済み。
- 書き出し [backupService.ts:20-35](../../src/utils/backupService.ts#L20-L35) `createBackupJson` は **解凍せず** プランをそのまま JSON 化（`compressedData` を含む・`data` は undefined）。
- 読み込み [backupService.ts:53-57](../../src/utils/backupService.ts#L53-L57) `parseBackupJson` が `!plan.data` を無効と判定し、**1つでも該当すると JSON 全体で null（復元失敗）**。
- 結果: 長く使い込んで圧縮プランを持つユーザーほどバックアップを復元できない＝守りたい層に刺さる。

### 修正
- `parseBackupJson` の各プラン検証を **`!plan.id || !plan.title || (!plan.data && !plan.compressedData)`** に緩める（`data` か `compressedData` のどちらかあれば有効）。
- 取り込み後、圧縮プランは開く時に既存 [planLoad.ts:15-16](../../src/lib/planLoad.ts#L15-L16) が解凍するのでデータは保たれる（追加の解凍処理は不要）。
- `mergePlans` は `compressedData` をそのまま引き継ぐので変更不要（`{ ...fromBackup, ownerId, ownerDisplayName }`）。
- 補足検討（実装時に確認）: `BackupData` 型コメント等で `data` 必須前提の記述があれば併せて調整。

---

## データフロー要約

```
起動: App.tsx → requestPersistentStorage()（裏方・best-effort）
                → silentCompressStale()（既存・圧縮が起きる）

Sidebar 描画:
  user==null && plans.length>0
    → LocalDataSafetyBar 表示（未読なら赤ドット）
       クリック → LocalDataSafetyModal
                    ├ バックアップ書き出し → BackupExportModal（既存）
                    ├ iOS: ホーム画面に追加（手順案内）
                    └ ログイン誘導（軽く）
       開いたら localSafetySeen.set() → 赤ドット消える（バーは残る）

復元: BackupRestoreModal → parseBackupJson（圧縮プランも有効化）
                          → mergePlans → 圧縮プランは開く時に planLoad が解凍
```

## 影響範囲

- 新規: `LocalDataSafetyBar.tsx` / `LocalDataSafetyModal.tsx` / `lib/requestPersistentStorage.ts` / `utils/localSafetySeen.ts`
- 小修正: `App.tsx`（persist 呼び出し1行）/ `Sidebar.tsx`（バー1個追加）/ `backupService.ts`（検証1行緩和）
- i18n: `local_safety.*` キー追加（ja/en を作成、ko/zh はいったん ja コピー＝既存方針 [[feedback_locale_json_textual_edit]]・該当ブロックのみ textual 編集）
- 既存の軽減表本体・同期・共有には触れない（[[feedback_scope_discipline]]）。

## テスト（TDD）

- `parseBackupJson`: `compressedData` のみ（`data` 無し）のプランを含むバックアップを **有効** と判定し、混在でも全体が通ること（回帰テスト）。
- `LocalDataSafetyBar`: 表示条件（user×plans の4組合せ）と赤ドットの出し分け（未読/既読）をテスト。
- `requestPersistentStorage`: `navigator.storage` 不在で安全に false を返す／`persisted()` true なら再要求しないこと（モック）。
- ライト/ダーク両テーマの目視はユーザーが実機で確認（自動スクショは行わない）。

## やらないこと（YAGNI）

- localStorage→IndexedDB 移行（C・別途）
- ログイン強制・派手なバナー・QuotaExceeded の本格対応
- 消失「前」のプッシュ通知（バーの常設＋赤ドットで代替）
