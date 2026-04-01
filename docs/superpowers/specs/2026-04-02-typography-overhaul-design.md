# タイポグラフィ刷新 — 設計書

## 概要

表エリア（タイムラインヘッダー列名・行データ・コントロールバー）を除く全UIのフォントサイズを6段階スケールに統一し、メリハリのある超現代的なタイポグラフィを実現する。

## 問題

現状ほぼ全てのUIが9-12pxに密集しており、階層感がなく単調。モーダルのタイトルもラベルも同じような大きさに見える。

## タイポグラフィスケール

| レベル | サイズ | weight | 用途 |
|---|---|---|---|
| **Display** | 24px | font-black | ページタイトル、ランディングヒーロー |
| **Heading** | 18px | font-black | モーダルタイトル、セクション見出し |
| **Subheading** | 15px | font-bold | サブセクション、プラン名、重要ラベル |
| **Body** | 13px | font-medium | リスト項目、ボタン、入力値 |
| **Caption** | 11px | font-medium | ラベル、説明文、ドロップダウンヘッダー |
| **Micro** | 9px | font-medium | ヒント、タイムスタンプ、メタ情報 |

## 変更しないもの

- タイムラインヘッダー列名（フェーズ、時間、敵の攻撃、Raw、Taken）
- タイムライン行の中身（時間表示、技名、ダメージ数値、軽減%）
- コントロールバーのボタン群
- Ko-fiリンク（フッター・サイドバー）のサイズ
- フォントスケーリング機能（data-font-scale）の仕組み自体

## 対象コンポーネント別の変更

### ページレベル

#### ConsolidatedHeader (`src/components/ConsolidatedHeader.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイムラインタイトル | text-[20px]/text-[26px] | text-[24px] font-black |
| メニューボタンテキスト | text-[10px] | text-[13px] font-medium |
| ソートオプション | text-[9px] | text-[11px] |
| ユーザー初期文字 | text-[10px] | text-[13px] |
| セクション見出し（uppercase） | text-[10px] | text-[11px] |

#### MobileHeader (`src/components/MobileHeader.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ヘッダータイトル | text-[11px] | text-[15px] font-bold |
| サブテキスト | text-[10px] | text-[11px] |
| ストレス表示タイトル | text-[13px] | text-[18px] font-black |
| ストレス説明 | text-[11px] | text-[11px]（維持） |

#### Layout (`src/components/Layout.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ページタイトル（PC） | text-base (16px) | text-[18px] font-black |
| ページタイトル（モバイル） | text-sm (14px) | text-[15px] font-bold |
| ログインボタン | text-sm | text-[13px] font-medium |
| ユーザー名 | text-lg | text-[18px] font-black |
| メールアドレス | text-sm | text-[11px] |
| バージョン情報 | text-[8px] | text-[9px] |

#### MobileBottomNav (`src/components/MobileBottomNav.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ナビラベル | text-[9px] | text-[9px]（維持、Micro） |

### サイドバー

#### Sidebar (`src/components/Sidebar.tsx`) — Ko-fiリンクは除外
| 要素 | 現状 | 変更後 |
|---|---|---|
| セクションタイトル | text-[10px] | text-[11px] caption |
| プラン名 | text-[9.5px] | text-[15px] font-bold |
| プラン説明 | text-[10px] | text-[11px] |
| プランボタン | text-[10px] | text-[13px] font-medium |
| タグ | text-[9px] | text-[9px]（維持、Micro） |
| カテゴリメニュー | text-[10px] | text-[13px] |
| シリーズ行 | text-[10px] | text-[13px] font-bold |

### モーダル（大きいUI）

#### EventModal (`src/components/EventModal.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイトル | text-sm (14px) | text-[18px] font-black |
| ラベル | text-xs (12px) | text-[11px] caption |
| 入力フィールド | text-sm (14px) | text-[13px] |
| ダメージ入力 | text-lg (18px) | text-lg（維持、既にHeading級） |
| 推定ダメージ表示 | text-xl (20px) | text-xl（維持） |
| ボタン（削除等） | text-xs (12px) | text-[11px] |
| 保存ボタン | text-sm (14px) | text-[13px] font-bold |

#### PhaseModal (`src/components/PhaseModal.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイトル | text-sm | text-[18px] font-black |
| ラベル | text-xs | text-[11px] |
| 入力 | text-sm | text-[13px] |
| 削除ボタン | text-xs | text-[11px] |
| キャンセル | text-xs | text-[11px] |
| 確定ボタン | text-xs | text-[13px] font-bold |

#### PartySettingsModal (`src/components/PartySettingsModal.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイトル | text-sm | text-[18px] font-black |
| 説明テキスト | text-[10px] | text-[11px] |
| ロール見出し（TANK等） | text-[11px] | text-[15px] font-bold |
| ステータス名 | text-[9px] | text-[11px] |
| シールド見出し | text-[10px] | text-[13px] font-bold |
| シールド詳細 | text-[9px] | text-[11px] |

