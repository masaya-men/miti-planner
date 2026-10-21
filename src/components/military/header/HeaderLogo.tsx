import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MilspecDecal, MilspecMark } from '../MilspecDecor';
import { headerLayout, HDR_BASE_MW } from '../headerGeometry';

const DECOR = headerLayout(HDR_BASE_MW).decor;

/** H1 ロゴ(見本 js:867-869)。押すとホームへ。走るハイライト(sweep)はホバーで 1 回。
 *  親は「ヘッダー区画」(position:absolute の座標系)。座標は headerLayout の decor。 */
export function HeaderLogo() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logo, decal, idH1 } = DECOR;
  return (
    <>
      <button type="button" className="milspec-logo" style={{ left: logo.x, top: logo.y }} aria-label={t('app.return_home')} onClick={() => navigate('/')}>
        LoPo<span className="milspec-logo-sweep" />
      </button>
      <MilspecDecal text="MIL-SPEC" style={{ left: decal.x, top: decal.y }} />
      <MilspecMark text="H1" style={{ left: idH1.x, top: idH1.y }} />
    </>
  );
}
