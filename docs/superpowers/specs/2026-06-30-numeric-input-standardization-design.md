# 数値入力の業界水準化（NumericInput / TimeInput 共通部品化）設計

作成: 2026-06-30 / ステータス: 設計確定（Phase 1 着手前）

## 背景・課題

ユーザーから「時刻や数値を入力するとき癖のある動作をする。何も気にせず素直に入力できるようにしたい」という要望。
調査の結果、数値入力欄が **3〜4 流派で混在**し、いずれも「数値を直接 state に持つ」設計から以下のクセが派生していた:

- 空欄にできず常に `0` が残る（`v === '' ? 0` で潰す）
- 打鍵中に `Number()` 変換され、文字をそのまま保てない／`NaN` が state に入りうる
- `type="number"` 採用箇所はホイールで値が変わる等のネイティブ地雷
- 桁区切り（`50,000`）が無い、または live 整形でカーソルが飛ぶ

### 業界水準（プロの数値入力パターン）

1. `type="number"` を使わず `type="text" inputmode="numeric"`（GOV.UK Design System 推奨）
2. 入力欄は**文字列で保持**し、数値化は **blur / 保存時のみ**
3. 打鍵中に勝手に書き換えない（整形は離脱時）
4. 空欄を許す
5. `NaN`・不正値を state に入れない
6. 検証は blur 後
7. 全選択 on focus は「丸ごと入れ替える欄」では許容（NN/g）→ **残す方針**

## 全数値入力 棚卸し（2026-06-30・多エージェント監査）

合計 **約 67 サイト**。

| エリア | 件数 | 数値の種類 | 現状 |
|---|---|---|---|
| 主要UI（ユーザー向け） | 12 | ダメージ・HP・武器ダメ・メインステ・判定力・活動日数 / 時刻(M:SS) | B/C/D 混在 |
| ハウジング（ユーザー向け） | 6 | 区画(ward 1-30)・番地(plot 1-60)・部屋番号(apt 1-90/個室 1-512) | 全 `type="number"` |
| 管理画面（管理者のみ） | 49 | 軽減率%(0-100)・効果/リキャスト秒(小数 0.1)・レベル(1-100)・ステ補正 | 全 `type="number"` |

### 主要UI 12サイト（Phase 1 対象）

- `EventForm.tsx:763` ダメージ量（直接入力）/ `:786` 実ダメージ（逆算）— 整数・非負
- `AASettingsPopover.tsx:126` オートアタック・ダメージ — 整数・非負・`type="number"`
- `PartyStatusPopover.tsx:244/262/270/278/286` Tank HP / Healer HP・WD・MND・DET — 整数・非負・`FormattedNumberInput` 利用
- `ActivityScrub.tsx:62` 活動日数（直接編集）— 整数・非負・max 4桁
- 時刻(M:SS): `HeaderTimeInput.tsx:114`（ジャンプ・上限あり）/ `BoundaryEditModal.tsx:176,194`（フェーズ開始/終了）
- `ui/FormattedNumberInput.tsx` — 既存共通部品（1箇所のみ利用・live桁区切りでカーソル飛び）→ NumericInput へ格上げ統合

### ハウジング 6サイト（Phase 1 対象）

- `HousingRegisterForm.tsx:454/486`（旧フォーム ward/plot）
- `HousingRegisterAddressFields.tsx:135/186/266`（新フォーム ward/plot/roomNumber）
- `HousingRegisterRoomNumberField.tsx:36`（部屋番号・apt/個室共用）
- 範囲制限は定数 `WARD_RANGE`/`PLOT_RANGE`/`APARTMENT_ROOM_RANGE`（`constants/housing.ts`）＋ `utils/housingValidation.ts`。**移行時も範囲・検証挙動を完全保持**。

## 設計：共通部品 2 つ

### ① `NumericInput`（純粋な数値）

業界標準の作り。**文字列内部状態**で表示を制御し、`value:number / onChange:number` のドロップイン互換にする。

```
interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;       // 空欄時は 0 を emit（表示は空のまま）
  min?: number;                            // blur 時に clamp
  max?: number;                            // blur 時に clamp
  decimalPlaces?: number;                  // 0=整数（既定）。>0 で小数許可
  thousandSeparator?: boolean;             // true で blur 時に 50,000 整形（既定 false）
  allowEmpty?: boolean;                    // true で空欄保持可（既定 true）
  selectOnFocus?: boolean;                 // 既定 true
  className?: string; placeholder?: string;
  // 必要に応じ aria-label / data-testid / data-tutorial を透過
}
```

挙動:
- 内部に `text` 文字列 state。表示は `text`。
- 外部 `value` 変化時、**非フォーカス時のみ** `text` を `value`（必要なら桁区切り）で再同期（apply-to-all 等の外部更新に追従。打鍵中はクロバーしない）。
- onChange: 全角→半角正規化 → 許容文字（数字・小数点・必要時マイナス）以外を除去 → `text` 更新 → 数値化して `onChange(n)`（空/不正は `0`）。`NaN` は弾く。
- onBlur: `min/max` clamp → 桁区切り整形 → `text` 確定（**桁区切りは離脱時のみ**＝カーソル飛び回避）。
- onFocus: `selectOnFocus` なら全選択。桁区切りは外して編集しやすく。

既存 `FormattedNumberInput` は本部品へ統合（PartyStatusPopover を NumericInput に差し替え、旧ファイルは撤去 or 薄い別名）。

### ② `TimeInput`（M:SS）

正典 `parseTimeString`/`formatTime`（`utils/templateConversions.ts`）を利用。`value:number(秒) / onChange:number`。

```
interface TimeInputProps {
  value: number;                 // 秒
  onChange: (sec: number) => void;
  maxSeconds?: number;           // 上限（HeaderTimeInput 用）
  allowNegative?: boolean;       // 戦闘前カウントダウン（既定 true）
  selectOnFocus?: boolean; className?: string; placeholder?: string;
}
```

- 内部 `text` 文字列。表示は M:SS。入力は "M:SS" でも裸の秒でも可（全角正規化）。
- EventForm 時刻（2026-06-30 実装済の手書き版）/ HeaderTimeInput / BoundaryEditModal を本部品へ統一し、各所の独自 `parseTimeInput`/ローカル `formatTime` 重複を解消。

## スコープと段階

- **Phase 1（本設計で着手）**: ユーザーが触る 主要UI 12 + ハウジング 6（約18サイト）。`NumericInput`/`TimeInput` 新設＋移行。
- **Phase 2（保留・Phase 1 確認後に判断）**: 管理画面 49 サイト。マスターデータ書込のため敵対監査＋実機検証セット。**ユーザーは管理画面に不便を感じていない**ため当面スコープ外。潜在地雷（`type="number"` のホイール誤変更）は将来「フォーカス中ホイール無効化」の1行保険で代替可。

## テスト方針

- `NumericInput` / `TimeInput` の単体テスト（空欄保持・全角・桁区切り blur 整形・min/max clamp・NaN 防止・小数）。
- 各移行先は「value:number/onChange:number」契約を保つため呼び出し側ロジックは原則無変更。回帰は既存テスト＋移行先の表示/保存確認。
- ハウジングは範囲検証（housingValidation）が崩れないことを確認。

## 非対象（YAGNI）

- 管理画面 49 サイト（Phase 2）
- 通貨記号・ロケール別区切り（軽減ツールは日本式 `,` 区切りで十分）
- live 桁区切り（カーソル飛びリスクのため不採用）
