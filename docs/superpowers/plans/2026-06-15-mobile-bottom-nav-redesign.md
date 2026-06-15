# スマホ ボトムナビ再設計 (A) 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホのボトムナビを 5 タブ `メニュー / インポート / カンペ / 共有 / ログイン` に再設計し、パーティ編成・自動組み立て・支援をメニューへ集約、Undo/Redo を FAB 近くに常設、ツール文言を PC と同じ i18n キーに統一する。

**Architecture:** 既存のシート(メニュー=Sidebar / パーティ=MobilePartyWithTabs / ツール→インポート=Timeline 内 MobileBottomSheet / カンペ=PipView / アカウント=MobileAccountMenu)は極力そのまま再利用し、**入口(ボトムナビのタブと配線)だけ組み替える**最小改修方針。パーティシートは廃止せずメニュー内ボタンから開く。Undo/Redo は Timeline 内で `canUndo/canRedo/readOnly` を持っているので Timeline から fixed 描画する(配線ゼロ・DRY)。

**Tech Stack:** React 18 + TypeScript, Tailwind v4, framer-motion, zustand, react-i18next, lucide-react。

**確定した設計判断(ユーザー承認済 2026-06-15):**
1. パーティ編成 = 既存シートを残し、メニュー内ボタンから開く(埋め込みはしない)
2. MY JOB トグル = パーティ編成シートの**上部**へ移設(nav からは廃止)
3. 共有タブ = A では枠のみ。中身は B で設計。**デプロイは A+B 完了後**なのでプレースホルダがユーザーに露出することはない
4. Undo/Redo = FAB の**左**に**横並び(案ア)で確定**。FAB メニューが真上に展開するため真上配置は不可。最終位置・サイズは実機で微調整
5. 支援(あ案) = メニュー内の**下部**に、開いた瞬間から常に見える形で配置

**非ゴール:** B の共有配布フロー詳細 / タブレット専用レイアウト / 支援のタイムライン本体露出。

---

## File Structure

| ファイル | 役割 | この計画での変更 |
|---|---|---|
| `src/locales/{ja,en,ko,zh}.json` | i18n | `nav.import` / `nav.cue` / `nav.share` 追加、`mobile.import_title` 追加 |
| `src/components/MobileBottomNav.tsx` | ボトムナビ本体 | 5 タブに刷新(party/myjob 撤去、import/cue/share 追加)、props 刷新 |
| `src/components/Layout.tsx` | シート配線 | nav ハンドラ刷新、共有シート(枠)追加、`mobileShareOpen` state 追加、Sidebar に party/autoplan コールバック注入 |
| `src/components/Timeline.tsx` | インポートシート + Undo/Redo 常設 | ツールシート→インポートシート(Undo/Redo・Auto Plan 撤去、文言キー化、タイトル変更)、FAB 左に Undo/Redo 常設を fixed 描画 |
| `src/components/Sidebar.tsx` | メニュー中身 | fullWidth(スマホ)時のみ「パーティ編成」「自動組み立て」ボタン追加、支援を下部常時可視に |
| `src/components/MobilePartySettings.tsx` | パーティシート中身 | `MobilePartyWithTabs` 上部に MY JOB ハイライトトグル追加 |
| `src/components/MobileFAB.tsx` | FAB | カンペ項目を撤去(ナビ昇格) |

新規ファイルは作らない(Undo/Redo は Timeline 内 fixed 描画で対応)。

---

## Task 1: i18n キー追加(4 言語)

**Files:**
- Modify: `src/locales/ja.json:1273`(nav ブロック)/ `mobile` ブロック
- Modify: `src/locales/en.json:1269`(nav ブロック)/ `mobile` ブロック
- Modify: `src/locales/ko.json`(nav / mobile ブロック)
- Modify: `src/locales/zh.json`(nav / mobile ブロック)

- [ ] **Step 1: ja.json の nav ブロックにキー追加**

`src/locales/ja.json` の `"nav": { ... }`(1273 行〜)で `"tools": "ツール",` の直後に追加:

```json
        "import": "インポート",
        "cue": "カンペ",
        "share": "共有",
```

