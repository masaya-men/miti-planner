/**
 * ハウジンガーのアイコン表示 (spec §4.2/§4.3 共通部品)。
 * avatarUrl があれば画像、 無ければ名前の頭文字プレースホルダを表示する。
 * サイズは呼び出し側から className で渡す (housing.css 側で token 経由の width/height を定義)。
 */
export interface HousingerAvatarProps {
  avatarUrl: string | null;
  name: string;
  className: string;
}

export const HousingerAvatar: React.FC<HousingerAvatarProps> = ({ avatarUrl, name, className }) => {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span className={`housinger-avatar ${className}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" />
      ) : (
        <span className="housinger-avatar-fallback" aria-hidden="true">
          {initial}
        </span>
      )}
    </span>
  );
};
