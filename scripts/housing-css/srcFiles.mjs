// src 以下の .tsx を集める(テスト用の __tests__ は除く)。 持ち主の判定と「同じ要素の仲間」の材料。
import fs from 'node:fs';

export function listTsx(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') listTsx(p, out);
    } else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}
