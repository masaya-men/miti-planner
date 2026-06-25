import { describe, expect, it } from 'vitest';
import { parseBackupJson } from '../backupService';

describe('parseBackupJson 圧縮プラン対応', () => {
  it('compressedData のみ(data 無し)のプランを含むバックアップを有効と判定する', () => {
    const json = JSON.stringify({
      version: 1,
      exportedAt: '2026-06-25T00:00:00.000Z',
      planCount: 2,
      plans: [
        { id: 'a', title: '通常', data: { currentLevel: 100 } },
        { id: 'b', title: '圧縮', compressedData: 'BASE64DUMMY' }, // data 無し
      ],
    });
    const result = parseBackupJson(json);
    expect(result).not.toBeNull();
    expect(result!.plans).toHaveLength(2);
  });

  it('data も compressedData も無いプランは無効(null)', () => {
    const json = JSON.stringify({
      version: 1, exportedAt: '', planCount: 1,
      plans: [{ id: 'x', title: 'no-data' }],
    });
    expect(parseBackupJson(json)).toBeNull();
  });
});
