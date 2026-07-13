import type { MockListing } from '../../data/housing/mockListings';
import { mergeListingsForViewer } from './listingPublish';

/**
 * ツアー解決専用の pool を組み立てる (「住所登録なし一時ツアー」計画 Task2)。
 *
 * `mergeListingsForViewer` (公開一覧 + 自分の登録の合流・既存仕様) の結果に、
 * 一時 listing (`useEphemeralListingsStore`) を合流する。
 * id が重複した場合は既存 (mergeListingsForViewer 側) を優先し、一時 listing 側は捨てる
 * (実運用では ephemeral id が `ephemeral-` prefix のため衝突しない想定だが、防御的に既存優先とする)。
 *
 * 注意: この関数は **ツアー解決専用**。「探す一覧」のグリッド表示 (`BrowsePage` の `merged` 等) には
 * 使わないこと。一時 listing を一覧に汚染させないのがこの計画の受け入れ条件。
 */
export function buildTourPool(
  publicListings: MockListing[],
  myListings: MockListing[],
  viewerUid: string | null,
  ephemeral: MockListing[],
  nowMs: number,
): MockListing[] {
  const merged = mergeListingsForViewer(publicListings, myListings, viewerUid, nowMs);
  const byId = new Map(merged.map((l) => [l.id, l]));
  for (const l of ephemeral) {
    if (!byId.has(l.id)) byId.set(l.id, l);
  }
  return Array.from(byId.values());
}
