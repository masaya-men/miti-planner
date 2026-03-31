# 管理画面ウィザードファースト刷新 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面を「記憶ゼロ・知識ゼロでも確実に操作できる」ウィザードファーストUIに全面刷新する

**Architecture:** 共通ウィザードフレームワーク（AdminWizard）を作り、各ウィザード（Content/Template/Skill/Stats）はステップ定義を渡すだけの構成。既存APIは変更せず、バックアップ復元・監査ログ閲覧の2機能を既存エンドポイントに追加。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, Firebase, i18n (react-i18next)

**Design Spec:** `docs/superpowers/specs/2026-03-31-admin-wizard-redesign.md`

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `src/components/admin/wizard/AdminWizard.tsx` | 共通ウィザードフレームワーク（プログレスバー、戻る/次へ、確認画面、成功画面） |
| `src/components/admin/wizard/useWizard.ts` | ウィザード状態管理フック（現在ステップ、入力データ、バリデーション） |
| `src/components/admin/wizard/ContentWizard.tsx` | コンテンツ追加ウィザード（8ステップ＋確認） |
| `src/components/admin/wizard/TemplateWizard.tsx` | テンプレート登録ウィザード（3分岐＋各フロー） |
| `src/components/admin/wizard/SkillWizard.tsx` | スキル追加ウィザード（11ステップ＋特殊動作＋確認） |
| `src/components/admin/wizard/SkillEditWizard.tsx` | スキル編集ウィザード（ジョブ選択→スキル選択→編集画面） |
| `src/components/admin/wizard/JobWizard.tsx` | ジョブ追加ウィザード（5ステップ＋確認） |
| `src/components/admin/wizard/StatsWizard.tsx` | ステータス更新ウィザード（パッチ追加・修正・レベル設定） |
| `src/components/admin/AdminBackups.tsx` | バックアップ復元画面 |
| `src/components/admin/AdminLogs.tsx` | 監査ログ閲覧画面 |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `src/components/admin/AdminDashboard.tsx` | 全面刷新：アクションカード＋最近の変更＋復元リンク |
| `src/components/admin/AdminLayout.tsx` | サイドバーに復元・ログのナビ追加 |
| `src/App.tsx` | 新ルート追加（/admin/backups, /admin/logs, 各wizard） |
| `api/admin/_templatesHandler.ts` | `?type=backups`, `?type=restore`, `?type=logs` 追加 |
| `src/locales/ja.json` | 全ウィザード・復元・ログのi18nキー追加 |
| `src/locales/en.json` | 同上（英語） |

---

## Task 1: ウィザードフレームワーク（useWizard + AdminWizard）

全ウィザードの土台となる共通フレームワーク。これが完成しないと他のタスクに進めない。

**Files:**
- Create: `src/components/admin/wizard/useWizard.ts`
- Create: `src/components/admin/wizard/AdminWizard.tsx`

- [ ] **Step 1: useWizardフックを作成**

```typescript
// src/components/admin/wizard/useWizard.ts
import { useState, useCallback } from 'react';

export interface WizardStep {
  id: string;
  label: string;         // 質問テキスト
  required: boolean;
  // 条件付きステップ: この関数がfalseを返すとスキップされる
  condition?: (data: Record<string, unknown>) => boolean;
}

interface UseWizardOptions {
  steps: WizardStep[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function useWizard({ steps, onSubmit }: UseWizardOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // 条件付きステップを考慮した有効ステップ一覧
  const activeSteps = steps.filter(
    (s) => !s.condition || s.condition(data)
  );

  const currentStep = activeSteps[currentIndex];
  const totalSteps = activeSteps.length;
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === totalSteps - 1;

  const setField = useCallback((key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const next = useCallback(() => {
    if (isLastStep) {
      setShowConfirmation(true);
    } else {
      setCurrentIndex((i) => Math.min(i + 1, totalSteps - 1));
    }
  }, [isLastStep, totalSteps]);

  const back = useCallback(() => {
    if (showConfirmation) {
      setShowConfirmation(false);
    } else {
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
  }, [showConfirmation]);

  const goToStep = useCallback(
    (stepId: string) => {
      const idx = activeSteps.findIndex((s) => s.id === stepId);
      if (idx >= 0) {
        setShowConfirmation(false);
        setCurrentIndex(idx);
      }
    },
    [activeSteps]
  );

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(data);
      setIsComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  }, [data, onSubmit]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setData({});
    setIsSubmitting(false);
    setIsComplete(false);
    setError(null);
    setShowConfirmation(false);
  }, []);

  return {
    currentStep,
    currentIndex,
    totalSteps,
    activeSteps,
    data,
    setField,
    next,
    back,
    goToStep,
    submit,
    reset,
    isFirstStep,
    isLastStep,
    isSubmitting,
    isComplete,
    showConfirmation,
    error,
  };
}
```

