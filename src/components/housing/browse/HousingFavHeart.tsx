import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';

const PARTICLE_COUNT = 8;
const PARTICLE_RADIUS = 22; // ボタン中心から飛ぶ距離(px)

interface Bit {
  id: number;
  tx: number;
  ty: number;
}

export interface HousingFavHeartProps {
  listingId: string;
}

/**
 * お気に入りトグルのハートボタン (押下フィードバック付き)。
 *
 * 追加(いいね)時に pop(1.35倍のバウンド) + 8方向へのパーティクル飛散でフィードバックする。
 * 解除時はフィードバックなし。状態は useHousingFavoritesStore に永続。色はハウジングの
 * ハニーゴールド(--housing-honey)で統一。prefers-reduced-motion では pop/粒子を無効化(CSS側)。
 */
export const HousingFavHeart: React.FC<HousingFavHeartProps> = ({ listingId }) => {
  const { t } = useTranslation();
  const favIds = useHousingFavoritesStore((s) => s.ids);
  const addFav = useHousingFavoritesStore((s) => s.add);
  const removeFav = useHousingFavoritesStore((s) => s.remove);
  const isFav = favIds.includes(listingId);

  const [pop, setPop] = useState(false);
  const [bits, setBits] = useState<Bit[]>([]);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isFav) {
        removeFav(listingId);
        return;
      }
      addFav(listingId);
      setPop(true);
      setTimeout(() => setPop(false), 320);
      const now = Date.now();
      setBits(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => {
          const a = (Math.PI * 2 * i) / PARTICLE_COUNT;
          return { id: now + i, tx: Math.cos(a) * PARTICLE_RADIUS, ty: Math.sin(a) * PARTICLE_RADIUS };
        }),
      );
      setTimeout(() => setBits([]), 600);
    },
    [isFav, listingId, addFav, removeFav],
  );

  return (
    <button
      type="button"
      className={`housing-card-fav${isFav ? ' is-on' : ''}${pop ? ' is-pop' : ''}`}
      aria-label={t('housing.card.favorite')}
      aria-pressed={isFav}
      onClick={toggle}
    >
      <Heart size={16} aria-hidden="true" />
      {bits.map((b) => (
        <span
          key={b.id}
          className="housing-fav-particle"
          aria-hidden="true"
          style={{ '--fav-tx': `${b.tx}px`, '--fav-ty': `${b.ty}px` } as React.CSSProperties}
        />
      ))}
    </button>
  );
};
