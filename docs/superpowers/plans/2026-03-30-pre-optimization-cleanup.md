# パフォーマンス最適化前クリーンアップ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React.memo最適化の前に、コンポーネント構造やpropsが変わるUI改善を全て完了させる

**Architecture:** 共通フック `useEscapeClose` を作成し全モーダル・ポップオーバーに適用。PartyStatusPopoverのスキル名ハードコーディングを解消しcontentLanguage依存を修正。パーティメンバーID定数を1ファイルに集約。

**Tech Stack:** React 19, TypeScript, Zustand, react-i18next

---

## ファイル構成

| 種別 | ファイル | 役割 |
|------|---------|------|
| 新規 | `src/hooks/useEscapeClose.ts` | Escapeキーで閉じる共通フック |
| 新規 | `src/constants/party.ts` | パーティメンバーID定数 |
| 修正 | `src/components/ConfirmDialog.tsx` | Escape対応追加 |
| 修正 | `src/components/EventModal.tsx` | Escape対応追加 |
| 修正 | `src/components/FFLogsImportModal.tsx` | Escape対応追加 |
| 修正 | `src/components/CsvImportModal.tsx` | Escape対応追加 |
| 修正 | `src/components/LoginModal.tsx` | Escape対応追加 |
| 修正 | `src/components/NewPlanModal.tsx` | Escape対応追加 |
| 修正 | `src/components/JobMigrationModal.tsx` | Escape対応追加 |
| 修正 | `src/components/PhaseModal.tsx` | Escape対応追加 |
| 修正 | `src/components/ShareModal.tsx` | Escape対応追加 |
| 修正 | `src/components/PartySettingsModal.tsx` | Escape対応追加 |
| 修正 | `src/components/AASettingsPopover.tsx` | Escape対応追加 |
| 修正 | `src/components/ClearMitigationsPopover.tsx` | Escape対応追加 |
| 修正 | `src/components/PartyStatusPopover.tsx` | Escape対応追加 + contentLanguage依存修正 |
| 修正 | `src/components/Sidebar.tsx` | ⋮メニューにEscape対応追加 |
| 修正 | `src/components/Layout.tsx` | パーティ定数を共通ファイルから参照 |
| 修正 | `src/components/Timeline.tsx` | パーティ定数を共通ファイルから参照 |
| 修正 | `src/store/useTutorialStore.ts` | パーティ定数を共通ファイルから参照 |

---

### Task 1: useEscapeClose 共通フック作成

**Files:**
- Create: `src/hooks/useEscapeClose.ts`

- [ ] **Step 1: フックを作成**

```typescript
// src/hooks/useEscapeClose.ts
import { useEffect } from 'react';
import { useTutorialStore } from '../store/useTutorialStore';

/**
 * Escapeキーでモーダル/ポップオーバーを閉じる共通フック。
 * チュートリアル中はEscapeを無視する。
 */
export function useEscapeClose(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // チュートリアル中は閉じさせない
        if (useTutorialStore.getState().isActive) return;
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useEscapeClose.ts
git commit -m "feat: Escapeキーで閉じる共通フック useEscapeClose を追加"
```

---

### Task 2: 全モーダルにEscape対応を適用

**Files:**
- Modify: `src/components/ConfirmDialog.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/EventModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/FFLogsImportModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/CsvImportModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/LoginModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/NewPlanModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/JobMigrationModal.tsx` — import追加 + フック呼び出し1行（onCancelを使用）
- Modify: `src/components/PhaseModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/ShareModal.tsx` — import追加 + フック呼び出し1行
- Modify: `src/components/PartySettingsModal.tsx` — import追加 + フック呼び出し1行

各モーダルのコンポーネント関数の先頭付近に以下を追加する:

```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
// ... コンポーネント関数内で:
useEscapeClose(isOpen, onClose); // ← 1行追加
```

**ConfirmDialog.tsx の注意:** `onCancel` が閉じる関数なので `useEscapeClose(isOpen, onCancel)` とする。ただしConfirmDialogは早期returnの前にフックを呼ぶ必要がある（Reactのフックルール）ので、`if (!isOpen) return null;` の **前** にフック呼び出しを置く。

