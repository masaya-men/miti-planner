import { describe, it, expect } from 'vitest';
import { escapeHtml, injectSeoSnapshot } from '../ogpPageShell';

describe('escapeHtml', () => {
  it('& " < > をエスケープする', () => {
    expect(escapeHtml('<script>alert("x")</script> & more')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; more',
    );
  });

  it('特殊文字が無ければそのまま返す', () => {
    expect(escapeHtml('ミスト・ヴィレッジ 23-6')).toBe('ミスト・ヴィレッジ 23-6');
  });
});

describe('injectSeoSnapshot', () => {
  it('空の #root に snapshotHtml を差し込む', () => {
    const html = '<body><div id="root"></div><script src="/main.js"></script></body>';
    const result = injectSeoSnapshot(html, '<h1>タイトル</h1>');
    expect(result).toBe('<body><div id="root"><h1>タイトル</h1></div><script src="/main.js"></script></body>');
  });

  it('#root が見つからない場合は元のhtmlをそのまま返す (壊れて何も出ないより安全側)', () => {
    const html = '<body>no root here</body>';
    const result = injectSeoSnapshot(html, '<h1>タイトル</h1>');
    expect(result).toBe(html);
  });
});
