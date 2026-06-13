# 共同編集 ジョイナー viewer mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ジョイナー画面(`/collab/:roomToken`)を本物の編集画面と同一の見た目にする — 本物の `ConsolidatedHeader`/`Timeline`/フッター/外周クロームを読み取り専用で再利用し、操作禁止は `cursor-not-allowed` で塞ぐ(業界標準=同一UI+read-onlyフラグ・一次情報確認済)。あわせて編集解禁バグ・人数上限バグを修正し、参加者ドットを追加。

**Architecture:** 方式B=Layout の自動保存機構は mount せず、本物の表示部品(ヘッダー/フッター/表/クローム)だけを `viewer`/read-only モードで再利用。`usePlanStore`・`planPersist`・Layout 自動保存 subscribe には一切触れない(メインアプリ byte-for-byte 不変・実ユーザー100%無傷)。read-only はサーバ側で既に拒否済(④-a)で、本計画はクライアントUI層と編集解禁の token 更新を直す。

**Tech Stack:** React 18 + TS + Zustand + i18next + Tailwind v4 + Vitest(happy-dom)。Cloudflare Worker(y-partyserver) for 人数上限。設計書=[docs/superpowers/specs/2026-06-13-collab-joiner-viewer-mode-design.md](../specs/2026-06-13-collab-joiner-viewer-mode-design.md)。

**前提:** branch `feat/collab-public-release`。admin gate で本番一般非露出=作業中も実ユーザー影響ゼロ。

**コミット規約:** `rtk git ...`。テストは `npx vitest run <file> --no-color`(単一ファイル・パイプ禁止 [[reference_vitest_vmthreads_hang]])。build=`rtk npm run build`(EXIT=0必須・strict tsc -b)。メッセージ末尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

## Task 1: フッターを共有部品 `AppFooter` に抽出

**Files:**
- Create: `src/components/AppFooter.tsx`
- Create: `src/components/__tests__/AppFooter.test.tsx`
- Modify: `src/components/Layout.tsx`(:86 の `footerLegalOpen` state を削除 / :686-719 のインラインフッターを `<AppFooter />` に置換)

ねらい: 本物フッターを1コンポーネント化し、Layout とジョイナー両方で同一マークアップを使う(フッターのズレ根治・純粋な抽出=低リスク)。

- [ ] **Step 1: 現状を読む**

