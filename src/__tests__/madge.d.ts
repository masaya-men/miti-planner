// madge は型定義を同梱しない。noCircularImports.test.ts で使う分だけ宣言する
declare module 'madge' {
  interface MadgeResult { circular(): string[][] }
  export default function madge(path: string, config?: Record<string, unknown>): Promise<MadgeResult>;
}
