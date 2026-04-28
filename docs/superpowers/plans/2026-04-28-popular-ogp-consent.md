# 野良主流 OGP 表示ポリシー整理 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プラン名 OGP 焼き込み機能を全削除し、ロゴトグルを「身元公開の意思表示」として明文化、初回共有時の同意ダイアログと共有モーダル内常駐キャプションで野良主流掲載を明示的に伝える。

**Architecture:**
- `showTitle` 関連コード（lib / API / UI）を完全削除し、OGP は常にコンテンツ名のみで描画。
- 野良主流ページ／シートのカード UI から `entry.title` 表示を撤去。
- 同意は localStorage 単位（ログイン/未ログイン共通）。同意未取得状態で共有 POST 直前にモーダル表示し、`理解して共有する` 押下後に POST を実行。

**Tech Stack:** React + TypeScript / Tailwind v4 / i18next（4言語）/ Vercel Edge Functions / Firebase Firestore / Vitest

**設計書:** `docs/superpowers/specs/2026-04-28-popular-ogp-consent-design.md`

---

## ファイル構成

| 種別 | パス | 役割 |
|------|------|------|
| 修正 | `src/lib/ogpImageHash.ts` | hash 入力型から `showTitle` 削除 |
| 修正 | `src/lib/__tests__/ogpImageHash.test.ts` | `showTitle` 関連テスト削除 |
| 修正 | `src/lib/ogpHelpers.ts` | `buildOgImageUrl` から `showTitle` 削除 |
| 修正 | `src/lib/__tests__/ogpHelpers.test.ts` | `showTitle` テスト整理 |
| 修正 | `api/og-cache/index.ts` | URL 組み立てから `showTitle` 削除 |
| 修正 | `api/share/index.ts` | POST/PUT で `showTitle` を読み書きしない |
| 修正 | `api/share/_sharePageHandler.ts` | `showTitle` 読み出し削除 |
| 修正 | `api/og/index.ts` | プラン名描画ロジック削除（常にコンテンツ名のみ） |
| 修正 | `src/components/ShareModal.tsx` | `showPlanTitle` 削除・同意ダイアログ統合・キャプション追加 |
| 修正 | `src/components/MitigationSheet.tsx` | 野良主流シートのカードから `miti-card-title` 削除 |
| 修正 | `src/components/PopularPage.tsx` | カードからプラン名削除・X 共有テキスト修正 |
| 修正 | `src/locales/{ja,en,zh,ko}.json` | `app.include_plan_title` 削除・新キー追加 |
| 新規 | `src/components/PopularConsentDialog.tsx` | 初回共有時の同意ダイアログ |
| 新規 | `src/lib/popularConsent.ts` | localStorage 同意フラグ読み書き |
| 新規 | `src/lib/__tests__/popularConsent.test.ts` | 同意フラグヘルパーのテスト |

---

## Task 1: showTitle 機能の全削除（lib層）

**Files:**
- Modify: `src/lib/__tests__/ogpImageHash.test.ts`
- Modify: `src/lib/ogpImageHash.ts`
- Modify: `src/lib/__tests__/ogpHelpers.test.ts`
- Modify: `src/lib/ogpHelpers.ts`

- [ ] **Step 1.1: `ogpImageHash.test.ts` から `showTitle` 関連を削除**

`baseInput` から `showTitle` 行を削除。`it('showTitle のフラグ差で hash が変わる', ...)` テストブロック自体を削除。

- [ ] **Step 1.2: `ogpImageHash.ts` の `ImageHashInput` から `showTitle` 削除**

```ts
export interface ImageHashInput {
    contentName: string;
    planTitle: string;
    showLogo: boolean;
    logoHash: string | null;
    lang: OgpLang;
}

export function computeImageHash(input: ImageHashInput): string {
    const normalized: ImageHashInput = {
        contentName: input.contentName || '',
        planTitle: input.planTitle || '',
        showLogo: !!input.showLogo,
        logoHash: input.logoHash || null,
        lang: input.lang,
    };
    const serialized = JSON.stringify(normalized);
    return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}
```

