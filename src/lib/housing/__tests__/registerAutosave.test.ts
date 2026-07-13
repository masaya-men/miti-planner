import { describe, it, expect } from 'vitest';
import { serializeDraft, restoreDraft, hasMeaningfulDraft } from '../registerAutosave';

describe('registerAutosave', () => {
  it('テキスト系フィールドを round-trip する', () => {
    const values = { title: 'わが家', description: 'コメント', dc: 'Elemental', tags: ['x'], postUrl: 'https://x.com/a' };
    const restored = restoreDraft(serializeDraft(values as any));
    expect(restored?.title).toBe('わが家');
    expect(restored?.tags).toEqual(['x']);
  });
  it('壊れた JSON は null', () => {
    expect(restoreDraft('{bad')).toBeNull();
  });
  it('null 入力は null', () => {
    expect(restoreDraft(null)).toBeNull();
  });
});

describe('hasMeaningfulDraft', () => {
  it('空・初期値のみ (title/description 空文字 + 既定 public + publishUntil null) は false', () => {
    // ← このバグの再現: 何も入力していないのに保存/復元通知が出ていた元凶。
    expect(
      hasMeaningfulDraft({
        title: '',
        description: '',
        tags: [],
        visibility: 'public',
        publishUntil: null,
      }),
    ).toBe(false);
  });
  it('空オブジェクトは false', () => {
    expect(hasMeaningfulDraft({})).toBe(false);
  });
  it('空白のみのタイトル/コメントは false (trim)', () => {
    expect(hasMeaningfulDraft({ title: '   ', description: '\n\t' })).toBe(false);
  });
  it('既定の public 単独では false', () => {
    expect(hasMeaningfulDraft({ visibility: 'public' })).toBe(false);
  });
  it('タイトルに実入力があれば true', () => {
    expect(hasMeaningfulDraft({ title: 'カフェ' })).toBe(true);
  });
  it('コメントに実入力があれば true', () => {
    expect(hasMeaningfulDraft({ description: '素敵な家' })).toBe(true);
  });
  it('タグが1つ以上あれば true', () => {
    expect(hasMeaningfulDraft({ tags: ['和風'] })).toBe(true);
  });
  it('住所フィールドが埋まっていれば true', () => {
    expect(hasMeaningfulDraft({ area: 'ミスト' })).toBe(true);
    expect(hasMeaningfulDraft({ ward: 3 })).toBe(true);
  });
  it('公開設定を private に変えていれば true (意図的な入力)', () => {
    expect(hasMeaningfulDraft({ visibility: 'private' })).toBe(true);
  });
  it('公開終了日時があれば true', () => {
    expect(hasMeaningfulDraft({ publishUntil: 1_700_000_000_000 })).toBe(true);
  });
  it('SNS URL があれば true', () => {
    expect(hasMeaningfulDraft({ postUrl: 'https://x.com/a/status/1' })).toBe(true);
  });
});
