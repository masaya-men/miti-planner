import { motion } from 'framer-motion';

/** LoPo らしい控えめなローディングインジケータ。 3 点が opacity + scale で
 *  順番に脈打つ (Phase B-1.5 polish 第 2 弾 #5 Rev 3)。 業界標準の dot loader を
 *  LoPo の白黒トーンで再現。 */
export function LoadingDots() {
    return (
        <div className="flex items-center gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-app-text-muted"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.18,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
}