同ファイルの `"mobile": { ... }`(`"tools_title": "ツール"` がある 1250 行付近)に追加:

```json
        "import_title": "インポート",
```

- [ ] **Step 2: en.json に同じキー(英語値)**

`"nav"`(1269 行〜)に追加:

```json
        "import": "Import",
        "cue": "Cue",
        "share": "Share",
```

`"mobile"` に追加:

```json
        "import_title": "Import",
```

- [ ] **Step 3: ko.json に同じキー(韓国語値)**

`"nav"` ブロックに追加(既存 nav 項目の体裁に合わせる):

```json
        "import": "가져오기",
        "cue": "치트시트",
        "share": "공유",
```

`"mobile"` に追加:

```json
        "import_title": "가져오기",
```

- [ ] **Step 4: zh.json に同じキー(中国語値)**

`"nav"` ブロックに追加:

```json
        "import": "导入",
        "cue": "速查表",
        "share": "分享",
```

`"mobile"` に追加:

```json
        "import_title": "导入",
```

- [ ] **Step 5: JSON 妥当性確認**

Run: `node -e "['ja','en','ko','zh'].forEach(l=>{const o=require('./src/locales/'+l+'.json');if(!o.nav.import||!o.nav.cue||!o.nav.share||!o.mobile.import_title)throw new Error(l+' missing key');});console.log('ok')"`
Expected: `ok`(JSON パースエラーなし・全キー存在)

- [ ] **Step 6: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(nav): スマホボトムナビ用 import/cue/share + import_title キー追加(4言語)"
```

---

## Task 2: MobileBottomNav を 5 タブに刷新

**Files:**
- Modify: `src/components/MobileBottomNav.tsx`(全面)

**新タブ(順番固定):** `メニュー(Menu) / インポート(CloudDownload) / カンペ(PictureInPicture2) / 共有(Share2) / ログイン(LogIn or avatar)`

- [ ] **Step 1: props インターフェースを刷新**

`MobileBottomNavProps`(10-18 行)を置換:

```tsx
interface MobileBottomNavProps {
    onMenuToggle: () => void;
    onImportToggle: () => void;
    onCueToggle: () => void;
    onShareToggle: () => void;
    onLoginOpen: () => void;
    activeTab?: string;
}
```

`onPartyOpen` / `onToolsOpen` / `myJobHighlight` / `onMyJobHighlightToggle` を削除。

- [ ] **Step 2: アイコン import を差し替え**

3 行目を置換:

```tsx
import { Menu, CloudDownload, PictureInPicture2, Share2, LogIn } from 'lucide-react';
```

(`Users` / `Eye` / `Wrench` を削除、`CloudDownload` / `PictureInPicture2` / `Share2` を追加)

- [ ] **Step 3: コンポーネント引数と items 配列を刷新**

20-23 行の分割代入を置換:

```tsx
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onMenuToggle, onImportToggle, onCueToggle, onShareToggle, onLoginOpen, activeTab
}) => {
```

`items` 配列(28-73 行)を置換:

```tsx
    const items = [
        {
            id: 'menu',
            icon: <Menu size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.menu'),
            onClick: onMenuToggle,
            active: activeTab === 'menu',
        },
        {
            id: 'import',
            icon: <CloudDownload size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.import'),
            onClick: onImportToggle,
            active: activeTab === 'import',
        },
        {
            id: 'cue',
            icon: <PictureInPicture2 size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.cue'),
            onClick: onCueToggle,
            active: activeTab === 'cue',
        },
        {
            id: 'share',
            icon: <Share2 size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.share'),
            onClick: onShareToggle,
            active: activeTab === 'share',
        },
        {
            id: 'login',
            icon: profileAvatarUrl ? (
                <img
                    src={profileAvatarUrl}
                    alt=""
                    className="rounded-full object-cover"
                    style={{ width: MOBILE_TOKENS.bottomNav.iconSize, height: MOBILE_TOKENS.bottomNav.iconSize }}
                />
            ) : (
                <LogIn size={MOBILE_TOKENS.bottomNav.iconSize} />
            ),
            label: user ? t('nav.account') : t('nav.login'),
            onClick: onLoginOpen,
            active: activeTab === 'login',
        },
    ];
```

- [ ] **Step 4: myjob 専用の黄色ハイライトを撤去**

スライディングインジケータ(92-102 行)の `backgroundColor` を単純化:

```tsx
                    style={{
                        width: `${100 / items.length}%`,
                        backgroundColor: 'var(--color-app-text)',
                    }}
```

各ボタンの active 文字色(112-115 行)を単純化:

```tsx
                        item.active ? "text-app-text" : "text-app-text/40"
```

(`item.id === 'myjob' ? "text-yellow-500"` の分岐を削除)

- [ ] **Step 5: tsc で型確認**

Run: `rtk tsc`
Expected: `MobileBottomNav.tsx` 起因のエラーは出ない(Layout.tsx 側はまだ旧 props を渡しているのでそこはエラーになる → Task 3 で解消。MobileBottomNav 単体の型は通る想定。Layout のエラーは Task 3 まで残る)

> 注: このタスク単独では Layout.tsx が旧 props を渡したままなので build は赤。Task 3 とセットでコミットしても良いが、レビュー単位を分けるため本タスクはここで止め、Step 6 のコミットは Task 3 完了後にまとめて行う。**→ 本タスクは未コミットのまま Task 3 へ進む。**

---

## Task 3: Layout.tsx の nav 配線刷新 + 共有シート(枠)追加

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: 共有シート用 state を追加**

`const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);`(88 行)の近くに追加:

```tsx
    const [mobileShareOpen, setMobileShareOpen] = React.useState(false);
