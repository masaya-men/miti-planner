# 整頓⑦ eslint エラー 0 計画(2026-10-27)

## 計測(基点 `12777c65`・テストの any を許可した後)
- error 700 / warning 132。本体の any 551(api 342・scripts 112・src 97)。
- その他 error: no-unused-vars 55・only-export-components 41・no-empty 14・prefer-const 11・no-irregular-whitespace 11・no-useless-escape 7・no-unused-expressions 5・no-control-regex 3・ban-ts-comment 1・no-useless-catch 1。
- warning: exhaustive-deps 112(後半で別扱い)・使われていない eslint-disable 20。

## 確定方針(再調査不要)
- 動きは変えない。型を付けるだけ。any → 実際の型 / `unknown`+絞り込み / ライブラリの型。
- どうしても any が要る所だけ `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 理由` (各区画で一覧を報告)。
- catch 節は `catch (e)`(unknown)にして `e instanceof Error ? e.message : String(e)` 等。
- no-empty は「わざと無視」なら中にコメント 1 行。no-irregular-whitespace は文字列内なら `　` 等のエスケープへ。
- only-export-components は定数/関数を隣の `*.ts` に移し import を差し替え(区画の中だけで完結させる)。
- テスト用ファイルは any 許可済み。テスト内の他の指摘と、効かなくなった `eslint-disable ... no-explicit-any` コメントは消す。

## 区画(並行・ファイルは重ならない)
| 区画 | 対象 | 件数 |
|---|---|---|
| A1 | `api/housing/**` | 約 137+テスト分 |
| A2 | `api/**` のうち housing 以外(`api/_lib` は触らない) | 約 212+テスト分 |
| B | `scripts/**`・`workers/**` | 約 120 |
| C | `src/**` | 約 200 |

## 検証(各区画)
- `npx eslint <区画>` error 0
- 型: A1/A2 `npx tsc -p tsconfig.api.json --noEmit` / B `scripts`・`workers/*` の tsc / C `npx tsc -b`(自区画のエラー 0)
- 関係テスト: `npx vitest run <区画>`(ハング時は止める)
- 最後に親が eslint 全体・tsc 全部・test:gate・build。commit は親。

## 後半
- exhaustive-deps 112: 動きが変わらない物(setter・ref・[] の useCallback)だけ足し、わざとのものは理由コメントで残す。
