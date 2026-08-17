# ハウジング動的ページ ソフト404修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Search Console が検出した「ソフト404」(ハウジンガーページ `/housing/housinger/:uid`) の根本原因を解消し、同じ構造上の弱点を持つ他の動的ページ (共有プラン `/share/:id`・ツアー招待 `/housing/tour/:token`・ハウジング物件詳細 `/housing/listing/:id`) にも同じ修正を適用する。

**Architecture:** これら4種類のページは Vercel の rewrite で `api/share` 配下の Node Function に内部委譲され、ビルド済み `index.html` の `<meta>` タグだけを差し替えて返す仕組み (SPA本体はクライアント側JSがFirestoreから中身を取得してから描画)。今回は (1) データが実在しない/非公開の場合は真の HTTP 404 を返す、(2) データが実在する場合は `<div id="root">` の中に人間可読なテキスト (タイトル・説明) をサーバー側であらかじめ埋め込む、の2点を4ハンドラー共通の仕組みとして追加する。React は `createRoot().render()` (hydrateRoot ではない) を使っているため、埋め込んだテキストは JS 実行後に安全に上書きされる (ハイドレーションミスマッチのリスクなし)。

**Tech Stack:** TypeScript, Vercel Node Functions, Firebase Admin SDK, Vitest

**Spec:** このセッションの会話で確定した設計 (spec ドキュメント無し、会話ログが設計根拠)。既存コードの実地調査で以下を確認済み:
- `api/share/_housingerPageHandler.ts` / `_sharePageHandler.ts` / `_tourInvitePageHandler.ts` はいずれも「データが無ければ既定OGPのまま200を返す」「`<div id="root"></div>` は常に空」という同型構造。
- `src/main.tsx:26` は `createRoot(...).render(...)` (hydrateRoot ではない) → SSR的なテキスト注入をしても安全。
- `api/housing/_publicWindow.ts` の `action==='listing'` に、物件詳細の「公開可否判定 (`isPubliclyViewable`)」と「住所を守る射影 (`projectPublicListing`)」が既に実装済み。新規ハンドラーはこれを再利用し、住所プライバシーのロジックを重複実装しない。
- Vercel Hobby プランは Serverless Function 12個上限で、現在ちょうど12個 (`api/*.ts` 3個 + `api/*/index.ts` 9個) 使い切っている。新規関数は追加できないため、物件詳細ページも既存の `api/share` 関数に `type=listing` 分岐として追加する (新規ファイルはアンダースコア始まりの非公開モジュールのみ)。

## Global Constraints

- 新規 Vercel Serverless Function を作らない (Hobby 12個上限に既に到達済み)。新しいロジックは `api/share/index.ts` からの分岐、またはアンダースコア始まりの非公開モジュールとして追加する。
- ユーザー生成コンテンツ (title / description / bio / tourName / tags) を HTML に埋め込む箇所は必ず `escapeHtml` を通す (XSS 防止)。
- 住所フィールドの公開可否は `src/lib/housing/publicListingProjection.ts` の `projectPublicListing` の判定 (`visibility==='public'` のときだけ住所を含む) をそのまま使う。新規ハンドラー側で独自の住所フィルタリングを書かない。
- 既存の `Cache-Control` 設定 (housinger=`s-maxage=30,max-age=0`=意図的にキャッシュ無効、share/tour=`s-maxage=300,max-age=60`) はそのまま維持する (OGPカードのランダム抽選の都合で意図的に選ばれた値のため、今回のスコープでは変更しない)。
- コミットは1タスク1コミット。

---

## File Structure

- **Create:** `src/lib/ogpPageShell.ts` — 4ハンドラー共通の `escapeHtml` / `injectSeoSnapshot`。
- **Create:** `src/lib/__tests__/ogpPageShell.test.ts`
- **Create:** `api/share/_listingPageHandler.ts` — 新規: ハウジング物件詳細ページの動的OGP+SEOスナップショットハンドラー。
- **Create:** `api/share/__tests__/_listingPageHandler.test.ts`
- **Create:** `api/share/__tests__/_sharePageHandler.test.ts`
- **Create:** `api/share/__tests__/_tourInvitePageHandler.test.ts`
- **Modify:** `api/share/_housingerPageHandler.ts` — 404ステータス化 + スナップショットHTML注入 + escapeHtml共通化。
- **Modify:** `api/share/_sharePageHandler.ts` — 同上。
- **Modify:** `api/share/_tourInvitePageHandler.ts` — 同上。
- **Modify:** `api/share/__tests__/_housingerPageHandler.test.ts` — 新関数のテスト追加。
- **Modify:** `api/share/index.ts` — `type=listing` 分岐を追加。
- **Modify:** `api/housing/_publicWindow.ts` — `isPubliclyViewable` を export する (新規ハンドラーが再利用するため)。
- **Modify:** `vercel.json` — `/housing/listing/:id` の rewrite を追加。
- **Modify:** `docs/TODO.md` — 完了後に状態を反映。

---

### Task 1: 共通ヘルパー (`escapeHtml` / `injectSeoSnapshot`)

**Files:**
- Create: `src/lib/ogpPageShell.ts`
- Test: `src/lib/__tests__/ogpPageShell.test.ts`

**Interfaces:**
- Produces: `escapeHtml(s: string): string`、`injectSeoSnapshot(html: string, snapshotHtml: string): string`(以降の全タスクがこの2関数を import する)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/ogpPageShell.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { escapeHtml, injectSeoSnapshot } from '../ogpPageShell';

describe('escapeHtml', () => {
  it('& " < > をエスケープする', () => {
    expect(escapeHtml('<script>alert("x")</script> & more')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more',
    );
  });

  it('特殊文字が無ければそのまま返す', () => {
    expect(escapeHtml('ミスト・ヴィレッジ 23-6')).toBe('ミスト・ヴィレッジ 23-6');
  });
});