```

- [ ] **Step 2: MobileBottomNav の呼び出しを新 props に差し替え**

785-816 行の `<MobileBottomNav ... />` を置換。カンペは既存イベント `mobile:open-cue-sheet`、インポートは `mobileToolsOpen`(=インポートシート)を再利用:

```tsx
            {!isTutorialActive && <MobileBottomNav
                onMenuToggle={() => {
                    const next = !mobileMenuOpen;
                    setMobileMenuOpen(next);
                    if (next) { setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                }}
                onImportToggle={() => {
                    const next = !mobileToolsOpen;
                    setMobileToolsOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                }}
                onCueToggle={() => {
                    setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false);
                    window.dispatchEvent(new Event('mobile:open-cue-sheet'));
                }}
                onShareToggle={() => {
                    const next = !mobileShareOpen;
                    setMobileShareOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                }}
                onLoginOpen={() => {
                    const authUser = useAuthStore.getState().user;
                    if (authUser) {
                        const next = !mobileAccountOpen;
                        setMobileAccountOpen(next);
                        if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                    } else {
                        setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false);
                        window.dispatchEvent(new Event('mobile:close-miti-flow'));
                        setMobileLoginModalOpen(true);
                    }
                }}
                activeTab={mobileMenuOpen ? 'menu' : mobileToolsOpen ? 'import' : mobileShareOpen ? 'share' : mobileAccountOpen ? 'login' : undefined}
            />}
```

> 注: カンペ(`mobileCueSheet`)はフルスクリーン表示で `activeTab` の点灯対象にしない(開いている間はナビ自体が隠れるフルスクリーンのため)。点灯は menu/import/share/login のみ。

- [ ] **Step 3: 共有シート(枠)を追加**

アカウントシート(`<MobileBottomSheet isOpen={mobileAccountOpen} ...>`、822-829 行)の直後に、共有シートの枠を追加。**中身は B で実装するため、A ではプレースホルダ**:

```tsx
            {/* Mobile: 共有シート（枠のみ・中身は B で設計） */}
            <MobileBottomSheet
                isOpen={mobileShareOpen}
                onClose={() => setMobileShareOpen(false)}
                title={t('nav.share')}
                height="auto"
            >
                <div className="py-10 text-center text-app-text-muted text-app-base">
                    {/* TODO(B): コピー配布 / 共同編集配布 + 複数選択フロー */}
                    Coming soon
                </div>
            </MobileBottomSheet>
