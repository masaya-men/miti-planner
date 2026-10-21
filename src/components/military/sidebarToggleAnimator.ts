import { create } from 'zustand';

/** 軍事レイアウトがマウント中だけ登録する「動き付きのサイドバー開閉 setter」(headerCollapseAnimator と同じ仕組み)。
 *  引数は「開いた状態にしたいか」。標準テーマでは何も登録されないので、Layout は元の setter をそのまま使う(挙動不変)。 */
type Setter = (open: boolean) => void;
export const useSidebarToggleAnimator = create<{ animated: Setter | null; set: (s: Setter | null) => void }>((set) => ({
  animated: null,
  set: (animated) => set({ animated }),
}));

/** 登録されていればそれ、無ければ元の setter を返す(Layout の呼び出し側用・コールバック内で毎回呼ぶ) */
export const pickSidebarSetter = (original: Setter): Setter => useSidebarToggleAnimator.getState().animated ?? original;
