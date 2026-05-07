# Housing Tour Phase 1 — Sub-spec 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジングツアーの裏側土台を作る — `/housing` ルート登録、Firestore 型定義、セキュリティルール追加、Coming Soon ページ表示まで。UI 本体は Sub-spec 2 で実装する。

**Architecture:** 既存 LoPo の React Router + Zustand + Firebase Auth + Firestore + Tailwind v4 + i18next パターンを踏襲。コンポーネントは `src/components/housing/` に隔離して既存コードと干渉しない。型は `src/types/housing.ts` に集約、定数は `src/constants/housing.ts`。Firestore rules は housing コレクション群を新規追加（既存ルールに干渉しない）。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + react-i18next + react-router-dom + Firebase Auth + Firestore + Vitest

**設計書参照:** `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` の §2.1 / §4 / §13 / §18 Sub-spec 1

---

## File Structure

新規作成ファイル:

```
src/types/housing.ts                                    # 全 Firestore ドキュメント型定義
src/constants/housing.ts                                # area / size / DC / role 等の定数
src/components/housing/
  ├─ index.ts                                           # 再エクスポート
  ├─ HousingComingSoonPage.tsx                          # /housing で表示するページ
  ├─ HousingDetailPagePlaceholder.tsx                   # /housing/p/:id (Sub-spec 2 で実装、Foundation はプレースホルダ)
  └─ HousingTourPagePlaceholder.tsx                     # /housing/tour/:id (同上)
src/__tests__/housing/
  ├─ housingTypes.test.ts                               # 型ガード関数テスト
  ├─ HousingComingSoonPage.test.tsx                     # コンポーネントレンダリングテスト
  └─ housingConstants.test.ts                           # 定数の網羅性確認
```

修正ファイル:

```
src/App.tsx                                              # /housing 系ルート 3 本追加
src/locales/ja.json, en.json, ko.json, zh.json          # housing.* キー群追加
firestore.rules                                          # housing_listings / housing_tours / housing_user_meta / housing_favorites / featureSessions ルール追加
```

---

## Task 1: Housing 型定義モジュールを作成

**Files:**
- Create: `src/types/housing.ts`
- Test: `src/__tests__/housing/housingTypes.test.ts`

設計書 §4 (データモデル) を `src/types/housing.ts` に反映。型ガード関数も同梱。

- [ ] **Step 1: テストファイルを先に書く**

```typescript
// src/__tests__/housing/housingTypes.test.ts
import { describe, it, expect } from 'vitest';
import {
  isValidHousingArea,
  isValidHousingSize,
  isValidImageMode,
  isValidReportReason,
  type HousingListing,
} from '../../types/housing';

describe('housingTypes', () => {
  describe('isValidHousingArea', () => {
    it('returns true for known areas', () => {
      expect(isValidHousingArea('Mist')).toBe(true);
      expect(isValidHousingArea('LavenderBeds')).toBe(true);
      expect(isValidHousingArea('Goblet')).toBe(true);
      expect(isValidHousingArea('Shirogane')).toBe(true);
      expect(isValidHousingArea('Empyreum')).toBe(true);
    });
    it('returns false for unknown areas', () => {
      expect(isValidHousingArea('Atlantis')).toBe(false);
      expect(isValidHousingArea('')).toBe(false);
    });
  });

  describe('isValidHousingSize', () => {
    it('returns true for known sizes', () => {
      expect(isValidHousingSize('S')).toBe(true);
      expect(isValidHousingSize('M')).toBe(true);
      expect(isValidHousingSize('L')).toBe(true);
      expect(isValidHousingSize('Apartment')).toBe(true);
      expect(isValidHousingSize('PrivateRoom')).toBe(true);
    });
    it('returns false for unknown sizes', () => {
      expect(isValidHousingSize('XL')).toBe(false);
    });
  });

  describe('isValidImageMode', () => {
    it('returns true for sns / thumbnail / none', () => {
      expect(isValidImageMode('sns')).toBe(true);
      expect(isValidImageMode('thumbnail')).toBe(true);
      expect(isValidImageMode('none')).toBe(true);
    });
    it('returns false for others', () => {
      expect(isValidImageMode('image')).toBe(false);
    });
  });

  describe('isValidReportReason', () => {
    it('returns true for known reasons', () => {
      expect(isValidReportReason('wrong_info')).toBe(true);
      expect(isValidReportReason('griefing')).toBe(true);
      expect(isValidReportReason('nsfw')).toBe(true);
      expect(isValidReportReason('sold')).toBe(true);
      expect(isValidReportReason('other')).toBe(true);
    });
  });

  it('HousingListing type can be constructed (compile-time check)', () => {
    const listing: HousingListing = {
      id: 'abc',
      ownerUid: 'uid1',
      dc: 'Mana',
      server: 'Pandaemonium',
      area: 'Shirogane',
      ward: 3,
      plot: 12,
      size: 'M',
      imageMode: 'none',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isHidden: false,
      reportCount: 0,
    };
    expect(listing.area).toBe('Shirogane');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `npm run test -- housing/housingTypes.test.ts`
Expected: FAIL（モジュールが存在しないため import エラー）

- [ ] **Step 3: 型定義モジュール実装**

```typescript
// src/types/housing.ts
/**
 * ハウジングツアー Firestore データモデル
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §4
 *
 * - 住所中心モデル（ツイート URL は補助情報）
 * - 1 物件 1 カード（住所ハッシュベースではなく auto-id、重複は登録時警告で吸収）
 * - 画像 3 択（SNS URL / サムネ / なし）
 * - LoPo 個人情報を持たない原則準拠（screen_name 等保存しない）
 */

