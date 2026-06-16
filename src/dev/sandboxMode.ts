/**
 * 管理画面サンドボックスモードの判定（単一の真実源）。
 * 有効になるのは「dev サーバー (import.meta.env.DEV) かつ MODE==='admin-sandbox'」のときだけ。
 * 本番ビルドでは DEV が false になるため、ここは必ず false を返す。
 *
 * env を引数で受けるのはテスト容易性のため。実コードは引数なしで呼ぶ。
 */
export function isAdminSandbox(
  env: { DEV: boolean; MODE: string } = import.meta.env,
): boolean {
  return env.DEV === true && env.MODE === 'admin-sandbox';
}
