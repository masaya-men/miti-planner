/**
 * 検査: ファイル同士の循環 import(A が B を読み、B が A を読む)を新しく増やさない。
 *
 * 目的: 循環があると、読み込み順しだいで「まだ中身の無い値」を掴んで起動時に壊れたり、
 *   ファイルを分けても切り離せず整理が進まなくなる。全体リファクタの「理想の状態」は循環 0
 *   (方針=docs/.private/2026-10-27-lopo-refactor-ideal.md の②)。
 *
 * 方式(歯止め): madge で src/ の import を辿り、見つかった循環を ALLOWED と突き合わせる。
 *   - ALLOWED に無い循環が出たら落ちる(新しく作った)。
 *   - ALLOWED にあるのに無くなった循環も落ちる(直したら ALLOWED から消す=許可を残さない)。
 *   ALLOWED は 0 件を目指して 1 件ずつ減らす。
 * 型だけの import(import type)は実行時に読まれないので数えない(skipTypeImports)。
 *   2026-10-27 の計測 9 件のうち 5 件は型だけの循環で、実行時の循環 4 件は同日に解消した。
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import madge from 'madge';

const ROOT = join(__dirname, '..', '..');

/** 例外として許す循環(src からの相対・madge の表記)。2026-10-27 に 0 件へ解消済み。足すときは理由を添える */
const ALLOWED: string[] = [];

describe('循環 import の検査', () => {
  it('src の循環 import が許可リストと一致する(増えても、直したのに残っていても落ちる)', async () => {
    const res = await madge(join(ROOT, 'src'), {
      fileExtensions: ['ts', 'tsx'],
      tsConfig: join(ROOT, 'tsconfig.app.json'),
      detectiveOptions: { ts: { skipTypeImports: true }, tsx: { skipTypeImports: true } },
    });
    const found = res.circular().map((c) => c.join(' > '));
    const added = found.filter((c) => !ALLOWED.includes(c));
    const fixed = ALLOWED.filter((c) => !found.includes(c));
    expect(added, '新しい循環 import(import の向きを一方通行に直す)').toEqual([]);
    expect(fixed, '直った循環(ALLOWED から消す)').toEqual([]);
  }, 60_000);
});
