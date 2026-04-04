# 軽減表バックアップ機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザーが全軽減表をJSONでバックアップ・復元できる機能を追加する

**Architecture:** サイドバー下部にバックアップ/復元ボタンを配置。各ボタンはモーダルを開く。バックアップはmanualSync後にlocalStorageからJSON生成、復元はJSONパース→マージ→Firestore同期。既存の3点メニューはゴミ箱アイコン直置きに変更。

**Tech Stack:** React, Zustand, Firestore, i18next, Lucide icons, Framer Motion

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| Create | `src/utils/backupService.ts` | エクスポートJSON生成、インポートバリデーション・マージロジック |
| Create | `src/components/BackupExportModal.tsx` | エクスポートモーダルUI |
| Create | `src/components/BackupRestoreModal.tsx` | インポートモーダルUI |
| Modify | `src/components/Sidebar.tsx` | バックアップ/復元ボタン追加、3点メニュー→ゴミ箱アイコン変更 |
| Modify | `src/locales/ja.json` | backup.* i18nキー追加 |
| Modify | `src/locales/en.json` | backup.* i18nキー追加 |
| Modify | `src/locales/zh.json` | backup.* i18nキー追加 |
| Modify | `src/locales/ko.json` | backup.* i18nキー追加 |
| Delete | `src/utils/csvExporter.ts` | CSV機能削除 |

---

## Task 1: i18nキー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: ja.json に backup セクション追加**

既存の最後のセクションの後に追加。以下のキーを追加する:

```json
"backup": {
    "backup_button": "バックアップ",
    "restore_button": "復元",
    "export_title": "軽減表をバックアップ",
    "export_description": "下のテキストをコピーするか、ファイルをダウンロードして安全な場所に保管してください。メモ帳やスプレッドシートに貼り付けておくと便利です。",
    "export_syncing": "データを同期中...",
    "export_plan_count": "{{count}}件の軽減表",
    "copy_button": "コピー",
    "copy_success": "クリップボードにコピーしました",
    "download_button": "ファイルをダウンロード",
    "download_success": "ダウンロードしました",
    "restore_title": "バックアップから復元",
    "restore_description": "バックアップしたテキストを下のエリアに貼り付けるか、ダウンロードしたファイルを選択してください。",
    "restore_paste_placeholder": "バックアップのJSONをここに貼り付け...",
    "restore_file_select": "ファイルを選択",
    "restore_button_label": "復元する",
    "restore_invalid_json": "バックアップデータが正しくありません。正しいバックアップテキストを貼り付けてください。",
    "restore_confirm_1_title": "軽減表を復元しますか？",
    "restore_confirm_1_message": "現在の軽減表はバックアップの内容で上書きされます。この操作は取り消せません。",
    "restore_confirm_1_continue": "続行する",
    "restore_confirm_2_title": "本当に復元しますか？",
    "restore_confirm_2_message": "現在の{{currentCount}}件の軽減表に、バックアップの{{backupCount}}件が上書きマージされます。",
    "restore_confirm_2_execute": "復元する",
    "restore_confirm_2_cancel": "やめる",
    "restore_success": "{{count}}件の軽減表を復元しました",
    "restore_syncing": "Firestoreに同期中..."
}
```

- [ ] **Step 2: en.json に backup セクション追加**

```json
"backup": {
    "backup_button": "Backup",
    "restore_button": "Restore",
    "export_title": "Backup Mitigation Plans",
    "export_description": "Copy the text below or download the file and keep it in a safe place. Pasting it into a notepad or spreadsheet is recommended.",
    "export_syncing": "Syncing data...",
    "export_plan_count": "{{count}} plan(s)",
    "copy_button": "Copy",
    "copy_success": "Copied to clipboard",
    "download_button": "Download File",
    "download_success": "Downloaded",
    "restore_title": "Restore from Backup",
    "restore_description": "Paste the backup text into the area below, or select a downloaded file.",
    "restore_paste_placeholder": "Paste backup JSON here...",
    "restore_file_select": "Select File",
    "restore_button_label": "Restore",
    "restore_invalid_json": "Invalid backup data. Please paste the correct backup text.",
    "restore_confirm_1_title": "Restore mitigation plans?",
    "restore_confirm_1_message": "Your current plans will be overwritten with the backup data. This action cannot be undone.",
    "restore_confirm_1_continue": "Continue",
    "restore_confirm_2_title": "Are you sure?",
    "restore_confirm_2_message": "{{backupCount}} plan(s) from the backup will be merged into your current {{currentCount}} plan(s).",
    "restore_confirm_2_execute": "Restore",
    "restore_confirm_2_cancel": "Cancel",
    "restore_success": "Restored {{count}} plan(s)",
    "restore_syncing": "Syncing to cloud..."
}
```

