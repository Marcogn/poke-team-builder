#!/usr/bin/env node

/**
 * Build-time script to generate pre-compiled Pokémon data JSON.
 *
 * Usage: node scripts/generate-pokemon-data.mjs
 *
 * Requires Node.js 18+ (uses built-in fetch).
 * Writes to: src/data/pokemon-data.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'pokemon-data.json');

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;
const RETRY_DELAY_MS = 1000;

/**
 * NOTE: The runtime hook (usePokemonData.ts) uses the static GitHub mirror
 * (raw.githubusercontent.com/PokeAPI/api-data) with 50-item batches and 50ms
 * delays. This generation script intentionally uses the live PokeAPI endpoint
 * with smaller batches (20) and longer delays (200ms) because:
 * - It runs once offline, not in the browser on every first visit
 * - The live API returns data by name (simpler URL construction)
 * - The static mirror uses numeric IDs requiring an extra index lookup
 * The output format is identical regardless of data source.
 */

const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

// --- Utilities ---

function prettify(name) {
  return name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function fetchWithRetry(url) {
  try {
    return await fetchJson(url);
  } catch (err) {
    console.warn(`  Retrying ${url} after error: ${err.message}`);
    await sleep(RETRY_DELAY_MS);
    try {
      return await fetchJson(url);
    } catch (err2) {
      console.warn(`  Skipping ${url}: ${err2.message}`);
      return null;
    }
  }
}

async function processInBatches(items, worker, label) {
  const results = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(slice.map((item, j) => worker(item, i + j)));
    results.push(...batchResults);
    const done = Math.min(i + BATCH_SIZE, items.length);
    console.log(`Fetching ${label} ${done}/${items.length}...`);
    if (i + BATCH_SIZE < items.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return results;
}

function extractIdFromUrl(url) {
  if (!url) return null;
  const last = url.split('/').filter(Boolean).pop();
  return last && /^\d+$/.test(last) ? last : null;
}

function collectFinalEvolutions(node, out) {
  if (!node.evolves_to || node.evolves_to.length === 0) {
    out.add(node.species.name);
    return;
  }
  for (const child of node.evolves_to) collectFinalEvolutions(child, out);
}

// --- Main generation logic ---

async function generate() {
  console.log('Starting Pokémon data generation...\n');

  // 1. Fetch full Pokémon list
  console.log('Fetching Pokémon list...');
  const listData = await fetchJson(`${POKEAPI_BASE}/pokemon?limit=10000&offset=0`);
  const pokemonList = listData.results; // { name, url }[]
  console.log(`Found ${pokemonList.length} Pokémon.\n`);

  // 2. Fetch Pokémon details
  const pokemonRaw = [];
  const results = await processInBatches(pokemonList, async (entry) => {
    const data = await fetchWithRetry(entry.url);
    return data;
  }, 'pokemon');

  for (const p of results) {
    if (p) pokemonRaw.push(p);
  }
  console.log(`\nFetched ${pokemonRaw.length} Pokémon details.\n`);

  // 3. Fetch species data
  const speciesIdByName = new Map();
  for (const p of pokemonRaw) {
    if (!speciesIdByName.has(p.species.name)) {
      const id = extractIdFromUrl(p.species.url);
      if (id) speciesIdByName.set(p.species.name, id);
    }
  }

  const speciesEntries = Array.from(speciesIdByName.entries());
  const speciesFlags = new Map();
  const evoChainUrls = new Set();

  await processInBatches(speciesEntries, async ([name, id]) => {
    const data = await fetchWithRetry(`${POKEAPI_BASE}/pokemon-species/${id}`);
    if (data) {
      speciesFlags.set(name, {
        legendary: data.is_legendary,
        mythical: data.is_mythical,
      });
      if (data.evolution_chain?.url) {
        evoChainUrls.add(data.evolution_chain.url);
      }
    }
  }, 'species');

  console.log(`\nFetched ${speciesFlags.size} species.\n`);

  // 4. Fetch evolution chains
  const chainList = Array.from(evoChainUrls);
  const finalEvolutions = new Set();

  await processInBatches(chainList, async (url) => {
    const data = await fetchWithRetry(url);
    if (data?.chain) {
      collectFinalEvolutions(data.chain, finalEvolutions);
    }
  }, 'evolution-chains');

  console.log(`\nFound ${finalEvolutions.size} final evolutions.\n`);

  if (finalEvolutions.size === 0) {
    throw new Error(
      'No final evolutions found — evolution chain fetches likely all failed. ' +
      'Cannot generate valid data without evolution information.',
    );
  }

  // 5. Fetch type chart
  console.log('Fetching type chart...');
  const typeChart = {};
  for (const a of POKEMON_TYPES) {
    typeChart[a] = {};
    for (const b of POKEMON_TYPES) typeChart[a][b] = 1;
  }

  const typeResults = await processInBatches(
    POKEMON_TYPES,
    async (typeName) => {
      const data = await fetchWithRetry(`${POKEAPI_BASE}/type/${typeName}`);
      return { typeName, data };
    },
    'types',
  );

  for (const { typeName, data } of typeResults) {
    if (!data?.damage_relations) continue;
    for (const x of data.damage_relations.double_damage_to) {
      if (typeChart[typeName]) typeChart[typeName][x.name] = 2;
    }
    for (const x of data.damage_relations.half_damage_to) {
      if (typeChart[typeName]) typeChart[typeName][x.name] = 0.5;
    }
    for (const x of data.damage_relations.no_damage_to) {
      if (typeChart[typeName]) typeChart[typeName][x.name] = 0;
    }
  }
  console.log('Type chart complete.\n');

  // 6. Fetch move list
  console.log('Fetching move list...');
  const moveListData = await fetchJson(`${POKEAPI_BASE}/move?limit=10000&offset=0`);
  const moveList = moveListData.results; // { name, url }[]
  console.log(`Found ${moveList.length} moves.\n`);

  // 7. Fetch move details
  const movesRaw = [];
  const moveResults = await processInBatches(moveList, async (entry) => {
    const data = await fetchWithRetry(entry.url);
    return data;
  }, 'moves');

  for (const m of moveResults) {
    if (m) {
      movesRaw.push({
        id: m.id,
        name: m.name,
        displayName: prettify(m.name),
        type: m.type.name,
        power: m.power,
        damageClass: m.damage_class.name,
      });
    }
  }
  console.log(`\nFetched ${movesRaw.length} move details.\n`);

  const moves = movesRaw.sort((a, b) => a.id - b.id);

  // --- Assemble output ---
  const pokemon = pokemonRaw
    .map((p) => {
      const types = p.types
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.type.name);

      const flags = speciesFlags.get(p.species.name);

      // Extract default ability (first non-hidden ability)
      const defaultAbility = p.abilities
        ?.slice()
        .sort((a, b) => a.slot - b.slot)
        .find((a) => !a.is_hidden)
        ?.ability?.name ?? null;

      return {
        id: p.id,
        name: p.name,
        displayName: prettify(p.name),
        speciesName: p.species.name,
        types: [types[0] ?? 'normal', types[1] ?? null],
        spriteHome: p.sprites?.other?.home?.front_default ?? null,
        spriteArtwork: p.sprites?.other?.['official-artwork']?.front_default ?? null,
        spriteDefault: p.sprites?.front_default ?? null,
        isLegendary: flags?.legendary ?? false,
        isMythical: flags?.mythical ?? false,
        isFinalEvolution: finalEvolutions.has(p.species.name),
        defaultAbility,
      };
    })
    .sort((a, b) => a.id - b.id);

  const output = {
    generatedAt: new Date().toISOString(),
    version: 3,
    pokemon,
    moves,
    typeChart,
  };

  // Write output
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  const fileSize = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(2);
  console.log(`\nDone. ${pokemon.length} pokemon, ${moves.length} moves written to ${OUTPUT_PATH} (${fileSize} MB)`);
}

generate().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