- [ ] **Step 1.3: ハッシュテストを実行して通ることを確認**

Run: `rtk vitest run src/lib/__tests__/ogpImageHash.test.ts`
Expected: PASS

- [ ] **Step 1.4: `ogpHelpers.test.ts` の `showTitle` 関連テストを整理**

`describe('buildOgImageUrl', ...)` 内の 4 ケース（showTitle×showLogo の組み合わせ）を 2 ケース（showLogo のみ）に集約。

```ts
describe('buildOgImageUrl', () => {
    it('showLogo=true: id → showLogo → lang', () => {
        expect(buildOgImageUrl(ORIGIN, SHARE_ID, { showLogo: true, lang: 'ja' }))
            .toBe('https://lopoly.app/api/og?id=abc12345&showLogo=true&lang=ja');
    });

    it('showLogo=false: id → lang のみ', () => {
        expect(buildOgImageUrl(ORIGIN, SHARE_ID, { showLogo: false, lang: 'ja' }))
            .toBe('https://lopoly.app/api/og?id=abc12345&lang=ja');
    });

    it('lang=en でも URL を組み立てられる', () => {
        expect(buildOgImageUrl(ORIGIN, SHARE_ID, { showLogo: true, lang: 'en' }))
            .toBe('https://lopoly.app/api/og?id=abc12345&showLogo=true&lang=en');
    });

    it('shareId に特殊文字があれば encode される', () => {
        expect(buildOgImageUrl(ORIGIN, 'a/b c+d', { showLogo: false, lang: 'ja' }))
            .toBe('https://lopoly.app/api/og?id=a%2Fb%20c%2Bd&lang=ja');
    });

    it('logoHash がついた場合は lh パラメータが付く', () => {
        expect(buildOgImageUrl(ORIGIN, SHARE_ID,
            { showLogo: true, logoHash: 'abc1234567890def', lang: 'ja' }))
            .toBe('https://lopoly.app/api/og?id=abc12345&showLogo=true&lh=abc1234567890def&lang=ja');
    });
});
```

> 注：実テストファイルの既存記法・前後コードを尊重。上は新ケース集合の意図のみ。

- [ ] **Step 1.5: `ogpHelpers.ts` の `buildOgImageUrl` から `showTitle` 削除**

```ts
export function buildOgImageUrl(
    origin: string,
    shareId: string,
    opts: { showLogo: boolean; logoHash?: string; lang: OgpLang },
): string {
    let url = `${origin}/api/og?id=${encodeURIComponent(shareId)}`;
    if (opts.showLogo) {
        url += '&showLogo=true';
        if (opts.logoHash) url += `&lh=${encodeURIComponent(opts.logoHash)}`;
    }
    url += `&lang=${opts.lang}`;
    return url;
}
```

JSDoc のパラメータ順序記載も `id → showLogo? → lh? → lang` に修正。

- [ ] **Step 1.6: lib テスト全体を実行**

Run: `rtk vitest run src/lib/__tests__/`
Expected: PASS（lib 配下の OGP 関連テストが緑）

- [ ] **Step 1.7: 中間コミットせず Task 2 に続く**

> このタスクは型変更なので Task 2/3 の API 修正までやらないと型エラーが残る。コミットは Task 3 末尾でまとめる。

---

## Task 2: showTitle 機能の全削除（API層）

**Files:**
- Modify: `api/og-cache/index.ts:60-67, 121`
- Modify: `api/share/index.ts:120-123, 154-202, 209-249, 256-341`
- Modify: `api/share/_sharePageHandler.ts:89-105`
- Modify: `api/og/index.ts:30, 108`

- [ ] **Step 2.1: `api/og-cache/index.ts` の URL 組み立てから `showTitle` 削除**

