# ロゴハッシュブロックリスト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理者がUGC管理画面でロゴを削除した際、画像のSHA-256ハッシュをブロックリストに登録し、同じ画像の再共有を防ぐ

**Architecture:** Firestore `blocked_logos` コレクションにハッシュ値のみ保存（個人情報なし）。共有API（POST/PUT）でロゴダウンロード後にハッシュチェック。ブロック時は `logoBlocked: true` をレスポンスに含め、クライアントが通知表示。

**Tech Stack:** Node.js `crypto`（SHA-256）、Firebase Admin SDK（Firestore）、React（ShareModal通知）、i18next（4言語）

**設計書:** `docs/superpowers/specs/2026-04-16-logo-hash-blocklist-design.md`

---

### Task 1: i18nキー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json:146-162` (team_logo セクション末尾に追加)
- Modify: `src/locales/en.json:146-162` (同上)
- Modify: `src/locales/zh.json:129-145` (同上)
- Modify: `src/locales/ko.json:129-145` (同上)
- Modify: `src/locales/ja.json:1462-1463` (admin.ugc_delete_confirm/success 更新)
- Modify: `src/locales/en.json:1458-1459` (同上)
- Modify: `src/locales/zh.json:1413-1414` (同上)
- Modify: `src/locales/ko.json:1413-1414` (同上)

- [ ] **Step 1: ja.json — team_logo に logo_blocked を追加**

`src/locales/ja.json` の `team_logo` セクション末尾（`usage_notice_terms` の後）に追加:

```json
        "usage_notice_terms": "アップロードにより<termsLink>利用規約</termsLink>に同意したものとみなします。",
        "logo_blocked": "ロゴが利用規約に違反したため使用できません。別の画像をアップロードしてください。"
```

- [ ] **Step 2: en.json — team_logo に logo_blocked を追加**

`src/locales/en.json` の `team_logo` セクション末尾に追加:

```json
        "usage_notice_terms": "By uploading, you agree to the <termsLink>Terms of Service</termsLink>.",
        "logo_blocked": "Your logo was removed due to a terms of service violation. Please upload a different image."
```

- [ ] **Step 3: zh.json — team_logo に logo_blocked を追加**

`src/locales/zh.json` の `team_logo` セクション末尾に追加:

```json
        "usage_notice_terms": "上传即视为您同意<termsLink>使用条款</termsLink>。",
        "logo_blocked": "您的标志因违反使用条款已被删除。请上传其他图片。"
```

- [ ] **Step 4: ko.json — team_logo に logo_blocked を追加**

`src/locales/ko.json` の `team_logo` セクション末尾に追加:

```json
        "usage_notice_terms": "업로드 시 <termsLink>이용약관</termsLink>에 동의한 것으로 간주합니다.",
        "logo_blocked": "로고가 이용약관 위반으로 삭제되었습니다. 다른 이미지를 업로드해 주세요."
```

- [ ] **Step 5: ja.json — admin.ugc_delete_confirm / ugc_delete_success を更新**

```json
        "ugc_delete_confirm": "このロゴを削除しますか？この画像は今後の共有でもブロックされます。この操作は取り消せません。",
        "ugc_delete_success": "ロゴを削除し、ブロックリストに登録しました"
```

- [ ] **Step 6: en.json — admin.ugc_delete_confirm / ugc_delete_success を更新**

```json
        "ugc_delete_confirm": "Delete this logo? This image will also be blocked from future shares. This action cannot be undone.",
        "ugc_delete_success": "Logo deleted and added to blocklist"
```

- [ ] **Step 7: zh.json — admin.ugc_delete_confirm / ugc_delete_success を更新**

```json
        "ugc_delete_confirm": "删除此标志？此图片将被禁止在今后的分享中使用。此操作无法撤销。",
        "ugc_delete_success": "标志已删除并加入屏蔽列表"
```

- [ ] **Step 8: ko.json — admin.ugc_delete_confirm / ugc_delete_success を更新**

```json
        "ugc_delete_confirm": "이 로고를 삭제하시겠습니까? 이 이미지는 향후 공유에서도 차단됩니다. 이 작업은 되돌릴 수 없습니다.",
        "ugc_delete_success": "로고를 삭제하고 차단 목록에 추가했습니다"
```

- [ ] **Step 9: ビルドチェック**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 10: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "$(cat <<'EOF'
i18n: ロゴブロックリスト関連の翻訳キー追加（4言語）