**JobMigrationModal.tsx の注意:** こちらも `onCancel` を使う。同様にフックルールに注意して早期returnの前に配置。

**SaveDialog.tsx / MobileBottomSheet.tsx:** 既にEscape対応済みのため変更不要。

- [ ] **Step 1: ConfirmDialog に適用**

ConfirmDialog.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内、`const { t } = useTranslation();` の次の行に追加:
```typescript
useEscapeClose(isOpen, onCancel);
```

- [ ] **Step 2: EventModal に適用**

EventModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内、`const { contentLanguage } = useThemeStore();` の前に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

- [ ] **Step 3: FFLogsImportModal に適用**

FFLogsImportModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内（export const FFLogsImportModal の直後付近）に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

注意: FFLogsImportModal内にLoginModalが子として開くことがある。Escapeキーイベントはbubbleするため、LoginModal側のuseEscapeCloseが先に処理する（LoginModalが開いている時はFFLogsImportModalのisOpenはtrueのまま）。ただし、LoginModalが閉じてもFFLogsImportModalは閉じない想定なので問題なし。2つのkeydownリスナーが同時に発火する可能性があるが、LoginModalのonCloseが先に実行されれば次のEscapeでFFLogsImportModalが閉じるので、自然な挙動になる。

→ 実際には **LoginModal が開いている間はFFLogsImportModal のEscapeで閉じてほしくない** 場合、FFLogsImportModal側のuseEscapeCloseにLoginModalのopen状態を条件に入れるべき。ただし現在のUXでは「ESCで最前面のモーダルだけ閉じる」挙動が自然なので、**stopPropagation不要で、2つの同時発火を防ぐにはLoginModal側でe.stopPropagation()を追加する**。

**対策: useEscapeClose に stopPropagation オプションは不要。** Escapeキーイベントは同一documentの全リスナーに届くが、LoginModalのonCloseでisOpenがfalseになるため、次フレームではFFLogsImportModal側のリスナーだけが残る。1つのkeydownイベントで2つのモーダルが同時に閉じることは起こりうるが、実際にはLoginModalが閉じた後もFFLogsImportModalは維持したい。

**最終対策:** useEscapeClose フックを修正して、最前面のモーダルだけが反応するようにする。

Task 1のuseEscapeClose.tsを以下に更新:

```typescript
import { useEffect, useRef } from 'react';
import { useTutorialStore } from '../store/useTutorialStore';

// グローバルスタック: 複数モーダルが重なった時に最前面だけがEscapeに反応する
const escapeStack: Array<() => void> = [];

export function useEscapeClose(isOpen: boolean, onClose: () => void) {
  const callbackRef = useRef(onClose);
  callbackRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const entry = () => callbackRef.current();
    escapeStack.push(entry);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (useTutorialStore.getState().isActive) return;
      // スタックの最後（最前面）が自分の場合のみ反応
      if (escapeStack[escapeStack.length - 1] === entry) {
        e.stopImmediatePropagation();
        callbackRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const idx = escapeStack.indexOf(entry);
      if (idx >= 0) escapeStack.splice(idx, 1);
    };
  }, [isOpen]);
}
```

これにより、LoginModalが開いている間にEscapeを押すとLoginModalだけが閉じ、FFLogsImportModalは残る。

- [ ] **Step 4: CsvImportModal に適用**

CsvImportModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const CsvImportModal` の直後に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

**注意:** CsvImportModalは`if (!isOpen) return null;`の前にフック呼び出しを置く必要がある（Reactのフックルール: 条件付きreturnの前に全フックを呼ぶ）。

- [ ] **Step 5: LoginModal に適用**

LoginModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const LoginModal` のコンポーネント関数内先頭に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

LoginModalはConfirmDialog（アカウント削除確認）を子として開く。ConfirmDialogにもuseEscapeCloseを適用済みなので、スタック機構により最前面のConfirmDialogだけがEscapeに反応する。

- [ ] **Step 6: NewPlanModal に適用**

NewPlanModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const NewPlanModal` の関数内、`const { t, i18n } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, () => onClose());
```

注意: NewPlanModalのonCloseは引数を受け取るため、`() => onClose()` でラップして引数なしで呼ぶ。

- [ ] **Step 7: JobMigrationModal に適用**

JobMigrationModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const JobMigrationModal` の関数内、`const { t, i18n } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, onCancel);
```