```

> 補足: この `Coming soon` プレースホルダは A+B 完了までデプロイされないためユーザーには露出しない(TODO.md「push/deploy 保留」方針)。B 着手時にこの中身を差し替える。

- [ ] **Step 4: build で配線確認**

Run: `rtk npm run build`
Expected: EXIT 0(Task 2 の MobileBottomNav 新 props と Layout の呼び出しが一致し、型エラー解消)

- [ ] **Step 5: 既存テスト緑確認**

Run: `rtk vitest run`
Expected: 既知 5 失敗(TopBar 4 + HousingWorkspace 1)のみ。新規失敗なし。

- [ ] **Step 6: コミット(Task 2 + Task 3 まとめて)**

```bash
rtk git add src/components/MobileBottomNav.tsx src/components/Layout.tsx
rtk git commit -m "feat(mobile-nav): ボトムナビを5タブ(メニュー/インポート/カンペ/共有/ログイン)へ刷新 + 共有シート枠"
```

- [ ] **Step 7: 実機チェックポイント①(ナビ骨組み)**

狭幅ブラウザ(またはスマホ実機)で確認:
- ボトムナビが 5 タブ表示・順番が `メニュー/インポート/カンペ/共有/ログイン`
- メニュー → Sidebar シート / インポート → 旧ツールシート(中身は次タスクで整理)/ カンペ → フルスクリーン PipView / 共有 → Coming soon シート / ログイン → アカウント or ログインモーダル
- アクティブタブのインジケータが正しいタブに乗る(黄色特例が消えている)
- 言語切替で 5 タブのラベルが各言語で出る

---

## Task 4: ツールシート → インポートシートへ整理(Timeline.tsx)

**Files:**
- Modify: `src/components/Timeline.tsx:3739-3814`(MobileBottomSheet 内)

整理方針: **Undo/Redo を撤去**(Task 5 で FAB 近接へ常設)、**Auto Plan を撤去**(Task 6 でメニューへ)、**FFLogs / みんなの軽減表を残す**、文言を PC と同じ i18n キーに統一、タイトルを `mobile.import_title` に。

- [ ] **Step 1: シートのタイトルを変更**

3742 行を置換:

```tsx
                title={t('mobile.import_title')}
```

- [ ] **Step 2: Undo/Redo ブロックと Auto Plan ブロックを撤去**

3745-3799 行(`<div className="flex flex-col gap-3">` 直下の Undo/Redo 行 + divider + FFLogs ボタン + Auto Plan ボタン)のうち、**Undo/Redo の `<div className="flex gap-2">...</div>`(3746-3767)と直後の divider(3769-3772)、Auto Plan ボタン(3787-3799)を削除**。FFLogs ボタン(3774-3786)と みんなの軽減表ボタン(3801-3812)は残す。

結果、シート内は以下の構造にする(3745-3813 を置換):

```tsx
                <div className="flex flex-col gap-3">
                    {/* FFLogs Import */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setImportModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-app-text/5 border border-app-border text-app-text hover:bg-app-text/10 cursor-pointer"
                    >
                        <CloudDownload size={20} />
                        <div className="text-left">
                            <div className="text-app-2xl font-bold">FF Logs</div>
                            <div className="text-app-base text-app-text-muted">{t('fflogs.tooltip_generate')}</div>
                        </div>
                    </button>
                    {/* Popular Plans — みんなの軽減表ボトムシートを開く */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setIsMitiSheetOpen(true);
                        }}
                        className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-app-border hover:bg-app-surface2 transition-colors"
                    >
                        <div>
                            <p className="text-app-2xl font-bold text-app-text">{t('popular.open_popular')}</p>
                            <p className="text-app-lg text-app-text-muted">{t('popular.subtitle')}</p>
                        </div>
                    </button>
                </div>