- team_logo.logo_blocked: 違反ロゴ通知メッセージ
- admin.ugc_delete_confirm/success: ブロック登録を明記

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 管理者削除API — ハッシュ計算+ブロックリスト登録

**Files:**
- Modify: `api/admin/_ugcHandler.ts`

- [ ] **Step 1: import に createHash を追加**

`api/admin/_ugcHandler.ts` の先頭、既存 import の後に追加:

```typescript
import { createHash } from 'crypto';
```

- [ ] **Step 2: BLOCKED_LOGOS 定数を追加**

`const COLLECTION = 'shared_plans';` の後に追加:

```typescript
const BLOCKED_LOGOS = 'blocked_logos';
```

- [ ] **Step 3: DELETE ハンドラを更新**

既存の DELETE ブロック（行64-66）:

```typescript
    } else if (req.method === 'DELETE') {
      await docRef.update({ logoBase64: FieldValue.delete() });
      return res.status(200).json({ success: true });
```

を以下に置き換え:

```typescript
    } else if (req.method === 'DELETE') {
      // ブロックリストにハッシュ登録（logoBase64が存在する場合のみ）
      const data = snap.data()!;
      if (data.logoBase64 && typeof data.logoBase64 === 'string') {
        try {
          const base64Data = data.logoBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const hash = createHash('sha256').update(buffer).digest('hex');
          await db.collection(BLOCKED_LOGOS).doc(hash).set({ blockedAt: Date.now() });
        } catch (err) {
          console.error('Logo hash registration failed:', err);
          // ハッシュ登録失敗でもlogoBase64削除は続行する
        }
      }
      await docRef.update({ logoBase64: FieldValue.delete() });
      return res.status(200).json({ success: true });
```

- [ ] **Step 4: ビルドチェック**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
rtk git add api/admin/_ugcHandler.ts
git commit -m "$(cat <<'EOF'
feat: 管理者ロゴ削除時にSHA-256ハッシュをブロックリストに登録

削除されたロゴのハッシュを blocked_logos コレクションに保存し、
同じ画像の再共有を防止する。個人情報は一切保存しない。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 共有API — ブロックチェック追加（POST）

**Files:**
- Modify: `api/share/index.ts`

- [ ] **Step 1: import に createHash を追加**

`api/share/index.ts` の先頭、既存 import の後（`import sharePageHandler` の後）に追加:

```typescript
import { createHash } from 'crypto';
```

- [ ] **Step 2: BLOCKED_LOGOS 定数を追加**

`const MAX_BODY_SIZE = 500 * 1024;` の後に追加:

```typescript
const BLOCKED_LOGOS = 'blocked_logos';
```

- [ ] **Step 3: POST ハンドラのロゴダウンロード処理にブロックチェックを追加**

POST ハンドラ内、ロゴダウンロード部分（行84-97）を以下に置き換え:

```typescript
            // firebase-adminでロゴをダウンロードしてbase64に変換
            let logoBase64: string | null = null;
            let logoBlocked = false;
            // Storageパスの厳格な検証（users/{uid}/team-logo.jpg のみ許可）
            const logoPathRegex = /^users\/[a-zA-Z0-9:_-]+\/team-logo\.jpg$/;
            if (typeof logoStoragePath === 'string' && logoPathRegex.test(logoStoragePath)) {
                try {
                    const bucket = getStorage().bucket('lopo-7793e.firebasestorage.app');
                    const file = bucket.file(logoStoragePath);
                    const [buffer] = await file.download();
                    // ブロックリストチェック
                    const hash = createHash('sha256').update(buffer).digest('hex');
                    const blocked = await db.collection(BLOCKED_LOGOS).doc(hash).get();
                    if (blocked.exists) {
                        logoBlocked = true;
                    } else {
                        logoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                    }
                } catch (err) {
                    console.error('Logo download failed:', err);
                }
            }
```

- [ ] **Step 4: POST レスポンスに logoBlocked フラグを追加**

バンドル共有のレスポンス（行117）を変更:

```typescript
                return res.status(200).json({ shareId, ...(logoBlocked && { logoBlocked: true }) });
```

単一プラン共有のレスポンス（行140）を変更:

```typescript
            return res.status(200).json({ shareId, ...(logoBlocked && { logoBlocked: true }) });
```

- [ ] **Step 5: ビルドチェック**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
rtk git add api/share/index.ts
git commit -m "$(cat <<'EOF'
feat: 共有API POST にロゴブロックチェックを追加

Storageからロゴダウンロード後にSHA-256ハッシュを計算し、
blocked_logos コレクションと照合。ブロック一致時はロゴなしで
共有し、レスポンスに logoBlocked: true を返す。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 共有API — ブロックチェック追加（PUT）

