'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  useEffect(() => {
    toasts.forEach(toast => {
      const timer = setTimeout(() => removeToast(toast.id), 5000);
      return () => clearTimeout(timer);
    });
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            "toast-enter px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm flex items-start gap-3",
            toast.type === 'success' && 'bg-accent/10 border-accent/20 text-accent',
            toast.type === 'error' && 'bg-danger/10 border-danger/20 text-danger',
            toast.type === 'warning' && 'bg-warning/10 border-warning/20 text-warning',
            toast.type === 'info' && 'bg-primary/10 border-primary/20 text-primary',
          )}
        >
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.message && <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>}
          </div>
          <button onClick={() => removeToast(toast.id)} className="text-current opacity-50 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
