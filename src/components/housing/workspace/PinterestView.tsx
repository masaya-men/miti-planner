/**
 * Phase 3: 物件カードグリッド
 *
 * クリック動作:
 * - `/housing/listing/:listingId` に navigate (background-location state 付き)
 *   → App.tsx 側で背景に一覧を残したままモーダル詳細を被せる
 * - URL 直アクセスやリロード時はフルページ詳細にフォールバック (App.tsx 側で処理)
 *
 * 以前の `expandedId` その場展開 (HousingCardExpanded) は Phase 3 で廃止。
 */
import { useLocation, useNavigate } from 'react-router-dom';
import type { MockListing } from '../../../data/housing/mockListings';
import { HousingCard } from './HousingCard';

export interface PinterestViewProps {
    listings: MockListing[];
    /**
     * 旧 `/housing/p/:listingId` 用に残しているが、 Phase 3 では未使用。
     * 詳細表示は `/housing/listing/:listingId` 経由に移行済。
     */
    initialExpandedId?: string;
}

export const PinterestView: React.FC<PinterestViewProps> = ({ listings }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const openDetail = (id: string) => {
        navigate(`/housing/listing/${id}`, {
            state: { backgroundLocation: location },
        });
    };

    return (
        <div className="housing-pinterest-grid">
            {listings.map((listing) => (
                <div key={listing.id} className="housing-pinterest-item">
                    <HousingCard
                        listing={listing}
                        onClick={() => openDetail(listing.id)}
                    />
                </div>
            ))}
        </div>
    );
};