- [ ] **Step 3: zh.json に backup セクション追加**

```json
"backup": {
    "backup_button": "备份",
    "restore_button": "恢复",
    "export_title": "备份减伤表",
    "export_description": "复制下方文本或下载文件，保存到安全的地方。建议粘贴到记事本或电子表格中。",
    "export_syncing": "正在同步数据...",
    "export_plan_count": "{{count}}个减伤表",
    "copy_button": "复制",
    "copy_success": "已复制到剪贴板",
    "download_button": "下载文件",
    "download_success": "已下载",
    "restore_title": "从备份恢复",
    "restore_description": "将备份文本粘贴到下方区域，或选择已下载的文件。",
    "restore_paste_placeholder": "在此粘贴备份JSON...",
    "restore_file_select": "选择文件",
    "restore_button_label": "恢复",
    "restore_invalid_json": "备份数据无效。请粘贴正确的备份文本。",
    "restore_confirm_1_title": "要恢复减伤表吗？",
    "restore_confirm_1_message": "当前的减伤表将被备份内容覆盖。此操作无法撤销。",
    "restore_confirm_1_continue": "继续",
    "restore_confirm_2_title": "确定要恢复吗？",
    "restore_confirm_2_message": "备份中的{{backupCount}}个减伤表将合并覆盖到当前的{{currentCount}}个减伤表中。",
    "restore_confirm_2_execute": "恢复",
    "restore_confirm_2_cancel": "取消",
    "restore_success": "已恢复{{count}}个减伤表",
    "restore_syncing": "正在同步到云端..."
}
```

- [ ] **Step 4: ko.json に backup セクション追加**

```json
"backup": {
    "backup_button": "백업",
    "restore_button": "복원",
    "export_title": "경감표 백업",
    "export_description": "아래 텍스트를 복사하거나 파일을 다운로드하여 안전한 곳에 보관하세요. 메모장이나 스프레드시트에 붙여넣는 것을 권장합니다.",
    "export_syncing": "데이터 동기화 중...",
    "export_plan_count": "{{count}}개의 경감표",
    "copy_button": "복사",
    "copy_success": "클립보드에 복사되었습니다",
    "download_button": "파일 다운로드",
    "download_success": "다운로드 완료",
    "restore_title": "백업에서 복원",
    "restore_description": "백업한 텍스트를 아래 영역에 붙여넣거나 다운로드한 파일을 선택하세요.",
    "restore_paste_placeholder": "백업 JSON을 여기에 붙여넣기...",
    "restore_file_select": "파일 선택",
    "restore_button_label": "복원",
    "restore_invalid_json": "백업 데이터가 올바르지 않습니다. 올바른 백업 텍스트를 붙여넣어 주세요.",
    "restore_confirm_1_title": "경감표를 복원하시겠습니까?",
    "restore_confirm_1_message": "현재 경감표가 백업 내용으로 덮어쓰기됩니다. 이 작업은 되돌릴 수 없습니다.",
    "restore_confirm_1_continue": "계속",
    "restore_confirm_2_title": "정말 복원하시겠습니까?",
    "restore_confirm_2_message": "백업의 {{backupCount}}개 경감표가 현재 {{currentCount}}개 경감표에 병합 덮어쓰기됩니다.",
    "restore_confirm_2_execute": "복원",
    "restore_confirm_2_cancel": "취소",
    "restore_success": "{{count}}개의 경감표를 복원했습니다",
    "restore_syncing": "클라우드에 동기화 중..."
}
```

- [ ] **Step 5: 不要になるi18nキーを削除**

