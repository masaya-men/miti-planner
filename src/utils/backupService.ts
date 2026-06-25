import type { SavedPlan } from '../types';

/** バックアップJSONのバージョン。フォーマット変更時にインクリメント */
const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  exportedAt: string;
  planCount: number;
  plans: SavedPlan[];
}

/** エクスポート時に除外するフィールド（個人情報保護） */
const STRIP_FIELDS: (keyof SavedPlan)[] = ['ownerId', 'ownerDisplayName'];

/**
 * SavedPlan[] からバックアップJSON文字列を生成。
 * ownerId / ownerDisplayName を除外して個人情報を含めない。
 */
export function createBackupJson(plans: SavedPlan[]): string {
  const sanitized = plans.map((plan) => {
    const copy = { ...plan };
    for (const field of STRIP_FIELDS) {
      delete (copy as Record<string, unknown>)[field];
    }
    return copy;
  });
  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    planCount: sanitized.length,
    plans: sanitized,
  };
  return JSON.stringify(data);
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
    // data か compressedData のどちらかあれば有効（圧縮プランも復元可能にする）
    for (const plan of data.plans) {
      if (!plan.id || !plan.title || (!plan.data && !plan.compressedData)) {
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
  currentDisplayName: string,
): SavedPlan[] {
  const backupMap = new Map(backupPlans.map((p) => [p.id, p]));
  const merged: SavedPlan[] = [];

  // 既存プランを走査: バックアップにあれば上書き、なければそのまま
  for (const existing of existingPlans) {
    const fromBackup = backupMap.get(existing.id);
    if (fromBackup) {
      merged.push({ ...fromBackup, ownerId: currentOwnerId, ownerDisplayName: currentDisplayName });
      backupMap.delete(existing.id);
    } else {
      merged.push(existing);
    }
  }

  // バックアップにしかないプランを追加
  for (const newPlan of backupMap.values()) {
    merged.push({ ...newPlan, ownerId: currentOwnerId, ownerDisplayName: currentDisplayName });
  }

  return merged;
}

/**
 * JSONファイルをダウンロードする（平文JSON、透明性のため圧縮しない）。
 * iOS Safari 等で click 直後の即時 revoke が保存を壊すため、DOM 挿入 + 遅延 revoke にする。
 */
export function downloadBackupFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // click のナビゲーションが非同期に走る環境で URL を奪わないよう遅延して revoke する。
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * バックアップJSONを Web Share でファイルとして共有する（iOS で「ファイルに保存」等が選べる）。
 * ローカル完結＝URL も作らずサーバーにも送らない。全プラン入りの1ファイルをそのまま渡す。
 * @returns 'shared'=共有した / 'cancelled'=ユーザーが共有シートを閉じた / 'unsupported'=非対応 / 'failed'=失敗
 */
export async function shareBackupFile(
  json: string,
  filename: string,
): Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'> {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return 'unsupported';
    const file = new File([json], filename, { type: 'application/json' });
    if (!navigator.canShare({ files: [file] })) return 'unsupported';
    await navigator.share({ files: [file], title: filename });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}
