// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { parseBackupJson, shareBackupFile, downloadBackupFile } from '../backupService';

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

describe('shareBackupFile', () => {
    const origCanShare = (navigator as any).canShare;
    const origShare = (navigator as any).share;
    afterEach(() => {
        (navigator as any).canShare = origCanShare;
        (navigator as any).share = origShare;
        vi.restoreAllMocks();
    });

    it('canShare/share 未対応 → unsupported', async () => {
        (navigator as any).canShare = undefined;
        (navigator as any).share = undefined;
        expect(await shareBackupFile('{}', 'b.json')).toBe('unsupported');
    });

    it('canShare(files)===false → unsupported', async () => {
        (navigator as any).canShare = () => false;
        (navigator as any).share = vi.fn();
        expect(await shareBackupFile('{}', 'b.json')).toBe('unsupported');
    });

    it('share 成功 → shared (File 入りで呼ばれる)', async () => {
        (navigator as any).canShare = () => true;
        const share = vi.fn().mockResolvedValue(undefined);
        (navigator as any).share = share;
        expect(await shareBackupFile('{"a":1}', 'b.json')).toBe('shared');
        expect(share).toHaveBeenCalledTimes(1);
        const arg = share.mock.calls[0][0];
        expect(arg.files[0]).toBeInstanceOf(File);
        expect(arg.files[0].name).toBe('b.json');
    });

    it('AbortError → cancelled', async () => {
        (navigator as any).canShare = () => true;
        (navigator as any).share = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
        expect(await shareBackupFile('{}', 'b.json')).toBe('cancelled');
    });

    it('その他エラー → failed', async () => {
        (navigator as any).canShare = () => true;
        (navigator as any).share = vi.fn().mockRejectedValue(new Error('boom'));
        expect(await shareBackupFile('{}', 'b.json')).toBe('failed');
    });
});

describe('downloadBackupFile', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        if (!URL.createObjectURL) (URL as any).createObjectURL = () => '';
        if (!URL.revokeObjectURL) (URL as any).revokeObjectURL = () => {};
    });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('即時に revokeObjectURL を呼ばない（遅延 revoke）', () => {
        const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        downloadBackupFile('{"a":1}', 'b.json');
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(revokeSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(10000);
        expect(revokeSpy).toHaveBeenCalledWith('blob:test');
    });
});
