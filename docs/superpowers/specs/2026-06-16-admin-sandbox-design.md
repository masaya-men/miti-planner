# 管理画面サンドボックス 設計書

- 日付: 2026-06-16
- ステータス: 設計確定（ユーザー承認待ち）
- 関連: `docs/TODO.md`「🔴 フォロー最優先=自己対処できる管理画面」、memory `feedback_admin_design` / `feedback_housing_admin_complete`

---

## 1. 背景・目的

### 困りごと（現状）
- 管理画面 (`/admin`) の確認は**本番デプロイ後のみ**。ログインが本番限定のため、ローカルで `/admin` を開いても管理者として入れない。
- 結果、ボタンの色1つ変えるだけでも「修正 → git push → Vercel ビルド待ち → 本番確認」が必要。
- Vercel Hobby のビルド回数（月100回）も消費する。見た目調整のたびに使うのは無駄（memory `feedback_vercel_builds`）。

### ゴール
1. **道具**: デプロイ・ログイン・本番アクセス無しで、ローカルで管理画面の見た目・触り心地をサクサク調整できる開発専用環境（サンドボックス）。実データ並みに「たくさん入った状態」のダミーで確認できる。
2. **本当の目的（別タスク）**: この道具を使い、管理画面を「ネイティブアプリのように直感的に管理できる」形へ作り直す。本設計書は**道具の方**だけを扱う。作り直し本体は道具完成後に別途ブレストする。

### 非ゴール
- 管理画面そのもののデザイン刷新（道具完成後の別タスク）。
- 本物のデータをローカルから読む（ログインの壁を越える別の仕掛けが必要。今回は扱わない）。
- 全14ページ分のダミー一括整備（今回は**テンプレート管理ページ1枚**を実例として完成させる。残りは作り直すページから1枚ずつ足す）。

---

## 2. 全体方針（A案＝開発モードでの「すり替え」）

検討した3案のうち、**A案（開発モードでのすり替え）** を採用。

- **A案（採用）**: 開発時だけ ①ログインの壁をスルー ②データ取得をダミーにすり替え。**本物の `/admin` コンポーネントをそのまま**ローカルで開ける。コピーを作らない＝ズレない・移植不要。
- B案（不採用）: `/admin-sandbox` 専用ページ＋各画面を props 駆動の部品に作り替え。部品化の工数大＋本物とコピーの二重化リスク。
- C案（不採用）: Storybook 導入。導入が重く、非エンジニアが新ツールを覚える必要があり、今回はオーバースペック。

A案の核心: 管理画面のデータ取得は**全て単一の窓口 `apiFetch`（[src/lib/apiClient.ts](../../../src/lib/apiClient.ts)）を経由**している（調査で確認済）。ここ1箇所にダミー分岐を足すだけで、全コンポーネントを無改造のまま動かせる。

---

## 3. アーキテクチャ

### すり替えは2点だけ

```
[ サンドボックスモード判定 ]  ← import.meta.env.DEV かつ VITE_ADMIN_SANDBOX==='true' の二重ガード
        │
        ├─(1) 偽管理者を注入 ──→ useAuthStore が「管理者でログイン済み」状態に
        │                          → AdminGuard を本物のまま通過（AdminGuard は無改造）
        │
        └─(2) apiFetch にダミー分岐 ──→ /api/admin?resource=... 等を
                                          ネット・本番に触れずダミー応答へすり替え
                                          （メモリ上の可変ストアで CRUD も反映）
```

### モード判定（誤爆防止が最重要・公開リポ＆本番事故防止）

サンドボックスが有効になる条件は **2つ同時成立** のときだけ:

1. `import.meta.env.DEV === true` … `npm run dev` 系（＝本番ビルドでない）でのみ true。`vite build`（本番）では静的に false。
2. `import.meta.env.VITE_ADMIN_SANDBOX === 'true'` … 専用の合言葉。普段の `npm run dev` では未設定 → false。

判定は1箇所に集約する純関数 `isAdminSandbox()` を用意し、すり替え箇所はそれを参照する。

