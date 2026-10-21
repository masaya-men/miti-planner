import { create } from 'zustand';

/** 軍事レイアウトがマウント中だけ登録する「動き付きのヘッダー開閉 setter」。
 *  標準テーマでは何も登録されないので、Layout は元の setter をそのまま使う(挙動不変)。 */
type Setter = React.Dispatch<React.SetStateAction<boolean>>;
export const useHeaderCollapseAnimator = create<{ animated: Setter | null; set: (s: Setter | null) => void }>((set) => ({
  animated: null,
  set: (animated) => set({ animated }),
}));

/** 登録されていればそれ、無ければ元の setter を返す(Layout の呼び出し側用・コールバック内で毎回呼ぶ) */
export const pickCollapseSetter = (original: Setter): Setter => useHeaderCollapseAnimator.getState().animated ?? original;
