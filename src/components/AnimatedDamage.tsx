import './AnimatedDamage.css';

interface AnimatedDamageProps {
    value: number;
    isLethal?: boolean;
    className?: string;
}

export function AnimatedDamage({ value, className }: AnimatedDamageProps) {
    const chars = value.toLocaleString().split('');
    return (
        <div className={`dmg-slot ${className ?? ''}`.trim()}>
            {chars.map((ch, i) => (
                <span key={`init-${i}`} className="ch" style={{ ['--i' as never]: i }}>
                    {ch}
                </span>
            ))}
        </div>
    );
}
