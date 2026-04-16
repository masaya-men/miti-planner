# ロゴハッシュブロックリスト設計書

## 概要

管理者がUGC管理画面で違反ロゴを削除した際、画像のSHA-256ハッシュをブロックリストに登録し、同じ画像が再共有されることを防ぐ。ユーザーIDや個人情報は一切保存しない。

## 背景と課題

### 現状の問題
- 管理者がロゴ削除すると `shared_plans.logoBase64` のみ削除される
- Firebase Storage の原本（`users/{uid}/team-logo.jpg`）は残る
- ユーザーが再共有するとサーバーがStorageからロゴを再取得し、ロゴが復活する

### プライバシー要件
- `shared_plans` にユーザーIDやStorageパスを保存しない
- ブロックリストにも個人情報を含めない
- APIレスポンスにユーザー特定情報を返さない
- PCが完全に乗っ取られても、共有プランからユーザーを辿れない

## 設計

### Firestoreコレクション: `blocked_logos`

```
blocked_logos/{sha256hex}
  - blockedAt: number  // Date.now() タイムスタンプ
```

- ドキュメントIDがハッシュ値そのもの（64文字の16進数文字列）
- 個人情報フィールドなし
- ハッシュは一方向関数のため、ハッシュ値から画像やユーザーを復元不可能

### ハッシュ計算

- アルゴリズム: SHA-256
- 入力: ロゴのバイナリデータ（JPEGバッファ）
- Node.js標準 `crypto` モジュール使用（新規依存なし）

```typescript
import { createHash } from 'crypto';

function computeLogoHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
```

**注意**: base64文字列ではなくバイナリバッファからハッシュを計算する。これにより、Storageからのダウンロードバッファと、既存のlogoBase64から復元したバッファで同じハッシュが得られる。

### 管理者削除フロー（api/admin/_ugcHandler.ts）

```
DELETE /api/admin?resource=ugc&shareId=xxx

1. 既存: shared_plans/{shareId} ドキュメント取得
2. 新規: logoBase64 からプレフィックス除去 → Buffer.from(base64, 'base64') → SHA-256
3. 新規: blocked_logos/{hash} に { blockedAt: Date.now() } を保存
4. 既存: shared_plans/{shareId} の logoBase64 を FieldValue.delete()
5. レスポンス: { success: true }
```

ステップ2-3が失敗してもステップ4は必ず実行する（既存動作のフォールバック）。

### 共有時のブロックチェック（api/share/index.ts）

```
POST /api/share（新規共有）
PUT  /api/share（ロゴ更新）

1. 既存: Storageからロゴダウンロード → buffer取得
2. 新規: computeLogoHash(buffer)
3. 新規: blocked_logos/{hash} の存在チェック
4. ブロック一致:
   - logoBase64 = null（ロゴなしで保存）
   - レスポンスに logoBlocked: true を追加
5. ブロック不一致:
   - 既存通り base64変換して保存
```

### クライアント通知（src/components/ShareModal.tsx）

共有APIのレスポンスに `logoBlocked: true` が含まれる場合:
- 共有自体は成功（shareIdは返る）
- ロゴだけが除外された旨を通知メッセージで表示
- 通知は既存のエラー/成功メッセージと同じスタイルで表示

### 管理画面UI更新（src/components/admin/AdminUgc.tsx）

- 削除確認ダイアログのテキスト更新: ブロックリスト登録されることを明記
- 削除成功メッセージ更新: ブロックされた旨を表示

## i18nキー

### 新規キー

| ���ー | ja | en | zh | ko |
|------|----|----|----|----|
| `team_logo.logo_blocked` | ロゴが利用規約に違反したため使用できません。別の画像をアップロードしてください。 | Your logo was removed due to a terms of service violation. Please upload a different image. | 您的标志因��反使用条款已被删除。请上传其他图片。 | 로고가 ���용약관 위반으로 삭제되었습니다. 다른 이미지를 업로드해 주세요. |

### 既���キー更新

| キー | ja | en | zh | ko |
|------|----|----|----|----|
| `admin.ugc_delete_confirm` | このロゴを削除しますか？この画像は今後の共有でもブロックされます。この操作は取り消せません。 | Delete this logo? This image will also be blocked from future shares. This action cannot be undone. | 删除此标志？���图片将被禁止在今后的分享中使用。此操作无法撤销。 | 이 로고를 삭제하시겠습니까? 이 이미지�� 향후 공유에서도 차단됩니다. 이 작업은 되돌릴 수 없습니다. |
| `admin.ugc_delete_success` | ロゴを削除し、ブロックリストに登録しました | Logo deleted and added to blocklist | 标志已删��并加入屏蔽列表 | 로고를 삭제하고 차단 목록에 추가했습니다 |

4言語すべて（ja, en, zh, ko）に対応する。

## エッジケース

| ケース | 動作 |
|--------|------|
| 同じ違反画像を再アップロード → 再共有 | Storageで上書き保存されるがバイナリは同一 → ハッシュ一致 → ブロック |
| 別の画像をアップロード → 再共有 | 異なるハッシュ → ブロックされない → 正常動作 |
| 既存の古い共有プラン（削除前に作成済み） | 影響なし。管理者が個別に削除可能 |
| ブロックチェック中のFirestoreエラー | ブロックチェックをスキップし、通常通りロゴを含めて保存（安全側にフォールバック） |
| ハッシュ登録中のFirestoreエラー | logoBase64の削除は必ず実行（既存動作にフォールバック）、エラーログ出力 |
| 管理者の誤ブロック解除 | Firebaseコンソールで `blocked_logos/{hash}` ドキュメントを削除 |
| logoBase64が存在しないshared_planの削除 | ハッシュ計算をスキップ、既存のエラーハンドリング通り |

## セキュリティ

### 個人情報保護
- `blocked_logos` コレクション: ハッシュ値とタイムスタンプのみ。個人特定不可
- `shared_plans` コレクション: 変更なし。ユーザーIDは追加しない
- APIレスポンス: `logoBlocked: true` フラグのみ。ハッシュ値もユーザー情報も返さない
- PCが完全に乗っ取られた場合: ブロックリストからはハッシュ値しか得られず、個人特定不可能

### SHA-256の安全性
- 暗号学的ハッシュ関数であり、ハッシュから原像（元画像）を復元することは計算上不可能
- 衝突耐性が高く、異なる画像が同じハッシュになる確率は無視できる

## 変更ファイル一覧

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `api/admin/_ugcHandler.ts` | 修正 | DELETEハンドラにハッシュ計算+ブロックリスト登録を追加 |
| `api/share/index.ts` | 修正 | POST/PUTハンドラにブロックチェックを追加 |
| `src/components/ShareModal.tsx` | 修正 | logoBlocked時の通知UI追加 |
| `src/components/admin/AdminUgc.tsx` | 修正不要 | i18nキー更新で自動反映 |
| `src/locales/ja.json` | 修正 | 新規キー追加+既存キー更新 |
| `src/locales/en.json` | 修正 | 同上 |
| `src/locales/zh.json` | 修正 | 同上 |
| `src/locales/ko.json` | 修正 | 同上 |

## 既存機能への影響

- **共有の作成・閲覧・OGP生成**: ブロックチェックは追加のみ。既存フィールドは変更なし
- **クライアント側のロゴアップロード・削除**: 変更なし
- **管理画面の検索**: 変更なし
- **既存の共有プラン**: 影響なし。新規共有時のみチェック実行