`meta` 引数の型から `showTitle` を抜き、`if (!meta.showTitle) url += '&showTitle=false';` 行を削除。
`computeImageHash` 呼び出し側でも `showTitle` を渡している箇所を削除。

- [ ] **Step 2.2: `api/share/index.ts` POST から `showTitle` 削除**

- 構造分解 `const { ... showTitle } = req.body;` から `showTitle` を抜く
- `normalizedShowTitle` 変数を削除
- `computeImageHash`／`upsertOgImageMeta`／Firestore doc 書き込みから `showTitle: normalizedShowTitle` を全て削除
- バンドル・単一プランの両ブランチで同じ作業

- [ ] **Step 2.3: `api/share/index.ts` PUT から `showTitle` 削除**

- 構造分解 `const { shareId, logoStoragePath, showTitle: putShowTitle } = req.body;` を `const { shareId, logoStoragePath } = req.body;` に
- `if (typeof putShowTitle === 'boolean') { await existingRef.update({ showTitle: putShowTitle }); }` ブロック削除
- `effectiveShowTitle` 計算ロジック削除、それを使っていた `imageHash` 計算と `upsertOgImageMeta` 呼び出しから `showTitle` キーを削除

- [ ] **Step 2.4: `api/share/_sharePageHandler.ts` から `showTitle` 削除**

`showTitleState` 変数定義（`typeof data.showTitle === 'boolean' ? data.showTitle : true`）と、それを `buildOgImageUrl` の opts へ渡している `showTitle: showTitleState` を削除。

- [ ] **Step 2.5: `api/og/index.ts` で常にプラン名なし描画に**

- `const showTitle = searchParams.get('showTitle') !== 'false';` 行を削除
- `buildSingleLayout(contentName, showTitle ? planTitle : '', ...)` を `buildSingleLayout(contentName, '', ...)` に固定

> `buildSingleLayout` 内部のレイアウト調整（タイトル空のときの余白）は実装時に視覚確認。差し当たり空文字列を渡すだけで、既存の null/空処理にフォールバックする想定。

- [ ] **Step 2.6: TypeScript ビルドで型エラーがないことを確認**

Run: `rtk tsc --noEmit`
Expected: error なし

---

## Task 3: ShareModal から showPlanTitle 関連削除 + コミット

**Files:**
- Modify: `src/components/ShareModal.tsx:37, 111, 125, 162, 170-207, 384-405`
- Modify: `src/locales/{ja,en,zh,ko}.json`（`app.include_plan_title` キー削除）

- [ ] **Step 3.1: state とハンドラを削除**

- `const [showPlanTitle, setShowPlanTitle] = useState(true);` を削除
- 関数 `handleTogglePlanTitle` を完全削除
- `body.showTitle = showPlanTitle;` 行を削除

- [ ] **Step 3.2: `buildOgUrl` ヘルパーから `planTitle` 引数を削除**

```ts
const buildOgUrl = (
    id: string,
    logo: boolean,
    logoHash: string | null,
    imageHash?: string | null,
) => {
    if (imageHash && /^[a-f0-9]{16}$/.test(imageHash)) {
        return `${window.location.origin}/og/${imageHash}.png`;
    }
    return buildOgImageUrl(window.location.origin, id, {
        showLogo: logo,
        logoHash: logoHash || undefined,
        lang,
    });
};
```

呼び出し側 3 箇所（POST 後 / updateShareLogo / handleTogglePlanTitle 跡地）を新シグネチャに合わせる（handleTogglePlanTitle は削除されるので 2 箇所）。

- [ ] **Step 3.3: トグル UI（行 384-405）を削除**

`{!isBundle && ( <div className="px-5 pb-2"> ... 「プラン名表示トグル」全体 </div> )}` ブロックを丸ごと削除。

- [ ] **Step 3.4: i18n キー `app.include_plan_title` を 4 言語から削除**