describe('injectSeoSnapshot', () => {
  it('空の #root に snapshotHtml を差し込む', () => {
    const html = '<body><div id="root"></div><script src="/main.js"></script></body>';
    const result = injectSeoSnapshot(html, '<h1>タイトル</h1>');
    expect(result).toBe('<body><div id="root"><h1>タイトル</h1></div><script src="/main.js"></script></body>');
  });

  it('#root が見つからない場合は元のhtmlをそのまま返す (壊れて何も出ないより安全側)', () => {
    const html = '<body>no root here</body>';
    const result = injectSeoSnapshot(html, '<h1>タイトル</h1>');
    expect(result).toBe(html);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/__tests__/ogpPageShell.test.ts`
Expected: FAIL (`../ogpPageShell` が存在しない)

- [ ] **Step 3: 実装する**

`src/lib/ogpPageShell.ts` を新規作成:

```typescript
/**
 * 動的OGPページハンドラー (api/share/_*PageHandler.ts) 共通のHTML組み立てヘルパー。
 *
 * これらのハンドラーはビルド済み index.html を取得し、<meta> タグの差し替えに加えて
 * <div id="root"> の中に人間可読なテキストを埋め込む (Googlebot のソフト404対策)。
 * src/main.tsx は createRoot().render() (hydrateRoot ではない) を使っているため、
 * ここで埋め込んだ静的テキストは JS 実行後に安全に上書きされる。
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** ビルド済み index.html の空の <div id="root"></div> に snapshotHtml を差し込む。見つからなければ元のhtmlを返す。 */
export function injectSeoSnapshot(html: string, snapshotHtml: string): string {
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) return html;
  return html.replace(marker, `<div id="root">${snapshotHtml}</div>`);
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run src/lib/__tests__/ogpPageShell.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: コミット**

```bash
git add src/lib/ogpPageShell.ts src/lib/__tests__/ogpPageShell.test.ts
git commit -m "feat: 動的OGPページ共通のescapeHtml/injectSeoSnapshotヘルパーを追加"
```

---

### Task 2: ハウジンガーページ (`_housingerPageHandler.ts`) — 404化 + スナップショット注入

**Files:**
- Modify: `api/share/_housingerPageHandler.ts:1-46`(import・定数), `153-378`(handler本体)
- Modify: `api/share/__tests__/_housingerPageHandler.test.ts`(新関数のテスト追加)

**Interfaces:**
- Consumes: `escapeHtml`, `injectSeoSnapshot` (Task 1)
- Produces: `buildHousingerSeoSnapshotHtml(input: { displayName: string; bio: string; listingCount: number }): string`(export、テスト対象)

- [ ] **Step 1: 失敗するテストを書く**

`api/share/__tests__/_housingerPageHandler.test.ts` の末尾に追記:

```typescript
import { buildHousingerSeoSnapshotHtml } from '../_housingerPageHandler.js';

describe('buildHousingerSeoSnapshotHtml', () => {
  it('displayName・bio・件数からスナップショットHTMLを組み立てる', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: 'ミスト太郎', bio: '内装こだわってます', listingCount: 3 });
    expect(html).toBe('<h1>ミスト太郎 のハウジング</h1><p>内装こだわってます</p><p>3件のハウジングを公開中</p>');
  });

  it('bioが空なら<p>を出さない', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: 'ミスト太郎', bio: '', listingCount: 0 });
    expect(html).toBe('<h1>ミスト太郎 のハウジング</h1><p>0件のハウジングを公開中</p>');
  });

  it('displayNameが空なら「ハウジンガー」にフォールバックする', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: '', bio: '', listingCount: 1 });
    expect(html).toBe('<h1>ハウジンガー のハウジング</h1><p>1件のハウジングを公開中</p>');
  });

  it('displayName・bioのHTML特殊文字をエスケープする', () => {
    const html = buildHousingerSeoSnapshotHtml({ displayName: '<b>x</b>', bio: '"quote"', listingCount: 0 });
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt; のハウジング</h1><p>&quot;quote&quot;</p><p>0件のハウジングを公開中</p>');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run api/share/__tests__/_housingerPageHandler.test.ts`
Expected: FAIL (`buildHousingerSeoSnapshotHtml` is not exported)

- [ ] **Step 3: 実装する**

`api/share/_housingerPageHandler.ts` の変更点は3箇所。

(a) import 行 (ファイル冒頭、`import { toPngSiblingPath } from '../housing/_imageArrayLogic.js';` の直後) に追加:

```typescript
import { escapeHtml as sharedEscapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';
```

(b) ファイル内で定義されている `escapeHtml` 関数 (14-46行目付近) を削除し、代わりに `sharedEscapeHtml` を `escapeHtml` としてそのまま使う。既存の呼び出し箇所 (`escapeHtml(ogTitle)` 等、330-338行目・353-355行目) は名前を変えず動くよう、import 行を次のようにする(上の (a) を置き換え):

```typescript
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';
```

そして元々のローカル `function escapeHtml(s: string): string { ... }` 定義 (44-46行目) を削除する。

(c) `buildHousingerSeoSnapshotHtml` を新規 export 関数として追加する (ファイル末尾、`export default async function handler` の直前):

```typescript
/** ハウジンガーページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildHousingerSeoSnapshotHtml(input: {
  displayName: string;
  bio: string;
  listingCount: number;
}): string {
  const name = input.displayName || 'ハウジンガー';
  const bioHtml = input.bio ? `<p>${escapeHtml(input.bio)}</p>` : '';
  return `<h1>${escapeHtml(name)} のハウジング</h1>${bioHtml}<p>${input.listingCount}件のハウジングを公開中</p>`;
}
```

(d) `export default async function handler` 本体を、404化とスナップショット注入のために変更する。現状 (153-378行目) は次の構造:

```
let ogTitle = DEFAULT_OG_TITLE;
...
try {
  if (rawUid) {
    ...
    if (profileSnap.exists) {
      const profile = profileSnap.data()!;
      const isPublic = ...;
      if (isPublic) {
        ... ogTitle / ogDescription / ogImageUrl を設定 ...
      }
      // isPublic===false の場合は専用メタを一切設定せず、デフォルトのまま下の HTML 生成に進む。
    }
  }
} catch (err) { ... }

const canonicalUrl = ...;
ogImageUrl = toAbsoluteUrl(ogImageUrl, origin);

try {
  const indexRes = await fetch(`${origin}/index.html`);
  if (indexRes.ok) {
    let html = await indexRes.text();
    html = html.replace(...) // meta tags
    res.setHeader('Content-Type', ...);
    res.setHeader('Cache-Control', ...);
    return res.send(html);
  }
} catch (err) { ... }

// フォールバック
...
return res.send(`...`);
```

これを次の形に変更する (差分の要点: `let httpStatus = 200` と `let seoSnapshotHtml = ''` を追加、`isPublic` の分岐内で件数を数えてスナップショットを組み立て、`isPublic` が false または profile が無いときは `httpStatus = 404`、最後の2つの `res.send` の直前に `res.status(httpStatus)` を挿入し、`injectSeoSnapshot` で HTML に差し込む):

```typescript
export default async function handler(req: any, res: any) {
  const rawUid = (req.query?.uid as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  let ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;
  const lang = 'ja';
  let httpStatus = 200;
  let seoSnapshotHtml = '';

  // (中略: allowedHosts/host/protocol/origin の算出は既存のまま変更なし)

  let shortUid = rawUid;

  try {
    if (rawUid) {
      const uid = normalizeHousingerUid(rawUid);
      shortUid = stripHashedPrefix(uid);

      initAdmin();
      const db = getAdminFirestore();

      const profileSnap = await db.collection(PROFILE_COLLECTION).doc(uid).get();
      if (profileSnap.exists) {
        const profile = profileSnap.data()!;
        const isPublic = profile.isPublished === true && profile.isModerationHidden !== true;

        if (isPublic) {
          // (既存の displayName/bio/avatarUrl/ogTitle/ogDescription/resolvedImages/cardUrl 算出はそのまま)
          // ↓ 既存の resolvedImages 算出ブロックの直後 (309行目付近、if (cardUrl) { ... } の後) に追加:
          const listingCount = selectedIds.length > 0 ? listingImageEntries.length : listingImageEntries.length;
          seoSnapshotHtml = buildHousingerSeoSnapshotHtml({ displayName, bio, listingCount });
        } else {
          httpStatus = 404;
        }
      } else {
        httpStatus = 404;
      }
    } else {
      httpStatus = 404;
    }
  } catch (err) {
    console.error('Housinger page data fetch error:', err);
  }

  const canonicalUrl = shortUid ? `${origin}/housing/housinger/${encodeURIComponent(shortUid)}` : origin;
  ogImageUrl = toAbsoluteUrl(ogImageUrl, origin);

  try {
    const indexRes = await fetch(`${origin}/index.html`);
    if (indexRes.ok) {
      let html = await indexRes.text();
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);
      if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=30, max-age=0');
      res.status(httpStatus);
      return res.send(html);
    }
  } catch (err) {
    console.error('Housinger page index.html fetch error:', err);
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDescription);
  const safeImg = escapeHtml(ogImageUrl);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(httpStatus);
  return res.send(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${safeImg}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImg}" />
</head>
<body>
<div id="root">${seoSnapshotHtml}</div>
</body>
</html>`);
}
```

注意点 (実装者向け):
- `listingCount` は既存コード (216-243行目) で既に `listingImageEntries` という配列に「本人が実際に公開している listing」が集まっている。上の疑似コードの `selectedIds.length > 0 ? ... : ...` は単に `listingImageEntries.length` を使えばよいという意味 (両方の分岐で同じ配列を使っているため単純に `listingImageEntries.length` でよい)。実装時はこの1行に簡略化すること: `seoSnapshotHtml = buildHousingerSeoSnapshotHtml({ displayName, bio, listingCount: listingImageEntries.length });`
- `let httpStatus = 200;` の宣言と `let seoSnapshotHtml = '';` の宣言は関数冒頭 (既存の `let ogImageUrl` 等の並び) に追加する。
- フォールバックHTML (最後の `return res.send(...)`) は元々 `<div id="root"></div><p style="...">読み込み中...</p>` だったが、`<div id="root">${seoSnapshotHtml}</div>` に置き換え、`読み込み中...` の `<p>` は削除する (スナップショットが空文字のときは従来通り空の root になるだけで挙動は変わらない)。

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run api/share/__tests__/_housingerPageHandler.test.ts`
Expected: PASS (全テスト)

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add api/share/_housingerPageHandler.ts api/share/__tests__/_housingerPageHandler.test.ts
git commit -m "fix: ハウジンガーページの非公開/不存在時に404を返し、公開時はSEOスナップショットを埋め込む"
```

---

### Task 3: 共有プランページ (`_sharePageHandler.ts`) — 404化 + スナップショット注入

**Files:**
- Modify: `api/share/_sharePageHandler.ts`(全体)
- Create: `api/share/__tests__/_sharePageHandler.test.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `injectSeoSnapshot` (Task 1)
- Produces: `buildSharePageSeoSnapshotHtml(ogTitle: string, ogDescription: string): string`(export)

- [ ] **Step 1: 失敗するテストを書く**

`api/share/__tests__/_sharePageHandler.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSharePageSeoSnapshotHtml } from '../_sharePageHandler.js';

describe('buildSharePageSeoSnapshotHtml', () => {
  it('タイトルと説明からスナップショットHTMLを組み立てる', () => {
    const html = buildSharePageSeoSnapshotHtml('アルカディア零式 - LoPo', '4層の軽減プラン');
    expect(html).toBe('<h1>アルカディア零式 - LoPo</h1><p>4層の軽減プラン</p>');
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildSharePageSeoSnapshotHtml('<b>x</b>', '"quote"');
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>&quot;quote&quot;</p>');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run api/share/__tests__/_sharePageHandler.test.ts`
Expected: FAIL (モジュールが該当exportを持たない)

- [ ] **Step 3: 実装する**

`api/share/_sharePageHandler.ts` を書き換える (全体、次の内容に置き換え):

```typescript
/**
 * 共有ページHTML返却ハンドラー
 *
 * /share/:id へのアクセスを受けて、動的OGPメタタグ付きHTMLを返す。
 * - クローラー: OGPメタタグ + 可視テキストスナップショットを読み取る
 * - 通常ユーザー: SPAのindex.htmlを返してReact Routerで表示 (即 /miti へ遷移)
 * - 共有が存在しない (期限切れ/削除済み/不正ID) 場合は真の404を返す (ソフト404対策)。
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getContentName, buildOgImageUrl, type OgpLang } from '../../src/lib/ogpHelpers.js';
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';

const COLLECTION = 'shared_plans';

function initAdmin() {
    if (!getApps().length) {
        let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
        if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
        pk = pk.replace(/\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: pk,
            }),
        });
    }
}

/** 共有プランページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildSharePageSeoSnapshotHtml(ogTitle: string, ogDescription: string): string {
    return `<h1>${escapeHtml(ogTitle)}</h1><p>${escapeHtml(ogDescription)}</p>`;
}

export default async function handler(req: any, res: any) {
    const shareId = (req.query.id as string) || '';

    let ogTitle = 'LoPo | FF14 軽減プランナー';
    let ogDescription = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
    let ogImageUrl = '/api/og';
    let lang: OgpLang = 'ja';
    let httpStatus = 200;
    let found = false;

    try {
        if (shareId) {
            initAdmin();
            const db = getFirestore();
            const snap = await db.collection(COLLECTION).doc(shareId).get();

            if (snap.exists) {
                found = true;
                const data = snap.data()!;
                lang = data.lang === 'en' ? 'en' : 'ja';

                if (data.type === 'bundle' && Array.isArray(data.plans)) {
                    const names = data.plans
                        .map((p: any) => getContentName(p.contentId, lang) || p.title || '')
                        .filter(Boolean);
                    if (names.length > 0) {
                        ogTitle = `${names.join(' / ')} - LoPo`;
                        ogDescription = lang === 'en'
                            ? `${names.length} mitigation plans`
                            : `${names.length}件の軽減プラン`;
                    }
                } else {
                    const contentName = getContentName(data.contentId, lang);
                    const planTitle = data.title || '';

                    if (contentName) {
                        ogTitle = `${contentName} - LoPo`;
                        ogDescription = lang === 'en'
                            ? (planTitle ? `${planTitle} | Mitigation plan for ${contentName}` : `Mitigation plan for ${contentName}`)
                            : (planTitle ? `${planTitle} | ${contentName} の軽減プラン` : `${contentName} の軽減プラン`);
                    } else if (planTitle) {
                        ogTitle = `${planTitle} - LoPo`;
                        ogDescription = lang === 'en'
                            ? `Mitigation plan: ${planTitle}`
                            : `${planTitle} の軽減プラン`;
                    }
                }

                const ogAllowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173'];
                const ogPreviewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
                const ogRawHost = req.headers.host || 'lopoly.app';
                const ogHost = ogAllowedHosts.find(h => ogRawHost.includes(h))
                    || (ogPreviewPattern.test(ogRawHost) ? ogRawHost : null)
                    || 'lopoly.app';
                const ogProtocol = ogHost.includes('localhost') ? 'http' : 'https';
                const hasLogo = typeof data.logoBase64 === 'string' && data.logoBase64.length > 0;
                const logoHashStr = typeof data.logoHash === 'string' ? data.logoHash : undefined;

                const imageHashFromDoc = typeof data.imageHash === 'string' ? data.imageHash : '';
                if (/^[a-f0-9]{16}$/.test(imageHashFromDoc)) {
                    ogImageUrl = `${ogProtocol}://${ogHost}/og/${imageHashFromDoc}.png`;
                } else {
                    ogImageUrl = buildOgImageUrl(`${ogProtocol}://${ogHost}`, shareId, {
                        showLogo: hasLogo,
                        logoHash: hasLogo ? logoHashStr : undefined,
                        lang,
                    });
                }
            }
        }
    } catch (err) {
        console.error('Share page data fetch error:', err);
    }

    if (!found) httpStatus = 404;
    const seoSnapshotHtml = found ? buildSharePageSeoSnapshotHtml(ogTitle, ogDescription) : '';

    try {
        const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
        const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
        const rawHost = req.headers.host || 'lopoly.app';
        const host = allowedHosts.find(h => rawHost.includes(h))
            || (previewPattern.test(rawHost) ? rawHost : null)
            || 'lopoly.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const indexRes = await fetch(`${protocol}://${host}/index.html`);

        if (indexRes.ok) {
            let html = await indexRes.text();
            const sharePageUrl = shareId ? `${protocol}://${host}/share/${encodeURIComponent(shareId)}` : `${protocol}://${host}`;

            html = html
                .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
                .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
                .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(sharePageUrl)}" />`)
                .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
                .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
                .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
                .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);
            if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
            res.status(httpStatus);
            return res.send(html);
        }
    } catch (err) {
        console.error('Index.html fetch error:', err);
    }

    const safeTitle = escapeHtml(ogTitle);
    const safeDesc = escapeHtml(ogDescription);
    const safeImg = escapeHtml(ogImageUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(httpStatus);
    return res.send(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${safeImg}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImg}" />
</head>
<body>
<div id="root">${seoSnapshotHtml}</div>
</body>
</html>`);
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run api/share/__tests__/_sharePageHandler.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add api/share/_sharePageHandler.ts api/share/__tests__/_sharePageHandler.test.ts
git commit -m "fix: 共有プランページの不存在時に404を返し、存在時はSEOスナップショットを埋め込む"
```

---

### Task 4: ツアー招待ページ (`_tourInvitePageHandler.ts`) — 404化 + スナップショット注入

**Files:**
- Modify: `api/share/_tourInvitePageHandler.ts`(全体)
- Create: `api/share/__tests__/_tourInvitePageHandler.test.ts`

**Interfaces:**
- Consumes: `escapeHtml`, `injectSeoSnapshot` (Task 1)
- Produces: `buildTourInviteSeoSnapshotHtml(tourName: string): string`(export)

- [ ] **Step 1: 失敗するテストを書く**

`api/share/__tests__/_tourInvitePageHandler.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { buildTourInviteSeoSnapshotHtml } from '../_tourInvitePageHandler.js';

describe('buildTourInviteSeoSnapshotHtml', () => {
  it('ツアー名からスナップショットHTMLを組み立てる', () => {
    const html = buildTourInviteSeoSnapshotHtml('ミストお茶会ツアー');
    expect(html).toBe('<h1>ミストお茶会ツアー</h1><p>FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。</p>');
  });

  it('ツアー名が空なら既定タイトルにフォールバックする', () => {
    const html = buildTourInviteSeoSnapshotHtml('');
    expect(html).toBe('<h1>LoPo Housing Tour</h1><p>FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。</p>');
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildTourInviteSeoSnapshotHtml('<b>x</b>');
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。</p>');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run api/share/__tests__/_tourInvitePageHandler.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`api/share/_tourInvitePageHandler.ts` を書き換える (全体、次の内容に置き換え):

```typescript
/**
 * ツアー招待ページ (/housing/tour/:tourToken) 動的OGPハンドラー
 * _housingerPageHandler.ts と同じ仕組み(クローラーにはOGPメタ+可視テキストスナップショット入りHTML、
 * 通常ユーザーには同じHTML内の <div id="root"> 経由で React Router が SPA を描画する)。vercel.json の
 * rewrite で /housing/tour/:tourToken → /api/share?type=tour&token=:tourToken に内部委譲される。
 * トークンが存在しない場合は真の404を返す (ソフト404対策)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { buildTourInviteOgCardParams } from '../../src/lib/ogpTourInviteCard.js';
import { computeOgCardImageHash } from '../../src/lib/ogpImageHash.js';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../src/types/sharedTour.js';
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';

const DEFAULT_OG_TITLE = 'LoPo Housing Tour';
const DEFAULT_OG_DESCRIPTION = 'FF14のハウジングを巡るツアーに招待されました。リンクを開くと幹事と同じ景色を一緒に見られます。';
const DEFAULT_OG_IMAGE = '/api/og?type=tour';

/** ツアー招待ページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildTourInviteSeoSnapshotHtml(tourName: string): string {
  const name = tourName || DEFAULT_OG_TITLE;
  return `<h1>${escapeHtml(name)}</h1><p>${escapeHtml(DEFAULT_OG_DESCRIPTION)}</p>`;
}

export default async function handler(req: any, res: any) {
  const rawToken = (req.query?.token as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  const ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;
  let httpStatus = 200;
  let found = false;
  let tourNameForSnapshot = '';

  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const rawHost = req.headers?.host || 'lopoly.app';
  const host = allowedHosts.find((h) => rawHost.includes(h))
    || (previewPattern.test(rawHost) ? rawHost : null)
    || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  try {
    if (rawToken) {
      initAdmin();
      const db = getAdminFirestore();
      const snap = await db.collection('shared_tours').doc(rawToken).get();
      if (snap.exists) {
        found = true;
        const data = snap.data()!;
        const tourName: string = typeof data.tourName === 'string' ? data.tourName.slice(0, SHARED_TOUR_NAME_MAX_LENGTH) : '';
        tourNameForSnapshot = tourName;

        ogTitle = tourName ? `${tourName} | LoPo Housing Tour` : DEFAULT_OG_TITLE;

        try {
          const params = buildTourInviteOgCardParams({ name: tourName });
          const hash = computeOgCardImageHash(params);
          await db.collection('og_image_meta').doc(hash).set({
            type: 'tour',
            name: tourName,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
          });
          ogImageUrl = `${origin}/og/${hash}.png`;
        } catch (err) {
          console.error('Tour invite OG card hash/meta error:', err);
        }
      }
    }
  } catch (err) {
    console.error('Tour invite page data fetch error:', err);
  }

  if (!found) httpStatus = 404;
  const seoSnapshotHtml = found ? buildTourInviteSeoSnapshotHtml(tourNameForSnapshot) : '';

  const canonicalUrl = rawToken ? `${origin}/housing/tour/${encodeURIComponent(rawToken)}` : origin;
  if (!/^https?:\/\//.test(ogImageUrl)) ogImageUrl = `${origin}${ogImageUrl}`;

  try {
    const indexRes = await fetch(`${origin}/index.html`);
    if (indexRes.ok) {
      let html = await indexRes.text();
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);
      if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
      res.status(httpStatus);
      return res.send(html);
    }
  } catch (err) {
    console.error('Tour invite page index.html fetch error:', err);
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDescription);
  const safeImg = escapeHtml(ogImageUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(httpStatus);
  return res.send(`<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${safeImg}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImg}" />
</head>
<body>
<div id="root">${seoSnapshotHtml}</div>
</body>
</html>`);
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run api/share/__tests__/_tourInvitePageHandler.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 6: コミット**

```bash
git add api/share/_tourInvitePageHandler.ts api/share/__tests__/_tourInvitePageHandler.test.ts
git commit -m "fix: ツアー招待ページの不存在時に404を返し、存在時はSEOスナップショットを埋め込む"
```

---

### Task 5: 物件詳細ページ (新規 `_listingPageHandler.ts`) + ルーティング配線

**Files:**
- Modify: `api/housing/_publicWindow.ts:36-42`(`isPubliclyViewable` を export する)
- Create: `api/share/_listingPageHandler.ts`
- Create: `api/share/__tests__/_listingPageHandler.test.ts`
- Modify: `api/share/index.ts:83-99`(`type=listing` 分岐を追加)
- Modify: `vercel.json:9-11`(rewrite追加)

**Interfaces:**
- Consumes: `escapeHtml`, `injectSeoSnapshot` (Task 1)、`isPubliclyViewable`(`api/housing/_publicWindow.ts`、本タスクでexport化)、`projectPublicListing`(`src/lib/housing/publicListingProjection.ts`、既存export)、`formatFullHousingAddress`/`regionForDC`(既存export)
- Produces: `buildListingSeoSnapshotHtml(input: { title: string; addressText: string | null; description: string }): string`(export)

- [ ] **Step 1: `isPubliclyViewable` を export する**

`api/housing/_publicWindow.ts:36` の `function isPubliclyViewable(d: any, now: number): boolean {` を `export function isPubliclyViewable(d: any, now: number): boolean {` に変更する (関数本体は変更なし)。

- [ ] **Step 2: 失敗するテストを書く**

`api/share/__tests__/_listingPageHandler.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { buildListingSeoSnapshotHtml } from '../_listingPageHandler.js';

describe('buildListingSeoSnapshotHtml', () => {
  it('タイトル・住所・説明からスナップショットHTMLを組み立てる', () => {
    const html = buildListingSeoSnapshotHtml({
      title: '海が見える家',
      addressText: 'ミスト・ヴィレッジ 23-6',
      description: '内装こだわってます',
    });
    expect(html).toBe('<h1>海が見える家</h1><p>ミスト・ヴィレッジ 23-6</p><p>内装こだわってます</p>');
  });

  it('addressTextがnull (unlisted) なら住所の<p>を出さない', () => {
    const html = buildListingSeoSnapshotHtml({ title: '海が見える家', addressText: null, description: '' });
    expect(html).toBe('<h1>海が見える家</h1>');
  });

  it('descriptionが140文字を超えたら140文字+…に切り詰める', () => {
    const longDesc = 'あ'.repeat(200);
    const html = buildListingSeoSnapshotHtml({ title: 'x', addressText: null, description: longDesc });
    expect(html).toBe(`<h1>x</h1><p>${'あ'.repeat(140)}…</p>`);
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildListingSeoSnapshotHtml({ title: '<b>x</b>', addressText: '"a"', description: '' });
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>&quot;a&quot;</p>');
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `npx vitest run api/share/__tests__/_listingPageHandler.test.ts`
Expected: FAIL (`../_listingPageHandler.js` が存在しない)

- [ ] **Step 4: 実装する**

`api/share/_listingPageHandler.ts` を新規作成:

```typescript
/**
 * ハウジング物件詳細ページ (/housing/listing/:id) 動的OGP+SEOスナップショットハンドラー。
 * _housingerPageHandler.ts / _tourInvitePageHandler.ts と同じ仕組み。vercel.json の rewrite で
 * /housing/listing/:id → /api/share?type=listing&id=:id に内部委譲される。
 *
 * データ取得・公開可否判定・住所射影は api/housing/_publicWindow.ts の action=listing と
 * 完全に同じロジック (isPubliclyViewable / projectPublicListing) を再利用する。
 * 独自の住所フィルタリングを書かない (住所非公開機能の二重実装によるドリフトを防ぐため)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { isPubliclyViewable } from '../housing/_publicWindow.js';
import { projectPublicListing } from '../../src/lib/housing/publicListingProjection.js';
import { formatFullHousingAddress } from '../../src/lib/housing/formatHousingAddress.js';
import { regionForDC } from '../../src/data/housing/dcServerMap.js';
import { escapeHtml, injectSeoSnapshot } from '../../src/lib/ogpPageShell.js';

const COLLECTION = 'housing_listings';
const DEFAULT_OG_TITLE = 'LoPo | FF14 軽減プランナー';
const DEFAULT_OG_DESCRIPTION = 'FF14の軽減プランをサクサク作れるウェブアプリ。FFLogsから自動生成されたタイムラインで、最適な軽減配置を。';
const DEFAULT_OG_IMAGE = '/api/og';
const DESCRIPTION_MAX_LENGTH = 140;

/** 物件詳細ページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildListingSeoSnapshotHtml(input: {
  title: string;
  addressText: string | null;
  description: string;
}): string {
  const addressHtml = input.addressText ? `<p>${escapeHtml(input.addressText)}</p>` : '';
  const trimmed = input.description.length > DESCRIPTION_MAX_LENGTH
    ? `${input.description.slice(0, DESCRIPTION_MAX_LENGTH)}…`
    : input.description;
  const descHtml = trimmed ? `<p>${escapeHtml(trimmed)}</p>` : '';
  return `<h1>${escapeHtml(input.title)}</h1>${addressHtml}${descHtml}`;
}

export default async function handler(req: any, res: any) {
  const listingId = (req.query?.id as string) || '';

  let ogTitle = DEFAULT_OG_TITLE;
  let ogDescription = DEFAULT_OG_DESCRIPTION;
  let ogImageUrl: string = DEFAULT_OG_IMAGE;
  let httpStatus = 200;
  let seoSnapshotHtml = '';

  const allowedHosts = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
  const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
  const rawHost = req.headers?.host || 'lopoly.app';
  const host = allowedHosts.find((h) => rawHost.includes(h))
    || (previewPattern.test(rawHost) ? rawHost : null)
    || 'lopoly.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  try {
    if (listingId) {
      initAdmin();
      const db = getAdminFirestore();
      const snap = await db.collection(COLLECTION).doc(listingId).get();

      if (snap.exists && isPubliclyViewable(snap.data()!, Date.now())) {
        const projected = projectPublicListing(listingId, snap.data()!);
        const title = typeof projected.title === 'string' && projected.title ? projected.title : DEFAULT_OG_TITLE;
        const description = typeof projected.description === 'string' ? projected.description : '';

        let addressText: string | null = null;
        if (
          typeof projected.area === 'string'
          && typeof projected.ward === 'number'
          && typeof projected.dc === 'string'
          && typeof projected.server === 'string'
        ) {
          addressText = formatFullHousingAddress(
            {
              area: projected.area as any,
              ward: projected.ward,
              buildingType: projected.buildingType as 'house' | 'apartment' | undefined,
              plot: projected.plot as number | undefined,
              apartmentBuilding: projected.apartmentBuilding as 1 | 2 | undefined,
              roomNumber: projected.roomNumber as number | undefined,
              region: regionForDC(projected.dc),
              dc: projected.dc,
              server: projected.server,
            },
            'ja',
          );
        }

        ogTitle = `${title} - LoPo Housing`;
        ogDescription = description || DEFAULT_OG_DESCRIPTION;
        seoSnapshotHtml = buildListingSeoSnapshotHtml({ title, addressText, description });
      } else {
        httpStatus = 404;
      }
    } else {
      httpStatus = 404;
    }
  } catch (err) {
    console.error('Listing page data fetch error:', err);
    httpStatus = 404;
  }

  const canonicalUrl = listingId ? `${origin}/housing/listing/${encodeURIComponent(listingId)}` : origin;
  if (!/^https?:\/\//.test(ogImageUrl)) ogImageUrl = `${origin}${ogImageUrl}`;

  try {
    const indexRes = await fetch(`${origin}/index.html`);
    if (indexRes.ok) {
      let html = await indexRes.text();
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`)
        .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`)
        .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`)
        .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);
      if (seoSnapshotHtml) html = injectSeoSnapshot(html, seoSnapshotHtml);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
      res.status(httpStatus);
      return res.send(html);
    }
  } catch (err) {
    console.error('Listing page index.html fetch error:', err);
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDescription);
  const safeImg = escapeHtml(ogImageUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(httpStatus);
  return res.send(`<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${safeTitle}</title>
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${safeImg}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${safeTitle}" />
<meta name="twitter:description" content="${safeDesc}" />
<meta name="twitter:image" content="${safeImg}" />
</head>
<body>
<div id="root">${seoSnapshotHtml}</div>
</body>
</html>`);
}
```

注意点 (実装者向け): `formatFullHousingAddress` の第1引数の型は `FullAddressViewModel`(`src/lib/housing/formatHousingAddress.ts:38`)。`projected.area` 等は `Record<string, unknown>` から来るため `as any` / `as` キャストが必要 (`_housingerPageHandler.ts` の既存コードも同様に `typeof` ガード後キャストしている、既存流儀に合わせる)。

- [ ] **Step 5: `api/share/index.ts` に `type=listing` 分岐を追加する**

`api/share/index.ts:21-23` の import 群の直後に追加:

```typescript
import listingPageHandler from './_listingPageHandler.js';
```

`api/share/index.ts:95-99`(ツアー招待ルーティングの直後)に追加:

```typescript
    // 物件詳細ページへのルーティング（?type=listing&id=...）
    // type=page/housinger/tour と同様、rate limit / App Check を課さない（GET html、匿名クローラーも通す）。
    if (req.query?.type === 'listing') {
        return listingPageHandler(req, res);
    }
```

- [ ] **Step 6: `vercel.json` に rewrite を追加する**

`vercel.json:11`(`/housing/tour/:tourToken` の行)の直後に追加:

```json
    { "source": "/housing/listing/:id", "destination": "/api/share?type=listing&id=:id" },
```

- [ ] **Step 7: テストを実行して成功を確認する**

Run: `npx vitest run api/share/__tests__/_listingPageHandler.test.ts`
Expected: PASS

- [ ] **Step 8: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し (`api/housing/_publicWindow.ts` の export化・新規ファイルの型を含む)

- [ ] **Step 9: コミット**

```bash
git add api/housing/_publicWindow.ts api/share/_listingPageHandler.ts api/share/__tests__/_listingPageHandler.test.ts api/share/index.ts vercel.json
git commit -m "feat: ハウジング物件詳細ページに動的OGP+SEOスナップショットハンドラーを追加(ソフト404対策)"
```

---

### Task 6: 全体検証・Cloudflareキャッシュルール手順・ドキュメント反映

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: フルビルド + 対象テストの実行**

Run: `npm run build`
Expected: 成功 (exit code 0)

Run: `npx vitest run api/share api/housing src/lib`
Expected: 全PASS (Task 1-5で追加/変更したテストのみでよい。フルスイートはハングの既知問題があるため実行しない — memory `reference_vitest_vmthreads_hang` 参照)

- [ ] **Step 2: ローカルで4パターンを軽く動作確認する (dev server)**

`npm run dev` を起動し、以下のURLに直接アクセスして「見た目が壊れていない」「一瞬後にちゃんとSPAとして表示される」ことを確認する:
- `/housing/housinger/<実在するuidの短縮形>` — 実在プロフィールで確認
- `/housing/listing/<実在するlistingId>` — 実在物件で確認
- 存在しないID (`/housing/listing/does-not-exist-123`) で開発者ツールのNetworkタブを見て、ステータスが404になっていることを確認

これはUI変更ではなく裏側のHTTPレスポンスの変更なので、`housing-design.md` の見た目承認フローの対象外。動作確認のみでよい。

- [ ] **Step 3: 本番デプロイ後、Cloudflare Cache Rule の確認 (ユーザー作業)**

`.claude/rules/api-caching.md` の通り、Cloudflareの `bypass-dynamic-shell` ルールが `/api/*` を含む主要パスを一律バイパスしている可能性がある。`api/housing/_publicWindow.ts` の `action=listing` 等は「Cloudflareがキャッシュする」と明記された専用ルールが既にある前提で 24h キャッシュを設定しているのに対し、今回追加・変更した4パス (`/housing/housinger/*`, `/share/*`, `/housing/tour/*`, `/housing/listing/*`) に同等のCache Ruleが既にあるかは未確認。デプロイ後、Cloudflareダッシュボード (Caching → Cache Rules) で以下を確認し、無ければ追加するようユーザーに依頼する:
- 対象: `/housing/housinger/*`, `/share/*`, `/housing/tour/*`, `/housing/listing/*`
- 動作: 「キャッシュ制御ヘッダーを無視し、このTTLを使用します」で各ハンドラーの `max-age` と同じ秒数を明示指定 (housinger=0=事実上キャッシュ無効のまま、share/tour=60秒、listing=86400秒)
- ルール一覧の末尾に追加 (Cache Rulesは後勝ちのため、既存ルールの上に置く必要は無い)

このステップはCloudflareダッシュボードでの手動操作のため、実装者(subagent)はここで止めて、ユーザーに確認を依頼するメッセージを返すこと。

- [ ] **Step 4: Search Console での確認方法をユーザーに案内する**

デプロイ後、今回Search Consoleで指摘された `https://lopoly.app/housing/housinger/fa1243d2681c...` のURLについて、Search Console の「URL検査」→「実際のURLをテスト」を再実行し、「テスト済みページを表示」のスクリーンショットで名前・ハウジング一覧の文字が実際に見えているか確認する。Googleへの再インデックス依頼 (「インデックス登録をリクエスト」ボタン) もこのタイミングで行うようユーザーに案内する。ただし審査完了まで数日〜数週間かかる場合がある旨も伝える。

- [ ] **Step 5: `docs/TODO.md` を更新する**

`docs/TODO.md` の該当行 (「🆕 SEO: ソフト404」の行) を以下に置き換える:

```markdown
- **✅ 2026-08-16 SEO: ソフト404対策 = 実装完了・デプロイ待ち**: ハウジンガー/共有プラン/ツアー招待/物件詳細の4動的ページで、データ不存在時は真の404を返し、データ存在時はサーバー側で可視テキストスナップショットを`<div id="root">`に埋め込むよう修正(詳細=`docs/.private/2026-08-15-soft-404-investigation.md`、実装計画=`docs/superpowers/plans/2026-08-16-housing-seo-soft-404-fix.md`)。**残**=Cloudflare Cache Rule (`/housing/housinger/*` `/share/*` `/housing/tour/*` `/housing/listing/*`) の存在確認・無ければ追加(ユーザー作業)/デプロイ後Search Console「URL検査」で再確認+インデックス登録リクエスト。
```

- [ ] **Step 6: コミット**

```bash
git add docs/TODO.md
git commit -m "docs: ソフト404対策の実装完了をTODO.mdへ反映"
```

---

## Self-Review

**Spec coverage:**
- ハウジンガーページの404化+スナップショット注入 → Task 2 ✅
- 共有プランページの同様の修正 (ユーザー承認済みスコープ) → Task 3 ✅
- ツアー招待ページの同様の修正 → Task 4 ✅
- 物件詳細ページの新規ハンドラー (Hobby 12関数上限を超えない設計) → Task 5 ✅
- 住所プライバシーロジックの再利用 (重複実装しない) → Task 5 で `isPubliclyViewable` / `projectPublicListing` を再利用 ✅
- キャッシュ設計 (ユーザーとの会話で合意した「丁寧なキャッシュ」) → 既存3ハンドラーは既存TTLを維持、新規listingハンドラーは`_publicWindow.ts`と同じ24h TTLを採用 ✅
- Cloudflare Cache Rule の手動確認手順 → Task 6 Step 3 ✅
- Search Console での確認・再インデックス依頼手順 → Task 6 Step 4 ✅

**Placeholder scan:** 全タスクに実コード・実テストコードを記載済み。「TODO」「後で実装」等の記述なし。

**Type consistency:** `escapeHtml` / `injectSeoSnapshot` (Task 1) は Task 2-5 で同一シグネチャで一貫して使用。`buildXxxSeoSnapshotHtml` の命名パターン (`buildHousingerSeoSnapshotHtml` / `buildSharePageSeoSnapshotHtml` / `buildTourInviteSeoSnapshotHtml` / `buildListingSeoSnapshotHtml`) を4ハンドラーで統一。
