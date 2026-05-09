// Phase B-1.5 Task 16: SharePage を「ルーター専用」に最小化。
// 旧 SharePage は full-page preview + コピー UI を持っていたが、
// 共有 URL 自動取り込みフローでは ShareImportSheet (Layout に常駐) が
// 全プロセスを担当する。 ここでは shareId を受け取って:
//   1. useShareImportFlow.start(shareId) でシートを起動 (loading 状態で即時表示)
//   2. /miti へ replace navigate して URL を更新 (戻るボタンで /share に戻らない)
//   3. 即 unmount (return null)
// だけを行う。
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { useTutorialStore } from '../store/useTutorialStore';

export const SharePage: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (!shareId) {
            navigate('/', { replace: true });
            return;
        }
        // 0. 共有 URL から来たユーザーにはチュートリアルを抑制する。
        //    これを設定しないと、新規ユーザーで「共有取り込みシート」と
        //    「チュートリアル overlay」が同時に開いてしまう (PC) / 500-600ms 後に
        //    モバイルガイドが自動発火してしまう。
        useTutorialStore.getState().setVisitedShare();
        // 1. シート起動 (非同期。 loading 状態で即時表示される)
        useShareImportFlow.getState().start(shareId);
        // 2. /miti へリダイレクト。 replace で「戻る」が /share に戻らないよう保護。
        navigate('/miti', { replace: true });
    }, [shareId, navigate]);

    return null;
};