`src/locales/ja.json`、`en.json`、`zh.json`、`ko.json` の `app` セクション内 `include_plan_title` キーを削除。
コンマ位置の整合に注意。

- [ ] **Step 3.5: 関連箇所が他にないか grep で確認**

Run: `rtk grep -n "include_plan_title\|showPlanTitle\|setShowPlanTitle" src/`
Expected: 0 件

- [ ] **Step 3.6: ビルドとテストの全体実行**

Run: `rtk npm run build`
Expected: 成功
Run: `rtk vitest run`
Expected: PASS

- [ ] **Step 3.7: ここまでをコミット**

```bash
rtk git add src/lib/ogpHelpers.ts src/lib/ogpImageHash.ts \
            src/lib/__tests__/ogpHelpers.test.ts src/lib/__tests__/ogpImageHash.test.ts \
            api/og-cache/index.ts api/share/index.ts api/share/_sharePageHandler.ts api/og/index.ts \
            src/components/ShareModal.tsx \
            src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
rtk git commit -m "$(cat <<'EOF'
feat(share): プラン名 OGP 焼き込み機能を全削除

OGP は常にコンテンツ名のみで描画する方針に統一。lib/ImageHashInput と
buildOgImageUrl から showTitle を削除し、API（share/og/og-cache/sharePageHandler）
の永続化と読み出しも全部除去。共有モーダルからトグル UI と関連 i18n キーも削除。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 野良主流シートのカードからプラン名削除

**Files:**
- Modify: `src/components/MitigationSheet.tsx:486-501`

- [ ] **Step 4.1: `miti-card-title` span を削除**

該当ブロック（行 486-489 付近）の `<span className="miti-card-title" title={entry.title}>{entry.title}</span>` を削除。
削除後の `miti-card-bottom` は「コピー数 + コピーボタン（条件表示）」のみの構成になる。

- [ ] **Step 4.2: CSS の `.miti-card-title` ルールが他で使われていないか確認**

Run: `rtk grep -n "miti-card-title" src/`
Expected: 0 件（全件マッチした場合は削除のみ）

該当 CSS（`src/styles/` または `index.css` 内）も該当ルールを削除。

- [ ] **Step 4.3: ビルド確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4.4: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx src/styles/ src/index.css
rtk git commit -m "$(cat <<'EOF'
feat(popular): 野良主流シートカードからプラン名表示を削除

プラン名は私的命名が多く、意図せぬ拡散を防ぐためカード表示から撤去。
OGP 画像のコンテンツ名で識別は十分。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> CSS ファイルが該当しない場合は `git add` から外す。

---

## Task 5: 野良主流ページからプラン名削除 + X 共有テキスト修正

**Files:**
- Modify: `src/components/PopularPage.tsx:296-307, 329`

- [ ] **Step 5.1: `renderCard` 内の `entry.title` 表示を削除**

行 329 の `<p className="text-app-lg text-app-text truncate font-semibold">{entry.title}</p>` を削除。
削除後、カードはラベル → ジョブアイコン → アクションボタンの構成になる。

- [ ] **Step 5.2: `handleShareX` から `entry.title` 連結を外す**

```ts
const handleShareX = useCallback((entry: PopularEntry) => {
    const url = getShareUrl(entry.shareId);
    const contentName = getContentName(entry.contentId);
    const text = contentName || t('popular.title');
    window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        '_blank',
        'noopener'
    );
}, [lang, t]);
```

- [ ] **Step 5.3: 削除に伴うレイアウト崩れがないか視覚チェック**

Run: `rtk npm run dev`
ブラウザで `/popular` を開き、人気カードがプラン名なしで適切に縦中央寄せ・高さが整っているか目視確認。
（破綻していれば `gap-2.5` の調整、`h-full` の付与等で対応。具体修正は実装時に判断）

- [ ] **Step 5.4: ビルド + コミット**

```bash
rtk npm run build
rtk git add src/components/PopularPage.tsx
rtk git commit -m "$(cat <<'EOF'
feat(popular): 野良主流ページからプラン名表示と X 共有テキスト連結を撤去

