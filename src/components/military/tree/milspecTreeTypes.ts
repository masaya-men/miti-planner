/** ツリーの選択モード(まとめて共有 / 選択削除)。無いときは通常のツリー。 */
export interface MilspecTreeSelect {
  mode: 'share' | 'delete';
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export type TreeProps = { lang: string; currentContentId: string | null; onAdd: (id?: string | null) => void; select?: MilspecTreeSelect };
