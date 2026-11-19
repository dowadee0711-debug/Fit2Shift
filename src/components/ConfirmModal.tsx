import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-slate-950 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-slate-950 ${
                destructive ? 'bg-[#F38181]' : 'bg-[#FCE38A]'
              } text-slate-950`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2
              id="confirm-modal-title"
              className="font-display text-lg font-bold text-slate-950"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-[#EAFFD0] hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-slate-950"
            aria-label="ปิดหน้าต่างยืนยัน"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {description}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] rounded-xl border-2 border-slate-900 bg-[#EAFFD0] px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#95E1D3] whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-[44px] rounded-xl border-2 border-slate-950 px-5 py-2.5 text-sm font-extrabold text-slate-950 transition-colors whitespace-nowrap shrink-0 ${
              destructive
                ? 'bg-[#F38181] hover:bg-[#f06969]'
                : 'bg-[#FCE38A] hover:bg-[#fbd85d]'
            } disabled:opacity-60`}
          >
            {loading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
