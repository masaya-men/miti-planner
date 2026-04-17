# みんなの軽減表ボトムシート 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/popular` の別ページ体験を、アプリ内ボトムシートに置き換える。現在編集中のコンテンツにドラムロールで自動スクロールし、OGP画像+軽減表プレビューで主流プランを確認・コピーできるようにする。

**Architecture:** 新規 `MitigationSheet.tsx` コンポーネントをframer-motionで実装。既存の `/api/popular` と `/api/share` をそのまま利用。`ConsolidatedHeader.tsx` のPopularボタンをシート起動に変更。

**Tech Stack:** React, framer-motion (^12.34.0), Zustand, 既存glassmorphism CSS, 既存i18n (ja/en/ko/zh), vitest

**設計書:** `docs/superpowers/specs/2026-04-17-minna-mitigation-design.md`

**モックアップ:** `.superpowers/brainstorm/699-1776394558/content/bottom-sheet-v6.html`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/components/MitigationSheet.tsx` | 新規 | ボトムシート本体（レイアウト、状態管理、コピーロジック） |
| `src/components/MitigationSheet.css` | 新規 | glassmorphism、ドラムロール、カプセル、スクロールバーのスタイル |
| `src/components/MitigationSheetPreview.tsx` | 新規 | 右カラムの軽減表ミニプレビュー描画 |
| `src/components/ConsolidatedHeader.tsx` | 変更 | Popularボタン → シート起動に変更 |
| `src/locales/ja.json` | 変更 | ボトムシート用i18nキー追加 |
| `src/locales/en.json` | 変更 | 同上（英語） |
| `src/locales/ko.json` | 変更 | 同上（韓国語） |
| `src/locales/zh.json` | 変更 | 同上（中国語） |

---

### Task 1: i18nキー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

- [ ] **Step 1: ja.json に miti_sheet セクションを追加**

`popular` セクションの直後に追加:

```json
"miti_sheet": {
  "editing_context": "現在 {{content}} を編集中",
  "tab_savage": "零式",
  "tab_ultimate": "絶",
  "copy_selected": "選択コピー",
  "copy_all_savage": "零式まとめてコピー",
  "copy_all_ultimate": "絶まとめてコピー",
  "copy_this": "コピーして使う",
  "copy_n_items": "{{count}} 件をコピー",
  "copied_toast": "コピーしました",
  "copied_n_toast": "{{count}} 件コピーしました",
  "skipped_toast": "（{{count}} 件はスキップ）",
  "limit_reached_toast": "このコンテンツのプラン上限（{{max}}件）に達しています。不要なプランを削除してからコピーしてください",
  "fetch_error_toast": "データの取得に失敗しました",
  "info_compat": "ジョブ構成が違っても大丈夫 — コピー後にパーティメンバーを変更するとスキル互換配置で自動調整することもできます",
  "info_new_plan": "新しいプランとして追加されます（編集中のプランは上書きされません）· 1コンテンツ最大{{max}}件",
  "footer_readonly": "読み取り専用プレビュー · コピーすると自分のプランとして編集可能",
  "close": "閉じる",
  "copies": "{{count}} copies",
  "no_data": "まだデータがありません"
}
```

- [ ] **Step 2: en.json に同セクションを追加**

```json
"miti_sheet": {
  "editing_context": "Currently editing {{content}}",
  "tab_savage": "Savage",
  "tab_ultimate": "Ultimate",
  "copy_selected": "Select & Copy",
  "copy_all_savage": "Copy All Savage",
  "copy_all_ultimate": "Copy All Ultimate",
  "copy_this": "Copy to Mine",
  "copy_n_items": "Copy {{count}} items",
  "copied_toast": "Copied!",
  "copied_n_toast": "{{count}} items copied",
  "skipped_toast": "({{count}} skipped)",
  "limit_reached_toast": "Plan limit reached ({{max}}) for this content. Delete unused plans to copy.",
  "fetch_error_toast": "Failed to fetch data",
  "info_compat": "Different party comp? No problem — change members after copy and Skill Compatibility will auto-adjust",
  "info_new_plan": "Added as a new plan (your current plan won't be overwritten) · Max {{max}} per content",
  "footer_readonly": "Read-only preview · Copy to edit as your own plan",
  "close": "Close",
  "copies": "{{count}} copies",
  "no_data": "No data yet"
}
```

- [ ] **Step 3: ko.json に同セクションを追加**

```json
"miti_sheet": {
  "editing_context": "현재 {{content}} 편집 중",
  "tab_savage": "영식",
  "tab_ultimate": "절",
  "copy_selected": "선택 복사",
  "copy_all_savage": "영식 전체 복사",
  "copy_all_ultimate": "절 전체 복사",
  "copy_this": "복사해서 사용",
  "copy_n_items": "{{count}}건 복사",
  "copied_toast": "복사 완료!",
  "copied_n_toast": "{{count}}건 복사 완료",
  "skipped_toast": "({{count}}건 건너뜀)",
  "limit_reached_toast": "이 콘텐츠의 플랜 상한({{max}}건)에 도달했습니다. 불필요한 플랜을 삭제한 후 복사해 주세요",
  "fetch_error_toast": "데이터를 가져오지 못했습니다",
  "info_compat": "직업 구성이 달라도 괜찮습니다 — 복사 후 파티원을 변경하면 스킬 호환 배치로 자동 조정할 수 있습니다",
  "info_new_plan": "새 플랜으로 추가됩니다(편집 중인 플랜은 덮어쓰지 않습니다) · 콘텐츠당 최대 {{max}}건",
  "footer_readonly": "읽기 전용 미리보기 · 복사하면 자신의 플랜으로 편집 가능",
  "close": "닫기",
  "copies": "{{count}} copies",
  "no_data": "아직 데이터가 없습니다"
}
```

- [ ] **Step 4: zh.json に同セクションを追加**

```json
"miti_sheet": {
  "editing_context": "正在编辑 {{content}}",
  "tab_savage": "零式",
  "tab_ultimate": "绝境",
  "copy_selected": "选择复制",
  "copy_all_savage": "零式全部复制",
  "copy_all_ultimate": "绝境全部复制",
  "copy_this": "复制使用",
  "copy_n_items": "复制 {{count}} 项",
  "copied_toast": "已复制！",
  "copied_n_toast": "已复制 {{count}} 项",
  "skipped_toast": "（跳过 {{count}} 项）",
  "limit_reached_toast": "此内容的计划上限（{{max}}个）已达到。请删除不需要的计划后再复制",
  "fetch_error_toast": "数据获取失败",
  "info_compat": "职业构成不同也没关系 — 复制后更改队员，技能兼容配置可自动调整",
  "info_new_plan": "将作为新计划添加（不会覆盖正在编辑的计划）· 每个内容最多{{max}}个",
  "footer_readonly": "只读预览 · 复制后可作为自己的计划编辑",
  "close": "关闭",
  "copies": "{{count}} copies",
  "no_data": "暂无数据"
}
```

- [ ] **Step 5: ビルドチェック**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(i18n): みんなの軽減表ボトムシート用翻訳キー追加（4言語）"
```