```

> 文言キー化: FFLogs のベタ書き `"FFLogs Import"` / `t('mobile.fflogs_desc')` を **ブランド表記 "FF Logs" + `fflogs.tooltip_generate`** に統一(spec 指定)。みんなの軽減表は元から `popular.open_popular` / `popular.subtitle` なので維持。

- [ ] **Step 3: 未使用 import の整理**

3745-3814 の整理で `Undo2` / `Redo2` / `Sparkles` がこのシート内で未使用になるが、**Undo/Redo は Task 5 で同ファイル内に再利用、`Sparkles` は他で使われていないか確認**。

Run: `rtk grep "Sparkles" src/components/Timeline.tsx`
Expected: Auto Plan ボタン削除後に他参照が無ければ import から `Sparkles` を削除(27 行の lucide import)。他参照があれば残す。

(`Undo2` / `Redo2` は Task 5・既存の Area D[2452-2477]・既存ショートカットで使うので削除しない)

- [ ] **Step 4: build 確認**

Run: `rtk npm run build`
Expected: EXIT 0(未使用 import エラーなし)

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(mobile-import): ツールシートをインポートシート化(Undo/Redo・Auto Plan撤去・FFLogs/みんなの軽減表を文言キー統一)"
```

- [ ] **Step 6: 実機チェックポイント②(インポートシート)**

- インポートタブ → タイトル「インポート」、中身は FFLogs(「FF Logs」+「からタイムラインを生成」)と みんなの軽減表の 2 項目のみ
- Undo/Redo・Auto Plan がシートから消えている
- FFLogs タップで取込モーダル / みんなの軽減表タップで MitigationSheet が開く

---

## Task 5: Undo/Redo を FAB 左に常設(Timeline.tsx から fixed 描画)

**Files:**
- Modify: `src/components/Timeline.tsx`(モバイル描画部に fixed 要素を追加)

方針: Timeline は `canUndo`(603 行)/ `canRedo`(604 行)/ `readOnly`(578 行)を既に持つので、ここから FAB 左に fixed の Undo/Redo ペアを描画する(配線ゼロ)。FAB は Layout で `bottom-20 right-4`、サイズ `MOBILE_TOKENS.fab.size`。Undo/Redo はその左に置く(**案ア=横並び既定**)。

- [ ] **Step 1: インポートシートの直前(または Timeline の return 直下の適切な位置)に常設 Undo/Redo を追加**

`<MobileBottomSheet isOpen={mobileToolsSheetOpen} ...>`(3739 行)の直前に追加:

```tsx
            {/* スマホ: FAB 左に Undo/Redo 常設（編集系は常設ツールバー・ナビ枠を消費しない） */}
            <div
                className="fixed z-[300] md:hidden flex items-center gap-2"
                style={{
                    bottom: '5rem', // Layout の FAB(bottom-20)と同じ高さ
                    right: `calc(1rem + ${MOBILE_TOKENS.fab.size}px + 0.75rem)`, // FAB(right-4) の左 + gap
                }}
            >
                <button
                    onClick={() => useMitigationStore.getState().undo()}
                    disabled={!canUndo || readOnly}
                    aria-label={t('timeline.undo')}
                    className="flex items-center justify-center border text-app-text shadow-lg active:scale-90 transition-transform duration-100 disabled:opacity-30 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Undo2 size={18} />
                </button>
                <button
                    onClick={() => useMitigationStore.getState().redo()}
                    disabled={!canRedo || readOnly}
                    aria-label={t('timeline.redo')}
                    className="flex items-center justify-center border text-app-text shadow-lg active:scale-90 transition-transform duration-100 disabled:opacity-30 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Redo2 size={18} />
                </button>
            </div>
```

> `MOBILE_TOKENS` は Timeline.tsx で既に import 済か確認。未 import なら `import { MOBILE_TOKENS } from '../tokens/mobileTokens';` を追加。
> Run: `rtk grep "MOBILE_TOKENS" src/components/Timeline.tsx` で確認。

- [ ] **Step 2: 配置は案ア(横並び)で確定済**

ユーザー承認済(2026-06-15)= 案ア(横並び `flex items-center gap-2`)。縦並びには変更しない。位置・サイズの微調整のみ実機チェックポイント③で行う。

- [ ] **Step 3: build 確認**

