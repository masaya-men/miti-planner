/**
 * sharp(ネイティブ libvips)の遅延読み込み。
 *
 * 公開読みの窓口(housing の version/gallery/listing 等・og-cache の HIT)の起動で sharp を
 * 読まないよう、画像を実際に扱う処理の中で `const sharp = await loadSharp();` として使う。
 * 初回だけ読み込み、GHSA-wq5f-xc86-pv6w 対策(LoPo は SVG を変換しないので SVG 読込を無効化)を
 * 必ずかけてから返す。2 回目以降は同じ Promise を返す。
 * 静的に `import sharp from 'sharp'` しないこと(api/__tests__/noStaticSharpImport.test.ts が見張る)。
 */
type Sharp = typeof import('sharp');

let pending: Promise<Sharp> | null = null;

export function loadSharp(): Promise<Sharp> {
  if (!pending) {
    pending = import('sharp').then((mod) => {
      const sharp = ((mod as { default?: Sharp }).default ?? mod) as Sharp;
      sharp.block({ operation: ['VipsForeignLoadSvg'] });
      return sharp;
    });
    // 読み込みに失敗したら次の呼び出しで読み直せるようにする
    pending.catch(() => { pending = null; });
  }
  return pending;
}
