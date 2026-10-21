import { useEffect } from 'react';

/** MIL-SPEC 見本 v11 の書体 7 種。標準テーマ・スマホでは読み込まない(MilspecLayout 表示時のみ)。 */
export const MILSPEC_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Saira+Semi+Condensed:wght@500;600;700&family=Michroma&family=Doto:wght@900&family=Share+Tech+Mono&family=Orbitron:wght@900&display=swap';

const LINK_ID = 'milspec-fonts';

/** head に書体の <link> を 1 つだけ足す。一度読んだ書体を消すと再読込が起きるのでアンマウントでも残す。 */
export function useMilspecFonts(): void {
  useEffect(() => {
    if (document.getElementById(LINK_ID)) return;
    const link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = MILSPEC_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}