**本番安全性の保証**:
- 本番ビルドでは `import.meta.env.DEV` が静的に `false` になり、すり替え分岐は **dead-code として除去**される。
- ダミー一式（fixtures / mockApi / bootstrap）は **動的 import (`await import(...)`)** でのみ読み込む。本番の成果物（バンドル）には**1バイトも入らない**。
- ダミー層は**本番APIにもFirestoreにも一切アクセスしない**。誤発火しても本番データに触れる経路が存在しない（ネットワーク呼び出しを行わない）。

### 起動方法

- 普段の `npm run dev` … **今まで通り**（挙動不変）。
- 新規追加 `npm run dev:admin` … 合言葉付きで起動。これで起動したときだけサンドボックスON。
- 実装: `package.json` の scripts に `"dev:admin": "vite --mode admin-sandbox"` 等を追加し、合言葉 `VITE_ADMIN_SANDBOX=true` を渡す（具体手段は実装計画で確定。`.env.admin-sandbox` か cross-env かは Windows 環境を考慮して選ぶ）。

---

## 4. コンポーネント（モジュール構成）

開発専用コードは `src/dev/adminSandbox/` 配下に隔離する（本番バンドル非混入の動的 import 境界も兼ねる）。

| モジュール | 役割 | 依存 |
|-----------|------|------|
| `src/dev/sandboxMode.ts` | `isAdminSandbox()` 純関数（二重ガード判定）。**ここだけは静的 import 可**（軽量・本番でも false を返すだけ） | なし |
| `src/dev/adminSandbox/bootstrap.ts` | `initAdminSandbox()`: useAuthStore に偽管理者を注入し、認証リスナーに上書きされない安定状態を作る | useAuthStore |
| `src/dev/adminSandbox/mockApi.ts` | `mockApiFetch(url, options)`: URL とメソッドを見てダミー `Response` を返す。該当しない URL は `null`（＝本物にフォールバック） | store, fixtures |
| `src/dev/adminSandbox/store.ts` | メモリ上の可変ストア。一覧データを保持し、POST/PUT/DELETE で書き換え → 再取得で反映（native アプリっぽい触り心地のため） | fixtures |
| `src/dev/adminSandbox/fixtures/templates.ts` | テンプレート管理ページ用のダミー生成（**今回の実例**）。後続ページは同フォルダに1ファイルずつ追加 | なし |

### 本体への改変（最小限・全て合言葉ガード付き）

1. `src/lib/apiClient.ts` … `apiFetch` 先頭に分岐を1本:
   ```ts
   if (isAdminSandbox()) {
     const { mockApiFetch } = await import('../dev/adminSandbox/mockApi');
     const mocked = await mockApiFetch(url, options);
     if (mocked) return mocked;       // 該当すればダミー応答
   }                                  // 該当しなければ従来どおり本物へ
   ```
2. アプリ起動箇所（`src/main.tsx` 付近）… 合言葉ON時のみ:
   ```ts
   if (isAdminSandbox()) {
     import('./dev/adminSandbox/bootstrap').then((m) => m.initAdminSandbox());
   }
   ```

`AdminGuard.tsx` や各管理ページは**無改造**。本物がそのまま動く。

---

## 5. データフロー（ダミーの中身）

### テンプレート管理ページ（実例）が叩く窓口と、再現するダミー

調査で確認した実際のエンドポイント（[AdminTemplates.tsx](../../../src/components/admin/AdminTemplates.tsx)）:

| メソッド/URL | 役割 | ダミー応答 |
|-------------|------|-----------|
| `GET /api/admin?resource=contents` | ドロップダウン用コンテンツ一覧 | `{ items: ContentItem[] }`（多数生成） |
| `GET /api/admin?resource=templates` | **メイン一覧テーブル** | `{ templates: TemplateRow[] }`（多数生成・ここが「たくさん入った状態」） |
| `GET /api/admin?resource=templates&id=◯◯` | 選択表のスプレッドシート中身 | `{ timelineEvents, phases, labels }` |
| `GET /api/template?action=promote&candidates=true` | 昇格候補 | `{ candidates: PromotionCandidate[] }` |
| `POST /api/admin?resource=templates` | 保存 | `{ ok: true }`＋ストア更新 |
| `DELETE /api/admin?resource=templates&contentId=◯◯` | 削除 | `{ ok: true }`＋ストアから除去 |
| `PUT /api/admin?resource=templates` | ロック切替 | `{ ok: true }`＋ストアの lockedAt 反映 |
| `POST /api/template?action=promote` | 昇格 承認/却下 | `{ ok: true }`＋候補から除去 |

ダミーのデータ形は、コンポーネントが実際に読むフィールドに厳密一致させる（推測でなく実コードに基づく）:
- `ContentItem` = `{ id, nameJa?, name?: { ja?, en? } }`
- `TemplateRow`（一覧表示用） = `{ contentId, source, eventCount, phaseCount, lockedAt: string|null, lastUpdatedAt: string }`
- `PromotionCandidate` = `{ shareId, contentId, title, copyCount }`

### 「太った状態」と「触り心地」
- 一覧は数十〜200件規模を生成し、スクロール・検索・並びの実際の触り心地を確認できるようにする。
- POST/PUT/DELETE はメモリ上ストアを書き換え、直後の再取得 (`fetchTemplates`) に反映 → 削除したら一覧から消える・ロックしたら表示が変わる、という native アプリ的な即時反応を再現する。
- ページ再読み込み（リロード）でダミーは初期状態に戻る（メモリ上のため。永続化は不要＝YAGNI）。

---

## 6. エラーハンドリング

- `mockApiFetch` が未対応の URL を受けたら `null` を返し、本物の `apiFetch` 経路にフォールバック（サンドボックスでも未モックのページは「データなし/エラー」表示になるだけで落ちない）。
- 偽管理者注入が認証リスナーに上書きされ得る競合は、bootstrap 側で「サンドボックス時は認証リスナーを張らず固定の偽管理者を維持する」方針で解消する（具体配線は実装計画で確定。要件＝起動後 `isAdmin` が安定して true）。
- ダミー応答は本物の `Response` 互換オブジェクトとして返す（`res.ok` / `res.status` / `res.json()` がコンポーネント側でそのまま使える）。

---

## 7. テスト方針

- `isAdminSandbox()`: 合言葉ON/OFF・DEV/本番の組合せで期待どおり true/false を返す（**本番で必ず false** を固定）。
- `mockApiFetch`: テンプレート系URLでダミーを返す／未対応URLで `null` を返す／DELETE 後にストアから除去され再取得に反映される。
- 既存の `apiFetch` 経路が**合言葉OFF時に一切変化しない**こと（回帰防止）。
- ビルド確認: 本番 `vite build` の成果物に `src/dev/adminSandbox/` のコードが含まれないこと（動的 import 境界＋DEAD code 除去）。

---

## 8. 段階

1. **道具の骨組み**: `sandboxMode.ts` / bootstrap（偽管理者）/ apiFetch 分岐 / `dev:admin` script。これだけで本物の `/admin` がローカルで開く（データはまだ空でもOK）。
2. **テンプレート管理ページのダミー**: fixtures + store + mockApi のテンプレート対応。一覧が「たくさん入った状態」で表示され、削除/ロック/保存が触れる。
3. （別タスク）残りページのダミーを1枚ずつ追加 → 管理画面の作り直し本体。

---

## 9. 確定した設計判断

- 起動は専用コマンド `npm run dev:admin`（普段の `npm run dev` は無変更）。
- 最初の実例ページ＝**テンプレート管理**。
- ダミーは実データ並みの量。CRUD はメモリ上で効く（即時反映）。永続化はしない。
- 新規ライブラリ依存は追加しない（MSW 等は使わず、単一窓口 `apiFetch` への薄い分岐で実現）。
- 開発専用コードは `src/dev/` に隔離し、動的 import で本番バンドルから完全排除。