// ─────────────────────────────────────────────
// Enum-like Union Types
// ─────────────────────────────────────────────

export const HOUSING_AREAS = ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'] as const;
export type HousingArea = typeof HOUSING_AREAS[number];

export const HOUSING_SIZES = ['S', 'M', 'L', 'Apartment', 'PrivateRoom'] as const;
export type HousingSize = typeof HOUSING_SIZES[number];

export const IMAGE_MODES = ['sns', 'thumbnail', 'none'] as const;
export type ImageMode = typeof IMAGE_MODES[number];

export const REPORT_REASONS = ['wrong_info', 'griefing', 'nsfw', 'sold', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export const FEATURE_TOOLS = ['miti', 'housing'] as const;
export type FeatureTool = typeof FEATURE_TOOLS[number];

// ─────────────────────────────────────────────
// 型ガード関数
// ─────────────────────────────────────────────

export function isValidHousingArea(value: string): value is HousingArea {
  return (HOUSING_AREAS as readonly string[]).includes(value);
}

export function isValidHousingSize(value: string): value is HousingSize {
  return (HOUSING_SIZES as readonly string[]).includes(value);
}

export function isValidImageMode(value: string): value is ImageMode {
  return (IMAGE_MODES as readonly string[]).includes(value);
}

export function isValidReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

export function isValidFeatureTool(value: string): value is FeatureTool {
  return (FEATURE_TOOLS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────
// Firestore ドキュメント型
// ─────────────────────────────────────────────

/**
 * housing_listings/{id} - メイン物件
 * 設計書 §4.2 参照
 */
export interface HousingListing {
  id: string;
  ownerUid: string;

  // 住所
  dc: string;
  server: string;
  area: HousingArea;
  ward: number;
  plot: number;
  size: HousingSize;
  apartmentRoom?: number;

  // 画像（3 択のいずれか）
  imageMode: ImageMode;
  postUrl?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;

  // ユーザー入力
  tags: string[];
  description?: string;

  // システム
  createdAt: number;
  updatedAt: number;
  isHidden: boolean;
  reportCount: number;
}

/**
 * housing_listings/{id}/reports/{reportId} - 通報サブコレクション
 * 設計書 §4.3 参照
 */
export interface HousingReport {
  reporterUid: string;
  reason: ReportReason;
  comment?: string;
  createdAt: number;
}

/**
 * housing_tours/{id} - ツアールート
 * 設計書 §4.4 参照
 * ゲストは LocalStorage に同等構造を保持（ownerUid='local'）
 */
export interface HousingTour {
  id: string;
  ownerUid: string;
  title: string;
  listingIds: string[];
  startId?: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * housing_favorites/{uid}/items/{listingId} - お気に入り
 * 設計書 §4.5 参照
 */
export interface HousingFavorite {
  listingId: string;
  addedAt: number;
}

/**
 * housing_user_meta/{uid} - ユーザーメタデータ
 * 設計書 §4.6 参照
 * 書き込みは Cloud Function 経由のみ（クライアント直接書き込み禁止）
 */
export interface HousingUserMeta {
  registrationCount: number;
  dailyQuota: {
    remaining: number;
    lastReset: number;
  };
}

/**
 * users/{uid}/featureSessions/{tool} - ツール毎 opt-in フラグ
 * 設計書 §4.7 参照
 * ツール (miti / housing) ごとに「使う」を明示的に opt-in する仕組み
 */
export interface FeatureSession {
  activated: boolean;
  activatedAt: number;
}
```

- [ ] **Step 4: テスト実行 → 成功確認**

Run: `npm run test -- housing/housingTypes.test.ts`
Expected: PASS（5+ tests passed）

- [ ] **Step 5: コミット**

```bash
git add src/types/housing.ts src/__tests__/housing/housingTypes.test.ts
git commit -m "feat(housing): Firestore 型定義モジュール

ハウジングツアー Phase 1 Sub-spec 1 (Foundation) の型定義を新設。

- HousingListing / HousingReport / HousingTour / HousingFavorite / HousingUserMeta / FeatureSession
- area / size / imageMode / reason / tool の Union Type + 型ガード関数
- LoPo 個人情報を持たない原則準拠（screen_name 等は保存しない）

設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §4"
```

---

## Task 2: Housing 定数モジュールを作成

**Files:**
- Create: `src/constants/housing.ts`
- Test: `src/__tests__/housing/housingConstants.test.ts`

各エリアごとの ward / plot 範囲、最大タグ数、最大文字数等の定数を一元管理。ハードコーディング回避。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/housingConstants.test.ts
import { describe, it, expect } from 'vitest';
import {
  HOUSING_LIMITS,
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  REPORT_AUTO_HIDE_THRESHOLD,
  REGISTRATION_INITIAL_BONUS,
  REGISTRATION_DAILY_QUOTA,
  HOUSING_ROUTES,
} from '../../constants/housing';

describe('housingConstants', () => {
  it('限度値定数が論理整合性を持つ', () => {
    expect(HOUSING_LIMITS.MAX_TAGS_PER_LISTING).toBeGreaterThan(0);
    expect(HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH).toBeGreaterThan(0);
    expect(HOUSING_LIMITS.MAX_TOUR_TITLE_LENGTH).toBeGreaterThan(0);
  });

  it('Ward / Plot 範囲が現実的', () => {
    expect(WARD_RANGE.min).toBe(1);
    expect(WARD_RANGE.max).toBeGreaterThanOrEqual(30);
    expect(PLOT_RANGE.min).toBe(1);
    expect(PLOT_RANGE.max).toBeGreaterThanOrEqual(60);
    expect(APARTMENT_ROOM_RANGE.min).toBe(1);
    expect(APARTMENT_ROOM_RANGE.max).toBeGreaterThanOrEqual(90);
  });

  it('通報自動非表示閾値は設計書通り 3', () => {
    expect(REPORT_AUTO_HIDE_THRESHOLD).toBe(3);
  });

  it('登録枠 D 案: 初回 30 + 日次 5', () => {
    expect(REGISTRATION_INITIAL_BONUS).toBe(30);
    expect(REGISTRATION_DAILY_QUOTA).toBe(5);
  });

  it('ルート定数が定義されている', () => {
    expect(HOUSING_ROUTES.TOP).toBe('/housing');
    expect(HOUSING_ROUTES.LISTING_DETAIL_TEMPLATE).toBe('/housing/p/:id');
    expect(HOUSING_ROUTES.TOUR_DETAIL_TEMPLATE).toBe('/housing/tour/:id');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `npm run test -- housing/housingConstants.test.ts`
Expected: FAIL

- [ ] **Step 3: 定数モジュール実装**

```typescript
// src/constants/housing.ts
/**
 * ハウジングツアー定数
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md
 *
 * すべてのマジックナンバー・ハードコード値はここに集約。
 */

// ─────────────────────────────────────────────
// 物件構造の範囲（FF14 仕様）
// ─────────────────────────────────────────────

export const WARD_RANGE = { min: 1, max: 30 } as const;
export const PLOT_RANGE = { min: 1, max: 60 } as const;
export const APARTMENT_ROOM_RANGE = { min: 1, max: 90 } as const;

// ─────────────────────────────────────────────
// ユーザー入力の制限（設計書 §4.2 / §6.1）
// ─────────────────────────────────────────────

export const HOUSING_LIMITS = {
  MAX_TAGS_PER_LISTING: 5,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_TOUR_TITLE_LENGTH: 50,
  MAX_THUMBNAIL_BYTES: 100 * 1024,            // 100KB（圧縮前の上限、後段で 80KB に圧縮）
  THUMBNAIL_DIMENSION_PX: 400,
  MAX_TOUR_LISTINGS: 100,
  MAX_FAVORITES_PER_USER: 100,
} as const;

// ─────────────────────────────────────────────
// 通報・自浄作用（設計書 §9.3）
// ─────────────────────────────────────────────

export const REPORT_AUTO_HIDE_THRESHOLD = 3;

// ─────────────────────────────────────────────
// 登録枠 D 案（設計書 §6.4）
// ─────────────────────────────────────────────

export const REGISTRATION_INITIAL_BONUS = 30;       // 累計 30 件まで無制限
export const REGISTRATION_DAILY_QUOTA = 5;          // 30 件超過後の日次回復数

// ─────────────────────────────────────────────
// ルート定義（設計書 §10.1）
// ─────────────────────────────────────────────

export const HOUSING_ROUTES = {
  TOP: '/housing',
  LISTING_DETAIL_TEMPLATE: '/housing/p/:id',
  TOUR_DETAIL_TEMPLATE: '/housing/tour/:id',
} as const;

/** 物件詳細 URL を組み立て */
export function buildListingDetailPath(id: string): string {
  return `/housing/p/${id}`;
}

/** ツアー詳細 URL を組み立て */
export function buildTourDetailPath(id: string): string {
  return `/housing/tour/${id}`;
}
```

- [ ] **Step 4: テスト実行 → 成功確認**

Run: `npm run test -- housing/housingConstants.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/constants/housing.ts src/__tests__/housing/housingConstants.test.ts
git commit -m "feat(housing): 定数モジュール（範囲・制限・ルート）

ハウジングツアーのマジックナンバーを一元管理。

- WARD / PLOT / APARTMENT_ROOM 範囲
- HOUSING_LIMITS（タグ・文字数・サムネサイズ等）
- REPORT_AUTO_HIDE_THRESHOLD
- 登録枠 D 案（INITIAL_BONUS=30, DAILY_QUOTA=5）
- HOUSING_ROUTES + URL ビルダー関数

設計書: §4.2 / §6.1 / §6.4 / §9.3 / §10.1"
```

---

## Task 3: i18n キーを 4 言語に追加

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`

Coming Soon ページで使う最小限のキー群を追加。`housing.coming_soon.*` 名前空間で。

- [ ] **Step 1: ja.json に追加**

`src/locales/ja.json` の `app` セクション内 `page_title_*` キー群の末尾に以下を追加:

```json
        "page_title_housing": "ハウジングツアー（準備中） | LoPo",
```

`app` セクション後、トップレベルに以下を追加:

```json
    "housing": {
        "coming_soon": {
            "eyebrow": "ハウジングツアー",
            "title": "もうすぐ来ます",
            "lead": "FF14 のハウジングを巡るツアー機能を準備しています。",
            "detail": "投稿写真ギャラリー、お気に入りツアー作成、URL シェアなど、ハウジングを愛するすべての方のための機能を作っています。",
            "back_to_top": "トップに戻る"
        }
    },
```

- [ ] **Step 2: en.json に追加**

```json
        "page_title_housing": "Housing Tour (Coming Soon) | LoPo",
```

```json
    "housing": {
        "coming_soon": {
            "eyebrow": "Housing Tour",
            "title": "Coming Soon",
            "lead": "We're building a tour feature for exploring FF14 housing.",
            "detail": "Photo galleries, favorite tour playlists, shareable URLs — everything for housing enthusiasts is on the way.",
            "back_to_top": "Back to top"
        }
    },
```

- [ ] **Step 3: ko.json に追加**

```json
        "page_title_housing": "하우징 투어 (준비 중) | LoPo",
```

```json
    "housing": {
        "coming_soon": {
            "eyebrow": "하우징 투어",
            "title": "곧 출시",
            "lead": "FF14 하우징을 둘러보는 투어 기능을 준비 중입니다.",
            "detail": "사진 갤러리, 즐겨찾기 투어, URL 공유 등 하우징을 사랑하는 모든 분을 위한 기능을 만들고 있습니다.",
            "back_to_top": "상단으로"
        }
    },
```

- [ ] **Step 4: zh.json に追加**

```json
        "page_title_housing": "房屋导览（准备中） | LoPo",
```

```json
    "housing": {
        "coming_soon": {
            "eyebrow": "房屋导览",
            "title": "即将上线",
            "lead": "我们正在准备 FF14 房屋导览功能。",
            "detail": "照片画廊、收藏导览、URL 分享等，专为热爱房屋装饰的玩家打造。",
            "back_to_top": "返回顶部"
        }
    },
```

- [ ] **Step 5: 4 言語キー整合性確認**

Run: `npm run test 2>&1 | grep -i "i18n\|locale" || echo "no i18n test errors"`
Expected: i18n 関連エラーなし

各 JSON ファイルが valid JSON かを再確認:

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/ja.json'))" && echo "ja OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json'))" && echo "en OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/ko.json'))" && echo "ko OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/zh.json'))" && echo "zh OK"
```
Expected: 全 OK 表示

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): Coming Soon ページの i18n キー（ja/en/ko/zh）

ハウジングツアー Phase 1 Sub-spec 1 (Foundation) で /housing アクセス時に
表示する Coming Soon ページの多言語テキストを追加。

- housing.coming_soon.{eyebrow, title, lead, detail, back_to_top}
- app.page_title_housing（ブラウザタブタイトル）

韓国語・中国語は機械翻訳ベース。本番運用前にネイティブチェック予定。"
```

