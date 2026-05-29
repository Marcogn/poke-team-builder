import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KNOWN_ABILITIES_WITH_EFFECTS, normalizeAbilityName, ABILITY_EFFECTS } from '../../data/abilityEffects';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Filterable dropdown for abilities. Shows known abilities with coverage
 * effects, plus allows free-text entry for rom-hack compatibility.
 */
export function AbilityDropdown({ value, onChange, placeholder }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || value).trim().toLowerCase();
    if (!q) return KNOWN_ABILITIES_WITH_EFFECTS;
    return KNOWN_ABILITIES_WITH_EFFECTS.filter((a) => a.includes(q));
  }, [query, value]);

  function hasEffect(ability: string): 'coverage' | 'display-only' | null {
    const slug = normalizeAbilityName(ability);
    const effects = ABILITY_EFFECTS[slug];
    if (!effects) return null;
    if (effects.some((e) => e.kind === 'badge-only')) return 'display-only';
    return 'coverage';
  }

  function selectAbility(ability: string) {
    onChange(ability);
    setQuery('');
    setOpen(false);
    setHighlightIndex(-1);
  }

  function handleInputChange(val: string) {
    setQuery(val);
    onChange(val);
    if (!open) setOpen(true);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        selectAbility(filtered[highlightIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-ability-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  return (
    <div className="relative flex-1" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={open && query !== '' ? query : value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t('slot.abilityPlaceholder')}
        className="w-full bg-panel2 rounded px-2 py-1 text-xs"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto bg-panel border border-panel2 rounded shadow-xl scrollbar-thin"
        >
          {filtered.map((ability, idx) => {
            const effect = hasEffect(ability);
            return (
              <button
                key={ability}
                data-ability-item
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-panel2 ${
                  idx === highlightIndex ? 'bg-panel2' : ''
                }`}
                onClick={() => selectAbility(ability)}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span className="truncate capitalize">{ability}</span>
                {effect === 'coverage' && (
                  <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-emerald-700 text-white whitespace-nowrap">
                    {t('slot.coverageEffect')}
                  </span>
                )}
                {effect === 'display-only' && (
                  <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-purple-700 text-white whitespace-nowrap">
                    {t('slot.displayOnly')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
