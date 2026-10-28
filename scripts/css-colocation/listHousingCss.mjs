// ハウジングの CSS を全部並べる: 入口 housing.css の @import 順の共有ファイル → 部品の隣の CSS(パスの辞書順)。
// 倍率の変換など「ハウジングの CSS 全部」に効かせる道具が使う。 返り値は repo からの相対パス(/ 区切り)。
import fs from 'node:fs';
import path from 'node:path';

export function listHousingCss(root = '.') {
  const entry = fs.readFileSync(path.join(root, 'src/styles/housing.css'), 'utf8');
  const shared = [...entry.matchAll(/@import\s+"\.\/(housing\/[^"]+)";/g)].map((m) => `src/styles/${m[1]}`);
  const components = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p);
      } else if (e.name.endsWith('.css')) components.push(p);
    }
  };
  walk('src/components/housing');
  return [...shared, ...components.sort()];
}
