import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';

const PARTICLE_COUNT = 14;
const PARTICLE_RADIUS = 34; // ボタン中心から飛ぶ基準距離(px)
const POP_MS = 420; // housing-fav-pop の再生時間と一致させる (housing.css)
const PARTICLE_MAX_DELAY_MS = 40;
const PARTICLE_LIFETIME_MS = 650; // housing-fav-fly の再生時間と一致させる

interface Bit {
  id: number;
  tx: number;
  ty: number;
  size: number;
  delayMs: number;
}

export interface HousingFavHeartProps {
  listingId: string;
}

/**
 * お気に入りトグルのハートボタン (押下フィードバック付き)。
 *
 * 追加(いいね)時に pop(1.5倍バウンド+軽いひねり) + 多方向へのパーティクル飛散でフィードバックする。
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
      setTimeout(() => setPop(false), POP_MS);
      const now = Date.now();
      setBits(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => {
          // 均等角度に軽いランダム揺らぎ(角度/距離/大きさ/発火タイミング)を足し、
          // 全粒が同じ形で飛ぶ機械的な見た目を避ける。
          const a = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.3;
          const radius = PARTICLE_RADIUS * (0.75 + Math.random() * 0.5);
          return {
            id: now + i,
            tx: Math.cos(a) * radius,
            ty: Math.sin(a) * radius,
            size: 4 + Math.random() * 4,
            delayMs: Math.random() * PARTICLE_MAX_DELAY_MS,
          };
        }),
      );
      setTimeout(() => setBits([]), PARTICLE_MAX_DELAY_MS + PARTICLE_LIFETIME_MS);
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
          style={
            {
              '--fav-tx': `${b.tx}px`,
              '--fav-ty': `${b.ty}px`,
              '--fav-size': `${b.size}px`,
              '--fav-delay': `${b.delayMs}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </button>
  );
};
