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
 * SavedPlan[] からバックアップJSON文字列を生成（整形なし=コンパクト）
 */
export function createBackupJson(plans: SavedPlan[]): string {
  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    planCount: plans.length,
    plans,
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
 * JSON文字列をgzip圧縮してダウンロードする
 */
export async function downloadBackupFile(json: string, filename: string): Promise<void> {
  const encoder = new TextEncoder();
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(json));
      controller.close();
    },
  });
  const compressedStream = inputStream.pipeThrough(new CompressionStream('gzip'));
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const blob = new Blob(chunks as BlobPart[], { type: 'application/gzip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.gz';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ファイルを読み込んでJSON文字列を返す。
 * .gz ファイルはgzip解凍、それ以外はそのままテキストとして読む。
 */
export async function readBackupFile(file: File): Promise<string> {
  if (file.name.endsWith('.gz')) {
    const decompressedStream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const decoder = new TextDecoder();
    return chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  }
  return file.text();
}
