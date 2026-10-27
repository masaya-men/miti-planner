# relayout.ts 分割計画(整頓④の 5 つ目・2026-10-27)

## 測った結果
- `src/components/military/relayout.ts` 811 行(CRLF)。90 日で変更 11 / fix 4。
- 1 本の中に「動きの形(keyframe)」「複製の暗幕・ランプ合わせ」「区画の切り分け」「進行中の状態・時刻合わせ」「2 段目に動く部品(表の縁・板・影)」「サイドバーの開閉」「ヘッダーの開閉」の 7 つの仕事が同居。
- 外から使うのは `MilspecLayout.tsx`(relayoutZones / cancelRelayout)とテスト(+ splitZone / PHASE_* 定数)だけ。

## 分け方(`src/components/military/relayout/`)
| ファイル | 中身(元の行) |
|---|---|
| index.ts | 冒頭の説明 1-11・relayoutZones 383-403・外向けの再エクスポート |
| motion.ts | 時間の定数・OUT・CLIP_PAD 14-25(20-21 除く)・zoneOf / steps / frames / carFrames 41-57・PAD / edgeFrames 195-201・zonesOf 407-408 |
| mirror.ts | 複製の暗幕・ランプ合わせ 61-140 |
| split.ts | TRACE_ATTRS 38-39・複製と切り分け 142-285(195-201 除く) |
| run.ts | SETTLE_MAX_FRAMES / PROBES 26-32・進行中の状態 287-381・時刻合わせ 600-641 |
| plates.ts | WS_SEAM 36-37・表の縁 / 板 / 影 427-598 |
| sidebar.ts | VENT_SEAM 20-21・FOOTER_* 33-35・SLIDE_ZONES 405-406・splitTargets / seamOf 409-425・台車とサイドバー開閉 643-759 |
| header.ts | ヘッダー開閉 761-811 |

- 中身は行範囲で機械的に移す(書き換えは `export` の付与と import のみ)。
- 唯一の意味上の変更: `finish` が `relayoutZones` を呼ぶと run.ts ↔ index.ts が循環するため、
  控えの開閉 `queued` に「始める関数 start」を持たせる(`{ change, start: () => relayoutZones(app, change, kind, reduced) }`)。
  渡す引数は同じなので動きは変わらない。
- `import '../relayout'` / `'./relayout'` はフォルダの index.ts に解決されるので呼び出し側は変更なし。

## 検証
- 行の突き合わせ: 元の 811 行が(上記の変更行以外)新ファイルのどこかに 1 回ずつ現れる。
- 既存の relayout.test.ts(594 行)・MilspecLayout.test.tsx・循環 import 検査が通る。
- build exit 0 / test:gate 失敗 0。