Run: `rtk npm run build`
Expected: EXIT 0

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(mobile): Undo/Redo を FAB 左に常設(親指圏・ナビ枠を消費しない)"
```

- [ ] **Step 5: 実機チェックポイント③(Undo/Redo 常設)**

- FAB の左に Undo/Redo が常時表示、FAB メニューを開いても重ならない
- 配置の最終確認(案ア横並び / 案イ縦並び)→ ユーザー判断で Step 2 反映
- 配置・操作可否(履歴ない時 disabled)・ボトムナビと被らない高さか確認
- ボタン押下で実際に undo/redo される

---

## Task 6: メニュー(Sidebar)にパーティ編成・自動組み立てを集約 + 支援を常時可視に

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Layout.tsx:618`(Sidebar にコールバック注入)

方針: メニューシート内の Sidebar は `MobileTriggersContext` の外で描画されている([Layout.tsx:611-620])ため、**props でコールバックを注入**する。パーティ編成・自動組み立てボタンは `fullWidth`(スマホ)時のみ表示。支援は下部で常時可視に。

- [ ] **Step 1: Sidebar の props に onOpenParty / onAutoPlan を追加**

`SidebarProps`(70-76 行)に追加:

```tsx
interface SidebarProps {
    isOpen: boolean;
    onToggle?: () => void;
    onClose?: () => void;
    /** モバイルのボトムシート内で使う場合trueにすると、幅100%・ハンドル非表示になる */
    fullWidth?: boolean;
    /** モバイルメニューから「パーティ編成」シートを開く */
    onOpenParty?: () => void;
    /** モバイルメニューから「自動組み立て」を実行 */
    onAutoPlan?: () => void;
}
```

コンポーネント引数の分割代入にも `onOpenParty` / `onAutoPlan` を追加。

- [ ] **Step 2: fullWidth 時のみ「パーティ編成」「自動組み立て」ボタンを追加**

コントロールボタン領域(1264-1307 行・新規作成/共有選択/削除選択の下)に、`fullWidth` のときだけ表示するブロックを追加:

```tsx
            {fullWidth && (
                <div className="flex flex-col gap-2 px-3 pt-2">
                    <button
                        onClick={() => onOpenParty?.()}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-app-border text-app-text hover:bg-app-text/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                        <Users size={18} />
                        <span className="text-app-base font-semibold">{t('nav.party')}</span>
                    </button>
                    <button
                        onClick={() => onAutoPlan?.()}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-app-border text-app-text hover:bg-app-text/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                        <Sparkles size={18} />
                        <span className="text-app-base font-semibold">{t('mitigation.auto_plan')}</span>
                    </button>
                </div>
            )}
```

> `Users` / `Sparkles` を Sidebar の lucide import に追加(未 import の場合)。Run: `rtk grep "lucide-react" src/components/Sidebar.tsx` で import 行を確認。

- [ ] **Step 3: 支援リンクを「開いた瞬間から見える」常時可視に**

支援リンク(1574-1585 行)は既に親 `overflow-hidden` の外側 `shrink-0` で下部固定だが、`isOpen ? <>☕ ...</> : '☕'` の条件で fullWidth でも `isOpen` 依存。fullWidth(スマホ)では常にフルラベルを出し、視認性を上げる。1582 行を置換:

```tsx
            {(isOpen || fullWidth) ? <>☕ {t('footer.support')}</> : '☕'}
```

支援ブロックの `py-2` を `py-3` にし、上の区切り線を少し強調(下部で埋もれないように)。1576-1577 付近のクラスを:

```tsx
    <div className="shrink-0 flex flex-col items-center py-3">
        <div className="border-t border-app-border w-full mb-2" />
```

> 注: 支援は既に各タブの `flex-1 overflow-y-auto` の外側(下部固定)にあるため、メニューを開いた瞬間から見える構造。レイアウトの大改修はせず、視認性(余白・線・常時フルラベル)のみ強化する。実機で「開いた瞬間に支援が目に入るか」を確認(チェックポイント⑤)。

- [ ] **Step 4: Layout から Sidebar へコールバックを注入**

[Layout.tsx:618] の Sidebar 呼び出しを置換:

