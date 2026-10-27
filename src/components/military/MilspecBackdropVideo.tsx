import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';
import { useVideoLoadRecovery } from '../housing/workspace/useVideoLoadRecovery';
import wallWebm from '../../assets/milspec/wall.webm';
import wallMp4 from '../../assets/milspec/wall.mp4';
import wallPoster from '../../assets/milspec/wall-poster.webp';

/** MIL-SPEC の最奥レイヤー: パネルの隙間から覗く機械の壁動画(spec 2026-09-25 §1 L1 / §5)。
 *  MilspecLayout(= military かつ PC のときだけ描画)の中にだけ置くので、標準テーマとスマホでは
 *  要素自体が作られない = ダウンロード 0。コスト対策の全項目は spec §5 を参照。
 *  タブ非表示で停止し、reduced-motion では poster のまま再生しない。 */
export function MilspecBackdropVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduced) { v.pause(); return; }
    const sync = () => { if (document.hidden) v.pause(); else v.play().catch(() => {}); };
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => document.removeEventListener('visibilitychange', sync);
  }, [reduced]);

  useVideoLoadRecovery(ref, !reduced);

  return (
    <div className="milspec-backdrop" aria-hidden="true" data-ms-backdrop>
      <video
        ref={ref}
        autoPlay={!reduced}
        loop
        muted
        playsInline
        preload={reduced ? 'none' : 'auto'}
        poster={wallPoster}
        disablePictureInPicture
        disableRemotePlayback
      >
        <source src={wallWebm} type="video/webm" />
        <source src={wallMp4} type="video/mp4" />
      </video>
      <div className="milspec-backdrop-veil" />
    </div>
  );
}
