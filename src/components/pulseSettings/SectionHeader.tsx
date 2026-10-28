// セクション区切り
export const SectionHeader: React.FC<{ label: string; right?: React.ReactNode }> = ({ label, right }) => (
    <div className="flex items-center gap-2 mb-2 mt-1">
        <span className="text-app-sm font-bold text-app-text uppercase tracking-widest">{label}</span>
        <div className="flex-1 h-px bg-app-border" />
        {right}
    </div>
);