カードは `ラベル / ジョブ / アクション` の構成のみに簡素化。X 共有時の
テキストは `コンテンツ名` のみ（プラン名は意図せぬ拡散の懸念があるため）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 同意ストレージヘルパーの追加（TDD）

**Files:**
- Create: `src/lib/popularConsent.ts`
- Create: `src/lib/__tests__/popularConsent.test.ts`

- [ ] **Step 6.1: テスト先行**

`src/lib/__tests__/popularConsent.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hasPopularConsent, setPopularConsent, CONSENT_KEY } from '../popularConsent';

describe('popularConsent', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('初期状態は同意なし', () => {
        expect(hasPopularConsent()).toBe(false);
    });

    it('setPopularConsent() 呼び出しで true を返すようになる', () => {
        setPopularConsent();
        expect(hasPopularConsent()).toBe(true);
    });

    it('CONSENT_KEY に 1 が永続化される', () => {
        setPopularConsent();
        expect(localStorage.getItem(CONSENT_KEY)).toBe('1');
    });

    it('localStorage が利用不可でも例外を投げない', () => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new Error('quota'); };
        try {
            expect(() => setPopularConsent()).not.toThrow();
        } finally {
            Storage.prototype.setItem = orig;
        }
    });
});
```

- [ ] **Step 6.2: テスト実行（失敗確認）**

Run: `rtk vitest run src/lib/__tests__/popularConsent.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 6.3: 実装**

`src/lib/popularConsent.ts`:

```ts
/**
 * 野良主流ページ掲載に関する同意フラグ（端末ローカル）。
 *
 * ログイン状態に関わらず localStorage 単位で同意を保持する。
 * 端末を変えれば再度ダイアログが出るが、同意自体は規約合意済みの
 * 範囲を確認するものなので「再表示で困る人はいない」設計。
 */

export const CONSENT_KEY = 'lopo.popularDisplayConsent';

export function hasPopularConsent(): boolean {
    try {
        return localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
        return false;
    }
}

export function setPopularConsent(): void {
    try {
        localStorage.setItem(CONSENT_KEY, '1');
    } catch {
        // Storage 不可時はサイレント無視（次回再表示される）
    }
}
```

- [ ] **Step 6.4: テスト実行（成功確認）**

Run: `rtk vitest run src/lib/__tests__/popularConsent.test.ts`
Expected: PASS

- [ ] **Step 6.5: コミット**

```bash
rtk git add src/lib/popularConsent.ts src/lib/__tests__/popularConsent.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(consent): 野良主流掲載同意フラグの localStorage ヘルパーを追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 同意ダイアログコンポーネント作成

**Files:**
- Create: `src/components/PopularConsentDialog.tsx`

- [ ] **Step 7.1: コンポーネント実装**

`src/components/PopularConsentDialog.tsx`:

```tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface Props {
    isOpen: boolean;
    onCancel: () => void;
    onAccept: () => void;
}

export const PopularConsentDialog: React.FC<Props> = ({ isOpen, onCancel, onAccept }) => {
    useEscapeClose(isOpen, onCancel);
    const { t } = useTranslation();

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
            onClick={onCancel}
        >
            <div
                className="relative glass-tier3 rounded-2xl shadow-2xl w-[400px] max-w-[90vw] p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-app-2xl font-bold text-app-text mb-3">
                    {t('popular_consent.title')}
                </h3>
                <p className="text-app-lg text-app-text-muted leading-relaxed mb-3">
                    {t('popular_consent.body_1')}
                </p>
                <p className="text-app-lg text-app-text-muted leading-relaxed mb-5">
                    {t('popular_consent.body_2')}
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-1.5 rounded-md border border-app-border text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer"
                    >
                        {t('popular_consent.cancel')}
                    </button>
                    <button
                        onClick={onAccept}
                        className="px-4 py-1.5 rounded-md bg-app-blue text-white text-app-md font-bold hover:bg-app-blue-hover transition-all cursor-pointer active:scale-95"
                    >
                        {t('popular_consent.accept')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
```

