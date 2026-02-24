import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, time?: number) => void;
    onDelete?: () => void;
    initialName?: string;
    initialTime?: number; // End Time
    isEdit?: boolean;
    position?: { x: number; y: number };
}

export const PhaseModal: React.FC<PhaseModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    initialName = '',
    initialTime,
    isEdit = false,
    position
}) => {
    const [name, setName] = useState(initialName);
    const [time, setTime] = useState(initialTime || 0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setName(initialName);
            setTime(initialTime || 0);
        }
    }, [isOpen, initialName, initialTime]);

    if (!mounted) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(name, time);
        onClose();
    };

    const x = position ? Math.min(position.x, window.innerWidth - 420) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 300) : '50%';
    const style = position ? { left: x, top: y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] text-left pointer-events-none">
                    {/* Transparent Backdrop to close on click outside */}
                    <div className="absolute inset-0 bg-transparent pointer-events-auto" onClick={onClose} />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bg-[#020203] border border-white/[0.08] rounded-xl shadow-2xl w-[400px] overflow-hidden ring-1 ring-white/5 glass-panel pointer-events-auto"
                        style={style}
                    >
                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.05] bg-[#050505]/50">
                            <h2 className="text-sm font-bold text-slate-200">
                                {isEdit ? 'フェーズ編集' : '新しいフェーズ'}
                            </h2>
                            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Time Range removed per user request */}

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">フェーズ名</label>
                                <input
                                    type="text"
                                    inputMode="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/[0.1] rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500/50 focus:bg-blue-500/[0.05] focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-barlow"
                                    placeholder="フェーズ名を入力"
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                {isEdit && onDelete ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDelete();
                                            onClose();
                                        }}
                                        className="px-3 py-1.5 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 rounded-md flex items-center gap-1.5 transition-colors text-xs"
                                    >
                                        <Trash2 size={14} />
                                        <span>削除</span>
                                    </button>
                                ) : <div></div>}

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors text-xs font-medium"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all border border-blue-500/50"
                                    >
                                        保存
                                    </button>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
