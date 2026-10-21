import React from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecArmor } from './MilspecArmor';
import { MilspecStencil } from './MilspecDecor';
import type { PlacedPanel, StretchFrame } from './armor/types';
import './footer/milspecFooter.css';
// 副作用 import: i18next の初期化(useTranslation は初期化済みインスタンスが無いとキー文字列を返す)
import '../../i18n';

/** 見本 v11 js:985 のフッター装甲。区画の基準幅 MW=1189・高さ 22。横は x>MW/2 の点が動く */
const MW = 1189;
const FOOTER_FRAME: StretchFrame = { w0: MW, h0: 22, sx: MW / 2, sy: 22 };
const FOOTER_PANELS: PlacedPanel[] = [{
  x: 0, y: 0, w: MW, h: 22,
  spec: { tone: 'chs', b: 2, pts: [[0, 0], [MW - 10, 0], [MW, 10], [MW, 22], [8, 22], [0, 14]], wx: { chips: 0.6 } },
}];

/**
 * フッター: 見本 v11 の 22px の帯(js:985-991, 1109 / css:549-562)。
 * MIL-SPEC 刻印・著作権 1 行・右に 法的情報▴ / Discord / X。
 * 法的情報の一覧は区画の上にはみ出して出る(開く動きは WAAPI 300ms = 見本 js:1109)。
 */
export const MilspecFooter: React.FC = () => {
  const { t } = useTranslation();
  const [legalOpen, setLegalOpen] = React.useState(false);
  const popRef = React.useRef<HTMLDivElement>(null);

  // 開いた直後に下から持ち上がる動き(見本 js:1109。動きを減らす設定のときは無し)
  React.useLayoutEffect(() => {
    const el = popRef.current;
    if (!legalOpen || !el || typeof el.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(-1px)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
      { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [legalOpen]);

  const close = () => setLegalOpen(false);

  return (
    <div className="milspec-ftr" data-milspec-footer>
      <MilspecArmor id="ftr" frame={FOOTER_FRAME} panels={FOOTER_PANELS} />
      <MilspecStencil en="MIL-SPEC" hi style={{ left: 12, top: 8.5 }} />
      <span className="milspec-flink static" style={{ left: 62, top: 7.5 }}>
        {t('footer.copyright')} · {t('footer.disclaimer')}
      </span>
      <div className="milspec-ftr-right">
        <span className="milspec-ftr-legalwrap">
          <button type="button" className="milspec-flink" aria-expanded={legalOpen} onClick={() => setLegalOpen((v) => !v)}>
            {t('footer.legal')} ▴
          </button>
          {legalOpen && (
            <>
              <div className="milspec-ftr-backdrop" onClick={close} />
              <div ref={popRef} className="milspec-legal-pop">
                <a href="/privacy" onClick={close}>{t('footer.privacy_policy')}</a>
                <a href="/terms" onClick={close}>{t('footer.terms')}</a>
                <a href="/about" onClick={close}>{t('footer.about')}</a>
                <a href="/about#contact" onClick={close}>{t('footer.contact')}</a>
              </div>
            </>
          )}
        </span>
        <a className="milspec-flink" href="https://discord.gg/z7uypbJSnN" target="_blank" rel="noopener noreferrer">{t('footer.discord')}</a>
        <a className="milspec-flink" href="https://x.com/lopoly_app" target="_blank" rel="noopener noreferrer">{t('footer.x_official')}</a>
      </div>
    </div>
  );
};
