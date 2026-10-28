import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, X as IconX } from 'lucide-react';
import type { PlanProgressStatus } from './progress';

export const LocalImportStatusIcon: React.FC<{ status: PlanProgressStatus | undefined }> = ({ status }) => {
    if (!status || status === 'pending') {
        return (
            <span
                className="w-4 h-4 rounded-full border-2 border-app-text-muted/40 shrink-0"
                style={{ borderStyle: 'dashed' }}
            />
        );
    }
    if (status === 'uploading') {
        return (
            <span className="w-4 h-4 rounded-full border-2 border-app-blue/60 bg-app-blue/15 shrink-0 animate-pulse" />
        );
    }
    if (status === 'success') {
        return (
            <motion.span
                initial={{ scale: 0.4, opacity: 0, y: -4 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
                className="shrink-0"
            >
                <CheckCircle2 size={18} className="text-app-blue" />
            </motion.span>
        );
    }
    return (
        <motion.span
            initial={{ scale: 0.4, opacity: 0, y: -4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.34, 1.56, 0.64, 1] }}
            className="shrink-0"
        >
            <IconX size={18} className="text-app-red" strokeWidth={3} />
        </motion.span>
    );
};