4言語すべてから以下を削除:
- `sidebar.export_csv`
- `sidebar.csv_exported`

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: バックアップ機能のi18nキー追加（4言語）"
```

---

## Task 2: backupService.ts（ロジック層）

**Files:**
- Create: `src/utils/backupService.ts`

- [ ] **Step 1: backupService.ts を作成**

```typescript
import type { SavedPlan } from '../types';

/** バックアップJSONのバージョン。フォーマット変更時にインクリメント */
const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  exportedAt: string;
  planCount: number;
  plans: SavedPlan[];
}

/**
 * SavedPlan[] からバックアップJSON文字列を生成
 */
export function createBackupJson(plans: SavedPlan[]): string {
  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    planCount: plans.length,
    plans,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * JSON文字列をパースしてバリデーション。
 * 成功時は BackupData を返す。失敗時は null。
 */
export function parseBackupJson(json: string): BackupData | null {
  try {
    const data = JSON.parse(json);
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof data.version !== 'number' ||
      !Array.isArray(data.plans)
    ) {
      return null;
    }
    // 各プランに最低限の必須フィールドがあるか検証
    for (const plan of data.plans) {
      if (!plan.id || !plan.title || !plan.data) {
        return null;
      }
    }
    return data as BackupData;
  } catch {
    return null;
  }
}

/**
 * バックアップのプランを既存プランにマージする。
 * - 同一ID → バックアップ版で上書き
 * - 新規ID → 追加
 * - バックアップに無い既存プラン → そのまま残す
 *
 * ownerIdは現在のユーザーのuidに書き換える。
 */
export function mergePlans(
  existingPlans: SavedPlan[],
  backupPlans: SavedPlan[],
  currentOwnerId: string,
): SavedPlan[] {
  const backupMap = new Map(backupPlans.map((p) => [p.id, p]));
  const merged: SavedPlan[] = [];

  // 既存プランを走査: バックアップにあれば上書き、なければそのまま
  for (const existing of existingPlans) {
    const fromBackup = backupMap.get(existing.id);
    if (fromBackup) {
      merged.push({ ...fromBackup, ownerId: currentOwnerId });
      backupMap.delete(existing.id);
    } else {
      merged.push(existing);
    }
  }

  // バックアップにしかないプランを追加
  for (const newPlan of backupMap.values()) {
    merged.push({ ...newPlan, ownerId: currentOwnerId });
  }

  return merged;
}

/**
 * JSONファイルをダウンロードする
 */
export function downloadBackupFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: コミット**

```bash
git add src/utils/backupService.ts
git commit -m "feat: backupService — エクスポートJSON生成・バリデーション・マージロジック"
```

---

## Task 3: BackupExportModal.tsx（エクスポートモーダル）

**Files:**
- Create: `src/components/BackupExportModal.tsx`

- [ ] **Step 1: BackupExportModal.tsx を作成**

```tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Copy, Download, Loader } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { createBackupJson, downloadBackupFile } from '../utils/backupService';
import { showToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [json, setJson] = useState('');
  const [syncing, setSyncing] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isOpen) {
      setJson('');
      return;
    }

    const run = async () => {
      const planStore = usePlanStore.getState();

      // 1. 編集中のプランをフラッシュ
      if (planStore.currentPlanId) {
        planStore.updatePlan(planStore.currentPlanId, {
          data: useMitigationStore.getState().getSnapshot(),
        });
        planStore.markDirty(planStore.currentPlanId);
      }

      // 2. ログイン中ならPUSH→PULLで全デバイスのデータを最新化
      if (user) {
        setSyncing(true);
        try {
          await planStore.manualSync(user.uid, user.displayName || 'Guest');
        } catch (err) {
          console.error('バックアップ前の同期エラー:', err);
        }
        setSyncing(false);
      }

      // 3. JSON生成
      const plans = usePlanStore.getState().plans;
      setJson(createBackupJson(plans));
    };

    run();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const planCount = json ? JSON.parse(json).planCount : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      showToast(t('backup.copy_success'));
    } catch {
      // fallback: テキストエリアを選択
      const textarea = document.querySelector<HTMLTextAreaElement>('[data-backup-json]');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        showToast(t('backup.copy_success'));
      }
    }
  };

  const handleDownload = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadBackupFile(json, `lopo-backup-${date}.json`);
    showToast(t('backup.download_success'));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[90vw] max-w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-app-lg font-bold text-app-text">
            {t('backup.export_title')}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-app-sm text-app-text-muted">
            {t('backup.export_description')}
          </p>

          {syncing ? (
            <div className="flex items-center gap-2 py-8 justify-center text-app-text-muted">
              <Loader size={16} className="animate-spin" />
              <span className="text-app-sm">{t('backup.export_syncing')}</span>
            </div>
          ) : (
            <>
              <div className="text-app-sm text-app-text-muted font-medium">
                {t('backup.export_plan_count', { count: planCount })}
              </div>
              <textarea
                data-backup-json
                readOnly
                value={json}
                className="w-full h-40 bg-app-bg border border-app-border rounded-lg p-3 text-app-xs text-app-text-muted font-mono resize-none focus:outline-none"
              />
            </>
          )}
        </div>

        {/* フッター */}
        {!syncing && json && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-app-border">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-app-text text-app-bg text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Copy size={14} />
              {t('backup.copy_button')}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
            >
              <Download size={14} />
              {t('backup.download_button')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/BackupExportModal.tsx
git commit -m "feat: BackupExportModal — エクスポートモーダルUI"
```