**Files:**
- Modify: `api/share/index.ts`

- [ ] **Step 1: PUT ハンドラのロゴダウンロード処理にブロックチェックを追加**

PUT ハンドラ内、ロゴダウンロード部分（行159-172）を以下に置き換え:

```typescript
            // firebase-adminでロゴをダウンロードしてbase64に変換
            let logoBase64: string | null = null;
            let logoBlocked = false;
            // Storageパスの厳格な検証（users/{uid}/team-logo.jpg のみ許可）
            const putLogoPathRegex = /^users\/[a-zA-Z0-9:_-]+\/team-logo\.jpg$/;
            if (typeof logoStoragePath === 'string' && putLogoPathRegex.test(logoStoragePath)) {
                try {
                    const bucket = getStorage().bucket('lopo-7793e.firebasestorage.app');
                    const file = bucket.file(logoStoragePath);
                    const [buffer] = await file.download();
                    // ブロックリストチェック
                    const hash = createHash('sha256').update(buffer).digest('hex');
                    const blocked = await db.collection(BLOCKED_LOGOS).doc(hash).get();
                    if (blocked.exists) {
                        logoBlocked = true;
                    } else {
                        logoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                    }
                } catch (err) {
                    console.error('Logo download failed:', err);
                }
            }
```

- [ ] **Step 2: PUT レスポンスに logoBlocked フラグを追加**

PUT のレスポンス（行181）を変更:

```typescript
            return res.status(200).json({ shareId, ...(logoBlocked && { logoBlocked: true }) });
```

- [ ] **Step 3: ビルドチェック**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
rtk git add api/share/index.ts
git commit -m "$(cat <<'EOF'
feat: 共有API PUT にもロゴブロックチェックを追加

POST と同様のハッシュチェックをロゴ更新時にも適用。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: ShareModal — ブロック通知UI

**Files:**
- Modify: `src/components/ShareModal.tsx`

- [ ] **Step 1: generateShareUrl でブロックフラグを処理**

`src/components/ShareModal.tsx` の `generateShareUrl` 関数内、レスポンス処理部分（行98-103）を変更:

```typescript
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setShareIdRef(data.shareId);
            const url = `${window.location.origin}/share/${data.shareId}`;
            setShareUrl(url);
            setOgImageUrl(buildOgUrl(data.shareId, showPlanTitle, showLogo));
            if (data.logoBlocked) {
                showToast(t('team_logo.logo_blocked'), 'error');
            }
```

- [ ] **Step 2: updateShareLogo でブロックフラグを処理**

`src/components/ShareModal.tsx` の `updateShareLogo` 関数内、`await apiFetch` の後（行121-127）を変更:

```typescript
            const res = await apiFetch('/api/share', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.logoBlocked) {
                showToast(t('team_logo.logo_blocked'), 'error');
            }
            // プレビュー画像を再読み込み（キャッシュ回避のためタイムスタンプ付与）
            setOgImageUrl(buildOgUrl(shareIdRef, showPlanTitle, withLogo) + `&t=${Date.now()}`);
```

- [ ] **Step 3: ビルドチェック**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/ShareModal.tsx
git commit -m "$(cat <<'EOF'
feat: ShareModalにロゴブロック通知を追加

共有API が logoBlocked: true を返した場合、
利用規約違反によるブロックをトーストで通知する。

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 動作確認 + 最終ビルド

**Files:** なし（確認のみ）

- [ ] **Step 1: フルビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 2: テスト実行**

Run: `rtk vitest run`
Expected: 既存テストがすべてパス

- [ ] **Step 3: 変更ファイル一覧の確認**

Run: `rtk git diff --stat HEAD~5`
Expected: 以下のファイルのみ変更されている:
- `api/admin/_ugcHandler.ts`
- `api/share/index.ts`
- `src/components/ShareModal.tsx`
- `src/locales/ja.json`
- `src/locales/en.json`
- `src/locales/zh.json`
- `src/locales/ko.json`

- [ ] **Step 4: セキュリティ確認**

以下をgrepで確認:
- `blocked_logos` コレクションに `userId`, `uid`, `path` などの個人情報フィールドがないこと
- APIレスポンスにハッシュ値やStorageパスが含まれていないこと

Run: `rtk grep -n "userId\|uid\|logoStoragePath" api/admin/_ugcHandler.ts`
Expected: DELETE ハンドラ内に `userId` や `logoStoragePath` への参照がない