> i18n キーは Task 9 で 4 言語追加。先に component を作っても、未訳キーは英語フォールバックされるため動作はする。

- [ ] **Step 7.2: ビルド確認**

Run: `rtk tsc --noEmit`
Expected: error なし

- [ ] **Step 7.3: コミット**

```bash
rtk git add src/components/PopularConsentDialog.tsx
rtk git commit -m "$(cat <<'EOF'
feat(consent): 野良主流掲載同意ダイアログのコンポーネントを追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: ShareModal にダイアログ統合

**Files:**
- Modify: `src/components/ShareModal.tsx`

- [ ] **Step 8.1: import を追加**

```tsx
import { PopularConsentDialog } from './PopularConsentDialog';
import { hasPopularConsent, setPopularConsent } from '../lib/popularConsent';
```

- [ ] **Step 8.2: state と保留 POST 用 ref を追加**

`useState` 群に追加：
```tsx
const [consentOpen, setConsentOpen] = useState(false);
const pendingPostRef = useRef<(() => void) | null>(null);
```

- [ ] **Step 8.3: `useEffect` 内の `generateShareUrl()` 呼び出しを書き換え**

```tsx
useEffect(() => {
    if (!isOpen) return;
    useTutorialStore.getState().completeEvent('share:modal-opened');
    setShareUrl(null);
    setOgImageUrl(null);
    setImageLoaded(false);
    setCopied(false);

    if (hasPopularConsent()) {
        generateShareUrl();
    } else {
        pendingPostRef.current = generateShareUrl;
        setConsentOpen(true);
    }
}, [isOpen]);
```

- [ ] **Step 8.4: 同意ハンドラを実装**

```tsx
const handleConsentAccept = () => {
    setPopularConsent();
    setConsentOpen(false);
    const fn = pendingPostRef.current;
    pendingPostRef.current = null;
    if (fn) fn();
};