---

## Task 4: BackupRestoreModal.tsx（復元モーダル）

**Files:**
- Create: `src/components/BackupRestoreModal.tsx`

- [ ] **Step 1: BackupRestoreModal.tsx を作成**

```tsx
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileUp, Loader, AlertTriangle } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { parseBackupJson, mergePlans } from '../utils/backupService';
import { showToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmStage = 'input' | 'confirm1' | 'confirm2' | 'restoring';

export const BackupRestoreModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [stage, setStage] = useState<ConfirmStage>('input');
  const [backupCount, setBackupCount] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const currentCount = usePlanStore((s) => s.plans.length);

  const handleClose = () => {
    setText('');
    setStage('input');
    setError('');
    setBackupCount(0);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
      setError('');
    };
    reader.readAsText(file);
    // input をリセットして同じファイルを再選択可能にする
    e.target.value = '';
  };

  const handleStartRestore = () => {
    setError('');
    const backup = parseBackupJson(text);
    if (!backup) {
      setError(t('backup.restore_invalid_json'));
      return;
    }
    setBackupCount(backup.planCount);
    setStage('confirm1');
  };

  const handleExecuteRestore = async () => {
    setStage('restoring');
    try {
      const backup = parseBackupJson(text)!;
      const planStore = usePlanStore.getState();
      const ownerId = user?.uid ?? 'local';

      // マージ実行
      const merged = mergePlans(planStore.plans, backup.plans, ownerId);

      // Zustand store更新
      planStore.setPlans(merged);

      // 全プランをdirtyにマーク（Firestoreに確実に反映させるため）
      for (const plan of backup.plans) {
        planStore.markDirty(plan.id);
      }

      // 現在開いているプランがバックアップで上書きされた場合、再読み込み
      if (planStore.currentPlanId) {
        const updatedPlan = merged.find((p) => p.id === planStore.currentPlanId);
        if (updatedPlan?.data) {
          useMitigationStore.getState().loadSnapshot(updatedPlan.data);
        }
      }

      // ログイン中は即時Firestore同期
      if (user) {
        await planStore.forceSyncAll(user.uid, user.displayName || 'Guest');
      }

      showToast(t('backup.restore_success', { count: backup.planCount }));
      handleClose();
    } catch (err) {
      console.error('復元エラー:', err);
      setError(String(err));
      setStage('input');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[90vw] max-w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-app-lg font-bold text-app-text">
            {t('backup.restore_title')}
          </h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ステージ: input */}
        {stage === 'input' && (
          <div className="px-5 py-4 flex flex-col gap-3">
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_description')}
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(''); }}
              placeholder={t('backup.restore_paste_placeholder')}
              className="w-full h-40 bg-app-bg border border-app-border rounded-lg p-3 text-app-xs text-app-text font-mono resize-none focus:outline-none focus:border-app-text-muted transition-colors"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
            >
              <FileUp size={14} />
              {t('backup.restore_file_select')}
            </button>
            {error && (
              <p className="text-app-sm text-red-500">{error}</p>
            )}
          </div>
        )}

        {/* ステージ: confirm1 */}
        {stage === 'confirm1' && (
          <div className="px-5 py-6 flex flex-col gap-4 items-center text-center">
            <AlertTriangle size={32} className="text-yellow-500" />
            <h3 className="text-app-md font-bold text-app-text">
              {t('backup.restore_confirm_1_title')}
            </h3>
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_confirm_1_message')}
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => setStage('confirm2')}
                className="flex-1 py-2 rounded-lg bg-yellow-500 text-black text-app-sm font-bold hover:bg-yellow-400 transition-colors cursor-pointer"
              >
                {t('backup.restore_confirm_1_continue')}
              </button>
            </div>
          </div>
        )}

        {/* ステージ: confirm2 */}
        {stage === 'confirm2' && (
          <div className="px-5 py-6 flex flex-col gap-4 items-center text-center">
            <AlertTriangle size={32} className="text-red-500" />
            <h3 className="text-app-md font-bold text-app-text">
              {t('backup.restore_confirm_2_title')}
            </h3>
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_confirm_2_message', {
                currentCount,
                backupCount,
              })}
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
              >
                {t('backup.restore_confirm_2_cancel')}
              </button>
              <button
                onClick={handleExecuteRestore}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-app-sm font-bold hover:bg-red-400 transition-colors cursor-pointer"
              >
                {t('backup.restore_confirm_2_execute')}
              </button>
            </div>
          </div>
        )}

        {/* ステージ: restoring */}
        {stage === 'restoring' && (
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <Loader size={24} className="animate-spin text-app-text-muted" />
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_syncing')}
            </p>
          </div>
        )}

        {/* フッター: inputステージのみ復元ボタン表示 */}
        {stage === 'input' && (
          <div className="px-5 py-4 border-t border-app-border">
            <button
              onClick={handleStartRestore}
              disabled={!text.trim()}
              className={
                text.trim()
                  ? "w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-app-text text-app-bg text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                  : "w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-app-text/20 text-app-text-muted text-app-sm font-bold cursor-not-allowed"
              }
            >
              <Upload size={14} />
              {t('backup.restore_button_label')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/BackupRestoreModal.tsx
git commit -m "feat: BackupRestoreModal — 復元モーダルUI（2段階確認付き）"
```