[Layout.tsx:686-719](../../../src/components/Layout.tsx#L686) のフッター JSX 全体と、:86 の `const [footerLegalOpen, setFooterLegalOpen] = React.useState(false);`、フッター内で使う i18n キー(`footer.copyright`/`footer.disclaimer`/`footer.legal`/`footer.privacy_policy`/`footer.terms`/`footer.commercial`/`footer.discord`/`footer.x_official`)と `PulseSettings`(あれば)を確認。`<footer className=...>` の className を**逐語**で控える。

- [ ] **Step 2: 失敗するテストを書く**

Create `src/components/__tests__/AppFooter.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppFooter } from '../AppFooter';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('AppFooter', () => {
  it('著作権/免責と法的情報トグルを表示する', () => {
    render(<MemoryRouter><AppFooter /></MemoryRouter>);
    expect(screen.getByText('footer.copyright')).toBeInTheDocument();
    expect(screen.getByText('footer.legal')).toBeInTheDocument();
  });
  it('法的情報を押すとプライバシー/利用規約リンクが出る', () => {
    render(<MemoryRouter><AppFooter /></MemoryRouter>);
    fireEvent.click(screen.getByText('footer.legal'));
    expect(screen.getByText('footer.privacy_policy')).toBeInTheDocument();
    expect(screen.getByText('footer.terms')).toBeInTheDocument();
  });
});
```
注: フッターに `PulseSettings` 等で別 store 依存があれば、テストでは `vi.mock` でスタブ化する(Step 4 実装後に必要なら追加)。

- [ ] **Step 3: テスト失敗を確認**

Run: `npx vitest run src/components/__tests__/AppFooter.test.tsx --no-color`
Expected: FAIL(モジュール未作成)

- [ ] **Step 4: `AppFooter` を実装(Layout のフッターを逐語移植)**

Create `src/components/AppFooter.tsx`: [Layout.tsx:686-719](../../../src/components/Layout.tsx#L686) の `<footer>...</footer>` を**そのまま**移植し、`footerLegalOpen` state をこのコンポーネント内に持つ(`const [footerLegalOpen, setFooterLegalOpen] = React.useState(false);`)。`useTranslation`・`react-router` のリンク(`<a href="/privacy">` 等は現状維持)・`PulseSettings` 等の import も移植。className は逐語コピー。

- [ ] **Step 5: Layout を `<AppFooter />` に置換**

[Layout.tsx](../../../src/components/Layout.tsx): :86 の `footerLegalOpen` state を削除(他で使っていないこと確認)、:686-719 を `<AppFooter />` に置換、import 追加。

- [ ] **Step 6: テスト緑 + build**

Run: `npx vitest run src/components/__tests__/AppFooter.test.tsx --no-color`(PASS) → `rtk npm run build`(EXIT=0)

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/AppFooter.tsx src/components/__tests__/AppFooter.test.tsx src/components/Layout.tsx
rtk git commit -m "refactor(layout): フッターをAppFooter共有部品に抽出(Layout/ジョイナーで再利用)"
```

---

## Task 2: `ConsolidatedHeader` に viewer ソース(コンテンツ名/タイトル)を追加

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx`(viewer プロップ + コンテンツラベル/タイトルのソース分岐)
- Test: `src/components/__tests__/ConsolidatedHeader.viewer.test.tsx`(新規)

ねらい: viewer プロップ指定時はコンテンツ名/タイトルを `usePlanStore` でなく**部屋(ジョイナーセッション)由来**で出す。未指定=現状そのまま(メインアプリ不変)。

- [ ] **Step 1: 現状を読む**

[ConsolidatedHeader.tsx:108-124](../../../src/components/ConsolidatedHeader.tsx#L108)(currentPlan/contentDef/contentLabel/currentContentId)と props の型定義(冒頭の interface)を確認。

- [ ] **Step 2: 失敗するテストを書く**

Create `src/components/__tests__/ConsolidatedHeader.viewer.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));
vi.mock('../../data/contentRegistry', () => ({
  getContentById: (id: string) => (id === 'TEA' ? { name: { ja: '絶アレキサンダー討滅戦', en: 'TEA' } } : undefined),
}));

import { ConsolidatedHeader } from '../ConsolidatedHeader';

describe('ConsolidatedHeader viewer mode', () => {
  it('viewer 指定時は contentId から部屋のコンテンツ名を表示(usePlanStore 非依存)', () => {
    render(<MemoryRouter><ConsolidatedHeader viewer={{ contentId: 'TEA', ownerLabel: null }} /></MemoryRouter>);
    expect(screen.getByText(/絶アレキサンダー討滅戦/)).toBeInTheDocument();
  });
});
```
⚠ ConsolidatedHeader は多数の store/hook に依存する。テストが他依存で落ちる場合は、その依存を `vi.mock` でスタブ化する(描画に必要な最小限)。`ConsolidatedHeader` の現行 props を壊さないよう、`viewer` は**任意**プロップとして足す。

- [ ] **Step 3: テスト失敗を確認**

Run: `npx vitest run src/components/__tests__/ConsolidatedHeader.viewer.test.tsx --no-color`
Expected: FAIL(viewer プロップ未対応 / contentLabel が currentPlan 依存)

- [ ] **Step 4: viewer プロップ + ソース分岐を実装**

[ConsolidatedHeader.tsx](../../../src/components/ConsolidatedHeader.tsx):
- props interface に `viewer?: { contentId: string | null; ownerLabel: string | null }` を追加。
- `const readOnly = props.viewer != null;`(以降の Task 3 でも使用)。
- コンテンツ解決を分岐: viewer 時は `const contentDef = props.viewer.contentId ? getContentById(props.viewer.contentId) : null;`(:109 を viewer 優先に)。`currentContentId` も viewer 時は `props.viewer.contentId`。
- タイトル表示([:175,:199] 付近)は viewer 時 `props.viewer.ownerLabel`(空なら汎用文言 or 非表示)。
- `currentPlan` への参照が viewer 時に `undefined` でも落ちないようにガード(viewer 時は contentDef/title を viewer から取る)。

- [ ] **Step 5: テスト緑 + build**

Run: `npx vitest run src/components/__tests__/ConsolidatedHeader.viewer.test.tsx --no-color`(PASS) → `rtk npm run build`(EXIT=0)

- [ ] **Step 6: 既存ヘッダーテストが緑のまま(回帰なし)を確認**

Run: 既存の ConsolidatedHeader 関連テストがあれば実行(`npx vitest run <その path> --no-color`)。無ければ build の通過で可。viewer 未指定の描画が変わっていないこと。

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/ConsolidatedHeader.tsx src/components/__tests__/ConsolidatedHeader.viewer.test.tsx
rtk git commit -m "feat(collab): ConsolidatedHeaderにviewerソース追加(部屋のコンテンツ名を読み取り専用表示)"
```

---

## Task 3: `ConsolidatedHeader` viewer 時の操作ボタンを禁止カーソル+無効化

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx`
- Test: `src/components/__tests__/ConsolidatedHeader.viewer.test.tsx`(Task 2 のファイルに追加)

ねらい: viewer 時、内容を変えるボタンを `disabled` + `cursor-not-allowed`。閲覧でも安全なボタンは有効維持。

- [ ] **Step 1: 失敗するテストを追加**

`ConsolidatedHeader.viewer.test.tsx` に追加(ボタンの aria-label/text は実コードに合わせる):
```tsx
  it('viewer 時、パーティ編成ボタンは無効(cursor-not-allowed)', () => {
    render(<MemoryRouter><ConsolidatedHeader viewer={{ contentId: 'TEA', ownerLabel: null }} /></MemoryRouter>);
    const btn = screen.getByRole('button', { name: /パーティ編成|party/i });
    expect(btn).toBeDisabled();
  });
```
⚠ 実際のボタンの取得方法(aria-label/text)は [ConsolidatedHeader.tsx:264](../../../src/components/ConsolidatedHeader.tsx#L264) 等の実装に合わせて調整。

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/components/__tests__/ConsolidatedHeader.viewer.test.tsx --no-color`
Expected: 追加分が FAIL

- [ ] **Step 3: viewer 時のボタン無効化を実装**

[ConsolidatedHeader.tsx](../../../src/components/ConsolidatedHeader.tsx) の下記ボタンに `disabled={readOnly}` と、`readOnly` 時 `cursor-not-allowed`(例: `className={`... ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}`)を付与。対象:
  - タイトルダブルクリック編集([:188-200](../../../src/components/ConsolidatedHeader.tsx#L188)) — viewer 時 `onDoubleClick` を無効(早期 return か未バインド)。
  - ShareButtons([:213](../../../src/components/ConsolidatedHeader.tsx#L213))/パーティ編成([:264](../../../src/components/ConsolidatedHeader.tsx#L264))/ステータス設定([:277](../../../src/components/ConsolidatedHeader.tsx#L277))/軽減自動組み立て([:289](../../../src/components/ConsolidatedHeader.tsx#L289))/Import・FFLogs([:299](../../../src/components/ConsolidatedHeader.tsx#L299))/人気プラン([:316](../../../src/components/ConsolidatedHeader.tsx#L316))/自分のジョブをハイライト([:325](../../../src/components/ConsolidatedHeader.tsx#L325))/並び替え([:341](../../../src/components/ConsolidatedHeader.tsx#L341))。
  - **有効維持**(触らない): ホーム([:153](../../../src/components/ConsolidatedHeader.tsx#L153))/テーマ([:225](../../../src/components/ConsolidatedHeader.tsx#L225))/言語([:238](../../../src/components/ConsolidatedHeader.tsx#L238))/ログイン([:242](../../../src/components/ConsolidatedHeader.tsx#L242))/折りたたみ([:373](../../../src/components/ConsolidatedHeader.tsx#L373))。
- ShareButtons は viewer 時そもそも出さない(共有はオーナー機能)か `disabled`。実装は ShareButtons に `disabled` prop が無ければ非表示が簡単。

- [ ] **Step 4: テスト緑 + build**

Run: `npx vitest run src/components/__tests__/ConsolidatedHeader.viewer.test.tsx --no-color`(PASS) → `rtk npm run build`(EXIT=0)

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ConsolidatedHeader.tsx src/components/__tests__/ConsolidatedHeader.viewer.test.tsx
rtk git commit -m "feat(collab): viewer時の操作ボタンを禁止カーソル+無効化(閲覧安全なボタンは維持)"
```

---

## Task 4: 「共同編集中」クラスタ(参加者ドット+カーソル+ジョブ+抜けるボタン)

**Files:**
- Create: `src/components/collab/CollabViewerCluster.tsx`
- Create: `src/components/collab/__tests__/CollabViewerCluster.test.tsx`

ねらい: 本物ヘッダー右に置く「共同編集中」スタイルのまとまり。参加者の光るドット(ホバー名)+ `PresenceControls`(カーソル/ジョブ)+「共同編集を抜ける」ボタン。抜ける=`/` へ遷移。

- [ ] **Step 1: 参加者ドットの材料を確認**

`useCollabPresenceStore`(roster: `RosterEntry[]` = `{clientId, color, isLocal, isEditor}`)と `nameForClient(clientId, adjectives, nouns, sep)`([presence.ts](../../../src/lib/collab/presence.ts))を確認(OwnerCollabPanel の使い方 [:38-40,:132-135](../../../src/components/collab/OwnerCollabPanel.tsx#L38) を踏襲)。

- [ ] **Step 2: 失敗するテストを書く**

Create `src/components/collab/__tests__/CollabViewerCluster.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollabViewerCluster } from '../CollabViewerCluster';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';

const navigate = vi.fn();
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../PresenceControls', () => ({ PresenceControls: () => <div data-testid="presence-controls" /> }));

describe('CollabViewerCluster', () => {
  beforeEach(() => { navigate.mockReset(); useCollabPresenceStore.getState().clear(); });

  it('参加者ドットと抜けるボタンを表示する', () => {
    useCollabPresenceStore.setState({ roster: [{ clientId: 1, color: '#fff', isLocal: true, isEditor: true }] as any });
    render(<CollabViewerCluster />);
    expect(screen.getByTestId('presence-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collab.leave|抜ける/i })).toBeInTheDocument();
  });

  it('抜けるボタンで / へ遷移する', () => {
    render(<CollabViewerCluster />);
    fireEvent.click(screen.getByRole('button', { name: /collab.leave|抜ける/i }));
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
```

- [ ] **Step 3: テスト失敗を確認**

Run: `npx vitest run src/components/collab/__tests__/CollabViewerCluster.test.tsx --no-color`
Expected: FAIL(未作成)

- [ ] **Step 4: i18n キー追加(4言語)**

`src/locales/{ja,en,ko,zh}.json` の `collab` セクションに:
- ja: `"leave": "共同編集を抜ける"` / en: `"leave": "Leave collab"` / ko: `"leave": "공동 편집 나가기"` / zh: `"leave": "退出协作"`
- (「共同編集中」ラベルは既存 `collab.chip_active`/`chip_active_count` を流用)

- [ ] **Step 5: `CollabViewerCluster` を実装**

Create `src/components/collab/CollabViewerCluster.tsx`:
- `useCollabPresenceStore(s => s.roster)` で色付きドットを横並び(`<span>` 円・`box-shadow` で光る感・`title`/tooltip に `nameForClient(...)`。`isLocal` は `collab.roster_you`)。
- `<PresenceControls />`(カーソル/ジョブ)。
- 「共同編集を抜ける」ボタン → `useNavigate()` で `navigate('/')`。`active:scale-95`・白黒トークン。
- 全体を `collab.chip_active`(共同編集中) ラベル付きの glass-tier2 ピル風(OwnerCollabPanel/ShareButtons チップと同トーン)。

- [ ] **Step 6: テスト緑 + build**

Run: `npx vitest run src/components/collab/__tests__/CollabViewerCluster.test.tsx --no-color`(PASS) → `rtk npm run build`(EXIT=0)

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/collab/CollabViewerCluster.tsx src/components/collab/__tests__/CollabViewerCluster.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(collab): 共同編集中クラスタ(参加者ドット+ホバー名+カーソル+抜けるボタン)"
```

---

## Task 5: 編集解禁バグ修正 — readOnly:false 再接続前に token 強制更新 + 診断ログ

**Files:**
- Modify: `src/components/CollabJoinerPage.tsx`(効果B: readOnly:false で接続する直前に `getIdToken(true)`)
- (任意) Modify: `src/lib/collab/collabProvider.ts`(診断ログ)

ねらい: ログイン+同意後に編集が効かない最有力原因(古い token 送出でサーバが viewer 降格)を、editor 接続直前の token 強制更新で解消。原因確定のため一時診断ログも仕込む(後で撤去)。

- [ ] **Step 1: 現状の効果Bを読む**

[CollabJoinerPage.tsx:103-154](../../../src/components/CollabJoinerPage.tsx#L103) の効果B(`startCollabSession(roomToken, {readOnly: !canEdit, ...})`)を確認。Layout の token 強制更新例 [Layout.tsx:516-524](../../../src/components/Layout.tsx#L516)(`getIdToken(true)`)を確認。

- [ ] **Step 2: token 強制更新を実装**

効果B の中で、`canEdit === true`(editor 接続)になる時、`startCollabSession` を呼ぶ**直前に** Firebase の現ユーザーで `await getIdToken(true)`(強制リフレッシュ)を1回行ってから接続する。firebase は動的 import(`const { auth } = await import('../firebase'); await auth.currentUser?.getIdToken(true);`)で遅延境界を保つ。effect 内の async は内部関数でラップ(cleanup と整合)。**効果Aと cleanup 順序は触らない**。

- [ ] **Step 3: 一時診断ログ(原因確定用・後で撤去)**

`collabProvider.ts` の params 取得部([:133-138](../../../src/lib/collab/collabProvider.ts#L133))で、`console.info('[collab] sending token?', !!token)` 程度の一時ログ(本番admin gate内で1回確認用)。**コミットメッセージに「診断ログ・後続コミットで撤去」と明記**。

- [ ] **Step 4: build + 既存ジョイナーテスト緑**

Run: `npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx --no-color`(PASS) → `rtk npm run build`(EXIT=0)

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/CollabJoinerPage.tsx src/lib/collab/collabProvider.ts
rtk git commit -m "fix(collab): editor接続直前にIDトークン強制更新(ログイン直後編集不可を解消)+診断ログ(後で撤去)"
```

---

## Task 6: 人数上限を動いてる部屋へ即時反映(worker)

**Files:**
- Modify: `workers/collab/src/server.ts`(DO に max 即時更新の内部経路)
- Modify: `workers/collab/src/index.ts` or `api/collab/_roomHandler.ts`(set-max 時に対象 DO へ通知)
- Test: `workers/collab/src/server.test.ts`(max 更新の反映)

ねらい: オーナーが人数変更時、保存だけでなく**動いている DO の `collab:maxParticipants` を即時更新** → 次の接続から新上限が効く(現状は部屋再起動まで古い上限のまま)。

- [ ] **Step 1: 現状を読む**

[server.ts:134-150](../../../workers/collab/src/server.ts#L134)(`/count` と max storage)・[index.ts:23-34](../../../workers/collab/src/index.ts#L23)(rejectIfRoomFull)・set-max の流れ([_roomHandler.ts](../../../api/collab/_roomHandler.ts) → DO は介さず Firestore 更新のみ)を確認。

- [ ] **Step 2: 失敗するテストを書く(worker)**

`workers/collab/src/server.test.ts` に、DO の内部 `/set-max?n=1`(新設)を叩いたら以後 `/count` の max が 1 を返す、というテストを追加(既存 `pollCount` ヘルパ流用):
```ts
it('DO /set-max で動いてる部屋の上限が即時更新される', async () => {
  // 既存パターンで部屋を立ち上げ(seed max=8)後、/set-max?n=1 を叩く
  const stub = ... // 既存テストの DO 取得方法に合わせる
  await SELF.fetch('https://collab.test/parties/room/live-max/set-max?n=1', { method: 'POST', headers: { 'x-partykit-room': 'live-max' } });
  const { max } = await pollCount('live-max');
  expect(max).toBe(1);
});
```
⚠ 既存テストの DO 起動/ヘッダ付与の作法に合わせて調整。認証は内部経路なので `x-collab-secret` で保護(server↔Vercel と同様)。

- [ ] **Step 3: テスト失敗を確認**

Run(workers ディレクトリ): `cd workers/collab && npx vitest run src/server.test.ts --no-color`
Expected: FAIL(/set-max 未実装)

- [ ] **Step 4: DO に `/set-max` を実装**

[server.ts](../../../workers/collab/src/server.ts) の fetch ハンドラ(`/count` を返している所)に `/set-max` を追加: `x-collab-secret` 検証 → `n` を `resolveMaxParticipants` でクランプ → `this.ctx.storage.put(MAX_PARTICIPANTS_KEY, n)`。

- [ ] **Step 5: set-max 時に対象 DO へ通知**

オーナーの人数変更経路で、Firestore 更新に加えて対象部屋 DO の `/set-max` を best-effort で叩く。worker 側(`index.ts` か新ハンドラ)で `env.Room.get(idFromName(roomToken)).fetch('.../set-max?n=...', {secret})`。受付係(Vercel)は DO に直接到達できないため、**クライアント→worker の set-max 経路**を1本足すのが綺麗(`collabRoomApi.setMaxParticipants` がworkerの管理エンドポイントも叩く、または worker に管理アクション追加)。実装は最小: worker に `POST /parties/room/<token>/set-max` を受けて DO storage を更新する経路。クライアント `setMaxParticipants` 成功後にこの worker 経路も呼ぶ。

- [ ] **Step 6: テスト緑 + worker build**

Run: `cd workers/collab && npx vitest run src/server.test.ts --no-color`(PASS)。root build も `rtk npm run build`(EXIT=0・クライアント側 set-max 経路の型)。

- [ ] **Step 7: Commit**

```bash
rtk git add workers/collab/src/server.ts workers/collab/src/index.ts src/lib/collab/collabRoomApi.ts workers/collab/src/server.test.ts
rtk git commit -m "fix(collab): 人数上限を動いてる部屋へ即時反映(DO /set-max・部屋再起動を待たない)"
```

---

## Task 7: ジョイナーシェルを本物部品に差し替え + 外周クローム(統合)

**Files:**
- Modify: `src/components/CollabJoinerPage.tsx`(sheet ビューを本物ヘッダー/フッター/クロームへ)
- Delete: `src/components/CollabJoinerHeader.tsx` + その test(Task 4-5 初版で作った手作りヘッダーを撤去)

ねらい: ジョイナーの sheet ビューを「本物 `ConsolidatedHeader`(viewer)+ `CollabViewerCluster` + `Timeline` + 赤バナー + `AppFooter` + 左折りたたみハンドル/右端装飾(読み取り専用)」に。**効果A/Bの useEffect・cleanup は触らない**(JSX のみ)。font-sans 維持。

- [ ] **Step 1: 本物の外周クロームを確認**

[Layout.tsx:567-590](../../../src/components/Layout.tsx#L567)(app-shell + Sidebar)と [:727](../../../src/components/Layout.tsx#L727) 付近(右端装飾の `motion.div` width animate)を読み、折りたたみハンドル/右端バーの**見た目だけ**を抜き出す方法を決める(本物部品の流用 or 静的再現)。Sidebar のプラン一覧は展開しない(折りたたみ固定)。

- [ ] **Step 2: sheet ビューJSXを差し替え**

[CollabJoinerPage.tsx](../../../src/components/CollabJoinerPage.tsx) の sheet ビュー `return`:
- ルート: `<div className="collab-joiner-shell font-sans text-app-text w-full h-screen overflow-hidden bg-app-bg flex flex-col">`
- 先頭: `<ConsolidatedHeader viewer={{ contentId, ownerLabel }} />`(`useCollabJoinerSession` から contentId/ownerLabel)。ヘッダー右の「共同編集中」エリアに `<CollabViewerCluster />` が入るよう ConsolidatedHeader 側に viewer 用スロット/差し込みを用意(or CollabJoinerPage 側でヘッダー下の bar に置く — 実装で本物の見た目に最も近い配置を選ぶ)。
- 中央: 左に**折りたたみサイドバーハンドル**(読み取り専用・押下禁止 or 抜ける導線)、中身に `<ErrorBoundary><Timeline /></ErrorBoundary>`、右端に**右端装飾**。
- 末尾: `<CollabJoinerBanner ... onLogin={() => setLoginOpen(true)} />`(画面下)→ `<AppFooter />` → モーダル(`LoginModal`/`CollabEditConsentModal`)。
- **手作り `CollabJoinerHeader` の import と使用を削除**。

- [ ] **Step 3: `CollabJoinerHeader` を削除**

`src/components/CollabJoinerHeader.tsx` と `src/components/__tests__/CollabJoinerHeader.test.tsx` を削除(本物ヘッダーに置換され不要)。

- [ ] **Step 4: 既存ジョイナーテスト緑 + build**

Run: `npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx --no-color`(PASS) → `rtk npm run build`(EXIT=0・削除した CollabJoinerHeader の参照残りが無いこと)。

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/CollabJoinerPage.tsx
rtk git rm src/components/CollabJoinerHeader.tsx src/components/__tests__/CollabJoinerHeader.test.tsx
rtk git commit -m "feat(collab): ジョイナーを本物UI(ConsolidatedHeader viewer+AppFooter+外周クローム)で読み取り専用再利用・手作りヘッダー撤去"
```

---

## Task 8: 実機 E2E(⑤-3d)→ 診断ログ撤去 → ゲート撤去 → 公開(ユーザーと)

**Files:** 状況に応じて(診断ログ撤去・`ShareButtons.tsx` ゲート)

> ⚠ ここはユーザーと一緒に。Worker 変更あり(Task 6)= `cd workers/collab && wrangler deploy` を**先に**。

- [ ] **Step 1: Worker 再デプロイ + Vercel 反映**

`cd workers/collab && wrangler deploy` → `rtk git push origin HEAD:main`(検証用)。

- [ ] **Step 2: 2ブラウザ E2E(設計書 §6 DoD)**

本物表で: 見た目同一(ヘッダー/フッター/クローム/フォント)/禁止カーソル/「共同編集中」クラスタ+抜ける→自分の画面へ/ログイン+同意で**編集できる**(診断ログで token 送出確認)/人数1で2人目満員/参加者ドット+ホバー名。1件ずつ修正→再検証。

- [ ] **Step 3: 診断ログ撤去**

Task 5 の `console.info` を削除してコミット。

- [ ] **Step 4: admin gate 撤去(最後)**

[ShareButtons.tsx:34,46](../../../src/components/ShareButtons.tsx#L34): `const { user } = useAuthStore();` / `if (!user) { setView('copy'); return; }`。テスト更新(ログインで2択・未ログインでコピー直行)。build。

- [ ] **Step 5: 公開**

`rtk git push origin HEAD:main` → 本番スモーク → 数日計測。TODO/memory 更新・完了タスクを TODO_COMPLETED へ。

---

## 自己レビュー結果

**スペック網羅:**
- §2.1 AppFooter 抽出 → Task 1 ✅
- §2.2 ConsolidatedHeader viewer ソース → Task 2 ✅
- §2.2 viewer ボタン無効化(禁止カーソル) → Task 3 ✅
- §2.3 シェル差し替え(本物ヘッダー/フッター) → Task 7 ✅
- §2.3b 外周クローム(折りたたみハンドル/右端装飾) → Task 7 Step1-2 ✅
- §2.4 共同編集中クラスタ+参加者ドット+抜ける → Task 4(+Task 7 で配置) ✅
- §3.1 編集バグ(token 強制更新) → Task 5 ✅
- §3.2 人数上限即時反映 → Task 6 ✅
- §4 非ゴール(サイドバー展開しない/usePlanStore 不変) → Task 7 で折りたたみ固定・Layout 自動保存 非mount ✅
- §7 公開手順(ゲート最後) → Task 8 ✅

**型整合:** `viewer?: { contentId: string|null; ownerLabel: string|null }` を Task 2/3/7 で一貫使用。`readOnly = viewer != null` を Task 2 で定義し Task 3 で使用。`CollabViewerCluster` を Task 4 で定義し Task 7 で配置。`AppFooter` を Task 1 で定義し Task 7 で使用。

**プレースホルダ:** コード/テスト/コマンドは具体。Task 3/6/7 は既存実装の line 参照に合わせた調整指示(skilled developer 前提・実ファイルが source of truth)であり TBD ではない。Task 8 はユーザー同席の検証/公開(コード新規無し)。

**リスク注記:** Task 2/3 は本物 ConsolidatedHeader を編集=メインアプリ影響。viewer 未指定=現状不変を**各 build + 既存テスト緑**で担保。Task 7 は漏洩防止 useEffect を触らない(JSX のみ)。
