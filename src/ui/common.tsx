import { useEffect, useState, type ReactNode } from 'react';

interface NumberFieldProps {
  value: number | null;
  onCommit: (value: number | null) => void;
  label: string;
  step?: number;
  min?: number;
  allowEmpty?: boolean;
  className?: string;
}

/** Numeric input that keeps a draft string and commits valid numbers on blur/Enter. */
export function NumberField({ value, onCommit, label, step = 1, min = 0, allowEmpty = false, className }: NumberFieldProps) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value == null ? '' : String(value));
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '' && allowEmpty) return onCommit(null);
    const n = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(n) || n < min) {
      setDraft(value == null ? '' : String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };

  return (
    <input
      className={`input ${className ?? ''}`}
      aria-label={label}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
