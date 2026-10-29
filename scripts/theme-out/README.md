# theme-out(計算後の見た目の前後比較)

CSS の書き換え(テーマの値を変数へ・ファイルの移動・クラスの改名)で、見た目の値が 1 つも変わっていないことを確かめる道具。
設計書: `docs/superpowers/specs/2026-10-29-theme-out-of-parts-design.md`

```
node scripts/theme-out/computed-probe.mjs --base=<rev>   # <rev> と作業ツリーを同じ条件で測って比べる(約 1 分)
```

- 対象は `probes.mjs`(画面の状態に頼らず DOM を差し込んで測る)。テーマは light / dark / military+dark / military+light、ハウジングは昼/夜。
- 改名したクラスは target の `selector: { base, head }` に旧名と新名を書く(突き合わせは base 側の名前)。
- 差があれば「probe / テーマ / 要素 / 性質: 前 → 後」を表示して exit 1、全一致で exit 0。MIL-SPEC の CSS が読まれていなければ exit 2。
- visual-regress と同じ base の作業場所の名前を使うので、同時には走らせない。
