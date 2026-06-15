// 共有フローの初期ビュー判定(純粋関数・PC/スマホ共通の 1 ソース)。
// PC ShareButtons と同じルール:
//   - 未ログイン        → コピー共有へ直行(共同編集はログイン必須なので 2 択を出さない)
//   - ログイン済み・ON  → オーナーパネル直行
//   - ログイン済み・OFF → コピー/共同編集の 2 択
export type ShareView = 'none' | 'choice' | 'copy' | 'panel';

export function resolveInitialShareView(
  { user, isOn }: { user: unknown; isOn: boolean },
): Exclude<ShareView, 'none'> {
  if (!user) return 'copy';
  return isOn ? 'panel' : 'choice';
}