---

## Task 5: Sidebar.tsx 変更（バックアップボタン追加 + 3点メニュー→ゴミ箱アイコン）

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: importを更新**

ファイル冒頭のimport文を変更:

1. 削除:
   - `MoreVertical` を `lucide-react` の import から除去
   - `Download` を `lucide-react` の import から除去
   - `import { exportPlanToCSV } from '../utils/csvExporter';` を削除

2. 追加:
   - `import { HardDrive } from 'lucide-react';` (既存のlucide importに `HardDrive` を追加)
   - `import { BackupExportModal } from './BackupExportModal';`
   - `import { BackupRestoreModal } from './BackupRestoreModal';`

- [ ] **Step 2: 3点メニュー関連のstate・ロジックを削除**

Sidebar コンポーネント内から以下を削除:
- `menuPlanId`, `setMenuPlanId` state
- `menuRef` ref
- `menuPos`, `setMenuPos` state
- `confirmDeletePlanId`, `setConfirmDeletePlanId` state
- `deleteAnimating`, `setDeleteAnimating` state
- メニュー外クリックの `useEffect`（`menuPlanId` に依存しているもの）
- メニュークローズ時の `useEffect`（`if (!menuPlanId)` のもの）
- `_handleCSVExport` 関数全体
- `isTouchDevice` state（削除確認の文言切替に使用 — ゴミ箱化後は不要になるか確認。他で使っていなければ削除）

注意: `isTouchDevice` は他の場所でも使っている可能性があるので、grep で確認してから削除すること。

- [ ] **Step 3: バックアップ/復元モーダルのstateを追加**

Sidebar コンポーネント内に追加:

```tsx
const [backupExportOpen, setBackupExportOpen] = useState(false);
const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
```

- [ ] **Step 4: 3点メニューをゴミ箱アイコン直置きに変更**

