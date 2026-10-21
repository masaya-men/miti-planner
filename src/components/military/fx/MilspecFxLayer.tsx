/**
 * 区画全面の光の経路層。経路は fill/stroke なしで置くだけ(光はエンジンが複製を足して走らせる)。
 * 経路の座標は区画の左上基準の px(見本の fxLayer と同じ)。
 */
export type FxTrace = { name: string; d: string; pc?: string; next?: string };

export function MilspecFxLayer({ traces }: { traces: FxTrace[] }) {
  return (
    <svg className="milspec-fx" aria-hidden="true" width={1} height={1}>
      {traces.map((t) => (
        <path
          key={t.name}
          className="milspec-trc"
          d={t.d}
          data-trace={t.name}
          data-trace-pc={t.pc || undefined}
          data-trace-next={t.next || undefined}
        />
      ))}
    </svg>
  );
}