---

### Task 2: MitigationSheet.css — スタイル定義

**Files:**
- Create: `src/components/MitigationSheet.css`

- [ ] **Step 1: CSSファイルを作成**

```css
/* ================================================
   MitigationSheet — ボトムシートUI
   ================================================ */

/* --- オーバーレイ --- */
.miti-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 60;
}

/* --- ボトムシート --- */
.miti-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80vh;
  z-index: 61;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  /* glassmorphism tier3 */
  background: var(--miti-sheet-bg, rgba(22, 22, 24, 0.78));
  --tw-backdrop-blur: blur(16px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* ライトテーマ */
.theme-light .miti-sheet {
  --miti-sheet-bg: rgba(250, 250, 250, 0.88);
  border-top-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* ハンドル */
.miti-handle {
  width: 40px;
  height: 4px;
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* --- カプセル通知 --- */
.miti-capsule {
  position: fixed;
  top: 16px;
  left: 50%;
  z-index: 62;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 99px;
  background: var(--miti-sheet-bg, rgba(22, 22, 24, 0.88));
  --tw-backdrop-blur: blur(16px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.miti-capsule-dot {
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  animation: miti-pulse 2s ease-in-out infinite;
}

@keyframes miti-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* --- ヘッダー --- */
.miti-header {
  padding: 8px 16px 4px 20px;
  flex-shrink: 0;
}

.miti-header-top {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.miti-close {
  width: 32px;
  height: 32px;
  border-radius: 99px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.miti-close:hover {
  background: rgba(128, 128, 128, 0.15);
  color: var(--color-text-primary);
}

.miti-header-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.miti-tabs {
  display: flex;
  gap: 2px;
}

.miti-tab {
  font-size: var(--font-size-lg);
  font-weight: 700;
  padding: 4px 14px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}
.miti-tab[data-active='true'] {
  background: rgba(128, 128, 128, 0.15);
  color: var(--color-text-primary);
}
.miti-tab:hover:not([data-active='true']) {
  color: var(--color-text-secondary);
}

.miti-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* --- ボタン --- */
.miti-btn {
  padding: 5px 14px;
  border-radius: 99px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.miti-btn:hover {
  background: rgba(128, 128, 128, 0.15);
  color: var(--color-text-primary);
}
.miti-btn-primary {
  padding: 7px 20px;
  font-size: var(--font-size-lg);
  border-color: rgba(128, 128, 128, 0.25);
  color: var(--color-text-primary);
}
.miti-btn-primary:hover {
  background: var(--color-text-primary);
  color: var(--color-bg-primary);
}

/* --- メインレイアウト --- */
.miti-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* 左: OGPカードリスト */
.miti-card-list {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px 10px;
  border-right: 1px solid rgba(128, 128, 128, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.miti-card-list.drumroll {
  overflow: hidden;
}

/* OGPカード */
.miti-card {
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.3s, background 0.3s,
    transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
  border: 2px solid transparent;
  background: rgba(128, 128, 128, 0.04);
  flex-shrink: 0;
  position: relative;
}
.miti-card:hover {
  background: rgba(128, 128, 128, 0.08);
  transform: scale(1.01);
}
.miti-card[data-selected='true'] {
  border-color: rgba(128, 128, 128, 0.4);
  background: rgba(128, 128, 128, 0.08);
  transform: scale(1.02);
}
.miti-card.selecting {
  animation: miti-glow 0.6s ease-out;
}
@keyframes miti-glow {
  0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3); }
  50% { box-shadow: 0 0 20px 6px rgba(255, 255, 255, 0.12); }
  100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
}

.miti-floor-label {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--color-text-muted);
  padding: 5px 10px 3px;
}

.miti-ogp-img {
  width: 100%;
  aspect-ratio: 1200 / 630;
  object-fit: cover;
  display: block;
  background: var(--color-bg-tertiary);
}

.miti-jobs-overlay {
  position: absolute;
  bottom: 28px;
  right: 8px;
  display: flex;
  gap: 2px;
  z-index: 2;
}
.miti-jobs-overlay img {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.3);
}

.miti-copies {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: 3px 10px 5px;
  font-weight: 600;
}

/* チェックボックス（選択モード） */
.miti-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid rgba(128, 128, 128, 0.35);
  background: rgba(0, 0, 0, 0.5);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  cursor: pointer;
}
.miti-check[data-checked='true'] {
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
}

/* --- 右: プレビュー --- */
.miti-preview {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 6px 14px 8px;
}

.miti-info-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.miti-info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: var(--font-size-base);
  line-height: 1.4;
}
.miti-info-blue {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.12);
  color: #93c5fd;
}
.miti-info-neutral {
  background: rgba(128, 128, 128, 0.05);
  border: 1px solid rgba(128, 128, 128, 0.1);
  color: var(--color-text-muted);
}

/* ミニテーブル */
.miti-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid rgba(128, 128, 128, 0.1);
  background: rgba(0, 0, 0, 0.15);
}

.theme-light .miti-table-wrap {
  background: rgba(0, 0, 0, 0.03);
}

.miti-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.miti-table th {
  position: sticky;
  top: 0;
  background: var(--color-bg-primary);
  font-size: 7px;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 5px 2px;
  text-align: center;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  z-index: 2;
}
.miti-table td {
  padding: 3px 2px;
  text-align: center;
  border-bottom: 1px solid rgba(128, 128, 128, 0.04);
  height: 18px;
  vertical-align: middle;
}
.miti-table .phase-col {
  font-size: 7px;
  color: var(--color-text-muted);
  text-align: left;
  padding-left: 5px;
  width: 30px;
}
.miti-table .time-col {
  font-size: 7px;
  color: var(--color-text-muted);
  width: 26px;
}
.miti-table .attack-col {
  font-size: 7px;
  color: var(--color-text-muted);
  text-align: left;
  width: 50px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.miti-skill-pip {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  vertical-align: middle;
}

/* フッター */
.miti-footer {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  padding: 5px 20px 10px;
  flex-shrink: 0;
  opacity: 0.6;
}

/* --- スマホ (< 768px) --- */
@media (max-width: 767px) {
  .miti-sheet {
    height: 100vh;
    border-radius: 0;
  }
  .miti-body {
    flex-direction: column;
  }
  .miti-card-list {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    height: auto;
    max-height: 160px;
    border-right: none;
    border-bottom: 1px solid rgba(128, 128, 128, 0.1);
    padding: 8px;
    gap: 8px;
  }
  .miti-card {
    min-width: 200px;
    flex-shrink: 0;
  }
  .miti-actions {
    overflow-x: auto;
    flex-wrap: nowrap;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/MitigationSheet.css
git commit -m "style: みんなの軽減表ボトムシートのCSS定義"
```

