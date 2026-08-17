import { describe, it, expect } from 'vitest';
import { buildSharePageSeoSnapshotHtml } from '../_sharePageHandler.js';

describe('buildSharePageSeoSnapshotHtml', () => {
  it('タイトルと説明からスナップショットHTMLを組み立てる', () => {
    const html = buildSharePageSeoSnapshotHtml('アルカディア零式 - LoPo', '4層の軽減プラン');
    expect(html).toBe('<h1>アルカディア零式 - LoPo</h1><p>4層の軽減プラン</p>');
  });

  it('HTML特殊文字をエスケープする', () => {
    const html = buildSharePageSeoSnapshotHtml('<b>x</b>', '"quote"');
    expect(html).toBe('<h1>&lt;b&gt;x&lt;/b&gt;</h1><p>&quot;quote&quot;</p>');
  });
});