- [ ] **Step 8: PhaseModal に適用**

PhaseModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const PhaseModal` の関数内、`const { t } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

- [ ] **Step 9: ShareModal に適用**

ShareModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const ShareModal` の関数内先頭に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

- [ ] **Step 10: PartySettingsModal に適用**

PartySettingsModal.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

`export const PartySettingsModal` の関数内、`const { t } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

PartySettingsModalはJobMigrationModalを子として開く。スタック機構により、JobMigrationModal表示中はそちらだけがEscapeに反応する。

- [ ] **Step 11: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 12: コミット**

```bash
git add src/hooks/useEscapeClose.ts src/components/ConfirmDialog.tsx src/components/EventModal.tsx src/components/FFLogsImportModal.tsx src/components/CsvImportModal.tsx src/components/LoginModal.tsx src/components/NewPlanModal.tsx src/components/JobMigrationModal.tsx src/components/PhaseModal.tsx src/components/ShareModal.tsx src/components/PartySettingsModal.tsx
git commit -m "feat: 全モーダル(10個)にEscapeキーで閉じる機能を追加

スタック機構付きuseEscapeCloseフックにより、
モーダルが重なった場合も最前面だけが閉じる"
```

---

### Task 3: ポップオーバー3種 + Sidebar⋮メニューにEscape対応

**Files:**
- Modify: `src/components/AASettingsPopover.tsx`
- Modify: `src/components/ClearMitigationsPopover.tsx`
- Modify: `src/components/PartyStatusPopover.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: AASettingsPopover に適用**

AASettingsPopover.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内、`const { t } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

- [ ] **Step 2: ClearMitigationsPopover に適用**

ClearMitigationsPopover.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内、`const { t } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

- [ ] **Step 3: PartyStatusPopover に適用**

PartyStatusPopover.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内、`const { t } = useTranslation();` の次に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

- [ ] **Step 4: Sidebar ⋮メニューにEscape追加**

Sidebar.tsx の ⋮メニュー外クリック useEffect（`// ⋮メニュー外クリックで閉じる` のコメント付近）の後に、新しいuseEffectを追加:

```typescript
// ⋮メニュー: Escapeで閉じる
React.useEffect(() => {
    if (!menuPlanId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setMenuPlanId(null);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [menuPlanId]);
```

