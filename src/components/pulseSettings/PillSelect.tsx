// ピル型選択ボタン
export const PillSelect: React.FC<{
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}> = ({ options, value, onChange, disabled }) => (
    <div className="flex gap-1.5 flex-wrap">
        {options.map(opt => (
            <button
                key={opt.id}
                onClick={() => !disabled && onChange(opt.id)}
                className={`px-2.5 py-1 rounded-full text-app-sm font-bold tracking-wider transition-all cursor-pointer ${
                    value === opt.id
                        ? 'bg-app-toggle text-app-toggle-text'
                        : 'bg-app-surface2 text-app-text-muted border border-app-border hover:border-app-text-muted'
                } ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);
