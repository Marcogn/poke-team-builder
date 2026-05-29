import { ReactNode, useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  allowOverflow?: boolean;
}

export function Modal({ open, onClose, children, allowOverflow }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-panel border border-panel2 rounded-lg p-5 w-full max-w-lg mx-4 max-h-[90vh] ${allowOverflow ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {children}
      </div>
    </div>
  );
}