- [ ] **Step 2: AdminWizardコンポーネントを作成**

```tsx
// src/components/admin/wizard/AdminWizard.tsx
import { useTranslation } from 'react-i18next';
import type { useWizard } from './useWizard';

interface AdminWizardProps {
  title: string;
  wizard: ReturnType<typeof useWizard>;
  renderStep: (stepId: string) => React.ReactNode;
  renderConfirmation: () => React.ReactNode;
  // 各ステップのバリデーション（trueなら「次へ」有効）
  isStepValid: (stepId: string) => boolean;
}

export function AdminWizard({
  title,
  wizard,
  renderStep,
  renderConfirmation,
  isStepValid,
}: AdminWizardProps) {
  const { t } = useTranslation();
  const {
    currentStep,
    currentIndex,
    totalSteps,
    activeSteps,
    next,
    back,
    submit,
    reset,
    isFirstStep,
    isSubmitting,
    isComplete,
    showConfirmation,
    error,
  } = wizard;

  // 成功画面
  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="text-4xl">✓</div>
        <p className="text-lg font-medium">{t('admin.wizard_success')}</p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 border border-app-text/20 rounded hover:bg-app-text/5"
          >
            {t('admin.wizard_add_another')}
          </button>
          <a
            href="/admin"
            className="px-4 py-2 bg-app-text text-app-bg rounded hover:opacity-80"
          >
            {t('admin.wizard_back_to_dashboard')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* ヘッダー */}
      <h1 className="text-xl font-bold mb-6">{title}</h1>

      {/* プログレスバー */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-app-text-muted mb-2">
          <span>
            {showConfirmation
              ? t('admin.wizard_confirmation')
              : `${t('admin.wizard_step')} ${currentIndex + 1}/${totalSteps}`}
          </span>
        </div>
        <div className="h-1 bg-app-text/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-app-text transition-all duration-300"
            style={{
              width: showConfirmation
                ? '100%'
                : `${((currentIndex + 1) / totalSteps) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* コンテンツ */}
      {showConfirmation ? (
        <div>
          {renderConfirmation()}
          {error && (
            <p className="text-red-500 text-sm mt-4">{error}</p>
          )}
        </div>
      ) : (
        <div>
          {/* 質問テキスト */}
          <p className="text-lg font-medium mb-6">{currentStep.label}</p>
          {/* ステップの入力UI */}
          {renderStep(currentStep.id)}
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex justify-between mt-8">
        <button
          onClick={back}
          disabled={isFirstStep && !showConfirmation}
          className="px-4 py-2 border border-app-text/20 rounded hover:bg-app-text/5 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← {t('admin.wizard_back')}
        </button>

        {showConfirmation ? (
          <button
            onClick={submit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-app-text text-app-bg rounded hover:opacity-80 disabled:opacity-50"
          >
            {isSubmitting
              ? t('admin.wizard_submitting')
              : t('admin.wizard_submit')}
          </button>
        ) : currentStep.required ? (
          <button
            onClick={next}
            disabled={!isStepValid(currentStep.id)}
            className="px-6 py-2 bg-app-text text-app-bg rounded hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('admin.wizard_next')} →
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={next}
              className="px-4 py-2 border border-app-text/20 rounded hover:bg-app-text/5"
            >
              {t('admin.wizard_skip')}
            </button>
            <button
              onClick={next}
              disabled={!isStepValid(currentStep.id)}
              className="px-6 py-2 bg-app-text text-app-bg rounded hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('admin.wizard_next')} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build 2>&1 | tail -5`
Expected: ビルド成功（未使用のためtree-shakingで除去されるがエラーなし）

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/wizard/useWizard.ts src/components/admin/wizard/AdminWizard.tsx
git commit -m "feat(admin): ウィザード共通フレームワーク（useWizard + AdminWizard）"
```

---

## Task 2: i18nキー追加

全ウィザード・ダッシュボード・復元・ログに必要なi18nキーをまとめて追加。

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: ja.jsonにウィザード共通キーを追加**

`admin`オブジェクト内に以下を追加（既存キーの後に追記）:

```json
"wizard_step": "ステップ",
"wizard_confirmation": "入力内容の確認",
"wizard_next": "次へ",
"wizard_back": "戻る",
"wizard_skip": "スキップ",
"wizard_submit": "登録する",
"wizard_submitting": "登録中...",
"wizard_save": "保存する",
"wizard_saving": "保存中...",
"wizard_success": "登録しました",
"wizard_add_another": "続けて追加する",
"wizard_back_to_dashboard": "ダッシュボードに戻る",
"wizard_edit": "編集",
"wizard_required": "必須",
"wizard_optional": "任意",
"wizard_id_available": "このIDは使えます",
"wizard_id_taken": "既に使われています",

"dash_what_to_do": "何をしますか？",
"dash_add_content": "新しいコンテンツを追加",
"dash_add_content_desc": "零式・絶などの新コンテンツ登録",
"dash_add_template": "テンプレートを登録",
"dash_add_template_desc": "タイムラインテンプレートの登録",
"dash_edit_skills": "スキルを追加・編集",
"dash_edit_skills_desc": "ジョブ・軽減スキルの管理",
"dash_edit_stats": "ステータスを更新",
"dash_edit_stats_desc": "パッチごとのHP・メインステ等",
"dash_edit_servers": "サーバー情報を編集",
"dash_edit_servers_desc": "DC・ワールド・ハウジングエリア",
"dash_config": "設定",
"dash_config_desc": "昇格しきい値など",
"dash_recent_changes": "最近の変更",
"dash_view_all": "すべて見る",
"dash_no_recent": "最近の変更はありません",
"dash_restore_backup": "バックアップから復元",
"dash_ago": "前",

"content_wiz_category": "カテゴリを選んでください",
"content_wiz_level": "レベルを選んでください",
"content_wiz_id": "コンテンツIDを入力してください",
"content_wiz_id_hint": "パッチ番号を含めると将来の重複を避けやすいです（例: 7.2-m5s）",
"content_wiz_name_ja": "コンテンツ名（日本語）を入力してください",
"content_wiz_name_en": "コンテンツ名（英語）を入力してください",
"content_wiz_series": "どのシリーズに属しますか？",
"content_wiz_new_series": "新しいシリーズを作る",
"content_wiz_patch": "パッチ番号を入力してください",
"content_wiz_fflogs": "FFLogs用のIDはありますか？",

"template_wiz_method": "どの方法で作りますか？",
"template_wiz_fflogs": "FFLogsからインポート",
"template_wiz_fflogs_desc": "URLを貼ってボス行動を取得",
"template_wiz_from_plan": "自分のプランをテンプレートにする",
"template_wiz_from_plan_desc": "編集済みのプランを選択",
"template_wiz_json": "JSONファイルをアップロード",
"template_wiz_json_desc": "従来方式",
"template_wiz_select_content": "どのコンテンツのテンプレートですか？",
"template_wiz_paste_url": "FFLogsのURLを貼ってください",
"template_wiz_select_plan": "どのプランをテンプレートにしますか？",
"template_wiz_select_file": "JSONファイルを選んでください",
"template_wiz_preview": "インポート結果",
"template_wiz_events_found": "{{count}}件のボス行動を取得しました",
"template_wiz_phases_found": "フェーズ: {{count}}",
"template_wiz_plan_note": "軽減配置は除外され、ボス行動のみがテンプレートになります",

"skill_wiz_mode": "何をしますか？",
"skill_wiz_add": "新しいスキルを追加する",
"skill_wiz_edit": "既存のスキルを編集する",
"skill_wiz_add_job": "新しいジョブを追加する",
"skill_wiz_select_job": "どのジョブのスキルですか？",
"skill_wiz_name_ja": "スキル名（日本語）を入力してください",
"skill_wiz_name_en": "スキル名（英語）を入力してください",
"skill_wiz_value": "軽減率は何%ですか？",
"skill_wiz_burst": "最初だけ追加軽減がありますか？",
"skill_wiz_burst_value": "追加軽減率（%）",
"skill_wiz_burst_duration": "追加軽減の持続秒数",
"skill_wiz_duration": "効果時間は何秒ですか？",
"skill_wiz_recast": "リキャスト時間は何秒ですか？",
"skill_wiz_type": "軽減の種類は？",
"skill_wiz_type_all": "全体",
"skill_wiz_type_magical": "魔法のみ",
"skill_wiz_type_physical": "物理のみ",
"skill_wiz_type_split": "物理と魔法で軽減率が違う",
"skill_wiz_scope": "効果範囲は？",
"skill_wiz_scope_self": "自分のみ",
"skill_wiz_scope_party": "パーティ全体",
"skill_wiz_scope_target": "対象指定",
"skill_wiz_target_self": "自分自身にも使えますか？",
"skill_wiz_min_level": "使用可能レベルは？",
"skill_wiz_icon": "アイコン画像を選んでください",
"skill_wiz_special": "特殊な動作はありますか？",
"skill_wiz_special_shield": "シールド（ダメージを吸収するバリアを張る）",
"skill_wiz_special_invincible": "無敵になる",
"skill_wiz_special_requires": "他のスキルを先に使う必要がある",
"skill_wiz_special_fairy": "フェアリーが必要",
"skill_wiz_special_charges": "チャージ制（複数回分を溜められる）",
"skill_wiz_special_resource": "リソースを消費する（エーテルフロー等）",
"skill_wiz_special_healing": "回復量もUPする",
"skill_wiz_select_skill": "どのスキルですか？",
"skill_wiz_edit_fields": "変更したい項目を直接編集してください",
"skill_wiz_changes_highlight": "変更箇所",

"job_wiz_id": "ジョブIDを入力してください",
"job_wiz_name_ja": "ジョブ名（日本語）を入力してください",
"job_wiz_name_en": "ジョブ名（英語）を入力してください",
"job_wiz_role": "ロールを選んでください",
"job_wiz_icon": "アイコン画像を選んでください",

"stats_wiz_mode": "何をしますか？",
"stats_wiz_add": "新しいパッチのステータスを追加",
"stats_wiz_edit": "既存のステータスを修正",
"stats_wiz_level": "レベル設定を変更",
"stats_wiz_patch": "パッチ番号を入力してください",
"stats_wiz_tank_hp": "タンクのHP",
"stats_wiz_tank_main": "タンクのメインステータス",
"stats_wiz_tank_det": "タンクのDET",
"stats_wiz_tank_wd": "タンクのWD",
"stats_wiz_other_hp": "その他ロールのHP",
"stats_wiz_other_main": "その他ロールのメインステータス",
"stats_wiz_other_det": "その他ロールのDET",
"stats_wiz_other_wd": "その他ロールのWD",
"stats_wiz_select_patch": "どのパッチですか？",

"backups_title": "バックアップから復元",
"backups_filter": "種類で絞り込み",
"backups_filter_all": "すべて",
"backups_restore": "復元する",
"backups_restore_confirm": "本当に復元しますか？現在のデータは自動でバックアップされます",
"backups_restore_success": "復元しました",
"backups_no_data": "バックアップはありません",
"backups_type_skills": "スキル",
"backups_type_stats": "ステータス",
"backups_type_contents": "コンテンツ",
"backups_type_servers": "サーバー",
"backups_type_template": "テンプレート",

"logs_title": "変更履歴",
"logs_filter": "種類で絞り込み",
"logs_filter_all": "すべて",
"logs_no_data": "変更履歴はありません",
"logs_action_create": "作成",
"logs_action_update": "更新",
"logs_action_delete": "削除"
```

- [ ] **Step 2: en.jsonに対応する英語キーを追加**

同じキー構造で英語テキストを追加。全キーを対応させる。例:
```json
"wizard_step": "Step",
"wizard_confirmation": "Review your input",
"wizard_next": "Next",
"wizard_back": "Back",
"wizard_skip": "Skip",
"wizard_submit": "Submit",
"wizard_submitting": "Submitting...",
"wizard_success": "Successfully registered",
"dash_what_to_do": "What would you like to do?",
"dash_add_content": "Add new content",
...
```
（全キーの英語訳を追加すること）

- [ ] **Step 3: ビルド確認**

Run: `npm run build 2>&1 | tail -5`
Expected: ビルド成功

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat(admin): ウィザード・復元・ログ用i18nキー追加"
```

---

## Task 3: ダッシュボード刷新

アクションカード＋最近の変更＋復元リンクに全面刷新。

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`（全面書き換え）

- [ ] **Step 1: AdminDashboard.tsxを全面書き換え**

現在のAdminDashboard.tsx（統計カード2枚のみ）を、以下の3セクション構成に書き換える:

1. **アクションカード6枚**: 大きなカード。クリックで各ウィザード/画面に遷移（react-router `useNavigate`）
   - コンテンツ追加 → `/admin/content-wizard`
   - テンプレート登録 → `/admin/template-wizard`
   - スキル編集 → `/admin/skill-wizard`
   - ステータス更新 → `/admin/stats-wizard`
   - サーバー編集 → `/admin/servers`
   - 設定 → `/admin/config`

2. **最近の変更**（直近5件）: `GET /api/admin?resource=templates&type=logs` から取得。日時＋操作内容を日本語表示。「すべて見る」→ `/admin/logs`

3. **バックアップから復元**: `/admin/backups` へのリンクカード

- [ ] **Step 2: ビルド確認**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/AdminDashboard.tsx
git commit -m "feat(admin): ダッシュボードをアクションカード方式に刷新"
```

---

## Task 4: コンテンツ追加ウィザード

設計書セクション3の8ステップ＋確認画面を実装。

**Files:**
- Create: `src/components/admin/wizard/ContentWizard.tsx`
- Modify: `src/App.tsx`（ルート追加）

- [ ] **Step 1: ContentWizard.tsxを作成**

ステップ定義:
1. `category` — ボタン5択（savage/ultimate/dungeon/raid/custom）
2. `level` — ボタン4択（70/80/90/100）
3. `contentId` — テキスト入力。リアルタイム重複チェック（既存コンテンツ一覧をマウント時にfetch）
4. `nameJa` — テキスト入力
5. `nameEn` — テキスト入力
6. `series` — 既存シリーズリスト＋新規作成モード
7. `patch` — テキスト入力（任意）
8. `fflogsId` — テキスト入力（任意）

確認画面: 全項目を一覧表示。各項目に「編集」ボタン（`goToStep`呼び出し）。

`onSubmit`: `POST /api/admin?resource=contents` に既存のAdminContents.tsxと同じペイロード形式で送信。

- [ ] **Step 2: App.tsxにルート追加**

`/admin` の子ルートに追加:
```tsx
<Route path="content-wizard" element={<ContentWizard />} />
```

- [ ] **Step 3: 動作確認**

Run: `npm run dev`
ブラウザで `/admin/content-wizard` にアクセス。全ステップを通して入力→確認画面→登録が動作することを確認。

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/wizard/ContentWizard.tsx src/App.tsx
git commit -m "feat(admin): コンテンツ追加ウィザード"
```

---

## Task 5: テンプレート登録ウィザード

3分岐（FFLogs / プランから / JSON）を実装。

**Files:**
- Create: `src/components/admin/wizard/TemplateWizard.tsx`
- Modify: `src/App.tsx`（ルート追加）

- [ ] **Step 1: TemplateWizard.tsxを作成**

最初のステップで3択分岐。選択に応じてステップ定義が動的に変わる。

**A. FFLogsインポート:**
1. `method` — ボタン3択
2. `contentId` — 登録済みコンテンツリストから選択
3. `fflogsUrl` — テキスト入力。URL形式チェック
4. プレビュー表示（既存のFFLogsインポートロジック `src/lib/fflogsImporter.ts` を再利用）
5. 確認 → `POST /api/admin?resource=templates`

**B. プランからテンプレート化:**
1. `method` — ボタン3択
2. `planId` — 自分のプラン一覧から選択。プラン一覧はlocalStorage + Firestoreから取得（既存の `usePlanStore` を利用）
3. プレビュー表示。「軽減配置は除外されます」の説明
4. 確認 → `POST /api/admin?resource=templates`（timelineEventsのみ送信、applied_mitigationsは除外）

**C. JSONアップロード:**
1. `method` — ボタン3択
2. `contentId` — 登録済みコンテンツリストから選択
3. ファイル選択。JSONパース＋形式チェック
4. 確認 → `POST /api/admin?resource=templates`

- [ ] **Step 2: App.tsxにルート追加**

```tsx
<Route path="template-wizard" element={<TemplateWizard />} />
```

- [ ] **Step 3: 動作確認**

3つの方法それぞれで登録が動作することを確認。

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/wizard/TemplateWizard.tsx src/App.tsx
git commit -m "feat(admin): テンプレート登録ウィザード（FFLogs/プラン/JSON）"
```

---

## Task 6: スキル追加ウィザード

設計書セクション5の11ステップ＋特殊動作チェックリスト＋確認画面。

**Files:**
- Create: `src/components/admin/wizard/SkillWizard.tsx`
- Modify: `src/App.tsx`（ルート追加）

- [ ] **Step 1: SkillWizard.tsxを作成**

最初のステップで3択分岐（追加/編集/ジョブ追加）。「追加」を選んだ場合の新スキルウィザード:

ステップ定義:
1. `jobId` — ジョブ一覧（アイコン付き）。`GET /api/admin?resource=templates&type=skills` から取得
2. `nameJa` — テキスト入力
3. `nameEn` — テキスト入力
4. `value` — 数値入力（0〜100）
5. `hasBurst` — はい/いいえ。「はい」→ `burstValue`（数値）＋ `burstDuration`（数値）入力が展開（条件付きステップ）
6. `duration` — 数値入力（0.1〜999）
7. `recast` — 数値入力（0〜999）
8. `type` — ボタン3択（all/magical/physical）＋「物理と魔法で軽減率が違う」チェック → 条件付きで `valuePhysical`/`valueMagical` 入力
9. `scope` — ボタン3択（self/party/target）
10. `targetCannotBeSelf` — はい/いいえ（scope=targetの場合のみ表示、条件付きステップ）
11. `minLevel` — 数値入力（1〜100）
12. `icon` — ファイル選択（任意）
13. `specials` — チェックリスト。選択した項目に応じて動的に追加ステップ

確認画面 → `PUT /api/admin?resource=templates&type=skills`

- [ ] **Step 2: App.tsxにルート追加**

```tsx
<Route path="skill-wizard" element={<SkillWizard />} />
```

- [ ] **Step 3: 動作確認**

新スキル追加フローが動作することを確認。特に条件付きステップ（burst、targetCannotBeSelf、specials）が正しくスキップ/表示されることを確認。

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/wizard/SkillWizard.tsx src/App.tsx
git commit -m "feat(admin): スキル追加ウィザード（特殊動作チェックリスト含む）"
```

---

## Task 7: スキル編集ウィザード＋ジョブ追加ウィザード

スキル編集（ジョブ選択→スキル選択→一括編集画面）とジョブ追加の2つ。

**Files:**
- Create: `src/components/admin/wizard/SkillEditWizard.tsx`
- Create: `src/components/admin/wizard/JobWizard.tsx`

- [ ] **Step 1: SkillEditWizard.tsxを作成**

ステップ:
1. `jobId` — ジョブ一覧から選択
2. `skillId` — 選んだジョブのスキル一覧から選択
3. 一括編集画面 — 現在の全フィールドが表示され、変更したい項目だけ直接編集。ウィザード形式ではなく1画面フォーム。

確認画面: 変更箇所のみハイライト表示（変更前→変更後）。
`onSubmit`: `PUT /api/admin?resource=templates&type=skills` で更新。

- [ ] **Step 2: JobWizard.tsxを作成**

ステップ定義:
1. `jobId` — テキスト入力。例:「vpr」
2. `nameJa` — テキスト入力
3. `nameEn` — テキスト入力
4. `role` — ボタン3択（TANK/HEALER/DPS）
5. `icon` — ファイル選択（任意）

確認 → `PUT /api/admin?resource=templates&type=skills` でjobs配列に追加。

- [ ] **Step 3: SkillWizardの分岐から遷移を接続**

SkillWizard.tsxのステップ1の3択分岐で:
- 「既存のスキルを編集する」→ SkillEditWizardコンポーネントを表示
- 「新しいジョブを追加する」→ JobWizardコンポーネントを表示

- [ ] **Step 4: 動作確認**

3つの分岐全てが動作することを確認。

- [ ] **Step 5: コミット**

```bash
git add src/components/admin/wizard/SkillEditWizard.tsx src/components/admin/wizard/JobWizard.tsx src/components/admin/wizard/SkillWizard.tsx
git commit -m "feat(admin): スキル編集ウィザード＋ジョブ追加ウィザード"
```

---

## Task 8: ステータス更新ウィザード

パッチ追加・修正・レベル設定の3分岐。

**Files:**
- Create: `src/components/admin/wizard/StatsWizard.tsx`
- Modify: `src/App.tsx`（ルート追加）

- [ ] **Step 1: StatsWizard.tsxを作成**

最初のステップで3択分岐。

**A. 新パッチ追加:**
1. `patch` — テキスト入力（例:「7.2」）
2. `tankHp` — 数値入力
3. `tankMain` — 数値入力
4. `tankDet` — 数値入力
5. `tankWd` — 数値入力
6. `otherHp` — 数値入力
7. `otherMain` — 数値入力
8. `otherDet` — 数値入力
9. `otherWd` — 数値入力
確認画面: タンク/その他を横並び表示 → `PUT /api/admin?resource=templates&type=stats`

**B. 既存修正:**
1. `patch` — パッチ一覧から選択
2. 一括編集画面（現在の値を表示、直接編集）
確認画面: 変更箇所ハイライト → `PUT`

**C. レベル設定:**
1. 一括編集画面（レベル→デフォルトパッチのマッピング）
確認 → `PUT`

- [ ] **Step 2: App.tsxにルート追加**

```tsx
<Route path="stats-wizard" element={<StatsWizard />} />
```

- [ ] **Step 3: 動作確認**

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/wizard/StatsWizard.tsx src/App.tsx
git commit -m "feat(admin): ステータス更新ウィザード"
```

---

## Task 9: バックアップ復元API＋画面

既存APIにbackups/restore機能を追加し、フロントエンドの復元画面を作成。

**Files:**
- Modify: `api/admin/_templatesHandler.ts`（`?type=backups` と `?type=restore` 追加）
- Create: `src/components/admin/AdminBackups.tsx`
- Modify: `src/App.tsx`（ルート追加）

- [ ] **Step 1: _templatesHandler.tsにバックアップ一覧API追加**

GETハンドラ内の `type` 分岐に追加:

```typescript
// type=backups の場合
if (type === 'backups') {
  const masterSnap = await db.collection('master_backups')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  const templateSnap = await db.collection('template_backups')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  const backups = [
    ...masterSnap.docs.map(d => ({ id: d.id, ...d.data(), collection: 'master' })),
    ...templateSnap.docs.map(d => ({ id: d.id, ...d.data(), collection: 'template' })),
  ].sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
  return res.json({ backups });
}
```

- [ ] **Step 2: _templatesHandler.tsにリストアAPI追加**

PUTハンドラ内の `type` 分岐に追加:

```typescript
// type=restore の場合
if (type === 'restore') {
  const { backupId, backupCollection } = req.body;
  if (!backupId || !backupCollection) {
    return res.status(400).json({ error: 'backupId and backupCollection required' });
  }
  const collName = backupCollection === 'master' ? 'master_backups' : 'template_backups';
  const backupDoc = await db.collection(collName).doc(backupId).get();
  if (!backupDoc.exists) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  const backup = backupDoc.data();

  // 復元先を決定
  if (backup.type === 'template') {
    // 現在のテンプレートをバックアップしてから復元
    const currentDoc = await db.collection('templates').doc(backup.contentId).get();
    if (currentDoc.exists) {
      await db.collection('template_backups').doc(`template_${backup.contentId}_${Date.now()}`).set({
        type: 'template', contentId: backup.contentId, data: currentDoc.data(), createdAt: FieldValue.serverTimestamp(),
      });
    }
    await db.collection('templates').doc(backup.contentId).set(backup.data);
  } else {
    // マスターデータの復元
    const targetPath = `master/${backup.type}`;
    const currentDoc = await db.doc(targetPath).get();
    if (currentDoc.exists) {
      await db.collection('master_backups').doc(`${backup.type}_${Date.now()}`).set({
        type: backup.type, data: currentDoc.data(), createdAt: FieldValue.serverTimestamp(),
      });
    }
    await db.doc(targetPath).set(backup.data);
  }

  // 監査ログ
  await db.collection('admin_logs').add({
    action: 'restore', target: `${backup.type}_${backupId}`,
    adminUid: uid, changes: { restored_from: backupId }, timestamp: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}
```

- [ ] **Step 3: AdminBackups.tsxを作成**

バックアップ一覧表示＋フィルタ＋復元ボタン＋確認ダイアログ。

- [ ] **Step 4: App.tsxにルート追加**

```tsx
<Route path="backups" element={<AdminBackups />} />
```

- [ ] **Step 5: 動作確認**

`/admin/backups` で一覧が表示され、復元が動作することを確認。

- [ ] **Step 6: コミット**

```bash
git add api/admin/_templatesHandler.ts src/components/admin/AdminBackups.tsx src/App.tsx
git commit -m "feat(admin): バックアップ復元API＋画面"
```

---

## Task 10: 監査ログAPI＋画面

既存APIにログ閲覧機能を追加し、フロントエンドの監査ログ画面を作成。

**Files:**
- Modify: `api/admin/_templatesHandler.ts`（`?type=logs` 追加）
- Create: `src/components/admin/AdminLogs.tsx`
- Modify: `src/App.tsx`（ルート追加）

- [ ] **Step 1: _templatesHandler.tsに監査ログAPI追加**

GETハンドラ内の `type` 分岐に追加:

```typescript
// type=logs の場合
if (type === 'logs') {
  const limit = parseInt(req.query.limit as string) || 50;
  const snap = await db.collection('admin_logs')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return res.json({ logs });
}
```

- [ ] **Step 2: AdminLogs.tsxを作成**

ログ一覧表示＋種類フィルタ。各ログエントリは日本語で操作内容を表示:
- action（create/update/delete）→ i18nキーで「作成」「更新」「削除」
- target（例:「skills.reprisal」）→ 種類名＋対象名に分解して表示
- timestamp → 相対時間（「3時間前」等）

- [ ] **Step 3: App.tsxにルート追加**

```tsx
<Route path="logs" element={<AdminLogs />} />
```

- [ ] **Step 4: AdminLayout.tsxのサイドバーにナビ追加**

既存のnavItems配列に追加:
```typescript
{ path: '/admin/backups', label: t('admin.dash_restore_backup') },
{ path: '/admin/logs', label: t('admin.logs_title') },
```

- [ ] **Step 5: 動作確認**

`/admin/logs` でログ一覧が表示され、フィルタが動作することを確認。

- [ ] **Step 6: コミット**

```bash
git add api/admin/_templatesHandler.ts src/components/admin/AdminLogs.tsx src/components/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): 監査ログAPI＋画面"
```

---

## Task 11: 結合テスト＋最終調整

全ウィザード・ダッシュボード・復元・ログの結合テスト。

**Files:**
- Various（修正が必要な箇所があれば）

- [ ] **Step 1: ビルド確認**

Run: `npm run build 2>&1 | tail -20`
Expected: エラーなしでビルド成功

- [ ] **Step 2: 全画面の動作確認**

以下を順番に確認:
1. `/admin` — ダッシュボードにアクションカード6枚＋最近の変更＋復元リンクが表示される
2. `/admin/content-wizard` — 全ステップ通し → 確認 → 登録
3. `/admin/template-wizard` — 3分岐それぞれ確認
4. `/admin/skill-wizard` — 新規追加・編集・ジョブ追加の3分岐確認
5. `/admin/stats-wizard` — パッチ追加・修正・レベル設定の3分岐確認
6. `/admin/backups` — 一覧表示＋復元
7. `/admin/logs` — 一覧表示＋フィルタ
8. サイドバーナビから全画面にアクセスできることを確認
9. 英語モードに切り替えて表示崩れがないことを確認

- [ ] **Step 3: 不具合修正**

動作確認で見つかった不具合を修正。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "fix(admin): ウィザード結合テスト後の修正"
```

---

## 実装順序の依存関係

```
Task 1 (フレームワーク) ─┬→ Task 4 (コンテンツ)
                        ├→ Task 5 (テンプレート)
Task 2 (i18n) ──────────┤├→ Task 6 (スキル追加) → Task 7 (スキル編集/ジョブ)
                        ├→ Task 8 (ステータス)
                        ├→ Task 9 (バックアップ)
                        └→ Task 10 (監査ログ)
Task 3 (ダッシュボード) ←── Task 10完了後に最近の変更が動く
Task 11 (結合テスト) ←── 全Task完了後
```

Task 1 + 2 は必須の前提。Task 3〜10 は Task 1+2 完了後なら順不同で実装可能（ただしTask 7はTask 6に依存）。
