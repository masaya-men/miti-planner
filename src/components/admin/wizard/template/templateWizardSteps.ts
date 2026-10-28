import type { WizardStep } from '../useWizard';

export const WIZARD_STEPS: WizardStep[] = [
  // 全ブランチ共通: 方法選択
  { id: 'method',     label: 'admin.template_wiz_method',         required: true },

  // 全ブランチ共通: コンテンツ選択
  { id: 'contentId',  label: 'admin.template_wiz_select_content', required: true },

  // Branch A: FFLogs URL入力
  {
    id: 'fflogsUrl',
    label: 'admin.template_wiz_paste_url',
    required: true,
    condition: (d) => d.method === 'fflogs',
  },
  // Branch A: FFLogsプレビュー
  {
    id: 'fflogsPreview',
    label: 'admin.template_wiz_preview',
    required: true,
    condition: (d) => d.method === 'fflogs',
  },

  // Branch B: プランから（プレースホルダー）
  {
    id: 'planNote',
    label: 'admin.template_wiz_select_plan',
    required: true,
    condition: (d) => d.method === 'plan',
  },

  // Branch C: JSONアップロード
  {
    id: 'jsonFile',
    label: 'admin.template_wiz_select_file',
    required: true,
    condition: (d) => d.method === 'json',
  },
  // Branch C: JSONプレビュー
  {
    id: 'jsonPreview',
    label: 'admin.template_wiz_preview',
    required: true,
    condition: (d) => d.method === 'json',
  },
];

