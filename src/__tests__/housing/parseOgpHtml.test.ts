import { describe, it, expect } from 'vitest';
import { extractBodyText } from '../../lib/housing/parseOgpHtml';

/**
 * extractBodyText の単体テスト (2026-07-10、 B: og-fetch 本文返却)。
 *
 * housingsnap 抜粋 fixture は https://housingsnap.com/47205 の実 HTML の
 * `<div class="main-text-box">` 周辺を faithful に切り出したもの (巨大な全 HTML は
 * コミットしない方針)。 住所行 `crystal | goblin | shirogane | w21 p58.` が
 * og:description の 120 字 truncate に載らず、 本文の入れ子 `<p><p>...</p><p>住所</p></p>`
 * にしか無い、 という実ページの構造をそのまま再現している。
 */

/** housingsnap.com/47205 の main-text-box 周辺を切り出した実 HTML 抜粋。 */
const HOUSINGSNAP_EXCERPT = `<!doctype html>
<html>
<head>
  <title>rainforest [M] - HOUSING SNAP</title>
  <meta property="og:title" content="rainforest [M]">
  <meta property="og:description" content="i've finally had the energy and motivation to redo my personal shirogane home. i opted for an overgrown">
  <style>.main-text-box{color:#333}.hidden{display:none}</style>
  <script type="text/javascript">window.NREUM||(NREUM={});NREUM.info={"beacon":"bam.nr-data.net","licenseKey":"24602fc2e3"}</script>
</head>
<body>
  <header><nav><ul><li>ホーム</li><li>ログイン</li></ul></nav></header>
  <div class="photo-information">
    <div class="main-text-box">
      <p><p>i've finally had the energy and motivation to redo my personal shirogane home. i opted for an overgrown build that felt like a rainforest. i tried to match the colors + vibe with the garden. i'd love if you visited. &#9825;</p>

<p>crystal | goblin | shirogane | w21 p58.
</p></p>
      <div id="social-share"><ul><li class="twitter"><a href="http://twitter.com/intent/tweet?text=rainforest [M]&amp;via=ff14housingsnap">tweet</a></li></ul></div>
    </div>
  </div>
  <footer><p>&copy; HOUSING SNAP</p><script>console.log("footer script")</script></footer>
</body>
</html>`;