const handleConsentCancel = () => {
    setConsentOpen(false);
    pendingPostRef.current = null;
    onClose(); // モーダル全体を閉じる（共有を中止）
};
```

- [ ] **Step 8.5: render 末尾に Dialog を差し込む**

`return (<>` 直後の portal の隣（`{createPortal(...)}` の後）に追加：

```tsx
<PopularConsentDialog
    isOpen={consentOpen}
    onAccept={handleConsentAccept}
    onCancel={handleConsentCancel}
/>
```

- [ ] **Step 8.6: 動作確認**

`rtk npm run dev` でブラウザで:
- localStorage クリア → 共有モーダルを開く → 同意ダイアログが先に出ること
- 「理解して共有する」を押す → ダイアログが閉じて OGP 生成が走ること
- 同じセッションでもう一度モーダルを開く → ダイアログは出ず、OGP 即生成
- localStorage で `lopo.popularDisplayConsent` が `1` になっていること
- キャンセル時：モーダル全体が閉じる、Firestore に POST されないこと（DevTools Network で確認）

- [ ] **Step 8.7: コミット**

```bash
rtk git add src/components/ShareModal.tsx
rtk git commit -m "$(cat <<'EOF'
feat(consent): 共有モーダルから初回のみ同意ダイアログを表示

POST 直前で localStorage の同意フラグを確認し、未取得なら
PopularConsentDialog を表示。承認で POST 続行、キャンセルで
モーダルを閉じる。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 常駐キャプション + i18n（4 言語）追加

**Files:**
- Modify: `src/components/ShareModal.tsx`
- Modify: `src/locales/ja.json`、`en.json`、`zh.json`、`ko.json`

- [ ] **Step 9.1: 4 言語に i18n キー追加**

各 `src/locales/{lang}.json` のトップレベルに `popular_consent` セクションを新設、`app` セクションに `popular_display_notice` を追加。

ja.json:
```json
"popular_consent": {
    "title": "共有について",
    "body_1": "共有したプランは、個人を特定できない形で集計され、人気になると野良主流ページに表示されることがあります。",
    "body_2": "ロゴをONにしている場合、野良主流ページにもロゴ付きで表示されます（チーム宣伝向け）。匿名のままにしたい場合はロゴをOFFにしてから共有してください。",
    "cancel": "キャンセル",
    "accept": "理解して共有する"
},
```

`app` セクション内に追記:
```json
"popular_display_notice": "共有したプランは匿名で集計され、野良主流ページに掲載されることがあります。ロゴ ON の場合は、ロゴも野良主流に表示されます。",
```

en.json:
```json
"popular_consent": {
    "title": "About sharing",
    "body_1": "Shared plans are aggregated anonymously and may appear on the Popular page if they become widely used.",
    "body_2": "If your logo is enabled, it will also appear on the Popular page (good for team promotion). To stay anonymous, turn off the logo before sharing.",
    "cancel": "Cancel",
    "accept": "I understand, share"
},
```

`app` 内:
```json
"popular_display_notice": "Shared plans are aggregated anonymously and may appear on the Popular page. If logo is on, it will also be shown there.",
```

zh.json:
```json
"popular_consent": {
    "title": "关于分享",
    "body_1": "分享的方案将以无法识别个人的形式进行汇总，受欢迎时可能会显示在野良主流页面上。",
    "body_2": "如果开启了标志显示，标志也会一同出现在野良主流页面上（适合团队宣传）。希望保持匿名时，请关闭标志后再分享。",
    "cancel": "取消",
    "accept": "我已了解，分享"
},
```

`app` 内:
```json
"popular_display_notice": "分享的方案会以匿名方式汇总，可能会显示在野良主流页面上。开启标志时，标志也将一同显示。",
```

ko.json:
```json
"popular_consent": {
    "title": "공유에 대해",
    "body_1": "공유한 플랜은 개인을 특정할 수 없는 형태로 집계되며, 인기를 얻으면 야라 주류 페이지에 표시될 수 있습니다.",
    "body_2": "로고를 ON으로 설정한 경우, 야라 주류 페이지에도 로고가 함께 표시됩니다 (팀 홍보용). 익명으로 유지하려면 로고를 OFF로 한 후 공유해 주세요.",
    "cancel": "취소",
    "accept": "이해하고 공유"
},
```

`app` 내:
```json
"popular_display_notice": "공유한 플랜은 익명으로 집계되며, 야라 주류 페이지에 게재될 수 있습니다. 로고 ON일 때는 로고도 함께 표시됩니다.",
```

> 翻訳の最終チェックは実装時にネイティブ感を整える（zh/ko の自然な表現に微調整可）。

- [ ] **Step 9.2: ShareModal に常駐キャプションを追加**

ShareModal 内、ロゴ設定行の下（`{/* UGC注意書き */}` ブロックの上、または下）に挿入:

```tsx
{/* 野良主流掲載に関する常駐通知 */}
<div className="px-5 pb-3 flex items-start gap-1.5 text-app-xs text-app-text-muted leading-relaxed">
    <span className="shrink-0 mt-px">ⓘ</span>
    <p>{t('app.popular_display_notice')}</p>
</div>
```

> ロゴをアップロードしていない（`!user` でロゴセクションが描画されない）ユーザーにも表示する必要があるため、ロゴセクション外側、共有モーダル全体の下部寄りに配置するのが妥当。最終位置は実装時に視覚調整。

- [ ] **Step 9.3: 4 言語で表示確認**

`rtk npm run dev` で言語切替し、:
- 同意ダイアログのタイトル・本文・ボタン文言が崩れずに表示されるか
- 共有モーダル下部の常駐キャプションが英語モードでも長すぎず収まるか
- 中韓フォントの行間が極端に空かないか

- [ ] **Step 9.4: ビルド + コミット**

```bash
rtk npm run build
rtk git add src/components/ShareModal.tsx src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
rtk git commit -m "$(cat <<'EOF'
feat(consent): 同意ダイアログと常駐キャプションの 4 言語訳を追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 最終ビルド・テスト・動作確認

**Files:** なし（検証のみ）

- [ ] **Step 10.1: フルビルド**

Run: `rtk npm run build`
Expected: success（warning OK、error 不可）

- [ ] **Step 10.2: 全テスト実行**

Run: `rtk vitest run`
Expected: 全 PASS

- [ ] **Step 10.3: 型チェック**

Run: `rtk tsc --noEmit`
Expected: error なし

- [ ] **Step 10.4: 手動シナリオテスト（dev サーバー）**

`rtk npm run dev` で:

1. **初回共有フロー**: localStorage クリア → 既存プランから共有モーダル → 同意ダイアログ表示 → 「理解して共有する」 → OGP プレビューに **プラン名が描画されていない** こと（コンテンツ名のみ）
2. **2 回目以降**: 同モーダルを開き直す → ダイアログ表示なし、即 OGP 生成
3. **キャンセル動作**: localStorage クリア → 共有モーダル開く → ダイアログでキャンセル → モーダル閉じる、Firestore POST が走らない（Network パネル確認）
4. **ロゴ ON/OFF 動作**: 共有モーダル内ロゴトグル切替 → OGP プレビューが切り替わる、プラン名は常に出ない
5. **野良主流シート**: 軽減ボトムシートを開く → カードに **プラン名が表示されていない** こと
6. **野良主流ページ**: `/popular` を開く → カードに **プラン名が表示されていない** こと
7. **X 共有**: 野良主流ページから X 共有 → ツイート文に **プラン名が含まれない**（コンテンツ名のみ）
8. **言語切替**: 4 言語で同意ダイアログとキャプションが正しく出る

- [ ] **Step 10.5: TODO.md 更新**

`docs/TODO.md` の「現在の状態」セクションに今セッションの内容を追記、「相談したい」セクションから本タスクを除外。

- [ ] **Step 10.6: 完了コミット & デプロイ**

```bash
rtk git add docs/TODO.md
rtk git commit -m "$(cat <<'EOF'
docs(todo): 野良主流 OGP ポリシー整理セッション完了を反映

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
rtk git push
```

Vercel が自動デプロイ。デプロイ完了後、本番でも上記シナリオ 1〜8 を再確認。

---

## 完了基準

- [ ] OGP API（`/api/og`）が `showTitle` パラメータを無視し、常にコンテンツ名のみで描画
- [ ] 共有モーダルから「プラン名を共有画像に表示」トグルが消失
- [ ] 野良主流シートと野良主流ページのカードからプラン名が消失
- [ ] X 共有テキストにプラン名が含まれない
- [ ] localStorage 未同意ユーザーが共有しようとした初回のみ、同意ダイアログが表示される
- [ ] 共有モーダル下部に常駐キャプションが 4 言語表示される
- [ ] 全 vitest 緑、`tsc --noEmit` 通過、`npm run build` 成功
- [ ] 本番デプロイ後、シナリオ 1〜8 が動作

---

## 非対象（このプランでは扱わない）

- ユーザー個別の同意撤回機能（設定画面で off にできるトグル等）
- 既存共有エントリーへのマイグレーション（`showTitle` フィールドの削除等）— Firestore に残ったままでも実害なし、放置可
- ロゴトグルのデフォルト値変更
- `consentedToPopularDisplay` を Firestore ユーザードキュメントに保存（端末ローカルで充分と判断）
