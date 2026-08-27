import { useEffect } from 'react';

/**
 * iOS Safari のビューポートずれ補正フック。
 *
 * iOS Safari は「アドレスバーが引っ込んで表示エリアが広がる」タイミングで、
 * `100dvh` 固定 + body スクロールロックの「アプリ的」画面のサイズ計算が
 * ズレたまま戻らなくなることがある(ページを開いた瞬間からズレる /
 * 通常のスクロールでは戻せない / お気に入り登録等でリロードすると直る、という症状)。
 *
 * 対策: `window.visualViewport` の `resize` を監視し、高さが急に増えたら
 * `window.scrollTo(0, 0)` + `documentElement.style.height` を一瞬いじって
 * 強制的にレイアウトを再計算させる。加えて **マウント直後にも無条件で 1 回補正する**
 * (初回描画時点で既にズレていた場合、以後の変化を待つだけでは永久に直らないため)。
 *
 * 元は `Layout.tsx`(軽減表本体)と `HousingShell.tsx`(ハウジング)に個別実装されていた。
 * HousingShell 側の改良版(マウント時 1 回補正あり)をこの共通フックに切り出し、
 * `Layout.tsx` / `HousingShell.tsx` / `CollabJoinerPage.tsx` の 3 箇所で共有する。
 *
 * @param isMobile スマホ幅かどうか。判定方法は呼び出し元ごとに微妙に違うため、
 *   呼び出し元で boolean 化してから渡す。
 */
export function useIOSViewportFix(isMobile: boolean): void {
  useEffect(() => {
    if (!isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let prevHeight = vv.height;
    const resync = () => {
      window.scrollTo(0, 0);
      document.documentElement.style.height = '100%';
      requestAnimationFrame(() => {
        document.documentElement.style.height = '';
      });
    };
    const handleResize = () => {
      const newHeight = vv.height;
      // アドレスバーが引っ込んだ(高さが急に増えた)
      if (newHeight > prevHeight + 50) resync();
      prevHeight = newHeight;
    };
    // input/textarea の blur 時にもスクロール位置をリセット
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(resync, 100);
      }
    };
    // 業界標準パターン(例: CSS-Tricks の --vh 手法)に合わせ、マウント直後にも無条件で 1 回補正する。
    // resize イベント(変化)にしか反応しないと、初回描画時点で既にズレていた場合に直す手段が無い。
    resync();
    vv.addEventListener('resize', handleResize);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      vv.removeEventListener('resize', handleResize);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isMobile]);
}
