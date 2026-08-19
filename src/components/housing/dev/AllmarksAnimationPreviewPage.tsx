import { AllmarksMapRoadDraw } from '../browse/AllmarksMapRoadDraw';

/**
 * DEV専用: Allmarksまとめてインポートの「ワードマップの一角がズームして切り取られ、
 * 道路の線が描かれる→消える→別のマップでまた描かれる」演出を、実際のインポート操作
 * (Allmarksリンク貼り付け)無しで単体確認・微調整するためのプレビュー。
 * 本番build非露出(/housing/dev/allmarks-animation、import.meta.env.DEV ガード)。
 */
export const AllmarksAnimationPreviewPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, padding: 40, justifyContent: 'center' }}>
      <AllmarksMapRoadDraw />
      <AllmarksMapRoadDraw />
      <AllmarksMapRoadDraw />
    </div>
  );
};
