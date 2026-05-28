import { useCallback, useEffect, useState } from 'react';
import {
  MoveEntry,
  POKEMON_TYPES,
  PokemonEntry,
  PokemonType,
  TypeChart,
} from '../types';

/**
 * All PokéAPI data lives under a single, independent storage key.
 * User data (teams, custom roster) is stored under `teamdex_userdata`
 * in App.tsx and is never touched by the cache-reset action.
 */
const POKEAPI_CACHE_KEY = 'teamdex_pokeapi_cache';

interface PokeApiCache {
  version: number;
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  chart: TypeChart;
}
const CACHE_VERSION = 2;

const POKEAPI = 'https://pokeapi.co/api/v2';

export interface PokeDataState {
  pokemon: PokemonEntry[];
  moves: MoveEntry[];
  typeChart: TypeChart | null;
  loading: boolean;
  progress: { stage: string; current: number; total: number };
  error: string | null;
}

function loadCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveCache(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch failed: ${url}`);
  return (await r.json()) as T;
}

function prettify(name: string): string {
  return name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('-');
}

export function usePokemonData() {
  const [state, setState] = useState<PokeDataState>({
    pokemon: [],
    moves: [],
    typeChart: null,
    loading: true,
    progress: { stage: 'init', current: 0, total: 0 },
    error: null,
  });

  const resetCache = useCallback(() => {
    // Only clear the PokéAPI cache domain — never touch user data.
    localStorage.removeItem(POKEAPI_CACHE_KEY);
    window.location.reload();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Try cache first.
      const cached = loadCache<PokeApiCache>(POKEAPI_CACHE_KEY);
      if (cached && cached.version === CACHE_VERSION) {
        setState({
          pokemon: cached.pokemon,
          moves: cached.moves,
          typeChart: cached.chart,
          loading: false,
          progress: { stage: 'done', current: 1, total: 1 },
          error: null,
        });
        return;
      }

      try {
        // Type chart
        setState((s) => ({ ...s, progress: { stage: 'types', current: 0, total: 18 } }));
        const chart = buildEmptyChart();
        for (let i = 0; i < POKEMON_TYPES.length; i++) {
          const t = POKEMON_TYPES[i];
          const data = await jget<{
            damage_relations: {
              double_damage_to: { name: string }[];
              half_damage_to: { name: string }[];
              no_damage_to: { name: string }[];
            };
          }>(`${POKEAPI}/type/${t}`);
          for (const x of data.damage_relations.double_damage_to) chart[t][x.name as PokemonType] = 2;
          for (const x of data.damage_relations.half_damage_to) chart[t][x.name as PokemonType] = 0.5;
          for (const x of data.damage_relations.no_damage_to) chart[t][x.name as PokemonType] = 0;
          if (cancelled) return;
          setState((s) => ({ ...s, progress: { stage: 'types', current: i + 1, total: 18 } }));
        }

        // Pokémon: full list of forms (PokéAPI /pokemon endpoint lists default + alternate forms)
        setState((s) => ({ ...s, progress: { stage: 'pokemon-list', current: 0, total: 1 } }));
        const list = await jget<{ results: { name: string; url: string }[] }>(
          `${POKEAPI}/pokemon?limit=100000`,
        );
        const total = list.results.length;

        // Species cache for legendary/mythical/evolution flags
        const speciesFlags = new Map<string, { legendary: boolean; mythical: boolean; evoChainUrl: string }>();
        // Fetch each Pokémon — we use limited parallelism.
        const pokemon: PokemonEntry[] = [];
        const CONCURRENCY = 24;
        let done = 0;
        let idx = 0;
        async function worker() {
          while (idx < list.results.length) {
            const i = idx++;
            const entry = list.results[i];
            try {
              const p = await jget<{
                id: number;
                name: string;
                sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } };
                types: { slot: number; type: { name: string } }[];
                species: { name: string; url: string };
              }>(entry.url);

              const types: PokemonType[] = p.types
                .sort((a, b) => a.slot - b.slot)
                .map((t) => t.type.name as PokemonType);
              const sprite =
                p.sprites.other?.['official-artwork']?.front_default ?? p.sprites.front_default ?? null;

              let legendary = false;
              let mythical = false;
              let evoUrl = '';
              const cached = speciesFlags.get(p.species.name);
              if (cached) {
                legendary = cached.legendary;
                mythical = cached.mythical;
                evoUrl = cached.evoChainUrl;
              } else {
                try {
                  const sp = await jget<{
                    is_legendary: boolean;
                    is_mythical: boolean;
                    evolution_chain: { url: string };
                  }>(p.species.url);
                  legendary = sp.is_legendary;
                  mythical = sp.is_mythical;
                  evoUrl = sp.evolution_chain?.url ?? '';
                  speciesFlags.set(p.species.name, { legendary, mythical, evoChainUrl: evoUrl });
                } catch {
                  // ignore species fetch failures
                }
              }

              pokemon.push({
                id: p.id,
                name: p.name,
                displayName: prettify(p.name),
                speciesName: p.species.name,
                types: [types[0] ?? 'normal', (types[1] as PokemonType | undefined) ?? null],
                spriteUrl: sprite,
                isLegendary: legendary,
                isMythical: mythical,
                isFinalEvolution: true, // resolved below
              });
            } catch {
              // skip failures
            }
            done++;
            if (done % 25 === 0 || done === total) {
              setState((s) => ({ ...s, progress: { stage: 'pokemon', current: done, total } }));
            }
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
        if (cancelled) return;

        // Evolution chains: resolve "final evolution" flag from unique chains.
        const uniqueChains = Array.from(new Set(Array.from(speciesFlags.values()).map((v) => v.evoChainUrl))).filter(Boolean);
        const finalEvolutionSpecies = new Set<string>();
        setState((s) => ({ ...s, progress: { stage: 'evolutions', current: 0, total: uniqueChains.length } }));
        let evoDone = 0;
        async function evoWorker(urls: string[]) {
          for (const url of urls) {
            try {
              const chain = await jget<{ chain: EvoNode }>(url);
              collectFinalEvolutions(chain.chain, finalEvolutionSpecies);
            } catch {
              // ignore
            }
            evoDone++;
            if (evoDone % 25 === 0) {
              setState((s) => ({ ...s, progress: { stage: 'evolutions', current: evoDone, total: uniqueChains.length } }));
            }
          }
        }
        const slice = Math.ceil(uniqueChains.length / 8);
        await Promise.all(
          Array.from({ length: 8 }, (_, k) => evoWorker(uniqueChains.slice(k * slice, (k + 1) * slice))),
        );
        for (const p of pokemon) {
          p.isFinalEvolution = finalEvolutionSpecies.size === 0 ? true : finalEvolutionSpecies.has(p.speciesName);
        }
        pokemon.sort((a, b) => a.id - b.id);

        // Moves list (light): name + url; details fetched in batch
        setState((s) => ({ ...s, progress: { stage: 'moves-list', current: 0, total: 1 } }));
        const moveList = await jget<{ results: { name: string; url: string }[] }>(`${POKEAPI}/move?limit=100000`);
        const moves: MoveEntry[] = [];
        let mdone = 0;
        let midx = 0;
        async function moveWorker() {
          while (midx < moveList.results.length) {
            const i = midx++;
            const r = moveList.results[i];
            try {
              const m = await jget<{
                id: number;
                name: string;
                power: number | null;
                type: { name: string };
                damage_class: { name: 'physical' | 'special' | 'status' };
              }>(r.url);
              moves.push({
                id: m.id,
                name: m.name,
                displayName: prettify(m.name),
                type: m.type.name as PokemonType,
                power: m.power,
                damageClass: m.damage_class.name,
              });
            } catch {
              // ignore
            }
            mdone++;
            if (mdone % 25 === 0 || mdone === moveList.results.length) {
              setState((s) => ({ ...s, progress: { stage: 'moves', current: mdone, total: moveList.results.length } }));
            }
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, () => moveWorker()));
        if (cancelled) return;
        moves.sort((a, b) => a.displayName.localeCompare(b.displayName));
        saveCache(POKEAPI_CACHE_KEY, {
          version: CACHE_VERSION,
          pokemon,
          moves,
          chart,
        } satisfies PokeApiCache);

        setState({
          pokemon,
          moves,
          typeChart: chart,
          loading: false,
          progress: { stage: 'done', current: 1, total: 1 },
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, resetCache };
}

interface EvoNode {
  species: { name: string };
  evolves_to: EvoNode[];
}

function collectFinalEvolutions(node: EvoNode, out: Set<string>) {
  if (!node.evolves_to || node.evolves_to.length === 0) {
    out.add(node.species.name);
    return;
  }
  for (const child of node.evolves_to) collectFinalEvolutions(child, out);
}

function buildEmptyChart(): TypeChart {
  const chart = {} as TypeChart;
  for (const a of POKEMON_TYPES) {
    chart[a] = {} as Record<PokemonType, number>;
    for (const b of POKEMON_TYPES) chart[a][b] = 1;
  }
  return chart;
}
