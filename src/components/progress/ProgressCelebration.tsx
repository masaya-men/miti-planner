/**
 * お祝い演出コンポーネント。
 * 試作 feat/progress-celebration-proto の Celebration を 1:1 移植。
 *
 * 変更点（試作からの差分）:
 *   - props: onClose → onDismiss
 *   - 「おめでとう！」ハードコード → t('progress.congrats') に i18n 化
 *   - createPortal で document.body へマウント（backdrop-filter 内の fixed 回避）
 *   - 演出ロジック（confetti 3砲・RAIN 72個・閃光リング・スプリング）は変更なし
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useTranslation } from 'react-i18next';

// メイン: 画面全幅を覆う降り注ぎ（ループ）。試作値を踏襲（72個）。
const RAIN = Array.from({ length: 72 });

/** お祝い演出。クリックで onDismiss。 */
export function ProgressCelebration({ icons, onDismiss }: { icons: string[]; onDismiss: () => void }) {
  const { t } = useTranslation();
  const pool = icons; // icons は配列型なので length チェックは不要
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const src = (i: number) => (pool.length ? pool[i % pool.length] : '');

  // アイコン片（img または フォールバックの白い矩形）
  const Piece = ({ s, px, blur }: { s: string; px: number; blur?: boolean }) =>
    s
      ? <img src={s} alt="" width={px} height={px} className="object-contain rounded-md"
          style={{ filter: `drop-shadow(0 0 5px rgba(59,130,246,0.4))${blur ? ' blur(0.7px)' : ''}` }}
          onError={(e) => { (e.currentTarget.style.visibility = 'hidden'); }} />
      : <span className="block rounded-[1px]" style={{ width: 8, height: 13, background: '#fff' }} />;

  // はじけ = canvas-confetti（中央の大砲 + 左右から）。試作値踏襲（particleCount/spread/startVelocity/ticks）。
  useEffect(() => {
    const fire = () => {
      confetti({ particleCount: 150, spread: 100, startVelocity: 55, origin: { y: 0.5 }, scalar: 1.1, ticks: 220 });
      confetti({ particleCount: 70, angle: 60, spread: 70, startVelocity: 50, origin: { x: 0, y: 0.65 } });
      confetti({ particleCount: 70, angle: 120, spread: 70, startVelocity: 50, origin: { x: 1, y: 0.65 } });
    };
    fire();
    const timerId = setTimeout(fire, 550); // もう一段はじけ（試作値踏襲）
    return () => clearTimeout(timerId);
  }, []);

  const overlay = (
    <motion.div
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer"
      initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      {/* はじける閃光リング（試作値踏襲: width/height/border/scale/duration） */}
      <motion.div
        className="absolute left-1/2 top-[42%] rounded-full pointer-events-none"
        style={{ width: 40, height: 40, marginLeft: -20, marginTop: -20, border: '3px solid var(--app-blue)' }}
        initial={{ scale: 0, opacity: 0.9 }}
        animate={{ scale: 20, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* メイン: 上から降り続ける（クリックまでループ）。まっすぐ落下 + 奥行き（大小/薄/ぼかし）。試作値踏襲。 */}
      {RAIN.map((_, i) => {
        const leftPct = (i * 53) % 101;                    // 全幅に散らす
        const tier = i % 3;                                // 0=奥(小・薄・ぼかし) … 2=手前(大)
        const size = tier === 0 ? 16 : tier === 1 ? 24 : 32;
        const dur = 3 + ((i * 7) % 18) / 10;               // 3.0〜4.7s（試作値踏襲）
        const startDelay = 0.75 + ((i * 11) % 16) / 10;    // バーストが飛び出してから降り始める（試作値踏襲）
        return (
          <motion.span key={`r${i}`} className="absolute" style={{ left: `${leftPct}%`, opacity: tier === 0 ? 0.7 : 1 }}
            initial={{ y: -0.16 * vh, rotate: 0, opacity: 0 }}
            animate={{ y: vh * 1.16, rotate: (i % 2 ? 1 : -1) * 360, opacity: [0, 1, 1, 1] }}
            transition={{ duration: dur, delay: startDelay, ease: 'easeIn', repeat: Infinity, repeatDelay: 0 }}>
            <Piece s={src(i + 5)} px={size} blur={tier === 0} />
          </motion.span>
        );
      })}

      {/* おめでとうテキスト（試作値踏襲: textShadow/scale/y/spring stiffness/damping/delay） */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="text-app-5xl font-bold tracking-wide"
          style={{ textShadow: '0 0 18px var(--app-blue)' }}
          initial={{ scale: 0.5, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.12 }}
        >
          {t('progress.congrats')}
        </motion.div>
      </div>
    </motion.div>
  );

  // backdrop-filter（ヘッダーの glass）内の position:fixed は枠基準になり画面外化するため、
  // createPortal で document.body へ直接マウントする。
  return createPortal(overlay, document.body);
}