---

## Task 4: HousingComingSoonPage コンポーネントを作成

**Files:**
- Create: `src/components/housing/HousingComingSoonPage.tsx`
- Test: `src/__tests__/housing/HousingComingSoonPage.test.tsx`

軽減表のテーマ・トークンと完全統一した最小ページ。デザイントークンのみ使用、ハードコーディングなし。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/HousingComingSoonPage.test.tsx
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingComingSoonPage } from '../../components/housing/HousingComingSoonPage';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <HousingComingSoonPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('HousingComingSoonPage', () => {
  it('eyebrow / title / lead / detail / back link を表示する', () => {
    renderPage();
    expect(screen.getByText('ハウジングツアー')).toBeInTheDocument();
    expect(screen.getByText('もうすぐ来ます')).toBeInTheDocument();
    expect(screen.getByText(/FF14 のハウジングを巡る/)).toBeInTheDocument();
    expect(screen.getByText(/投稿写真ギャラリー/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'トップに戻る' })).toHaveAttribute('href', '/');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

Run: `npm run test -- housing/HousingComingSoonPage.test.tsx`
Expected: FAIL（コンポーネント未作成）

- [ ] **Step 3: コンポーネント実装**

```typescript
// src/components/housing/HousingComingSoonPage.tsx
/**
 * /housing アクセス時に表示する Coming Soon ページ
 *
 * Foundation (Sub-spec 1) では UI 本体は実装せず、
 * 「準備中」を多言語で表示するだけのシンプルなランディング。
 *
 * Sub-spec 2 でこのファイルが本格的なギャラリー画面に置き換わる予定。
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §11
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { HOUSING_ROUTES } from '../../constants/housing';

export const HousingComingSoonPage: React.FC = () => {
  useCanonicalUrl(HOUSING_ROUTES.TOP);
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('app.page_title_housing');
  }, [t]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ backgroundColor: 'var(--color-app-bg)', color: 'var(--color-app-text)' }}
    >
      <article className="max-w-2xl text-center">
        {/* eyebrow */}
        <p
          className="text-app-sm tracking-[0.2em] uppercase mb-3"
          style={{ color: 'var(--color-app-text-muted)' }}
        >
          {t('housing.coming_soon.eyebrow')}
        </p>

        {/* title */}
        <h1
          className="text-app-5xl font-bold mb-6"
          style={{ color: 'var(--color-app-text)' }}
        >
          {t('housing.coming_soon.title')}
        </h1>

        {/* lead */}
        <p
          className="text-app-2xl leading-relaxed mb-4"
          style={{ color: 'var(--color-app-text)' }}
        >
          {t('housing.coming_soon.lead')}
        </p>

        {/* detail */}
        <p
          className="text-app-lg leading-relaxed mb-10"
          style={{ color: 'var(--color-app-text-muted)' }}
        >
          {t('housing.coming_soon.detail')}
        </p>

        {/* back link */}
        <Link
          to="/"
          className="inline-block text-app-md tracking-[0.15em] uppercase font-mono border-b border-current pb-1 transition-opacity duration-200 hover:opacity-70"
          style={{ color: 'var(--color-app-text)' }}
        >
          {t('housing.coming_soon.back_to_top')}
        </Link>
      </article>
    </main>
  );
};
```

- [ ] **Step 4: テスト実行 → 成功確認**

Run: `npm run test -- housing/HousingComingSoonPage.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/HousingComingSoonPage.tsx src/__tests__/housing/HousingComingSoonPage.test.tsx
git commit -m "feat(housing): Coming Soon ページコンポーネント

/housing 直アクセスで表示するシンプルなランディング。
Sub-spec 2 で本格 UI に置き換わる暫定実装。

- 全テキスト i18n キー経由（4 言語対応）
- すべてデザイントークン経由、ハードコード値なし
- useCanonicalUrl + document.title で SEO 整合"
```

---

## Task 5: 物件詳細・ツアー詳細のプレースホルダコンポーネント

**Files:**
- Create: `src/components/housing/HousingDetailPagePlaceholder.tsx`
- Create: `src/components/housing/HousingTourPagePlaceholder.tsx`

Sub-spec 2 / 3 で本実装するルート枠だけ用意。Foundation では Coming Soon と同じ表示を流用。

- [ ] **Step 1: HousingDetailPagePlaceholder.tsx 実装**

```typescript
// src/components/housing/HousingDetailPagePlaceholder.tsx
/**
 * /housing/p/:id プレースホルダ（Sub-spec 2 で本実装）
 *
 * Foundation では HousingComingSoonPage を再利用するだけ。
 * URL 直リンクが SPA fallback で / に飛ばされず、housing 配下に
 * 留まるためのルート枠。
 */
import { HousingComingSoonPage } from './HousingComingSoonPage';

export const HousingDetailPagePlaceholder: React.FC = () => {
  return <HousingComingSoonPage />;
};
```

- [ ] **Step 2: HousingTourPagePlaceholder.tsx 実装**

```typescript
// src/components/housing/HousingTourPagePlaceholder.tsx
/**
 * /housing/tour/:id プレースホルダ（Sub-spec 3 で本実装）
 *
 * Foundation では HousingComingSoonPage を再利用するだけ。
 */
import { HousingComingSoonPage } from './HousingComingSoonPage';

export const HousingTourPagePlaceholder: React.FC = () => {
  return <HousingComingSoonPage />;
};
```

- [ ] **Step 3: コミット**

```bash
git add src/components/housing/HousingDetailPagePlaceholder.tsx src/components/housing/HousingTourPagePlaceholder.tsx
git commit -m "feat(housing): 物件詳細・ツアー詳細のルート枠（プレースホルダ）

/housing/p/:id と /housing/tour/:id のルート枠を確保。
Foundation 段階では HousingComingSoonPage を再利用。
Sub-spec 2 / 3 で本実装に差し替え予定。"
```

---

## Task 6: housing コンポーネントの index.ts (バレルエクスポート)

**Files:**
- Create: `src/components/housing/index.ts`

import 文を綺麗に保つためのバレルエクスポート。

- [ ] **Step 1: index.ts 実装**

```typescript
// src/components/housing/index.ts
/**
 * housing コンポーネントのバレルエクスポート
 * 外部からは `import { HousingComingSoonPage } from '@/components/housing'` で使う想定
 */
export { HousingComingSoonPage } from './HousingComingSoonPage';
export { HousingDetailPagePlaceholder } from './HousingDetailPagePlaceholder';
export { HousingTourPagePlaceholder } from './HousingTourPagePlaceholder';
```

- [ ] **Step 2: コミット**

```bash
git add src/components/housing/index.ts
git commit -m "chore(housing): components/housing バレルエクスポート"
```

---

## Task 7: App.tsx に /housing 系ルートを登録

**Files:**
- Modify: `src/App.tsx`

既存ルートと同じパターンで 3 本追加。

- [ ] **Step 1: import 文を追加**

`src/App.tsx` の既存 import 群（`SupportPage` の next 行あたり）に以下を追加:

```typescript
import {
  HousingComingSoonPage,
  HousingDetailPagePlaceholder,
  HousingTourPagePlaceholder,
} from './components/housing';
```

- [ ] **Step 2: <Routes> 内にルート追加**

`/support` 行の直後（`/privacy` の直前）に以下 3 行を追加:

```tsx
<Route path="/housing" element={<HousingComingSoonPage />} />
<Route path="/housing/p/:id" element={<HousingDetailPagePlaceholder />} />
<Route path="/housing/tour/:id" element={<HousingTourPagePlaceholder />} />
```

最終的な `<Routes>` 該当部分:

```tsx
<Route path="/" element={<LandingPage />} />
<Route path="/miti" element={<MitiPlannerPage />} />
<Route path="/share/:shareId" element={<SharePage />} />
<Route path="/support" element={<SupportPage />} />

<Route path="/housing" element={<HousingComingSoonPage />} />
<Route path="/housing/p/:id" element={<HousingDetailPagePlaceholder />} />
<Route path="/housing/tour/:id" element={<HousingTourPagePlaceholder />} />

<Route path="/privacy" element={<PrivacyPolicyPage />} />
```

- [ ] **Step 3: ビルド・型チェック・テスト**

Run:
```bash
npm run test 2>&1 | tail -20
npx tsc --noEmit
```

Expected:
- vitest: 既存 + 新規テスト全 PASS
- tsc: エラー 0

- [ ] **Step 4: dev サーバーで `/housing` 直アクセス動作確認**

Run: `npm run dev`

ブラウザで以下の URL を確認:
- `http://localhost:5173/housing` → Coming Soon ページ表示
- `http://localhost:5173/housing/p/test-id` → Coming Soon ページ表示
- `http://localhost:5173/housing/tour/test-id` → Coming Soon ページ表示
- ライト/ダークテーマ切替が効くこと
- 言語切替（ja/en/ko/zh）でテキストが変わること
- 「トップに戻る」リンクで `/` に遷移すること

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx
git commit -m "feat(housing): /housing 系 3 ルートを App.tsx に登録

- /housing → HousingComingSoonPage
- /housing/p/:id → HousingDetailPagePlaceholder
- /housing/tour/:id → HousingTourPagePlaceholder

Foundation 完了後の動作確認:
- 直アクセスで Coming Soon ページ表示
- ライト/ダーク・4 言語切替動作
- トップへの back リンク動作"
```

---

## Task 8: Firestore セキュリティルールに housing コレクション群を追加

**Files:**
- Modify: `firestore.rules`

設計書 §13 の rules を既存ルールに統合。

- [ ] **Step 1: 既存 helper 関数の確認**

`firestore.rules` の冒頭にある `isAuthenticated()` / `isOwner(uid)` / `isValidString(s, maxLen)` を再利用する。新規 helper は最小限に追加。

- [ ] **Step 2: housing 用 helper を追加**

`firestore.rules` の `// その他すべてのパスへのアクセスを拒否` セクションの直前に、以下を挿入:

```javascript
    // ========================================
    // ハウジング: helper 関数
    // ========================================

    function isValidHousingArea(area) {
      return area in ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'];
    }

    function isValidHousingSize(size) {
      return size in ['S', 'M', 'L', 'Apartment', 'PrivateRoom'];
    }

    function isValidImageMode(mode) {
      return mode in ['sns', 'thumbnail', 'none'];
    }

    function isValidWard(ward) {
      return ward is int && ward >= 1 && ward <= 30;
    }

    function isValidPlot(plot) {
      return plot is int && plot >= 1 && plot <= 60;
    }

    function isValidTags(tags) {
      return tags is list && tags.size() <= 5;
    }

    // ========================================
    // housing_listings コレクション
    // 読み取り: 公開（誰でも閲覧可、isHidden=true は UI 側でフィルタ）
    // 書き込み: 認証済み + 所有者のみ
    // ========================================
    match /housing_listings/{listingId} {
      allow read: if true;

      allow create: if isAuthenticated()
                    && request.auth.uid == request.resource.data.ownerUid
                    && request.resource.data.dc is string
                    && request.resource.data.server is string
                    && isValidHousingArea(request.resource.data.area)
                    && isValidWard(request.resource.data.ward)
                    && isValidPlot(request.resource.data.plot)
                    && isValidHousingSize(request.resource.data.size)
                    && isValidImageMode(request.resource.data.imageMode)
                    && isValidTags(request.resource.data.tags)
                    && request.resource.data.reportCount == 0
                    && request.resource.data.isHidden == false;

      allow update: if isOwner(resource.data.ownerUid)
                    && request.resource.data.ownerUid == resource.data.ownerUid
                    && isValidHousingArea(request.resource.data.area)
                    && isValidWard(request.resource.data.ward)
                    && isValidPlot(request.resource.data.plot)
                    && isValidHousingSize(request.resource.data.size)
                    && isValidImageMode(request.resource.data.imageMode)
                    && isValidTags(request.resource.data.tags)
                    // reportCount / isHidden はクライアントから直接変更不可（Cloud Function 経由のみ）
                    && request.resource.data.reportCount == resource.data.reportCount
                    && request.resource.data.isHidden == resource.data.isHidden;

      allow delete: if isOwner(resource.data.ownerUid);

      // 通報サブコレクション
      match /reports/{reportId} {
        allow read: if false;  // 管理者のみ Admin SDK 経由で読む
        allow create: if isAuthenticated()
                      && request.auth.uid == request.resource.data.reporterUid
                      && request.resource.data.reason in ['wrong_info', 'griefing', 'nsfw', 'sold', 'other'];
        allow update: if false;
        allow delete: if false;
      }
    }

    // ========================================
    // housing_tours コレクション
    // 読み取り: 公開ツアー OR 所有者
    // 書き込み: 所有者のみ
    // ========================================
    match /housing_tours/{tourId} {
      allow read: if (resource != null && resource.data.isPublic == true)
                  || isOwner(resource.data.ownerUid);

      allow create: if isAuthenticated()
                    && request.auth.uid == request.resource.data.ownerUid
                    && isValidString(request.resource.data.title, 50)
                    && request.resource.data.listingIds is list
                    && request.resource.data.isPublic is bool;

      allow update: if isOwner(resource.data.ownerUid)
                    && request.resource.data.ownerUid == resource.data.ownerUid
                    && isValidString(request.resource.data.title, 50);

      allow delete: if isOwner(resource.data.ownerUid);
    }

    // ========================================
    // housing_favorites コレクション
    // /housing_favorites/{uid}/items/{listingId}
    // ========================================
    match /housing_favorites/{uid}/items/{listingId} {
      allow read: if isOwner(uid);
      allow write: if isOwner(uid);
    }

    // ========================================
    // housing_user_meta コレクション
    // 書き込みは Cloud Function 経由のみ（クライアントは登録枠改ざん不可）
    // ========================================
    match /housing_user_meta/{uid} {
      allow read: if isOwner(uid);
      allow write: if false;
    }

    // ========================================
    // users/{uid}/featureSessions/{tool}
    // ツール毎 opt-in フラグ
    // ========================================
    match /users/{uid}/featureSessions/{tool} {
      allow read: if isOwner(uid);
      allow create, update: if isOwner(uid)
                            && tool in ['miti', 'housing']
                            && request.resource.data.activated is bool;
      allow delete: if isOwner(uid);
    }
```

完成形は既存の `// その他すべてのパスへのアクセスを拒否` セクションの **直前** に挿入されている状態。

- [ ] **Step 3: rules ファイル構文チェック**

Run: `npx firebase emulators:start --only firestore --project lopo-app 2>&1 | head -30`

Expected: `Compiled successfully` ライクなメッセージ。Firebase emulator が起動できれば構文 OK。

emulator が利用できない場合は manual review でも OK：括弧の対応、`match` ブロック構造、helper 関数の重複なしを目視確認。

- [ ] **Step 4: コミット**

```bash
git add firestore.rules
git commit -m "feat(housing): Firestore セキュリティルール追加

ハウジングツアー Phase 1 のコレクション群に対するルール:

- housing_listings: read public / write owner-only / 通報サブコレクションは create のみ
- housing_tours: read public-or-owner / write owner-only
- housing_favorites: 完全 owner-only
- housing_user_meta: read owner-only / write Cloud Function 経由のみ
- users/{uid}/featureSessions/{tool}: ツール毎 opt-in フラグ管理

helper 関数で area / size / imageMode / ward / plot / tags の値域検証。
reportCount / isHidden はクライアント直接変更不可（改ざん防止）。

設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §13"
```

---

## Task 9: Firestore ルールをデプロイ + 手動動作確認

**Files:** （変更なし、運用手順のみ）

ルールを本番 Firestore に適用し、未認証アクセスが期待通り拒否されることを確認。

- [ ] **Step 1: Firebase CLI でログイン状態確認**

Run: `npx firebase projects:list 2>&1 | head -10`

Expected: プロジェクト一覧が出る。出ない場合は `npx firebase login` を実行。

- [ ] **Step 2: Firestore ルールをデプロイ**

Run: `npx firebase deploy --only firestore:rules`

Expected: `✔ Deploy complete!`

- [ ] **Step 3: ブラウザコンソールで未認証書き込み拒否を確認**

Chrome DevTools のコンソールで以下を実行（プロダクションサイトを開いて、ログアウト状態で）:

```javascript
// ログアウト状態でテスト
const { db } = await import('/src/lib/firebase.ts');
const { addDoc, collection } = await import('firebase/firestore');

try {
  await addDoc(collection(db, 'housing_listings'), {
    ownerUid: 'fake-uid',
    dc: 'Mana',
    server: 'Pandaemonium',
    area: 'Shirogane',
    ward: 1,
    plot: 1,
    size: 'M',
    imageMode: 'none',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isHidden: false,
    reportCount: 0,
  });
  console.error('FAIL: 未認証で書き込めてしまった');
} catch (e) {
  console.log('OK: 未認証書き込みが拒否された:', e.code);
}
```

Expected: `OK: 未認証書き込みが拒否された: permission-denied`

このテストは UI なしの Foundation 段階では手動で行う。Sub-spec 2 で本格的な書き込みテスト（自分のものは書ける、他人のは書けない等）を追加する。

- [ ] **Step 4: 結果を docs/TODO.md に追記**

`docs/TODO.md` の「現在の状態」セクションの先頭に以下を追加:

```markdown
- **最新セッション（2026-05-07・Housing Foundation 実装）**: ハウジングツアー Phase 1 Sub-spec 1 (Foundation) 実装完了。/housing 直アクセスで Coming Soon ページ表示（4 言語対応・テーマ統一）、Firestore に housing_listings / housing_tours / housing_favorites / housing_user_meta / featureSessions のセキュリティルール追加。未認証書き込み拒否を本番で確認済み。次は Sub-spec 2（Registration & Gallery）の実装プラン作成へ。
```

- [ ] **Step 5: コミット**

```bash
git add docs/TODO.md
git commit -m "docs(todo): Housing Foundation 実装完了を記録"
```

---

## Task 10: Foundation 完了の総合動作確認

**Files:** （変更なし）

全部繋がって動くかをまとめて確認。

- [ ] **Step 1: クリーンビルド**

Run:
```bash
npm run build
```

Expected: `✓ built` でビルド成功、警告ゼロ（or 既存と同レベル）

- [ ] **Step 2: 全テスト実行**

Run: `npm run test`

Expected: 全テスト PASS（既存 + Foundation で追加した 3 ファイル分）

- [ ] **Step 3: tsc 厳密チェック**

Run: `npx tsc --noEmit`

Expected: エラー 0

- [ ] **Step 4: dev サーバーで全ルート確認**

Run: `npm run dev`

ブラウザで:
- `http://localhost:5173/` → ランディング表示
- `http://localhost:5173/miti` → 軽減プランナー表示（既存機能影響なし）
- `http://localhost:5173/housing` → Coming Soon 表示
- `http://localhost:5173/housing/p/test-id` → Coming Soon 表示（プレースホルダ）
- `http://localhost:5173/housing/tour/test-id` → Coming Soon 表示（プレースホルダ）
- ライト/ダーク切替動作
- ja/en/ko/zh 切替で全テキストが変化

- [ ] **Step 5: 設計書要件カバレッジ確認**

設計書 §18 Sub-spec 1 の項目を確認:

| 項目 | 状態 | Task |
|---|---|---|
| ルート登録 / Coming Soon | ✓ | Task 4, 7 |
| Firestore 型定義 | ✓ | Task 1 |
| セキュリティルール追加 | ✓ | Task 8, 9 |
| Auth 統合確認 | ✓ | Task 9（既存 Firebase Auth 使用） |
| featureSessions スキーマ | ✓ | Task 1, 8 |
| 認証必須テスト | ✓ | Task 9（手動）|

すべて ✓ なら Sub-spec 1 完了。

- [ ] **Step 6: 完了をユーザーに通知**

実装担当者は user に「Sub-spec 1 (Foundation) 完了。次は Sub-spec 2 (Registration & Gallery) の実装プラン作成に進めますか？」と確認する。

---

## Self-Review Checklist (作成者向け)

このプランを書き上げた後に確認したこと:

**1. Spec coverage:** 設計書 §18 Sub-spec 1 の全項目を網羅 ✓
- ルート登録 → Task 4, 5, 7
- Coming Soon ページ → Task 3, 4
- Firestore 型定義 → Task 1
- セキュリティルール → Task 8, 9
- Auth 統合確認 → Task 9
- featureSessions → Task 1 (型), Task 8 (rules)
- 認証必須テスト → Task 9 (手動)

**2. Placeholder scan:** TBD / TODO / 「あとで」等の曖昧表現なし ✓

**3. Type consistency:** Task 1 で定義した型を Task 4 / 8 で正しく参照 ✓

**4. Coding 方針 (feedback_code_quality.md):** 
- ファイル分割: types / constants / components が分離 ✓
- デザイントークン: `var(--color-app-*)` のみ使用、ハードコード値なし ✓
- 多言語対応: i18n キー経由、4 言語完備 ✓
- LoPo 主義: 個人情報を持たない設計 ✓

**5. 既存パターン踏襲:**
- Firebase Auth helper (isOwner, isAuthenticated) を再利用 ✓
- `useCanonicalUrl` / `useTranslation` の既存フック流用 ✓
- LegalPage 等の既存ページと同じスタイル方針 ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-housing-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