注意: Sidebar⋮メニューはuseEscapeCloseフックを使わず直接useEffectで実装する。理由: ⋮メニューのopen状態は`menuPlanId !== null`で管理されており、isOpen/onCloseのインターフェースに合わない。また、チュートリアル中に⋮メニューが開くことはないため、チュートリアルブロックも不要。

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/AASettingsPopover.tsx src/components/ClearMitigationsPopover.tsx src/components/PartyStatusPopover.tsx src/components/Sidebar.tsx
git commit -m "feat: ポップオーバー3種 + Sidebar⋮メニューにEscapeキー対応を追加"
```

---

### Task 4: PartyStatusPopover の contentLanguage 依存修正

**Files:**
- Modify: `src/components/PartyStatusPopover.tsx:95-151`

現在の問題: `useMemo` の依存配列に `contentLanguage` が含まれていない。言語を切り替えても `compute` 関数内の `skillNames.ja` 固定参照が再評価されない。

- [ ] **Step 1: useMemo内のcompute関数でcontentLanguageを使うように修正**

PartyStatusPopover.tsx の95-151行目を以下に変更:

```typescript
const skillPreviews = useMemo(() => {
    const compute = (skillNames: { ja: string; en: string }) => {
        const skillName = skillNames.ja; // SKILL_DATAのキーは常に日本語
        const skill = SKILL_DATA[skillName as keyof typeof SKILL_DATA] as any;
        if (!skill) return null;
        if (skill.minLevel && currentLevel < skill.minLevel) return null;
        if (skill.maxLevel && currentLevel > skill.maxLevel) return null;

        const isTankSkill = ['pld', 'war', 'drk', 'gnb'].some(job => skill.jobs?.includes(job));
        const stats = isTankSkill ? tankRep?.stats : healerRep?.stats;
        if (!stats) return null;

        let value = 0;
        if (skill.type === 'hp' && 'percent' in skill) {
            value = calculateHpValue(stats.hp, skill.percent || 0);
        } else if (skill.type === 'potency' && 'potency' in skill) {
            let base = calculatePotencyValue(stats, skill.potency || 0, isTankSkill ? 'tank' : 'healer', LEVEL_MODIFIERS[currentLevel]);
            const multiplier = 'multiplier' in skill ? skill.multiplier : undefined;
            if (multiplier) base = Math.floor(base * multiplier);
            if ((skill as any).isCrit) base = calculateCriticalValue(base);
            value = base;
        }

        const iconUrl = (skill as any).icon ? `/icons/${(skill as any).icon}` : null;
        return { key: skillName, value, iconUrl, nameJa: skillNames.ja, nameEn: skillNames.en };
    };

    return {
        tank: [
            { ja: "ディヴァインヴェール", en: "Divine Veil" },
            { ja: "シェイクオフ", en: "Shake It Off" },
            { ja: "原初の血気", en: "Bloodwhetting" },
            { ja: "ブラックナイト", en: "The Blackest Night" },
        ].map(compute).filter(Boolean),
        dps: [
            { ja: "インプロビゼーション", en: "Improvisation" },
            { ja: "テンペラグラッサ", en: "Tempera Grassa" },
        ].map(compute).filter(Boolean),
        healerTop: [
            { ja: "ディヴァインカレス", en: "Divine Caress" },
            { ja: "秘策：展開戦術", en: "Recitation Deployment Tactics" },
            { ja: "コンソレイション", en: "Consolation" },
            { ja: "アクセッション", en: "Accession" },
            { ja: "ホーリズム", en: "Holos" },
            { ja: "パンハイマ", en: "Panhaima" },
        ].map(compute).filter(Boolean),
        healerBottom: [
            { ja: "鼓舞激励の策", en: "Adloquium" },
            { ja: "意気軒高の策", en: "Concitation" },
            { ja: "士気高揚の策", en: "Succor" },
            { ja: "エウクラシア・プログノシスII", en: "Eukrasian Prognosis II" },
            { ja: "エウクラシア・プログノシス", en: "Eukrasian Prognosis" },
            { ja: "アスペクト・ヘリオス (Nセクト)", en: "Aspected Helios (Neutral)" },
            { ja: "コンジャンクション・ヘリオス (Nセクト)", en: "Helios Conjunction (Neutral)" },
        ].map(compute).filter(Boolean),
    };
}, [tankRep?.stats.hp, healerRep?.stats.hp, healerRep?.stats.mainStat, healerRep?.stats.det, healerRep?.stats.wd, currentLevel, contentLanguage]);
```

変更点は依存配列の末尾に `contentLanguage` を追加したのみ。compute関数内のロジックは変更不要（SKILL_DATAのキーは常に日本語名で引くのが正しいため）。contentLanguageが変わった時にuseMemoが再評価されることで、SkillPreviewItemに最新のcontentLanguageが渡される。

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/PartyStatusPopover.tsx
git commit -m "fix: PartyStatusPopoverのuseMemoにcontentLanguage依存を追加

言語切替時にスキルプレビューが再計算されないバグを修正"
```

---

### Task 5: パーティメンバーID定数の共通化

**Files:**
- Create: `src/constants/party.ts`
- Modify: `src/components/Layout.tsx:195-196, 357-358`
- Modify: `src/components/Timeline.tsx:1292, 2090`
- Modify: `src/store/useTutorialStore.ts:559`

- [ ] **Step 1: 定数ファイルを作成**

```typescript
// src/constants/party.ts

/** パーティメンバーID（表示順） */
export const PARTY_MEMBER_IDS = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;

/** パーティメンバーIDのソート用マップ */
export const PARTY_MEMBER_ORDER: Record<string, number> = {
  MT: 0, ST: 1, H1: 2, H2: 3, D1: 4, D2: 5, D3: 6, D4: 7,
};
```

- [ ] **Step 2: Layout.tsx の2箇所を置換**

