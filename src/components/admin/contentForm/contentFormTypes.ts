/** コンテンツデータの型 */
export interface ContentData {
  id: string;
  nameJa: string;
  nameEn: string;
  nameZh: string;
  nameZhHant: string;
  nameKo: string;
  shortNameJa: string;
  shortNameEn: string;
  category: string;
  level: number;
  patch: string;
  seriesId: string;
  order: number;
  fflogsEncounterId: number | null;
  hasCheckpoint: boolean;
}
