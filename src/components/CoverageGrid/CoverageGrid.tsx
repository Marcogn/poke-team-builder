import { POKEMON_TYPES, PokemonType, TeamMember, TypeChart } from '../../types';
import { defensiveProfile, sharedWeaknesses } from '../../utils/coverageEngine';
import { TypeBadge } from '../TypeBadge/TypeBadge';

interface Props {
  chart: TypeChart;
  members: TeamMember[];
}

function cellClass(mult: number): string {
  if (mult === 0) return 'bg-red-700/70 text-white';
  if (mult >= 2) return 'bg-emerald-600/70 text-white';
  if (mult > 0 && mult < 1) return 'bg-orange-600/70 text-white';
  return 'bg-panel2 text-slate-300';
}

export function CoverageGrid({ chart, members }: Props) {
  // Offensive grid: rows = members, columns = defending types.
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="font-semibold mb-2">Offensive Coverage</h3>
        <div className="overflow-auto scrollbar-thin">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left sticky left-0 bg-bg">Pokémon</th>
                {POKEMON_TYPES.map((t) => (
                  <th key={t} className="px-1 py-1">
                    <TypeBadge type={t} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const attackingTypes = collectAttackingTypes(m);
                return (
                  <tr key={m.id}>
                    <td className="px-2 py-1 sticky left-0 bg-bg whitespace-nowrap">{m.speciesName}</td>
                    {POKEMON_TYPES.map((def) => {
                      let best = 0;
                      for (const atk of attackingTypes) {
                        const v = chart[atk]?.[def] ?? 1;
                        if (v > best) best = v;
                      }
                      return (
                        <td key={def} className={`px-1 py-1 text-center ${cellClass(best)}`}>
                          {best === 0 ? '0' : best.toString().replace(/\.0$/, '')}x
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="px-2 py-1 sticky left-0 bg-bg">Team best</td>
                {POKEMON_TYPES.map((def) => {
                  let best = 0;
                  for (const m of members) {
                    for (const atk of collectAttackingTypes(m)) {
                      const v = chart[atk]?.[def] ?? 1;
                      if (v > best) best = v;
                    }
                  }
                  return (
                    <td key={def} className={`px-1 py-1 text-center ${cellClass(best)}`}>
                      {best === 0 ? '0' : best.toString().replace(/\.0$/, '')}x
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Defensive Profiles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {members.map((m) => {
            const dp = defensiveProfile(chart, m.types);
            return (
              <div key={m.id} className="bg-panel rounded p-2 text-xs flex flex-col gap-1">
                <div className="font-semibold">{m.speciesName}</div>
                <Row label="Weak" types={dp.weaknesses} />
                <Row label="Resists" types={dp.resistances} />
                <Row label="Immune" types={dp.immunities} />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Shared Weaknesses</h3>
        <div className="flex flex-wrap gap-1">
          {sharedWeaknesses(chart, members).map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
          {sharedWeaknesses(chart, members).length === 0 && (
            <span className="text-xs text-slate-400">None — your team has no overlapping weaknesses.</span>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, types }: { label: string; types: PokemonType[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-slate-400 w-14">{label}:</span>
      {types.length === 0 ? (
        <span className="text-slate-500">—</span>
      ) : (
        types.map((t) => <TypeBadge key={t} type={t} />)
      )}
    </div>
  );
}

function collectAttackingTypes(m: TeamMember): PokemonType[] {
  const damaging = m.moves.filter(
    (mv) => mv && mv.damageClass !== 'status' && (mv.power ?? 0) > 0,
  );
  if (damaging.length > 0) return damaging.map((mv) => (mv as { type: PokemonType }).type);
  return [m.types[0], ...(m.types[1] ? [m.types[1]] : [])];
}
