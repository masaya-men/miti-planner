/**
 * api/og/_faviconBase64.ts を生成する。
 * favicon 画像を変更した場合は `node scripts/generate-favicon-base64.cjs` を実行する。
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'public', 'icons', 'favicon-192x192.png');
const DEST = path.join(__dirname, '..', 'api', 'og', '_faviconBase64.ts');

const buf = fs.readFileSync(SOURCE);
const b64 = buf.toString('base64');
const content = `// 自動生成: ${path.relative(path.join(__dirname, '..'), SOURCE).replace(/\\/g, '/')} を base64 エンコード
// 再生成: node scripts/generate-favicon-base64.cjs
export const FAVICON_BASE64 = "data:image/png;base64,${b64}";
`;
fs.writeFileSync(DEST, content);
console.log(`wrote ${DEST} (${b64.length} base64 bytes)`);
