import { useCallback, useEffect, useState } from 'react';

/**
 * 【一時機能】文字のメリハリ・密度の見比べ用切替 (?typo=a|b|c)。
 * 案が決まったら撤去する: このファイル / HousingTypoSwitch.tsx / housing.css の
 * 「typo preview」節 / HousingShell の呼び出し 2 行。
 *  A=今のまま (何もしない) / B=全体 75% (CSS zoom) / C=75% + 読む文字だけ大きく戻す
 */
export type HousingTypoMode = 'a' | 'b' | 'c';

export const TYPO_STORAGE_KEY = 'housing-typo-preview';

export function parseTypo(v: string | null | undefined): HousingTypoMode | null {
  return v === 'a' || v === 'b' || v === 'c' ? v : null;
}

/** URL 優先 → sessionStorage の順で現在の案を決める。どちらも無ければ null (=切替無効)。 */
export function resolveTypo(search: string): HousingTypoMode | null {
  const fromUrl = parseTypo(new URLSearchParams(search).get('typo'));
  if (fromUrl) return fromUrl;
  try {
    return parseTypo(sessionStorage.getItem(TYPO_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persist(mode: HousingTypoMode) {
  try {
    if (mode === 'a') sessionStorage.removeItem(TYPO_STORAGE_KEY);
    else sessionStorage.setItem(TYPO_STORAGE_KEY, mode);
  } catch {
    /* 保存できなくても動作には影響しない */
  }
}

function applyToHtml(mode: HousingTypoMode | null) {
  const el = document.documentElement;
  if (!mode) {
    el.removeAttribute('data-housing-typo');
    return;
  }
  // zoom 本体は housing.css 側 (html[data-housing-typo=b|c] かつ PC 幅のみ)。スマホは属性があっても変わらない。
  el.setAttribute('data-housing-typo', mode);
}

/**
 * HousingShell で 1 回呼ぶ。?typo= があれば sessionStorage に保存し (ページ移動しても維持)、
 * html に data-housing-typo を付ける (B/C の zoom は CSS が PC 幅だけに掛ける)。?typo=a で解除。
 * 戻り値 mode が null の間 (切替を一度も使っていない) は何も表示・変更しない。
 */
export function useHousingTypoPreview(): {
  mode: HousingTypoMode | null;
  setMode: (m: HousingTypoMode) => void;
} {
  const [mode, setModeState] = useState<HousingTypoMode | null>(() =>
    typeof window === 'undefined' ? null : resolveTypo(window.location.search),
  );

  // URL に ?typo= が付いていたら保存 (a は解除=保存削除だが切替部品は出し続ける)
  useEffect(() => {
    const fromUrl = parseTypo(new URLSearchParams(window.location.search).get('typo'));
    if (fromUrl) persist(fromUrl);
  }, []);

  useEffect(() => {
    applyToHtml(mode);
    return () => applyToHtml(null); // /housing を離れたら外す
  }, [mode]);

  const setMode = useCallback((m: HousingTypoMode) => {
    persist(m);
    const url = new URL(window.location.href);
    url.searchParams.set('typo', m);
    window.history.replaceState(window.history.state, '', url.toString());
    setModeState(m);
  }, []);

  return { mode, setMode };
}
