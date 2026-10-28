// madge は型定義を同梱しない。noCircularImports.test.ts で使う分だけ宣言する
// (引数は { ファイル: [読んでいるファイル] } のつながり。作り方=lib/importGraph.ts)
declare module 'madge' {
  interface MadgeResult { circular(): string[][] }
  export default function madge(graph: Record<string, string[]>): Promise<MadgeResult>;
}