---

### Task 3: MitigationSheetPreview.tsx — 軽減表ミニプレビュー

**Files:**
- Create: `src/components/MitigationSheetPreview.tsx`

- [ ] **Step 1: プレビューコンポーネントを作成**

planDataを受け取り、ミニテーブルとして描画する読み取り専用コンポーネント。

```tsx
import React from 'react';
import type { PlanData } from '../types';
import { useJobs } from '../hooks/useSkillsData';

interface Props {
  planData: PlanData | null;
  loading: boolean;
}

export const MitigationSheetPreview: React.FC<Props> = ({ planData, loading }) => {
  const jobs = useJobs();

  if (loading) {
    return (
      <div className="miti-table-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-6 h-6 border-2 border-app-text/20 border-t-app-text/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="miti-table-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-app-text-muted text-app-sm">—</span>
      </div>
    );
  }

  const partyMembers = planData.partyMembers ?? [];
  const attacks = planData.attacks ?? [];

  // ジョブ名取得
  const getJobLabel = (jobId: string | null): string => {
    if (!jobId) return '—';
    const job = jobs.find(j => j.id === jobId);
    return job?.name?.en?.substring(0, 3).toUpperCase() ?? jobId.substring(0, 3).toUpperCase();
  };

  // スキルアイコンの色（ロール判定）
  const getSkillColor = (jobId: string | null): string => {
    if (!jobId) return 'transparent';
    const job = jobs.find(j => j.id === jobId);
    if (!job) return 'rgba(128,128,128,0.4)';
    switch (job.role) {
      case 'tank': return 'rgba(59,130,246,0.5)';
      case 'healer': return 'rgba(34,197,94,0.5)';
      case 'dps': return 'rgba(239,68,68,0.4)';
      default: return 'rgba(128,128,128,0.4)';
    }
  };

  const getSkillBorder = (jobId: string | null): string => {
    if (!jobId) return 'transparent';
    const job = jobs.find(j => j.id === jobId);
    if (!job) return 'rgba(128,128,128,0.3)';
    switch (job.role) {
      case 'tank': return 'rgba(59,130,246,0.3)';
      case 'healer': return 'rgba(34,197,94,0.3)';
      case 'dps': return 'rgba(239,68,68,0.3)';
      default: return 'rgba(128,128,128,0.3)';
    }
  };

  // 時間フォーマット
  const formatTime = (ms: number): string => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // フェーズ名取得
  let lastPhase = '';

  return (
    <div className="miti-table-wrap">
      <table className="miti-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}></th>
            <th style={{ width: 26 }}>時間</th>
            <th style={{ width: 50 }}>技名</th>
            {partyMembers.map((member, i) => (
              <th key={i}>{getJobLabel(member.jobId)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attacks.map((attack, rowIdx) => {
            const showPhase = attack.phase !== lastPhase;
            if (showPhase) lastPhase = attack.phase ?? '';

            return (
              <tr key={rowIdx}>
                <td className="phase-col">{showPhase ? (attack.phase ?? '') : ''}</td>
                <td className="time-col">{formatTime(attack.time)}</td>
                <td className="attack-col" title={attack.name}>{attack.name}</td>
                {partyMembers.map((member, colIdx) => {
                  const skills = attack.mitigations?.[colIdx] ?? [];
                  return (
                    <td key={colIdx}>
                      {skills.length > 0 && (
                        <span
                          className="miti-skill-pip"
                          style={{
                            background: getSkillColor(member.jobId),
                            border: `1px solid ${getSkillBorder(member.jobId)}`,
                          }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

**注意**: `planData.attacks` と `planData.partyMembers` の実際の型は実装時にコードを確認して合わせること。上記は構造の骨格であり、フィールド名（`attack.mitigations`、`attack.phase`、`attack.time`、`attack.name`）は実際のPlanData型に合わせて調整が必要。

- [ ] **Step 2: コミット**

```bash
git add src/components/MitigationSheetPreview.tsx
git commit -m "feat: 軽減表ミニプレビューコンポーネント追加"
```

---

### Task 4: MitigationSheet.tsx — ボトムシート本体

**Files:**
- Create: `src/components/MitigationSheet.tsx`

- [ ] **Step 1: コンポーネントの骨格を作成**

ボトムシート本体。状態管理、データ取得、コピーロジック、ドラムロールアニメーションを含む。

```tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useJobs } from '../hooks/useSkillsData';
import {
  getContentDefinitions,
  getContentById,
} from '../data/contentRegistry';
import { PLAN_LIMITS } from '../types/firebase';
import { apiFetch } from '../lib/apiClient';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import type { PlanData, SavedPlan } from '../types';
import './MitigationSheet.css';

