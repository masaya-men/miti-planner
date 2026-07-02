import { useAuthStore } from '../../../store/useAuthStore';
import { HousingLoginPrompt } from '../HousingLoginPrompt';

/**
 * 登録ページ (3カラム): 探す/お気に入りと同じ骨格。
 * 未ログイン → 中央にログイン案内。ログイン済 → 3カラムのフォーム枠。
 * 中身 (左=ステッパー/ガイド、中央=5セクション、右=チェック/重複/区画プレビュー) は
 * Task10-14 で本実装する。ここではインライン div のスタブに留め、
 * 存在しない後続コンポーネントを import しない。
 */
export const RegisterPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <div className="housing-register">
        <section className="housing-register-panel housing-register-panel-solo" data-region="center">
          <div className="housing-register-col housing-register-col-center">
            <div data-testid="housing-register-login-prompt">
              <HousingLoginPrompt context="register" registerFlag={false} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="housing-register" data-testid="housing-register-form-root">
      {/* 左カラム: ステッパーナビ + ガイド (Task10-14 で本実装) */}
      <section className="housing-register-panel" data-region="left">
        <div className="housing-register-col housing-register-col-left">
          <div data-testid="housing-register-stepper-nav-stub" />
          <div data-testid="housing-register-guide-stub" />
        </div>
      </section>

      {/* 中央カラム: 5セクションのフォーム (Task10-14 で本実装) */}
      <section className="housing-register-panel" data-region="center">
        <div className="housing-register-col housing-register-col-center">
          <div data-testid="housing-register-section-location-stub" />
          <div data-testid="housing-register-section-images-stub" />
          <div data-testid="housing-register-section-details-stub" />
          <div data-testid="housing-register-section-tags-stub" />
          <div data-testid="housing-register-section-publish-stub" />
        </div>
      </section>

      {/* 右カラム: チェック/重複パネル + 区画マッププレビュー (Task10-14 で本実装) */}
      <section className="housing-register-panel" data-region="right">
        <div className="housing-register-col housing-register-col-right">
          <div data-testid="housing-register-check-panel-stub" />
          <div data-testid="housing-register-duplicate-panel-stub" />
          <div data-testid="housing-register-ward-map-preview-stub" />
        </div>
      </section>
    </div>
  );
};