Layout.tsx 195-196行目:
```typescript
// 変更前
const memberOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
const sortedMembers = memberOrder.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;

// 変更後
import { PARTY_MEMBER_IDS } from '../constants/party';
// ...
const sortedMembers = PARTY_MEMBER_IDS.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;
```

Layout.tsx 357-358行目も同様に:
```typescript
// 変更前
const memberOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
const sortedMembers = memberOrder.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;

// 変更後
const sortedMembers = PARTY_MEMBER_IDS.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;
```

importは1箇所（ファイル先頭）に追加するだけ。

- [ ] **Step 3: Timeline.tsx の2箇所を置換**

Timeline.tsx 1292行目:
```typescript
// 変更前
const roleOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];

// 変更後
import { PARTY_MEMBER_IDS, PARTY_MEMBER_ORDER } from '../constants/party';
// ...
const roleOrder = PARTY_MEMBER_IDS;
```

Timeline.tsx 2090行目:
```typescript
// 変更前
const memberOrder: Record<string, number> = { MT: 0, ST: 1, H1: 2, H2: 3, D1: 4, D2: 5, D3: 6, D4: 7 };

// 変更後（PARTY_MEMBER_ORDERを使用）
// memberOrderの参照を全てPARTY_MEMBER_ORDERに置換
```

2129行目と2139行目の `memberOrder[...]` も `PARTY_MEMBER_ORDER[...]` に変更。

- [ ] **Step 4: useTutorialStore.ts の1箇所を置換**

useTutorialStore.ts 559行目:
```typescript
// 変更前
const partyOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];

// 変更後
import { PARTY_MEMBER_IDS } from '../constants/party';
// ...
const partyOrder = PARTY_MEMBER_IDS;
```

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/constants/party.ts src/components/Layout.tsx src/components/Timeline.tsx src/store/useTutorialStore.ts
git commit -m "refactor: パーティメンバーID定数を src/constants/party.ts に集約

Layout.tsx(2箇所), Timeline.tsx(2箇所), useTutorialStore.ts(1箇所)の
重複定義を共通定数に置換"
```

---

### Task 6: SaveDialog の既存Escape対応をuseEscapeCloseに統一（任意）

**Files:**
- Modify: `src/components/SaveDialog.tsx:89-91`

SaveDialogのinput内onKeyDownにEscape対応があるが、inputにフォーカスが無い時は効かない。useEscapeCloseで補完する。

- [ ] **Step 1: useEscapeCloseを追加**

SaveDialog.tsx の先頭importに追加:
```typescript
import { useEscapeClose } from '../hooks/useEscapeClose';
```

コンポーネント関数内、`const inputRef = useRef<HTMLInputElement>(null);` の次に追加:
```typescript
useEscapeClose(isOpen, onClose);
```

input内のonKeyDownの `if (e.key === 'Escape') onClose();` は残しておく（inputフォーカス中のEscapeをstopPropagationなしで処理する分には問題ない。useEscapeCloseのstopImmediatePropagationにより二重発火もしない）。

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/SaveDialog.tsx
git commit -m "feat: SaveDialogにuseEscapeCloseを追加（input外でもEscapeで閉じる）"
```

---

### Task 7: 動作確認 + TODO.md更新

- [ ] **Step 1: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. 各モーダルを開いてEscapeキーで閉じられることを確認
2. モーダルが重なっている場合（例: PartySettings → JobMigration）、最前面だけが閉じることを確認
3. チュートリアル中にEscapeが無視されることを確認
4. Sidebar⋮メニューがEscapeで閉じることを確認
5. 言語切替後にPartyStatusPopoverのスキルプレビューが正しく再計算されることを確認

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし、warningのみ許容

- [ ] **Step 3: TODO.md更新**

以下を完了マーク:
- `- [x] **Escapeキーでモーダル・メニューを閉じる** — 全モーダル・ドロップダウンでEscapeキー対応`

以下のバグ修正を記録:
- PartyStatusPopover contentLanguage依存修正（完了）

- [ ] **Step 4: コミット**

```bash
git add docs/TODO.md
git commit -m "docs: Escapeキー対応・contentLanguage修正・定数共通化の完了をTODOに反映"
```
