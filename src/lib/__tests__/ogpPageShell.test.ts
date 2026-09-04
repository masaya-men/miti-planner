import { describe, it, expect } from 'vitest';
import { escapeHtml, metaContent, injectSeoSnapshot } from '../ogpPageShell';

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

describe('metaContent', () => {
  it('改行を単一スペースに畳む (meta content 属性に生の改行を残さない)', () => {
    // 実バグ: 物件説明文の末尾改行が content="...🙇\n" を作り、緩いパーサがタグ境界を誤認しうる
    const desc = 'ここでジャンプして入ります。\n落ちたら「客室のドアに移動」で戻れます。\n';
    expect(metaContent(desc)).toBe('ここでジャンプして入ります。 落ちたら「客室のドアに移動」で戻れます。');
  });

  it('連続する空白・タブも1つに畳んで前後を trim する', () => {
    expect(metaContent('  A   B\t\tC  ')).toBe('A B C');
  });

  it('畳んだ後に HTML エスケープも行う', () => {
    expect(metaContent('a\n<b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;');
  });

  it('改行が無ければ escapeHtml と同じ結果 (前後空白のみ trim)', () => {
    expect(metaContent('ミスト・ヴィレッジ 23-6')).toBe('ミスト・ヴィレッジ 23-6');
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

  it('snapshotHtml に $ パターン ($&, $`, $\') が含まれている場合もそのまま差し込む', () => {
    const html = '<body><div id="root"></div></body>';
    const snapshotWithDollarPattern = '<h1>Price: $& other</h1>';
    const result = injectSeoSnapshot(html, snapshotWithDollarPattern);
    expect(result).toBe(`<body><div id="root"><h1>Price: $& other</h1></div></body>`);
  });
});
