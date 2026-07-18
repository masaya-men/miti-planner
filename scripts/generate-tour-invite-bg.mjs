// 使い方: node scripts/generate-tour-invite-bg.mjs
// src/assets/og/tour-invite-bg.jpg → api/og/_tourInviteBg.generated.ts (base64 data URI 埋め込み)
// **正典は src/assets/og/tour-invite-bg.jpg**。画像を差し替えたら本スクリプトを再実行する。
import { readFileSync, writeFileSync } from 'fs';

const buf = readFileSync('src/assets/og/tour-invite-bg.jpg');
const base64 = buf.toString('base64');
const dataUri = `data:image/jpeg;base64,${base64}`;

writeFileSync(
  'api/og/_tourInviteBg.generated.ts',
  `// 生成物。編集しないこと。scripts/generate-tour-invite-bg.mjs で再生成する。\nexport const TOUR_INVITE_BG_DATA_URI = '${dataUri}';\n`,
);
console.log(`_tourInviteBg.generated.ts 生成完了: base64 ${(base64.length / 1024).toFixed(0)}KB`);