// --- 型 ---
interface PopularEntry {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
  viewCount: number;
  featured: boolean;
  partyMembers: { jobId: string | null }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentContentId: string | null;
}

// --- コンテンツID算出（PopularPage.tsxから移植） ---
const savageContents = getContentDefinitions().filter(c => c.category === 'savage');
const latestPatch = savageContents.reduce((max, c) => c.patch > max ? c.patch : max, '0');
const savageIds = savageContents
  .filter(c => c.patch === latestPatch)
  .sort((a, b) => a.order - b.order)
  .map(c => c.id);

const ultimateIds = getContentDefinitions()
  .filter(c => c.category === 'ultimate' && c.id !== 'dsr_p1')
  .map(c => c.id);

export const MitigationSheet: React.FC<Props> = ({ isOpen, onClose, currentContentId }) => {
  const { t, i18n } = useTranslation();
  const JOBS = useJobs();
  const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';
  const plans = usePlanStore(s => s.plans);

  // --- 状態 ---
  const [activeTab, setActiveTab] = useState<'savage' | 'ultimate'>('savage');
  const [popularData, setPopularData] = useState<Record<string, { plans: PopularEntry[]; featured: PopularEntry | null }>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PlanData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [drumrollDone, setDrumrollDone] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const contentIds = activeTab === 'savage' ? savageIds : ultimateIds;

  // --- データ取得 ---
  useEffect(() => {
    if (!isOpen) return;
    const allIds = [...savageIds, ...ultimateIds];
    apiFetch(`/api/popular?contentIds=${allIds.join(',')}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((json: { results: Array<{ contentId: string; plans: PopularEntry[]; featured: PopularEntry | null }> }) => {
        const map: Record<string, { plans: PopularEntry[]; featured: PopularEntry | null }> = {};
        for (const item of json.results) {
          map[item.contentId] = { plans: item.plans, featured: item.featured };
        }
        setPopularData(map);
      })
      .catch(() => {
        showToast(t('miti_sheet.fetch_error_toast'));
      });
  }, [isOpen, t]);

  // --- 選択中プランのプレビュー取得 ---
  useEffect(() => {
    if (!selectedId) { setPreviewData(null); return; }
    const entry = getSelectedEntry();
    if (!entry) return;

    setPreviewLoading(true);
    apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(shared => {
        setPreviewData(shared.planData ?? shared.data ?? null);
        setPreviewLoading(false);
      })
      .catch(() => {
        setPreviewData(null);
        setPreviewLoading(false);
      });
  }, [selectedId]);

  // --- ドラムロール ---
  useEffect(() => {
    if (!isOpen || drumrollDone || Object.keys(popularData).length === 0) return;

    // 現在編集中のコンテンツがどのタブか判定
    if (currentContentId && ultimateIds.includes(currentContentId)) {
      setActiveTab('ultimate');
    }

    // ドラムロールは requestAnimationFrame ベースで実装
    // listRef.current に対して scrollTop を操作
    const timer = setTimeout(() => {
      runDrumroll();
    }, 600);

    return () => clearTimeout(timer);
  }, [isOpen, popularData, drumrollDone, currentContentId]);

  const runDrumroll = () => {
    const list = listRef.current;
    if (!list) { setDrumrollDone(true); return; }

    const cards = Array.from(list.querySelectorAll('[data-content-id]')) as HTMLElement[];
    const targetId = currentContentId ?? contentIds[0];
    const targetIdx = cards.findIndex(c => c.dataset.contentId === targetId);
    if (targetIdx < 0) { setDrumrollDone(true); return; }

    const cardHeight = cards[0].offsetHeight + 8;
    const listHeight = list.clientHeight;
    const centerOffset = (listHeight / 2) - (cardHeight / 2);
    const targetTop = cardHeight * targetIdx;
    const finalScroll = Math.max(0, targetTop - centerOffset);

    // クローンで2回転分のスクロール距離を作る
    const totalHeight = cardHeight * cards.length;
    const fullRotations = 2;
    const totalScroll = (fullRotations * totalHeight) + finalScroll;

    // クローン追加
    for (let i = 0; i < fullRotations + 1; i++) {
      cards.forEach(card => {
        const clone = card.cloneNode(true) as HTMLElement;
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '0.5';
        clone.classList.add('drumroll-clone');
        list.appendChild(clone);
      });
    }

    list.classList.add('drumroll');
    const duration = 2200;
    const startTime = performance.now();

    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      list.scrollTop = easeOutExpo(progress) * totalScroll;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // クローン除去
        list.querySelectorAll('.drumroll-clone').forEach(c => c.remove());
        list.classList.remove('drumroll');
        list.scrollTop = finalScroll;

        // ターゲット選択
        setSelectedId(targetId);
        setDrumrollDone(true);

        // グロウエフェクト
        const targetCard = cards[targetIdx];
        targetCard?.classList.add('selecting');
        setTimeout(() => targetCard?.classList.remove('selecting'), 600);
      }
    };

    requestAnimationFrame(animate);
  };

  // --- ヘルパー ---
  const getSelectedEntry = (): PopularEntry | null => {
    if (!selectedId) return null;
    const d = popularData[selectedId];
    return d?.plans?.[0] ?? null;
  };

  const getFloorLabel = (contentId: string): string => {
    const def = getContentById(contentId);
    if (!def) return contentId;
    return (lang === 'ja' ? def.shortName.ja : def.shortName.en).replace(/\n/g, ' ');
  };

  const getContentName = (contentId: string): string => {
    const def = getContentById(contentId);
    if (!def) return contentId;
    return def.name[lang] || def.name.ja;
  };

  const getJobIcon = (jobId: string | null): string | null => {
    if (!jobId) return null;
    return JOBS.find(j => j.id === jobId)?.icon ?? null;
  };

  // --- コピーロジック ---
  const copyPlan = useCallback(async (entry: PopularEntry): Promise<boolean> => {
    // 件数制限チェック
    const contentPlans = plans.filter(p => p.contentId === entry.contentId);
    if (contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
      showToast(t('miti_sheet.limit_reached_toast', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }));
      return false;
    }
    if (plans.length >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
      showToast(t('miti_sheet.limit_reached_toast', { max: PLAN_LIMITS.MAX_TOTAL_PLANS }));
      return false;
    }

    try {
      const res = await apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`);
      if (!res.ok) throw new Error();
      const shared = await res.json();
      const planData: PlanData = shared.planData ?? shared.data;

      const newPlan: SavedPlan = {
        id: crypto.randomUUID?.() ?? `plan_${Date.now()}`,
        ownerId: '',
        ownerDisplayName: '',
        title: entry.title,
        contentId: entry.contentId,
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: planData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      usePlanStore.getState().addPlan(newPlan);

      // copyCount +1（重複防止）
      const copiedKey = 'lopo_copied_shares';
      const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
      if (!copiedList.includes(entry.shareId)) {
        copiedList.push(entry.shareId);
        localStorage.setItem(copiedKey, JSON.stringify(copiedList));
        apiFetch('/api/popular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId: entry.shareId }),
        }).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }, [plans, t]);

  const handleCopyThis = useCallback(async () => {
    const entry = getSelectedEntry();
    if (!entry) return;
    const ok = await copyPlan(entry);
    if (ok) showToast(t('miti_sheet.copied_toast'));
  }, [selectedId, popularData, copyPlan, t]);

  const handleCopyAll = useCallback(async () => {
    const ids = activeTab === 'savage' ? savageIds : ultimateIds;
    const entries = ids
      .map(id => popularData[id]?.plans?.[0])
      .filter((e): e is PopularEntry => !!e);

    if (entries.length === 0) return;

    let copied = 0;
    let skipped = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
      else skipped++;
    }

    let msg = t('miti_sheet.copied_n_toast', { count: copied });
    if (skipped > 0) msg += ' ' + t('miti_sheet.skipped_toast', { count: skipped });
    showToast(msg);
  }, [activeTab, popularData, copyPlan, t]);

  const handleCopyChecked = useCallback(async () => {
    const entries = Array.from(checkedIds)
      .map(id => popularData[id]?.plans?.[0])
      .filter((e): e is PopularEntry => !!e);

    if (entries.length === 0) return;

    let copied = 0;
    let skipped = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
      else skipped++;
    }

    let msg = t('miti_sheet.copied_n_toast', { count: copied });
    if (skipped > 0) msg += ' ' + t('miti_sheet.skipped_toast', { count: skipped });
    showToast(msg);
    setSelectMode(false);
    setCheckedIds(new Set());
  }, [checkedIds, popularData, copyPlan, t]);

  // カード選択
  const handleCardClick = (contentId: string) => {
    if (selectMode) {
      setCheckedIds(prev => {
        const next = new Set(prev);
        if (next.has(contentId)) next.delete(contentId);
        else next.add(contentId);
        return next;
      });
      return;
    }
    setSelectedId(contentId);
    // グロウ + スクロール
    const card = listRef.current?.querySelector(`[data-content-id="${contentId}"]`) as HTMLElement | null;
    if (card) {
      card.classList.add('selecting');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('selecting'), 600);
    }
  };

  // ESCで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // リセット
  useEffect(() => {
    if (!isOpen) {
      setDrumrollDone(false);
      setSelectedId(null);
      setPreviewData(null);
      setSelectMode(false);
      setCheckedIds(new Set());
      setActiveTab('savage');
    }
  }, [isOpen]);

  // 現在のコンテンツ名
  const currentContentName = currentContentId ? getContentName(currentContentId) : '';

  // OGP画像URL
  const getOgpUrl = (shareId: string) => `/api/og?id=${encodeURIComponent(shareId)}`;

  // --- トースト ---
  // 既存PopularPageのshowToastと同じ仕組み
  // (実装時に共通化してもよい)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            className="miti-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* カプセル通知 */}
          {currentContentName && (
            <motion.div
              className="miti-capsule"
              initial={{ opacity: 0, y: -20, x: '-50%', scale: 0.9 }}
              animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: 0.8,
              }}
            >
              <span className="miti-capsule-dot" />
              <span>
                {t('miti_sheet.editing_context', { content: currentContentName })}
              </span>
            </motion.div>
          )}

          {/* ボトムシート */}
          <motion.div
            className="miti-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 28,
            }}
          >
            <div className="miti-handle" />

            {/* ヘッダー */}
            <div className="miti-header">
              <div className="miti-header-top">
                <button className="miti-close" onClick={onClose} title={t('miti_sheet.close') + ' (ESC)'}>
                  <X size={14} />
                </button>
              </div>
              <div className="miti-header-bottom">
                <div className="miti-tabs">
                  <button className="miti-tab" data-active={activeTab === 'savage'} onClick={() => setActiveTab('savage')}>
                    {t('miti_sheet.tab_savage')}
                  </button>
                  <button className="miti-tab" data-active={activeTab === 'ultimate'} onClick={() => setActiveTab('ultimate')}>
                    {t('miti_sheet.tab_ultimate')}
                  </button>
                </div>
                <div className="miti-actions">
                  <button className="miti-btn" onClick={() => { setSelectMode(!selectMode); setCheckedIds(new Set()); }}>
                    {t('miti_sheet.copy_selected')}
                  </button>
                  <button className="miti-btn" onClick={handleCopyAll}>
                    {activeTab === 'savage' ? t('miti_sheet.copy_all_savage') : t('miti_sheet.copy_all_ultimate')}
                  </button>
                  {selectMode && checkedIds.size > 0 && (
                    <button className="miti-btn miti-btn-primary" onClick={handleCopyChecked}>
                      {t('miti_sheet.copy_n_items', { count: checkedIds.size })}
                    </button>
                  )}
                  {!selectMode && (
                    <button className="miti-btn miti-btn-primary" onClick={handleCopyThis}>
                      {t('miti_sheet.copy_this')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* メイン */}
            <div className="miti-body">
              {/* 左: OGPカードリスト */}
              <div className="miti-card-list" ref={listRef}>
                {contentIds.map(contentId => {
                  const entry = popularData[contentId]?.plans?.[0];
                  const isSelected = selectedId === contentId;
                  const isChecked = checkedIds.has(contentId);

                  return (
                    <div
                      key={contentId}
                      data-content-id={contentId}
                      className="miti-card"
                      data-selected={isSelected}
                      onClick={() => handleCardClick(contentId)}
                    >
                      {selectMode && (
                        <div className="miti-check" data-checked={isChecked}>
                          {isChecked && <Check size={11} />}
                        </div>
                      )}
                      <div className="miti-floor-label">{getFloorLabel(contentId)}</div>
                      {entry ? (
                        <>
                          <img
                            className="miti-ogp-img"
                            src={getOgpUrl(entry.shareId)}
                            alt={entry.title}
                            loading="lazy"
                          />
                          {entry.partyMembers?.length > 0 && (
                            <div className="miti-jobs-overlay">
                              {entry.partyMembers.map((m, i) => {
                                const icon = getJobIcon(m.jobId);
                                return icon ? <img key={i} src={icon} alt="" /> : null;
                              })}
                            </div>
                          )}
                          <div className="miti-copies">
                            {t('miti_sheet.copies', { count: entry.copyCount })}
                          </div>
                        </>
                      ) : (
                        <div className="miti-ogp-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="text-app-text-muted text-app-sm">{t('miti_sheet.no_data')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 右: プレビュー */}
              <div className="miti-preview">
                <div className="miti-info-panel">
                  <div className="miti-info-item miti-info-blue">
                    <span style={{ fontSize: 12, flexShrink: 0, width: 16, textAlign: 'center' }}>↔</span>
                    <span>{t('miti_sheet.info_compat')}</span>
                  </div>
                  <div className="miti-info-item miti-info-neutral">
                    <span style={{ fontSize: 12, flexShrink: 0, width: 16, textAlign: 'center' }}>+</span>
                    <span>{t('miti_sheet.info_new_plan', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}</span>
                  </div>
                </div>

                <MitigationSheetPreview
                  planData={previewData}
                  loading={previewLoading || !drumrollDone}
                />
              </div>
            </div>

            <div className="miti-footer">{t('miti_sheet.footer_readonly')}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- トースト（PopularPage.tsxから移植） ---
function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-app-toggle text-app-toggle-text px-4 py-2 rounded-full text-app-2xl font-bold z-[100]';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 1500);
  setTimeout(() => el.remove(), 2000);
}
```

**注意**: 上記コードはPlanData型の実際のフィールド構造を実装時に確認して調整すること。特に `MitigationSheetPreview` に渡す `planData` の `attacks` / `partyMembers` / `mitigations` のフィールド名。

- [ ] **Step 2: ビルドチェック**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 型エラーがあれば修正（PlanData型のフィールド名調整等）

- [ ] **Step 3: コミット**

```bash
git add src/components/MitigationSheet.tsx
git commit -m "feat: みんなの軽減表ボトムシートコンポーネント追加"
```

---

### Task 5: ConsolidatedHeader.tsx — Popularボタンをシート起動に変更

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx:310-317`

- [ ] **Step 1: MitigationSheet のインポートと状態追加**

ファイル冒頭のインポートに追加:

```tsx
import { MitigationSheet } from './MitigationSheet';
```

コンポーネント内に状態追加:

```tsx
const [isMitiSheetOpen, setIsMitiSheetOpen] = useState(false);
```

`currentPlanId` と `plans` から現在のコンテンツIDを取得:

```tsx
const currentPlanId = usePlanStore(s => s.currentPlanId);
const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
const currentContentId = currentPlan?.contentId ?? null;
```

- [ ] **Step 2: Popularボタンの onClick を変更**

変更前（行310-317）:
```tsx
<button
    onClick={() => window.open('/popular', '_blank')}
    className={clsx(pillBtnBase, pillBtnDefault)}
>
    <Crown size={14} className="..."/>
    <span>{t('popular.open_popular')}</span>
</button>
```

変更後:
```tsx
<button
    onClick={() => setIsMitiSheetOpen(true)}
    className={clsx(pillBtnBase, pillBtnDefault)}
>
    <Crown size={14} className="..."/>
    <span>{t('popular.open_popular')}</span>
</button>
```

- [ ] **Step 3: MitigationSheet をレンダーに追加**

コンポーネントのreturn文末尾（閉じタグの直前）に追加:

```tsx
<MitigationSheet
  isOpen={isMitiSheetOpen}
  onClose={() => setIsMitiSheetOpen(false)}
  currentContentId={currentContentId}
/>
```

- [ ] **Step 4: ビルドチェック**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx
git commit -m "feat: みんなの軽減表ボタンをボトムシート起動に変更"
```

---

### Task 6: 動作確認・ビルド・調整

**Files:**
- Possibly modify: `src/components/MitigationSheet.tsx`, `MitigationSheetPreview.tsx`, `MitigationSheet.css`

- [ ] **Step 1: 開発サーバー起動・動作確認**

Run: `npm run dev`

ブラウザで確認:
1. コントロールバーの「みんなの軽減表」ボタンをクリック → ボトムシートが開く
2. ドラムロールアニメーションが動作する
3. 左のOGPカードをクリック → 選択アニメーション + プレビュー表示
4. 「コピーして使う」→ トースト表示 + プランが追加される
5. 「まとめてコピー」→ 全プランコピー
6. 「選択コピー」→ チェックモード → チェック → コピー
7. ×ボタン / ESC / オーバーレイクリック → 閉じる
8. タブ切替（零式 ↔ 絶）
9. カプセル通知の表示・アニメーション
10. ライトテーマでの表示

- [ ] **Step 2: PlanData型の調整**

MitigationSheetPreview.tsx のテーブル描画が実際のPlanDataと合っているか確認。合っていなければフィールド名を修正。

実際のPlanData型を `src/types/index.ts` から読み、`attacks` → 実際のフィールド名に合わせる。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 4: テスト実行**

Run: `npm test`
Expected: 既存テストが壊れていないこと

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "fix: みんなの軽減表ボトムシート動作調整"
```

---

## 実装時の注意事項

### PlanData型の実際のフィールド名

Task 3 と Task 4 のコードは PlanData の正確なフィールド名を仮定しています。実装時に `src/types/index.ts` の PlanData 型を確認し、以下を合わせること:

- 攻撃リスト: `attacks` → 実際のフィールド名
- 各攻撃のフェーズ: `attack.phase` → 実際のフィールド名
- 各攻撃の時間: `attack.time` → 実際のフィールド名
- 各攻撃の名前: `attack.name` → 実際のフィールド名
- 軽減配置: `attack.mitigations` → 実際のフィールド名
- パーティメンバー: `planData.partyMembers` → 実際のフィールド名

### showToast の共通化

PopularPage.tsx と MitigationSheet.tsx で同じ showToast を使っている。将来的には `src/lib/toast.ts` に共通化できるが、今回のスコープではコピーで十分。

### /popular ページの扱い

今回は `/popular` ページは残す（並行稼働）。既存の外部リンクやSEOが壊れないようにする。将来的にリダイレクトまたは簡易版に変更。