#### NewPlanModal (`src/components/NewPlanModal.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイトル | text-[13px] | text-[18px] font-black |
| ラベル | text-[10px] | text-[11px] |
| 入力フィールド | text-[13px] | text-[13px]（維持） |
| ボタン（選択肢） | text-[11px] | text-[13px] |
| 説明テキスト | text-[11px] | text-[11px]（維持） |
| 確定ボタン | text-[11px] | text-[13px] font-bold |

#### ConfirmDialog (`src/components/ConfirmDialog.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイトル | text-sm | text-[18px] font-black |
| メッセージ | text-[12px] | text-[13px] |
| キャンセルボタン | text-[11px] | text-[13px] |
| 確定ボタン | text-[11px] | text-[13px] font-bold |

#### JobMigrationModal (`src/components/JobMigrationModal.tsx`)
- タイトル → text-[18px] font-black
- 説明 → text-[13px]
- 選択肢ラベル → text-[15px] font-bold
- ボタン → text-[13px]

#### FFLogsImportModal (`src/components/FFLogsImportModal.tsx`)
- タイトル → text-[18px] font-black
- 説明/ステップ → text-[13px]
- 入力 → text-[13px]
- ラベル → text-[11px]
- ボタン → text-[13px]

### ドロップダウン/ポップオーバー（小さいUI）

#### HeaderPhaseDropdown (`src/components/HeaderPhaseDropdown.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ヘッダー | text-xs (12px) | text-[11px] caption |
| フェーズ名リスト | text-sm (14px) | text-[13px] |
| 折りたたみトグル | text-xs (12px) | text-[11px] |

#### HeaderTimeInput (`src/components/HeaderTimeInput.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ヘッダー | text-xs (12px) | text-[11px] caption |
| 入力 | text-sm (14px) | text-[13px] |
| エラーメッセージ | text-xs (12px) | text-[9px] |

#### HeaderMechanicSearch (`src/components/HeaderMechanicSearch.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ヘッダー | text-xs (12px) | text-[11px] caption |
| 検索入力 | text-sm (14px) | text-[13px] |
| 攻撃名リスト | text-sm (14px) | text-[13px] |
| 出現回数（×3 ▸） | text-xs (12px) | text-[9px] micro |
| サブリストヘッダー | text-xs (12px) | text-[11px] font-bold |
| サブリスト項目 | text-sm (14px) | text-[13px] |
| フェーズ名（サブリスト内） | text-xs (12px) | text-[9px] |
| 時刻（サブリスト内） | text-xs (12px) | text-[11px] font-mono |

#### AASettingsPopover (`src/components/AASettingsPopover.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ヘッダー | text-xs | text-[11px] |
| ラベル | text-[10px] | text-[11px] |
| 入力 | text-sm | text-[13px] |
| ボタン | text-xs | text-[13px] |

#### ClearMitigationsPopover (`src/components/ClearMitigationsPopover.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ラベル | text-[9px] | text-[11px] |
| メニュー項目 | text-[10-11px] | text-[13px] |

#### JobPicker (`src/components/JobPicker.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| 見出し | text-[9px] | text-[11px] |
| ジョブ名 | text-[9px] | text-[11px] |

#### MitigationSelector (`src/components/MitigationSelector.tsx`)
- スキル名 → text-[13px]
- カテゴリ見出し → text-[11px]

#### PartyStatusPopover (`src/components/PartyStatusPopover.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| タイトル | text-xs | text-[15px] font-bold |
| 説明 | text-[9px] | text-[11px] |
| ロール見出し | text-xs | text-[13px] font-bold |
| パラメータラベル | text-[10px] | text-[11px] |
| 入力 | text-xs | text-[13px] |

### フローティング/オーバーレイ

#### Tooltip (`src/components/ui/Tooltip.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| テキスト | text-[11px] | text-[11px]（維持） |

#### Toast（Timeline.tsx内）
| 要素 | 現状 | 変更後 |
|---|---|---|
| メッセージ | text-sm | text-[13px] font-bold |

#### MobileBottomSheet
- ヘッダー → text-[15px] font-bold
- リスト項目 → text-[13px]

#### MobileGuide (`src/components/MobileGuide.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| ラベル（uppercase） | text-[10px] | text-[11px] |
| タイトル | text-base | text-[18px] font-black |
| 説明 | text-[13px] | text-[13px]（維持） |
| ボタン | text-sm | text-[13px] |

### モバイル設定系

#### MobilePartySettings (`src/components/MobilePartySettings.tsx`)
| 要素 | 現状 | 変更後 |
|---|---|---|
| メニュー項目（大） | text-sm | text-[15px] font-bold |
| サブテキスト | text-[10px] | text-[11px] |
| メンバーID | text-[10px] | text-[13px] font-bold |
| パラメータ | text-[10px] | text-[11px] font-mono |
| ボタン | text-xs | text-[13px] |
| パラメータラベル | text-sm | text-[13px] font-bold |

## 実装方針

- コンポーネントごとにサブエージェントで並列実装
- 表エリア・Ko-fiリンクには一切触れない
- font-weight も合わせて統一（black/bold/medium の3段階）
- i18nテキストは変更なし（サイズとweightのみ変更）
