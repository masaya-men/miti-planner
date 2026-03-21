import type { ContentCategory, ContentLevel } from '../types';
import contentsData from './contents.json';

export interface RawContentData {
  id: string;
  category: ContentCategory;
  level: ContentLevel;
  patch: string;     // e.g. "7.11"
  ja: string;        // Official Japanese Name
  en: string;        // Official English Name
  shortNameJa?: string; // Optional Abbreviation (e.g. 絶エデン, 辺獄4, etc.)
  hasCheckpoint?: boolean; // true if fight has a save-point between phases
  fflogsEncounterId?: number; // FFLogs encounter ID for Rankings API
}

export const RAID_CONTENTS: RawContentData[] = contentsData as RawContentData[];
