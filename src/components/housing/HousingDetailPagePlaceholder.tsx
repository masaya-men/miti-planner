// src/components/housing/HousingDetailPagePlaceholder.tsx
/**
 * /housing/p/:id プレースホルダ（Sub-spec 2 で本実装）
 *
 * Foundation では HousingComingSoonPage を再利用するだけ。
 * URL 直リンクが SPA fallback で / に飛ばされず、housing 配下に
 * 留まるためのルート枠。
 */
import { HousingComingSoonPage } from './HousingComingSoonPage';

export const HousingDetailPagePlaceholder: React.FC = () => {
  return <HousingComingSoonPage />;
};