```tsx
                    <Sidebar
                        isOpen={true}
                        fullWidth
                        onClose={() => setMobileMenuOpen(false)}
                        onOpenParty={() => { setMobileMenuOpen(false); setMobilePartyOpen(true); }}
                        onAutoPlan={() => { setMobileMenuOpen(false); window.dispatchEvent(new CustomEvent('timeline:autoplan')); }}
                    />
```

> `timeline:autoplan` は [Timeline.tsx:911] で listen 済 → `handleAutoPlan` 実行。パーティは既存の `mobilePartyOpen` シートを開く。

- [ ] **Step 5: build + 既存テスト確認**

Run: `rtk npm run build`
Expected: EXIT 0

Run: `rtk vitest run`
Expected: 既知 5 失敗のみ。新規失敗なし。

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/Sidebar.tsx src/components/Layout.tsx
rtk git commit -m "feat(mobile-menu): メニューにパーティ編成・自動組み立てを集約 + 支援を常時可視化(あ案)"
```

- [ ] **Step 7: 実機チェックポイント④⑤(メニュー集約 + 支援)**

- メニュー(スマホ)に「パーティ」「軽減自動組み立て」ボタンが出る。PC では出ない(fullWidth 限定)
- 「パーティ」タップ → メニューが閉じてパーティシートが開く
- 「軽減自動組み立て」タップ → メニューが閉じて自動配置が走る
- ⑤ 支援(☕)がメニューを開いた瞬間に下部で目に入る(スクロール不要)。タイムライン本体やポップアップでは催促されない

---

## Task 7: パーティシート上部に MY JOB トグル

**Files:**
- Modify: `src/components/MobilePartySettings.tsx`(`MobilePartyWithTabs`)

方針: nav から消した MY JOB ハイライトを、パーティ編成シート上部のトグルに移設。ストアは `useMitigationStore` の `myJobHighlight` / `setMyJobHighlight`(既存・[Layout.tsx:70])。

- [ ] **Step 1: MobilePartyWithTabs の現状を確認**

Run: `rtk read src/components/MobilePartySettings.tsx`
- `MobilePartyWithTabs` の return 冒頭(タブ群より上)に挿入できる位置を特定
- `useMitigationStore` の import 有無を確認

- [ ] **Step 2: 上部に MY JOB ハイライトトグルを追加**

`MobilePartyWithTabs` の return 冒頭(最上部のコンテナ直下、タブより前)に挿入:

```tsx
            {/* MY JOB ハイライト（旧ボトムナビの MY JOB タブから移設） */}
            <button
                onClick={() => {
                    const cur = useMitigationStore.getState().myJobHighlight;
                    useMitigationStore.getState().setMyJobHighlight(!cur);
                }}
                className="flex items-center gap-2 w-full px-3 py-2.5 mb-2 rounded-xl border border-app-border text-app-text hover:bg-app-text/10 active:scale-[0.98] transition-all cursor-pointer"
            >
                <Star size={16} className={myJobHighlight ? "fill-current text-app-text" : "text-app-text/50"} />
                <span className="text-app-base font-semibold">MY JOB</span>
            </button>
```

`myJobHighlight` をリアクティブに読むため、コンポーネント先頭で:

```tsx
    const myJobHighlight = useMitigationStore(s => s.myJobHighlight);
```

`Star` を lucide import に追加(未 import の場合)。

> 「MY JOB」ラベルは現状ベタ書き(既存ナビと同じ表記)を踏襲。i18n キー化は別タスク(spec の非ゴール範囲)。

- [ ] **Step 3: build 確認**

Run: `rtk npm run build`
Expected: EXIT 0

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MobilePartySettings.tsx
rtk git commit -m "feat(mobile-party): パーティ編成シート上部に MY JOB ハイライトトグルを移設"
```

- [ ] **Step 5: 実機チェックポイント⑥(MY JOB)**

- パーティシート上部に MY JOB トグルが出る
- タップで自ジョブ行のハイライト ON/OFF が切り替わる(旧ナビと同じ挙動)
- 状態がトグルの星アイコンに反映される

---

## Task 8: FAB からカンペ項目を撤去

**Files:**
- Modify: `src/components/MobileFAB.tsx:241-248`