PC用プラン行（`ContentPlanList` コンポーネント内 — 行ごとの `MoreVertical` ボタンとportalメニュー全体）を以下に置き換え:

```tsx
{/* ゴミ箱アイコン（削除） */}
<div className="relative">
    <button
        onClick={(e) => {
            e.stopPropagation();
            if (confirmDeletePlanId === plan.id) {
                // 2回目タップ: 削除実行
                const ps = usePlanStore.getState();
                const authUser = useAuthStore.getState().user;
                if (authUser) {
                    ps.deleteFromFirestore(plan.id, authUser.uid, plan.contentId);
                } else {
                    ps.deletePlan(plan.id);
                }
                setConfirmDeletePlanId(null);
            } else {
                // 1回目タップ: 確認状態に
                setConfirmDeletePlanId(plan.id);
                setTimeout(() => setConfirmDeletePlanId(null), 3000);
            }
        }}
        className={clsx(
            "shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer",
            confirmDeletePlanId === plan.id
                ? "text-red-500 bg-red-500/10"
                : "text-app-text-muted hover:text-red-500 hover:bg-red-500/10"
        )}
    >
        <Trash2 size={9} />
    </button>
</div>
```

注意:
- `confirmDeletePlanId` stateは残す（ゴミ箱の2段階確認に引き続き使用）
- `menuPlanId`, `menuRef`, `menuPos` 関連は削除OK
- `deleteAnimating` は不要になるので削除
- portal全体（`createPortal` でメニューを表示していた部分）を削除

- [ ] **Step 5: Ko-fiリンクの上にバックアップ/復元ボタンを追加**

`{/* Ko-fi 支援リンク — サイドバー最下部 */}` コメントの直前に以下を追加:

```tsx
{/* バックアップ/復元ボタン */}
{!multiSelect.isEnabled && (
    <div className="shrink-0 flex flex-col gap-1.5 px-3 py-2">
        <div className="border-t border-glass-border w-full mb-1" />
        <button
            onClick={() => setBackupExportOpen(true)}
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
        >
            <HardDrive size={12} />
            {isOpen ? t('backup.backup_button') : null}
        </button>
        <button
            onClick={() => setBackupRestoreOpen(true)}
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
        >
            <Upload size={12} />
            {isOpen ? t('backup.restore_button') : null}
        </button>
    </div>
)}
```

`Upload` を lucide-react の import に追加すること。

- [ ] **Step 6: モーダルコンポーネントをレンダリング**

Sidebar の return 文の最後（閉じタグの直前）にモーダルを追加:

```tsx
<BackupExportModal isOpen={backupExportOpen} onClose={() => setBackupExportOpen(false)} />
<BackupRestoreModal isOpen={backupRestoreOpen} onClose={() => setBackupRestoreOpen(false)} />
```

- [ ] **Step 7: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: サイドバーにバックアップ/復元ボタン追加 + 3点メニューをゴミ箱アイコンに変更"
```

---

## Task 6: CSV機能の削除とクリーンアップ

**Files:**
- Delete: `src/utils/csvExporter.ts`
- Modify: `src/components/Sidebar.tsx` (残っている参照があれば)

- [ ] **Step 1: csvExporter.ts を削除**

```bash
rm src/utils/csvExporter.ts
```

- [ ] **Step 2: Sidebar.tsx 内の残参照を確認・削除**

`csvExporter` や `exportPlanToCSV` への参照がSidebar.tsx内に残っていないことを確認する（Task 5 Step 1 で削除済みのはず）。

他のファイルからの参照も grep で確認:

```bash
grep -r "csvExporter\|exportPlanToCSV" src/
```

参照があれば削除する。

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "chore: CSV機能を削除（バックアップ機能に置き換え）"
```

---

## Task 7: ビルド確認・動作テスト

- [ ] **Step 1: TypeScriptビルド確認**

```bash
npx tsc --noEmit
```

エラーがあれば修正する。よくあるパターン:
- 削除したCSV関連の参照が残っている
- i18nキーの型エラー（ある場合）
- import漏れ

- [ ] **Step 2: Viteビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット（修正があった場合）**

```bash
git add -A
git commit -m "fix: ビルドエラー修正"
```