describe('extractBodyText', () => {
    it('空文字列 / 非文字列は空文字列を返す', () => {
        expect(extractBodyText('')).toBe('');
        // @ts-expect-error 実行時ガードの確認 (呼び出し側の型崩れ対策)
        expect(extractBodyText(null)).toBe('');
        // @ts-expect-error
        expect(extractBodyText(undefined)).toBe('');
    });

    it('<script> の中身ごと除去する', () => {
        const html = `<div>before</div><script>var x = 1; alert("boom");</script><div>after</div>`;
        const out = extractBodyText(html);
        expect(out).not.toContain('alert');
        expect(out).not.toContain('var x');
        expect(out).toContain('before');
        expect(out).toContain('after');
    });

    it('<style> の中身ごと除去する', () => {
        const html = `<div>visible</div><style>.a{color:red}</style>`;
        const out = extractBodyText(html);
        expect(out).not.toContain('color:red');
        expect(out).toContain('visible');
    });

    it('noscript / svg / nav / header / footer / template の中身も除去する', () => {
        const html = [
            '<nav>NAVLINK</nav>',
            '<header>HEADERBAR</header>',
            '<noscript>NOSCRIPTTEXT</noscript>',
            '<svg><text>SVGTEXT</text></svg>',
            '<template>TEMPLATETEXT</template>',
            '<p>KEEPME</p>',
            '<footer>FOOTERTEXT</footer>',
        ].join('');
        const out = extractBodyText(html);
        expect(out).toContain('KEEPME');
        for (const junk of [
            'NAVLINK',
            'HEADERBAR',
            'NOSCRIPTTEXT',
            'SVGTEXT',
            'TEMPLATETEXT',
            'FOOTERTEXT',
        ]) {
            expect(out).not.toContain(junk);
        }
    });

    it('<head\\b> 除去は <header> と衝突しない (語境界)', () => {
        // <head> は除去、 <header> も (drop 対象なので) 除去、 だが body 本文は残る
        const html = `<head><title>T</title></head><body><header>HB</header><p>BODYTEXT</p></body>`;
        const out = extractBodyText(html);
        expect(out).toBe('BODYTEXT');
    });

    it('ブロック終端 (</p> <br> </div> </li> </h1>-</h6> </tr> </section> </article>) で改行する', () => {
        const html =
            '<h1>title</h1><p>para1</p><p>para2</p><div>divtext</div>' +
            '<ul><li>item1</li><li>item2</li></ul>' +
            'a<br>b<br/>c<br />d' +
            '<section>sec</section><article>art</article>' +
            '<table><tr>row1</tr><tr>row2</tr></table>';
        const out = extractBodyText(html);
        const lines = out.split('\n').filter((l) => l.length > 0);
        expect(lines).toEqual([
            'title',
            'para1',
            'para2',
            'divtext',
            'item1',
            'item2',
            'a',
            'b',
            'c',
            'd',
            'sec',
            'art',
            'row1',
            'row2',
        ]);
    });

    it('maxChars 打ち切りでサロゲートペア (絵文字) を割らない', () => {
        // 3999 文字 + 家の絵文字。 素朴な slice(0, 4000) だと高サロゲートだけが末尾に残る。
        const html = `<p>${'a'.repeat(3999)}🏠</p>`;
        const out = extractBodyText(html, 4000);
        expect(out).toHaveLength(3999);
        // 壊れた高サロゲートが末尾に残っていない
        expect(/[\uD800-\uDBFF]$/.test(out)).toBe(false);
        // 割れずに収まる場合は絵文字ごと残る
        expect(extractBodyText(`<p>${'a'.repeat(3998)}🏠</p>`, 4000)).toMatch(/🏠$/);
    });

    it('各行内の連続空白を 1 個に畳む', () => {
        const html = '<p>hello\t\t   spaced\n\n  world</p>';
        const out = extractBodyText(html);
        expect(out).toBe('hello spaced world');
    });

    it('3 連以上の改行を 2 個に畳む', () => {
        const html = '<p>a</p><p></p><p></p><p></p><p>b</p>';
        const out = extractBodyText(html);
        expect(out).toBe('a\n\nb');
    });

    it('HTML 実体参照を decode する', () => {
        const html = `<p>a &amp; b &lt;c&gt; &quot;d&quot; &#039;e&#039;</p>`;
        const out = extractBodyText(html);
        expect(out).toBe(`a & b <c> "d" 'e'`);
    });

    it('maxChars で打ち切る', () => {
        const html = `<p>${'x'.repeat(100)}</p>`;
        expect(extractBodyText(html, 10)).toBe('x'.repeat(10));
        expect(extractBodyText(html, 10).length).toBe(10);
    });

    it('maxChars 既定は 4000', () => {
        const html = `<p>${'y'.repeat(5000)}</p>`;
        expect(extractBodyText(html).length).toBe(4000);
    });

    it('ネストした script を貪欲に食わず、 間の本文を残す', () => {
        const html =
            '<script>A</script><p>MIDDLE</p><script>B</script><p>END</p>';
        const out = extractBodyText(html);
        expect(out).toContain('MIDDLE');
        expect(out).toContain('END');
        expect(out).not.toContain('A');
        // 'B' 単体は 'END' 等に含まれないことだけ確認
        expect(out.split('\n')).not.toContain('B');
    });

    it('housingsnap 抜粋から住所行が 1 行として取れる (実 HTML fixture)', () => {
        const out = extractBodyText(HOUSINGSNAP_EXCERPT);
        const lines = out.split('\n');
        // 住所行が「1 行」として存在する (前後にゴミが連結していない)
        expect(lines).toContain('crystal | goblin | shirogane | w21 p58.');
        // head / script / style / nav / header / footer は本文に漏れない
        expect(out).not.toContain('NREUM');
        expect(out).not.toContain('bam.nr-data.net');
        expect(out).not.toContain('color:#333');
        expect(out).not.toContain('footer script');
        expect(out).not.toContain('HOUSING SNAP'); // <title> (head 内) は漏れない
        // 説明文本体は残る
        expect(out).toContain('i opted for an overgrown build that felt like a rainforest');
    });
});