方針: カンペはナビに昇格したので、FAB メニューの `cueSheet` 項目を削除。

- [ ] **Step 1: navItems から cueSheet を削除**

`MobileFAB.tsx` の `navItems`(212-248 行)から `cueSheet` ブロック(241-247 行)を削除:

```tsx
        {
            key: 'cueSheet',
            label: t('app.fab_cue_sheet'),
            icon: <PictureInPicture2 size={20} />,
            onClick: () => { close(); window.dispatchEvent(new Event('mobile:open-cue-sheet')); },
            accent: false,
        },
```

- [ ] **Step 2: 未使用 import を確認**

Run: `rtk grep "PictureInPicture2" src/components/MobileFAB.tsx`
Expected: 他参照が無ければ lucide import(9 行付近)から `PictureInPicture2` を削除。

- [ ] **Step 3: build 確認**

Run: `rtk npm run build`
Expected: EXIT 0

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MobileFAB.tsx
rtk git commit -m "refactor(mobile-fab): カンペ項目を撤去(ボトムナビへ昇格済)"
```

- [ ] **Step 5: 実機チェックポイント⑦(FAB)**

- FAB メニューからカンペが消えている(言語/テーマ/フェーズ/ラベル/検索/展開のみ)
- カンペはボトムナビのタブから開ける

---

## Task 9: 総合確認(全フェーズ完了後)

- [ ] **Step 1: フル build + テスト**

Run: `rtk npm run build`
Expected: EXIT 0

Run: `rtk vitest run`
Expected: 既知 5 失敗(TopBar 4 + HousingWorkspace 1)のみ。新規失敗なし。

- [ ] **Step 2: 4 言語でナビ表示確認**

ja / en / ko / zh それぞれでボトムナビ 5 タブ・メニュー内ボタン・各シートタイトルが崩れず表示されるか実機確認。

- [ ] **Step 3: 全実機チェックポイント①〜⑦の総ざらい**

各タスクのチェックポイントを通しで再確認(タブ遷移の排他制御・スクロール・親指到達性)。

- [ ] **Step 4: TODO.md 更新**

`docs/TODO.md` の「現在の状態」を A 完了に更新。次は **B(共有配布フロー設計)** を別ブレストで開始 → A+B 揃ったらまとめて push/デプロイ(Vercel ビルド節約 + C を本番確認)。

> **push / デプロイはこの計画では行わない。** A 完了後に B を設計・実装し、A+B まとめて push(本番自動デプロイ)。これは TODO.md の確定方針。

---

## Self-Review(計画 vs spec の突き合わせ)

- **spec「新ナビ5タブ」** → Task 2 で実装 ✓
- **spec「パーティ・MYJOB タブ廃止→メニュー集約」** → Task 2(撤去)+ Task 6(パーティをメニューへ)+ Task 7(MY JOB をパーティ内へ)✓
- **spec「ツール→インポート改名・Undo/Redo 撤去・自動組み立てはメニューへ」** → Task 4(改名・Auto Plan/Undo Redo 撤去)+ Task 6(自動組み立てをメニューへ)✓
- **spec「カンペ FAB 昇格」** → Task 2(ナビ追加)+ Task 8(FAB から撤去)✓
- **spec「Undo/Redo を FAB 近く常設」** → Task 5 ✓
- **spec「文言 PC 一致=共通 i18n キー」** → Task 1(キー追加)+ Task 4(FFLogs/popular をキー統一)+ Task 6(`mitigation.auto_plan` 使用)✓
- **spec「支援をメニューで埋もれさせない(あ案)」** → Task 6 Step 3 ✓
- **spec「共有タブは枠+入口まで(中身は B)」** → Task 3 Step 3(プレースホルダ枠)✓
- **未確定の実機調整点**: Undo/Redo 案ア/案イ(Task 5 Step 2)、支援の視認性微調整(Task 6 Step 3)は実機チェックポイントで確定。

**型整合**: `onOpenParty` / `onAutoPlan`(Task 6)、`onImportToggle`/`onCueToggle`/`onShareToggle`(Task 2/3)、`mobileShareOpen`(Task 3)はタスク間で命名一致を確認済。
