import { useEffect, useMemo, useRef, useState } from 'react';

export interface DropdownOption<T> {
  key: string;
  label: string;
  value: T;
  spriteUrl?: string | null;
  group?: string;
}

interface Props<T> {
  options: DropdownOption<T>[];
  value: T | null;
  placeholder?: string;
  onChange: (v: T | null, opt: DropdownOption<T> | null) => void;
  renderOption?: (opt: DropdownOption<T>) => React.ReactNode;
  emptyHint?: string;
  maxVisible?: number;
  dropdownClassName?: string;
}

export function SearchableDropdown<T>({
  options,
  value,
  placeholder = 'Search…',
  onChange,
  renderOption,
  emptyHint = 'No matches',
  maxVisible = 100,
  dropdownClassName,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxVisible);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, maxVisible);
  }, [options, query, maxVisible]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="w-full flex items-center gap-2 bg-panel2 hover:bg-panel rounded px-2 py-1.5 text-left text-sm border border-transparent focus:border-accent"
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <>
            {selected.spriteUrl && (
              <img src={selected.spriteUrl} alt="" className="w-6 h-6 object-contain" loading="lazy" />
            )}
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <span className="ml-auto text-slate-500">▾</span>
      </button>
      {open && (
        <div className={dropdownClassName ?? "absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-panel border border-panel2 rounded shadow-xl scrollbar-thin"}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 bg-panel2 text-sm outline-none border-b border-panel2 sticky top-0"
          />
          {selected && (
            <button
              className="w-full text-left text-xs px-2 py-1 text-slate-400 hover:bg-panel2"
              onClick={() => {
                onChange(null, null);
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          )}
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-sm text-slate-400">{emptyHint}</div>
          )}
          {filtered.map((o) => (
            <button
              key={o.key}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-panel2"
              onClick={() => {
                onChange(o.value, o);
                setOpen(false);
                setQuery('');
              }}
            >
              {renderOption ? (
                renderOption(o)
              ) : (
                <>
                  {o.spriteUrl && (
                    <img src={o.spriteUrl} alt="" className="w-6 h-6 object-contain" loading="lazy" />
                  )}
                  <span className="truncate">{o.label}</span>
                  {o.group && <span className="ml-auto text-[10px] uppercase text-slate-400">{o.group}</span>}
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
