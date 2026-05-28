import { Suggestion } from '../../hooks/useSuggestions';
import { TypeBadge } from '../TypeBadge/TypeBadge';

interface Props {
  suggestions: Suggestion[];
  mixedMovesNote: boolean;
  onApply?: (s: Suggestion) => void;
}

export function SuggestionPanel({ suggestions, mixedMovesNote, onApply }: Props) {
  if (suggestions.length === 0) {
    return <div className="text-sm text-slate-400">No suggestions available.</div>;
  }
  const allZero = suggestions.every((s) => s.gain === 0);
  return (
    <div className="flex flex-col gap-3">
      {mixedMovesNote && (
        <div className="text-xs text-amber-300 bg-amber-900/30 rounded p-2">
          Some Pokémon have no moves entered — using type-based coverage for those slots.
        </div>
      )}
      {allZero && (
        <div className="text-sm text-slate-300">
          Your team coverage is solid. These are alternatives with similar coverage or less overlap:
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-panel rounded p-3 flex flex-col gap-2 border border-panel2">
            <div className="flex items-center gap-2">
              {s.spriteUrl && <img src={s.spriteUrl} alt="" className="w-12 h-12 object-contain" />}
              <div className="flex flex-col">
                <div className="font-semibold">{s.candidateLabel}</div>
                <div className="flex gap-1 mt-1">
                  {s.types[0] && <TypeBadge type={s.types[0]} />}
                  {s.types[1] && <TypeBadge type={s.types[1]} />}
                </div>
              </div>
            </div>
            <div className="text-xs">
              {s.kind === 'add' ? (
                <span className="text-slate-300">Add to team</span>
              ) : (
                <span className="text-slate-300">
                  Replaces: <strong>{s.replacesName}</strong>
                </span>
              )}
            </div>
            <div className="text-xs">
              {s.newlyCovered.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-400">New types covered:</span>
                  {s.newlyCovered.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              ) : (
                <span className="text-slate-400">No new types — reduces overlap.</span>
              )}
            </div>
            {onApply && (
              <button
                className="text-xs px-2 py-1 bg-accent rounded self-end hover:bg-violet-500"
                onClick={() => onApply(s)}
              >
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
